import { sleep } from "workflow";

export async function scheduledSessionClose(sessionId: string, callId: string, expiresAt: number) {
  "use workflow";
  await sleep(new Date(expiresAt));
  await stopProviderCall(sessionId, callId);
  await settleClosedSession(sessionId);
}

async function stopProviderCall(sessionId: string, callId: string) {
  "use step";
  const { closeProviderSession } = await import("../lib/server/lifecycle");
  try {
    await closeProviderSession(sessionId, callId);
  } catch {
    throw new Error("The scheduled session close could not be confirmed.");
  }
}

async function settleClosedSession(sessionId: string) {
  "use step";
  const { recordClosedSession } = await import("../lib/server/lifecycle");
  try {
    await recordClosedSession(sessionId);
  } catch {
    throw new Error("The closed session admission record could not be updated.");
  }
}
