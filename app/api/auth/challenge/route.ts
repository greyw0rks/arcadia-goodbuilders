import { authBody, authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { currentBrowserId } from "@/lib/player-session";
import { progressStore } from "@/lib/progress-store";
import { issueWalletChallenge } from "@/lib/wallet-auth";

export async function POST(request: Request) {
  try {
    const origin = requireSameOrigin(request);
    const body = await authBody(request);
    const challenge = await issueWalletChallenge(progressStore(), await currentBrowserId(), body.address, origin);
    return privateJson(challenge);
  } catch (error) { return authFailure(error); }
}
