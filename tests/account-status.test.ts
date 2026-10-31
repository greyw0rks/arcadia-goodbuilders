import { describe, expect, it } from "vitest";
import { identityStatus } from "../lib/account-status";
const wallet = "0x1111111111111111111111111111111111111111";
const root = "0x2222222222222222222222222222222222222222";
const identity = (root: string | null) => ({ verified: Boolean(root), root, verificationUrl: "https://goodwallet.xyz" });
describe("GoodDollar account classification", () => {
  it("distinguishes a verified root from a linked wallet and an unverified wallet", () => {
    expect(identityStatus(wallet, identity(wallet), false, "")).toBe("verified");
    expect(identityStatus(wallet, identity(root), false, "")).toBe("linked");
    expect(identityStatus(wallet, identity(null), false, "")).toBe("unverified");
  });
  it("never reports an unavailable or loading check as an unverified wallet", () => {
    expect(identityStatus(wallet, null, true, "")).toBe("loading");
    expect(identityStatus(wallet, null, false, "RPC unavailable")).toBe("unavailable");
    expect(identityStatus(wallet, identity(wallet), false, "RPC unavailable")).toBe("unavailable");
    expect(identityStatus(null, identity(wallet), false, "")).toBe("guest");
  });
});
