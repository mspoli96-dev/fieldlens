import { endSession } from "@/lib/server/session-handlers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  return endSession(request);
}
