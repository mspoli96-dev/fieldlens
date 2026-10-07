import { Redis } from "@upstash/redis";
import { z } from "zod";
import { dailySessionLimit, redisConfiguration, RESERVATION_TTL_SECONDS, VISITOR_DAILY_LIMIT } from "./config";
import { PublicError } from "./security";

export const admissionScript = `
if redis.call('GET', KEYS[3]) == ARGV[1] then return 1 end
if redis.call('EXISTS', KEYS[3]) == 1 or redis.call('EXISTS', KEYS[4]) == 1 then return -1 end
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[2]) then return -2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[3]) then return -3 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 172800)
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], 172800)
redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[4])
redis.call('SET', KEYS[4], ARGV[1], 'EX', ARGV[4])
return 1
`;

const releaseScript = `
for _, key in ipairs(KEYS) do
  if redis.call('GET', key) == ARGV[1] then redis.call('DEL', key) end
end
return 1
`;

const sessionRecordSchema = z.strictObject({
  id: z.string().uuid(),
  visitorId: z.string().uuid(),
  callId: z.string().regex(/^rtc_[A-Za-z0-9_-]{5,200}$/),
  expiresAt: z.number().int().positive(),
  status: z.enum(["active", "ended"]),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export interface SessionStore {
  reserve(visitorId: string, reservationId: string): Promise<void>;
  release(visitorId: string, reservationId: string): Promise<void>;
  save(record: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | null>;
}

function leaseKeys(visitorId: string) {
  return ["fieldlens:{admission}:active", `fieldlens:{admission}:visitor-active:${visitorId}`];
}

export function createSessionStore(): SessionStore {
  const redis = new Redis(redisConfiguration());
  return {
    async reserve(visitorId, reservationId) {
      const day = new Date().toISOString().slice(0, 10);
      const result = await redis.eval(admissionScript, [`fieldlens:{admission}:daily:${day}`, `fieldlens:{admission}:visitor:${day}:${visitorId}`, ...leaseKeys(visitorId)], [reservationId, dailySessionLimit(), VISITOR_DAILY_LIMIT, RESERVATION_TTL_SECONDS]);
      if (result === -1) throw new PublicError("A demo session is already running. Please try again after it ends.", 429);
      if (result !== 1) throw new PublicError("Today's demo session allowance has been used. Please try again another day.", 429);
    },
    async release(visitorId, reservationId) {
      await redis.eval(releaseScript, leaseKeys(visitorId), [reservationId]);
    },
    async save(record) {
      await redis.set(`fieldlens:session:${record.id}`, sessionRecordSchema.parse(record), { ex: RESERVATION_TTL_SECONDS });
    },
    async get(sessionId) {
      const record = await redis.get<unknown>(`fieldlens:session:${sessionId}`);
      return record === null ? null : sessionRecordSchema.parse(record);
    },
  };
}
