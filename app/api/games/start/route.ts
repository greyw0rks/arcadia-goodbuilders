import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { gamePlayer, games, verifiedRoot } from "@/lib/game-api";
import { WalletAuthError } from "@/lib/wallet-identity";
import { limitRequests } from "@/lib/rate-limit";
import { progressStore } from "@/lib/progress-store";
import { isTriviaSelection } from "@/lib/trivia-catalog";
import { hasTournamentEntry } from "@/lib/tournament-entry";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await authBody(request);
    if (body.mode !== "daily" && body.mode !== "tournament" && body.mode !== "arcade") throw new WalletAuthError("Choose a game mode.", 400);
    const player = await gamePlayer(body.playerAddress ?? null);
    await limitRequests(progressStore(), "game-start-player", player.playerId, 20);
    const root = await verifiedRoot(player.address);
    if (root) await limitRequests(progressStore(), "game-start-root", root, 20);
    if (body.mode !== "tournament") throw new WalletAuthError("Arcadia now has one play flow: four daily tournament games, then mixed trivia. Open Play to continue.", 410);
    const competition = await games().competition(root);
    if (!await hasTournamentEntry(progressStore(), competition.id, root)) throw new WalletAuthError("Confirm your free entry transaction before starting a game.", 409);
    return privateJson({ game: await games().start(player.playerId, body.mode, root, body.practice === true, undefined, isTriviaSelection(body.trivia) ? body.trivia : undefined) });
  } catch (error) { return authFailure(error); }
}
