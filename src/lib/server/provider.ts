import { realtimeSessionConfiguration } from "./prompt";
import { PublicError } from "./security";

export type CreatedCall = { callId: string; sdp: string };
export class RejectedCallError extends PublicError {}

export async function hangupCall(callId: string): Promise<void> {
  if (!/^rtc_[A-Za-z0-9_-]{5,200}$/.test(callId)) throw new PublicError("The session could not be closed.", 503);
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new PublicError("The session could not be closed yet. Its scheduled close remains active.", 503);
}

export async function createCall(sdp: string, safetyIdentifier: string): Promise<CreatedCall> {
  const body = new FormData();
  body.set("sdp", sdp);
  body.set("session", JSON.stringify(realtimeSessionConfiguration()));
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Safety-Identifier": safetyIdentifier },
      body,
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new PublicError("The AI connection could not be confirmed. It was not retried automatically.", 503);
  }
  if (!response.ok) {
    void response.body?.cancel();
    const ErrorType = [400, 401, 403, 404, 429].includes(response.status) ? RejectedCallError : PublicError;
    throw new ErrorType(response.status === 429 ? "The live AI allowance is temporarily unavailable. Please try again later." : "The AI service could not open this session. Please try again later.", response.status === 429 ? 429 : 503);
  }
  const location = response.headers.get("location");
  let callId: string | undefined;
  try {
    const url = new URL(location ?? "", "https://api.openai.com");
    if (url.origin === "https://api.openai.com" && !url.username && !url.password && !url.search && !url.hash) callId = url.pathname.match(/^\/v1\/realtime\/calls\/(rtc_[A-Za-z0-9_-]{5,200})$/)?.[1];
  } catch {}
  if (!callId) throw new PublicError("The AI connection could not be verified. Please try again later.", 503);
  try {
    const answer = await response.text();
    if (!answer.startsWith("v=0") || answer.length > 32_768) throw new Error("Invalid SDP answer");
    return { callId, sdp: answer };
  } catch {
    try { await hangupCall(callId); } catch {}
    throw new PublicError("The AI connection could not be verified. Please try again later.", 503);
  }
}
