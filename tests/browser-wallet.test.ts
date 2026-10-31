import { describe, expect, it } from "vitest";
import { walletChainId } from "../lib/browser-wallet";

describe("wallet network responses", () => {
  it("accepts WalletConnect numbers and injected-wallet hex strings as the same network", () => {
    for (const value of [42220, 42220n, "42220", "0xa4ec", "0xA4EC", "0x00a4ec"]) {
      expect(walletChainId(value)).toBe("0xa4ec");
    }
    expect(walletChainId(1)).toBe("0x1");
  });

  it("rejects malformed responses instead of coercing them to a trusted network", () => {
    for (const value of [undefined, null, true, {}, [42220], "42220oops", "4.222e4", "", "0x", 42220.5, NaN, Infinity, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => walletChainId(value)).toThrow("invalid network ID");
    }
  });
});
