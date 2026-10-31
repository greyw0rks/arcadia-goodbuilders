import type { Address } from "viem";
import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { gamePlayer } from "@/lib/game-api";
import { progressStore } from "@/lib/progress-store";
import { limitRequests } from "@/lib/rate-limit";
import { WalletAuthError } from "@/lib/wallet-identity";
import { prepareSponsor, sponsorStatus, sponsorTransactionStatus } from "@/lib/sponsor";
import { SPONSOR_ADDRESS } from "@/lib/sponsor-config";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await authBody(request);
    const player = await gamePlayer(body.playerAddress);
    if (!player.address) throw new WalletAuthError("Sign in with the wallet that will deploy and fund the escrow.", 401);
    if (player.address.toLowerCase() !== SPONSOR_ADDRESS) throw new WalletAuthError("Connect the designated sponsor wallet to manage this funding setup.", 403);
    await limitRequests(progressStore(), "sponsor-setup", player.playerId, 30);
    if (body.action === "prepare") return privateJson(await prepareSponsor(player.address as Address));
    if (body.action === "status" && typeof body.deploymentHash === "string") {
      const transactionResult = typeof body.pendingHash === "string" ? await sponsorTransactionStatus(player.address as Address, body.pendingHash) : undefined;
      if (transactionResult === "pending") return privateJson({ stage: "pending", address: player.address, transactionResult, message: "The transaction is pending on Celo. Refresh after it confirms in your wallet." });
      if (transactionResult === "reverted" && body.pendingHash === body.deploymentHash) return privateJson({ stage: "deploy", address: player.address, transactionResult, message: "Deployment reverted. No escrow was created. Prepare a new quote to retry." });
      return privateJson({ ...await sponsorStatus(player.address as Address, body.deploymentHash), transactionResult });
    }
    throw new WalletAuthError("Choose a funding setup action.", 400);
  } catch (error) { return authFailure(error); }
}
