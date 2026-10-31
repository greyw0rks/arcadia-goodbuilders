import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/player-session";
import { progressStore } from "@/lib/progress-store";
import { playerGameHistory } from "@/lib/game-history";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { playerId, address } = await currentPlayer();
    if (!address) return NextResponse.json({ error: "Sign in to see your game history." }, { status: 401, headers: { "cache-control": "private, no-store" } });
    return NextResponse.json({ playerAddress: address, games: await playerGameHistory(progressStore(), playerId) }, { headers: { "cache-control": "private, no-store", vary: "Cookie" } });
  } catch { return NextResponse.json({ error: "Your game history is unavailable. Try again shortly." }, { status: 503 }); }
}
