import { sleep } from "workflow";

export async function scheduledSessionClose(sessionId: string, callId: string, expiresAt: number) {
  "use workflow";
  await sleep(new Date(expiresAt));
  await stopProviderCall(callId);
  await settleClosedSession(sessionId);
}

async function stopProviderCall(callId: string) {
  "use step";
  const { hangupCall } = await import("../lib/server/provider");
  try {
    await hangupCall(callId);
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
