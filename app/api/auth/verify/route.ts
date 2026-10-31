import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { currentBrowserId, currentSessionToken, establishWalletSession } from "@/lib/player-session";
import { progressStore } from "@/lib/progress-store";
import { verifyWalletLogin } from "@/lib/wallet-auth";

export async function POST(request: Request) {
  try {
    const origin = requireSameOrigin(request);
    const body = await authBody(request);
    const result = await verifyWalletLogin(progressStore(), await currentBrowserId(), origin, body.nonce, body.signature, await currentSessionToken());
    await establishWalletSession(result.token);
    return privateJson({ identity: result.identity, progress: result.progress });
  } catch (error) { return authFailure(error); }
}
