import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { gamePlayer, games, verifiedRoot } from "@/lib/game-api";
import { progressStore } from "@/lib/progress-store";
import { WalletAuthError } from "@/lib/wallet-identity";
import { limitRequests } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await authBody(request);
    if (typeof body.id !== "string" || !["read", "answer", "next", "finish"].includes(String(body.action))) throw new WalletAuthError("Choose a valid game action.", 400);
    const player = await gamePlayer(body.playerAddress ?? null);
    await limitRequests(progressStore(), "game-action-player", player.playerId, 120);
    const store = games();
    // A signed-in player authorized at game entry can finish this attempt
    // without Celo RPC calls between timed questions. Each new run rechecks.
    const root = await store.actionRoot(player.playerId, body.id, () => verifiedRoot(player.address));
    if (root) await limitRequests(progressStore(), "game-action-root", root, 120);
    let game;
    try {
      game = await store.act(player.playerId, root, body.id, body.action as "read" | "answer" | "next" | "finish", body.questionIndex as number, body.answerIndex as number);
    } catch (error) {
      if (!(error instanceof WalletAuthError) || error.status !== 409) throw error;
      // A second tab or the closing time can invalidate the displayed question.
      // Return the authorized, current state instead of repeating an obsolete
      // action. Reading never commits another answer.
      const current = await store.act(player.playerId, root, body.id, "read");
      return privateJson({ error: error.message, game: current, progress: await progressStore().get(player.playerId) }, 409);
    }
    return privateJson({ game, progress: await progressStore().get(player.playerId) });
  } catch (error) { return authFailure(error); }
}
