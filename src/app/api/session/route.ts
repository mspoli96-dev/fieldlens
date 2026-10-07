import { startSession } from "@/lib/server/session-handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return startSession(request);
}
