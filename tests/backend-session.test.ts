import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configResponse, endSession, startSession, type SessionDependencies } from "../src/lib/server/session-handlers";
import { newVisitor, PublicError, readBoundedJson, visitorFromRequest } from "../src/lib/server/security";
import type { SessionRecord, SessionStore } from "../src/lib/server/store";
import { liveEnabled } from "../src/lib/server/config";
import { RejectedCallError } from "../src/lib/server/provider";

vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("workflow", () => ({ sleep: vi.fn() }));
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

const origin = "https://fieldlens.example";

function request(body: unknown = { sdp: "v=0\r\nsynthetic-offer", consent: true }, cookie?: string, originHeader = origin) {
  return new Request(`${origin}/api/session`, { method: "POST", headers: { "content-type": "application/json", origin: originHeader, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}

function fakeServices() {
  const records = new Map<string, SessionRecord>();
  let active: string | null = null;
  const store: SessionStore = {
    reserve: vi.fn(async (_visitor, id) => { if (active !== null) throw new PublicError("A session is already active.", 429); active = id; }),
    release: vi.fn(async (_visitor, id) => { if (active === id) active = null; }),
    save: vi.fn(async (record) => { records.set(record.id, record); }),
    get: vi.fn(async (id) => records.get(id) ?? null),
  };
  const services: SessionDependencies = {
    store: () => store,
    create: vi.fn(async () => ({ sdp: "v=0\r\nsynthetic-answer", callId: "rtc_test_call" })),
    hangup: vi.fn(async () => {}),
    schedule: vi.fn(async () => {}),
    verifyBrowser: vi.fn(async () => true),
  };
  return { services, store, records };
}

beforeEach(() => {
  const configuration = { NODE_ENV: "production", VERCEL: "1", FIELDLENS_LIVE_ENABLED: "true", OPENAI_API_KEY: "test-placeholder", OPENAI_PROJECT_HARD_LIMIT_CONFIRMED: "true", SESSION_SECRET: "test-only-secret-with-more-than-thirty-two-characters", UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "test-placeholder", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", WORKFLOW_ENABLED: "true", APP_ORIGIN: origin, VERCEL_BOTID_ENABLED: "true", VERCEL_RATE_LIMIT_CONFIRMED: "true", FIELDLENS_SESSION_SECONDS: "120", FIELDLENS_DAILY_SESSION_LIMIT: "20" };
  for (const [key, value] of Object.entries(configuration)) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("public session admission", () => {
  it("recognizes native Vercel Redis aliases when custom variables are empty", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "  ");
    vi.stubEnv("KV_REST_API_URL", "https://native-redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "native-test-placeholder");
    expect(liveEnabled()).toBe(true);
    vi.stubEnv("KV_REST_API_TOKEN", "");
    expect(liveEnabled()).toBe(false);
  });

  it("fails closed when any required deployment control is absent", async () => {
    const { services } = fakeServices();
    for (const key of ["FIELDLENS_LIVE_ENABLED", "OPENAI_API_KEY", "OPENAI_PROJECT_HARD_LIMIT_CONFIRMED", "SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "WORKFLOW_ENABLED", "APP_ORIGIN", "VERCEL_BOTID_ENABLED", "VERCEL_RATE_LIMIT_CONFIRMED"]) {
      const previous = process.env[key];
      vi.stubEnv(key, "");
      expect(liveEnabled()).toBe(false);
      expect((await startSession(request(), services)).status).toBe(503);
      vi.stubEnv(key, previous);
    }
    expect(services.create).not.toHaveBeenCalled();
  });

  it("rejects wrong origins, absent consent, and unknown request fields before quota or provider calls", async () => {
    const { services, store } = fakeServices();
    const attempts = [request(undefined, undefined, "https://other.example"), request({ sdp: "v=0\r\nfixture", consent: false }), request({ sdp: "v=0\r\nfixture", consent: true, model: "unexpected" })];
    for (const input of attempts) expect((await startSession(input, services)).status).toBeGreaterThanOrEqual(400);
    expect(store.reserve).not.toHaveBeenCalled();
    expect(services.create).not.toHaveBeenCalled();
  });

  it("rejects failed or unavailable browser verification before quota consumption", async () => {
    const { services, store } = fakeServices();
    vi.mocked(services.verifyBrowser).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("private provider error"));
    expect((await startSession(request(), services)).status).toBe(403);
    const unavailable = await startSession(request(), services);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("private provider error");
    expect(store.reserve).not.toHaveBeenCalled();
  });

  it("does not call OpenAI if shared admission storage rejects or fails", async () => {
    const { services, store } = fakeServices();
    vi.mocked(store.reserve).mockRejectedValueOnce(new PublicError("Daily allowance used.", 429)).mockRejectedValueOnce(new Error("Redis details"));
    expect((await startSession(request(), services)).status).toBe(429);
    expect((await startSession(request(), services)).status).toBe(503);
    expect(services.create).not.toHaveBeenCalled();
  });

  it("reserves before opening and confirms the scheduled end before returning SDP", async () => {
    const { services, store } = fakeServices();
    let releaseSchedule!: () => void;
    vi.mocked(services.schedule).mockImplementation(() => new Promise<void>((resolve) => { releaseSchedule = resolve; }));
    const resultPromise = startSession(request(), services);
    await vi.waitFor(() => expect(services.schedule).toHaveBeenCalledOnce());
    expect(store.reserve).toHaveBeenCalledOnce();
    expect(store.save).toHaveBeenCalledOnce();
    let returned = false;
    void resultPromise.then(() => { returned = true; });
    await Promise.resolve();
    expect(returned).toBe(false);
    releaseSchedule();
    const response = await resultPromise;
    const result = await response.json();
    expect(result).toMatchObject({ sdp: "v=0\r\nsynthetic-answer", sessionId: expect.any(String), expiresAt: expect.any(Number) });
    expect(result).not.toHaveProperty("callId");
    expect(services.schedule).toHaveBeenCalledWith(result.sessionId, "rtc_test_call", result.expiresAt);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("makes at most one provider call for overlapping requests behind shared admission", async () => {
    const { services } = fakeServices();
    const results = await Promise.all(Array.from({ length: 8 }, () => startSession(request(), services)));
    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
    expect(results.filter((response) => response.status === 429)).toHaveLength(7);
    expect(services.create).toHaveBeenCalledOnce();
  });

  it("closes a created call when workflow scheduling fails, without returning SDP", async () => {
    const { services, store } = fakeServices();
    vi.mocked(services.schedule).mockRejectedValue(new Error("private workflow details"));
    const response = await startSession(request(), services);
    expect(response.status).toBe(503);
    expect(services.hangup).toHaveBeenCalledWith("rtc_test_call");
    expect(store.release).toHaveBeenCalledOnce();
    expect(await response.text()).not.toContain("synthetic-answer");
  });

  it("retains admission after an ambiguous create or close failure", async () => {
    const { services, store } = fakeServices();
    vi.mocked(services.create).mockRejectedValue(new Error("Network timeout"));
    expect((await startSession(request(), services)).status).toBe(503);
    expect(store.release).not.toHaveBeenCalled();
    expect(services.create).toHaveBeenCalledOnce();
    const another = fakeServices();
    vi.mocked(another.services.schedule).mockRejectedValue(new Error("Schedule failed"));
    vi.mocked(another.services.hangup).mockRejectedValue(new Error("Close uncertain"));
    expect((await startSession(request(), another.services)).status).toBe(503);
    expect(another.store.release).not.toHaveBeenCalled();
  });

  it("releases only the active slot after a definitive rejection while retaining the consumed attempt", async () => {
    const { services, store } = fakeServices();
    vi.mocked(services.create).mockRejectedValue(new RejectedCallError("Provider allowance unavailable.", 429));
    expect((await startSession(request(), services)).status).toBe(429);
    expect(store.reserve).toHaveBeenCalledOnce();
    expect(store.release).toHaveBeenCalledOnce();
    expect(services.schedule).not.toHaveBeenCalled();
  });
});

describe("session ownership and request bounds", () => {
  it("rejects forged and expired visitor cookies", () => {
    const now = Date.now();
    const visitor = newVisitor(request(), now);
    expect(visitorFromRequest(request(undefined, visitor.cookie), now)).toBe(visitor.id);
    expect(visitorFromRequest(request(undefined, visitor.cookie.replace(visitor.id, randomUUID())), now)).toBeNull();
    expect(visitorFromRequest(request(undefined, visitor.cookie), now + 86_400_001)).toBeNull();
  });

  it("does not expose secrets in config", async () => {
    const response = configResponse(new Request(origin));
    const body = await response.json();
    expect(body).toMatchObject({ liveEnabled: true, model: "gpt-realtime-2.1", maxSessionSeconds: 120, maxImageBytes: 48_000 });
    expect(JSON.stringify(body)).not.toContain("placeholder");
  });

  it("authorizes session ending using the signed visitor cookie and makes repeat closes harmless", async () => {
    const { services, records, store } = fakeServices();
    const visitor = newVisitor(request());
    const id = randomUUID();
    records.set(id, { id, visitorId: visitor.id, callId: "rtc_owned_call", expiresAt: Date.now() + 120_000, status: "active" });
    expect((await endSession(request({ sessionId: id }, newVisitor(request()).cookie), services)).status).toBe(403);
    expect(services.hangup).not.toHaveBeenCalled();
    expect((await endSession(request({ sessionId: id }, visitor.cookie), services)).status).toBe(200);
    expect((await endSession(request({ sessionId: id }, visitor.cookie), services)).status).toBe(200);
    expect(services.hangup).toHaveBeenCalledOnce();
    expect(store.release).toHaveBeenCalledTimes(2);
  });

  it("enforces streamed bytes even when Content-Length is absent or misleading", async () => {
    const input = new Request(`${origin}/api/session`, { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: "x".repeat(2_000) });
    await expect(readBoundedJson(input, 1_024)).rejects.toMatchObject({ status: 413 });
  });
});
