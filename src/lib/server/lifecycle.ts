import { createSessionStore, type SessionStore } from "./store";
import { hangupCall } from "./provider";

export async function closeProviderSession(sessionId: string, callId: string, store?: Pick<SessionStore, "get">, hangup: (callId: string) => Promise<void> = hangupCall): Promise<void> {
  async function alreadyClosed(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const record = await Promise.race([
        (store ?? createSessionStore()).get(sessionId),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2_000); }),
      ]);
      return record?.id === sessionId && record.callId === callId && record.status === "ended";
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  if (await alreadyClosed()) return;
  try {
    await hangup(callId);
  } catch (error) {
    if (await alreadyClosed()) return;
    throw error;
  }
}

export async function closeSession(sessionId: string, store: SessionStore = createSessionStore(), hangup: (callId: string) => Promise<void> = hangupCall): Promise<void> {
  const record = await store.get(sessionId);
  if (!record) throw new Error("Session closure state is unavailable.");
  if (record.status !== "ended") {
    await hangup(record.callId);
    await store.save({ ...record, status: "ended" });
  }
  await store.release(record.visitorId, record.id);
}

export async function recordClosedSession(sessionId: string, store: SessionStore = createSessionStore()): Promise<void> {
  const record = await store.get(sessionId);
  if (!record) return;
  if (record.status !== "ended") await store.save({ ...record, status: "ended" });
  await store.release(record.visitorId, record.id);
}
