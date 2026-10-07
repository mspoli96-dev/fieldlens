import { randomUUID } from "node:crypto";
import { checkBotId } from "botid/server";
import { start } from "workflow/api";
import { z } from "zod";
import { scheduledSessionClose } from "../../workflows/close-session";
import { hostedEnvironment, liveEnabled, maxSessionSeconds, publicSessionConfig } from "./config";
import { assertOrigin, newVisitor, PublicError, readBoundedJson, visitorFromRequest } from "./security";
import { createSessionStore, type SessionStore } from "./store";
import { createCall, hangupCall, RejectedCallError, type CreatedCall } from "./provider";
import { closeSession } from "./lifecycle";

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const startSchema = z.strictObject({ sdp: z.string().min(5).max(24_576).startsWith("v=0"), consent: z.literal(true) });
const endSchema = z.strictObject({ sessionId: z.string().uuid() });

export type SessionDependencies = {
  store: () => SessionStore;
  create: (sdp: string, identifier: string) => Promise<CreatedCall>;
  hangup: (callId: string) => Promise<void>;
  schedule: (sessionId: string, callId: string, expiresAt: number) => Promise<void>;
  verifyBrowser: () => Promise<boolean>;
};

const dependencies: SessionDependencies = {
  store: createSessionStore,
  create: createCall,
  hangup: hangupCall,
  async schedule(id, callId, expiresAt) { await start(scheduledSessionClose, [id, callId, expiresAt]); },
  async verifyBrowser() {
    const result = await checkBotId({ advancedOptions: { checkLevel: "basic" } });
    return result?.isBot === false && result.bypassed === false;
  },
};

function errorResponse(error: unknown, cookie?: string): Response {
  const known = error instanceof PublicError;
  return Response.json({ error: known ? error.message : "Live assistance is temporarily unavailable. Please try again later." }, { status: known ? error.status : 503, headers: { ...noStore, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}

export function configResponse(request: Request): Response {
  const config = publicSessionConfig();
  let cookie: string | undefined;
  if (config.liveEnabled && !visitorFromRequest(request)) cookie = newVisitor(request).cookie;
  return Response.json(config, { headers: { ...noStore, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}

export async function startSession(request: Request, services: SessionDependencies = dependencies): Promise<Response> {
  let cookie: string | undefined;
  try {
    if (!liveEnabled()) throw new PublicError("Live AI is not enabled for this deployment. You can explore the bench.", 503);
    assertOrigin(request);
    const parsed = startSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) throw new PublicError("Provide a valid connection offer and confirm AI processing.", 400);
    if (hostedEnvironment()) {
      let verified = false;
      try { verified = await services.verifyBrowser(); } catch { throw new PublicError("Browser verification is temporarily unavailable.", 503); }
      if (!verified) throw new PublicError("Browser verification failed. Refresh the page and try again.", 403);
    }
    let visitorId = visitorFromRequest(request);
    if (!visitorId) { const visitor = newVisitor(request); visitorId = visitor.id; cookie = visitor.cookie; }
    const sessionId = randomUUID();
    const store = services.store();
    await store.reserve(visitorId, sessionId);
    let call: CreatedCall | undefined;
    try {
      call = await services.create(parsed.data.sdp, visitorId);
      const expiresAt = Date.now() + maxSessionSeconds() * 1000;
      await store.save({ id: sessionId, visitorId, callId: call.callId, expiresAt, status: "active" });
      await services.schedule(sessionId, call.callId, expiresAt);
      return Response.json({ sdp: call.sdp, sessionId, expiresAt }, { headers: { ...noStore, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
    } catch (error) {
      if (call) {
        try {
          await services.hangup(call.callId);
          await store.release(visitorId, sessionId);
        } catch {}
      } else if (error instanceof RejectedCallError) {
        try { await store.release(visitorId, sessionId); } catch {}
      }
      throw error;
    }
  } catch (error) { return errorResponse(error, cookie); }
}

export async function endSession(request: Request, services: SessionDependencies = dependencies): Promise<Response> {
  try {
    assertOrigin(request);
    const parsed = endSchema.safeParse(await readBoundedJson(request, 1_024));
    if (!parsed.success) throw new PublicError("The session identifier is invalid.", 400);
    const visitorId = visitorFromRequest(request);
    if (!visitorId) throw new PublicError("This browser cannot close that session.", 403);
    const store = services.store();
    const record = await store.get(parsed.data.sessionId);
    if (!record || record.visitorId !== visitorId) throw new PublicError("This browser cannot close that session.", 403);
    await closeSession(record.id, store, services.hangup);
    return Response.json({ ended: true }, { headers: noStore });
  } catch (error) { return errorResponse(error); }
}
