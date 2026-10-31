import { encodeFunctionData, isAddress } from "viem";
import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { gamePlayer } from "@/lib/game-api";
import { goodIdentity, identityAbi } from "@/lib/gooddollar";
import { WalletAuthError } from "@/lib/wallet-identity";
import { limitRequests } from "@/lib/rate-limit";
import { progressStore } from "@/lib/progress-store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await authBody(request);
    const player = await gamePlayer(body.playerAddress ?? null);
    if (!player.address || typeof body.sourceAddress !== "string" || !isAddress(body.sourceAddress)) throw new WalletAuthError("Select your verified GoodDollar wallet first.", 400);
    await limitRequests(progressStore(), "identity-link", player.playerId, 10);
    const [source, target] = await Promise.all([goodIdentity(body.sourceAddress), goodIdentity(player.address)]);
    if (target.verified) throw new WalletAuthError("This playing wallet already has a verified GoodDollar identity. No new link is needed.", 409);
    if (!source.verified || source.root !== body.sourceAddress.toLowerCase() || !source.identityContract) throw new WalletAuthError("The selected wallet must be the GoodDollar-verified identity wallet.", 403);
    return privateJson({ from: body.sourceAddress, to: source.identityContract, chainId: "0xa4ec", data: encodeFunctionData({ abi: identityAbi, functionName: "connectAccount", args: [player.address as `0x${string}`] }) });
  } catch (error) { return authFailure(error); }
}
