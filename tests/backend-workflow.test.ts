import { describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { scheduledSessionClose } from "../src/workflows/close-session";
import { closeProviderSession, recordClosedSession } from "../src/lib/server/lifecycle";

vi.mock("workflow", () => ({ sleep: vi.fn(async () => {}) }));
vi.mock("../src/lib/server/lifecycle", () => ({ closeProviderSession: vi.fn(async () => {}), recordClosedSession: vi.fn(async () => {}) }));

describe("durable scheduled closure", () => {
  it("closes OpenAI independently of unavailable admission storage", async () => {
    const order: string[] = [];
    vi.mocked(closeProviderSession).mockImplementationOnce(async () => { order.push("hangup"); });
    vi.mocked(recordClosedSession).mockImplementationOnce(async () => { order.push("store"); throw new Error("Redis unavailable"); });
    const expiresAt = Date.now() + 120_000;
    await expect(scheduledSessionClose("opaque-session", "rtc_example_call", expiresAt)).rejects.toThrow("admission record");
    expect(sleep).toHaveBeenCalledWith(new Date(expiresAt));
    expect(order).toEqual(["hangup", "store"]);
    expect(closeProviderSession).toHaveBeenCalledWith("opaque-session", "rtc_example_call");
  });

  it("does not release admission when provider closure is unconfirmed", async () => {
    vi.mocked(recordClosedSession).mockClear();
    vi.mocked(closeProviderSession).mockRejectedValueOnce(new Error("network failure"));
    await expect(scheduledSessionClose("opaque-session", "rtc_example_call", Date.now())).rejects.toThrow("could not be confirmed");
    expect(recordClosedSession).not.toHaveBeenCalled();
  });
});
