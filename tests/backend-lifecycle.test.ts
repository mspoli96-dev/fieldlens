import { afterEach, describe, expect, it, vi } from "vitest";
import { closeProviderSession } from "../src/lib/server/lifecycle";
import type { SessionRecord } from "../src/lib/server/store";

const record: SessionRecord = { id: "b4e138c4-5998-4320-ae57-89c47cd89855", visitorId: "f2b729ce-e42c-4202-b552-86e54f57fc82", callId: "rtc_example_call", expiresAt: 2_000_000_000_000, status: "active" };
afterEach(() => vi.useRealTimers());

describe("idempotent provider session closure", () => {
  it("does not hang up again when the matching session was already confirmed ended", async () => {
    const get = vi.fn().mockResolvedValue({ ...record, status: "ended" });
    const hangup = vi.fn(async () => {});
    await closeProviderSession(record.id, record.callId, { get }, hangup);
    expect(hangup).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith(record.id);
  });

  it("does not accept an ended record for a different provider call or session", async () => {
    const hangup = vi.fn(async () => {});
    for (const altered of [{ ...record, status: "ended", callId: "rtc_other_call" }, { ...record, status: "ended", id: "another-session" }]) {
      await closeProviderSession(record.id, record.callId, { get: vi.fn().mockResolvedValue(altered) }, hangup);
    }
    expect(hangup).toHaveBeenCalledTimes(2);
    expect(hangup).toHaveBeenCalledWith(record.callId);
  });

  it("still closes the provider when Redis is unavailable", async () => {
    const hangup = vi.fn(async () => {});
    await closeProviderSession(record.id, record.callId, { get: vi.fn().mockRejectedValue(new Error("Redis unavailable")) }, hangup);
    expect(hangup).toHaveBeenCalledOnce();
  });

  it("bounds a stalled Redis lookup before closing the provider", async () => {
    vi.useFakeTimers();
    const hangup = vi.fn(async () => {});
    const closing = closeProviderSession(record.id, record.callId, { get: vi.fn(() => new Promise<SessionRecord | null>(() => {})) }, hangup);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(hangup).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await closing;
    expect(hangup).toHaveBeenCalledOnce();
  });

  it("accepts a concurrently confirmed manual close after a provider rejection", async () => {
    const get = vi.fn().mockResolvedValueOnce(record).mockResolvedValueOnce({ ...record, status: "ended" });
    const hangup = vi.fn().mockRejectedValue(new Error("Call no longer active"));
    await expect(closeProviderSession(record.id, record.callId, { get }, hangup)).resolves.toBeUndefined();
    expect(hangup).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not turn an unconfirmed provider failure into a successful close", async () => {
    const get = vi.fn().mockResolvedValue(record);
    const failure = new Error("Close unconfirmed");
    await expect(closeProviderSession(record.id, record.callId, { get }, vi.fn().mockRejectedValue(failure))).rejects.toBe(failure);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
