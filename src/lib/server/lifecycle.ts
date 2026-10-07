import { createSessionStore, type SessionStore } from "./store";
import { hangupCall } from "./provider";

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
