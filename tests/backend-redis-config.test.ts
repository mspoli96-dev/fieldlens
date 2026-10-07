import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "@upstash/redis";
import { createSessionStore } from "../src/lib/server/store";

vi.mock("@upstash/redis", () => ({ Redis: vi.fn(function RedisMock() {}) }));

beforeEach(() => {
  vi.mocked(Redis).mockClear();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "https://native-redis.example");
  vi.stubEnv("KV_REST_API_TOKEN", "native-test-placeholder");
});
afterEach(() => vi.unstubAllEnvs());

describe("Redis configuration aliases", () => {
  it("passes native integration values to the store without an empty custom value shadowing them", () => {
    createSessionStore();
    expect(Redis).toHaveBeenCalledWith({ url: "https://native-redis.example", token: "native-test-placeholder" });
  });

  it("preserves explicit custom configuration when both naming conventions exist", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://custom-redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "custom-test-placeholder");
    createSessionStore();
    expect(Redis).toHaveBeenCalledWith({ url: "https://custom-redis.example", token: "custom-test-placeholder" });
  });
});
