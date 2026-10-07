import type { SessionConfig } from "../contracts";

export const REALTIME_MODEL = "gpt-realtime-2.1";
export const MAX_IMAGE_BYTES = 48_000;
export const VISITOR_DAILY_LIMIT = 10;
export const RESERVATION_TTL_SECONDS = 3_900;
export const SESSION_COOKIE = "fieldlens_visitor";

export function redisConfiguration(): { url: string; token: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "",
  };
}

export function maxSessionSeconds(): number {
  const value = Number(process.env.FIELDLENS_SESSION_SECONDS ?? 120);
  return Number.isInteger(value) && value >= 30 && value <= 120 ? value : 120;
}

export function dailySessionLimit(): number {
  const value = Number(process.env.FIELDLENS_DAILY_SESSION_LIMIT ?? 20);
  return Number.isInteger(value) && value >= 1 && value <= 20 ? value : 20;
}

export function hostedEnvironment(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function liveEnabled(): boolean {
  const redisConfig = redisConfiguration();
  const required = process.env.FIELDLENS_LIVE_ENABLED === "true"
    && Boolean(process.env.OPENAI_API_KEY?.trim())
    && process.env.OPENAI_PROJECT_HARD_LIMIT_CONFIRMED === "true"
    && (process.env.SESSION_SECRET?.length ?? 0) >= 32
    && Boolean(redisConfig.token)
    && process.env.WORKFLOW_ENABLED === "true";
  if (!required) return false;
  try {
    const origin = new URL(process.env.APP_ORIGIN ?? "");
    const redis = new URL(redisConfig.url);
    if (redis.protocol !== "https:" || origin.origin !== process.env.APP_ORIGIN) return false;
    if (hostedEnvironment()) return origin.protocol === "https:" && process.env.VERCEL_BOTID_ENABLED === "true" && process.env.VERCEL_RATE_LIMIT_CONFIRMED === "true";
    return process.env.ALLOW_LOCAL_LIVE === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  } catch {
    return false;
  }
}

export function publicSessionConfig(): SessionConfig {
  const ready = liveEnabled();
  return { liveEnabled: ready, model: REALTIME_MODEL, maxSessionSeconds: maxSessionSeconds(), maxImageBytes: MAX_IMAGE_BYTES, unavailableReason: ready ? null : "Live AI is not enabled for this deployment. You can explore the interactive bench." };
}
