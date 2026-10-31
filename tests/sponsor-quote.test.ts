import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { dollarQuote } from "../lib/sponsor-quote";
const token = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const pair = { chainId: "celo", pairAddress: "0x991f1AA7e0901f9AB3d583846bf5BE0EbACE1d7f", baseToken: { address: token }, priceUsd: "0.0001150", liquidity: { usd: 6000 } };
describe("one-dollar G$ quote", () => {
  it("uses the deepest eligible Celo pool and rounds the deposit down to one dollar", () => {
    const result = dollarQuote([{ ...pair, priceUsd: "1.00", liquidity: { usd: 1200 } }, pair]);
    expect(result.priceUsd).toBe(pair.priceUsd);
    const price = parseUnits(result.priceUsd, 18);
    expect(result.amount * price).toBeLessThanOrEqual(10n ** 36n);
    expect((result.amount + 1n) * price).toBeGreaterThan(10n ** 36n);
  });
  it("rejects the wrong chain, quote-side G$, insufficient liquidity and invalid prices", () => {
    for (const invalid of [{ ...pair, chainId: "ethereum" }, { ...pair, baseToken: { address: "0x0000000000000000000000000000000000000001" } }, { ...pair, liquidity: { usd: 999 } }, { ...pair, priceUsd: "0.000" }, { ...pair, priceUsd: "NaN" }]) {
      expect(() => dollarQuote([invalid])).toThrow();
    }
  });
});
