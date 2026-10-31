import { authFailure, privateJson, requireSameOrigin } from "@/lib/auth-http";
import { signOutWallet } from "@/lib/player-session";
import { EMPTY_PROGRESS } from "@/lib/progress";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await signOutWallet();
    return privateJson({ identity: { address: null }, progress: EMPTY_PROGRESS });
  } catch (error) { return authFailure(error); }
}
