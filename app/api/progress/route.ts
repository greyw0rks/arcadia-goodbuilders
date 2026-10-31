import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/player-session";
import { progressStore } from "@/lib/progress-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { playerId, address } = await currentPlayer();
    const progress = await progressStore().get(playerId);
    return NextResponse.json({ progress, identity: { address } }, { headers: { "cache-control": "private, no-store", vary: "Cookie" } });
  } catch {
    return NextResponse.json(
      { error: "Player progress is unavailable. Try again before starting today's quiz." },
      { status: 503 },
    );
  }
}
