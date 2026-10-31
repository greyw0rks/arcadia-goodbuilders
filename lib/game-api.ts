import { currentPlayer } from "./player-session";
import { goodIdentity } from "./gooddollar";
import { GameStore } from "./game-store";
import { progressStore } from "./progress-store";
import { WalletAuthError } from "./wallet-identity";
export function games() { return new GameStore(progressStore()); }
export async function gamePlayer(expectedAddress?: unknown) {
  const player = await currentPlayer();
  if (!player.address) throw new WalletAuthError("Connect your wallet and sign in before playing.", 401);
  if (expectedAddress !== undefined && expectedAddress !== player.address) throw new WalletAuthError("Your account changed. Reload before continuing.", 409);
  return player;
}
export async function verifiedRoot(address: string | null) {
  const identity = await goodIdentity(address);
  if (!identity.verified || !identity.root) throw new WalletAuthError("Verify your GoodDollar wallet or link your verified identity before playing any game.", 403);
  return identity.root;
}
