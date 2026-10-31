import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { currentPlayer } from "@/lib/player-session";
import { games, gamePlayer, verifiedRoot } from "@/lib/game-api";
import { goodIdentity } from "@/lib/gooddollar";
import { limitRequests } from "@/lib/rate-limit";
import { progressStore } from "@/lib/progress-store";
import { assertFreeWeek, confirmFreeEntry, freeEntryData, hasTournamentEntry } from "@/lib/tournament-entry";
import { GOODDOLLAR } from "@/lib/gooddollar";
import { WalletAuthError } from "@/lib/wallet-identity";
import type { Address } from "viem";

async function accountView(address: string | null, identity: Awaited<ReturnType<typeof goodIdentity>> | null, identityError: string | null = null) {
  const competition = await games().competition(identity?.root ?? null);
  if (competition.entry && identity?.root) competition.entry.requiresTransaction = !await hasTournamentEntry(progressStore(), competition.id, identity.root);
  return { playerAddress: address, competition, identity, identityError };
}
export async function GET() {
  try {
    const player = await currentPlayer();
    await limitRequests(progressStore(), "tournament-read", player.playerId, 60);
    let identity: Awaited<ReturnType<typeof goodIdentity>> | null = null;
    let identityError: string | null = null;
    try { identity = await goodIdentity(player.address); }
    catch { identityError = "GoodDollar verification is temporarily unavailable. Your recorded tournament progress is unchanged."; }
    return privateJson(await accountView(player.address, identity, identityError));
  } catch (error) { return authFailure(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await authBody(request);
    const player = await gamePlayer(body.playerAddress ?? null);
    await limitRequests(progressStore(), "tournament-entry", player.playerId, 30);
    const root = await verifiedRoot(player.address);
    const competition = await games().competition(root);
    if (await hasTournamentEntry(progressStore(), competition.id, root)) return privateJson({ stage: "confirmed", ...await accountView(player.address, await goodIdentity(player.address)) });
    assertFreeWeek(competition);
    if (body.action === "prepare") return privateJson({ stage: "approve", playerAddress: player.address, tournamentId: competition.id, transaction: { from: player.address, to: GOODDOLLAR.token, value: "0x0", data: freeEntryData } });
    if (body.action !== "confirm") throw new WalletAuthError("Approve and confirm your free entry transaction before joining.", 400);
    const stage = await confirmFreeEntry(progressStore(), competition, player.address as Address, root, body.transactionHash);
    return privateJson({ stage, ...await accountView(player.address, await goodIdentity(player.address)) });
  } catch (error) { return authFailure(error); }
}
