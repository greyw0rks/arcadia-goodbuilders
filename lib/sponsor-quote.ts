import { parseUnits } from "viem";
const TOKEN = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a";
interface Pair { chainId?: string; pairAddress?: string; baseToken?: { address?: string }; priceUsd?: string; liquidity?: { usd?: number } }
export function dollarQuote(pairs: Pair[]) {
  const pair = pairs.filter(pair => pair.chainId === "celo" && pair.baseToken?.address?.toLowerCase() === TOKEN
    && /^0x[0-9a-f]{40}$/i.test(pair.pairAddress ?? "") && Number.isFinite(pair.liquidity?.usd) && pair.liquidity!.usd! >= 1000
    && /^(?:0|[1-9]\d*)\.\d{1,18}$/.test(pair.priceUsd ?? "") && Number(pair.priceUsd) > 0)
    .sort((a, b) => b.liquidity!.usd! - a.liquidity!.usd!)[0];
  if (!pair) throw new Error("A liquid G$ price quote is unavailable. Try again later.");
  // Round down: never exceed US$1 at this indicative market quote.
  const amount = 10n ** 36n / parseUnits(pair.priceUsd!, 18);
  if (amount <= 0n) throw new Error("The G$ price quote is invalid.");
  return { amount, priceUsd: pair.priceUsd!, quoteUrl: `https://dexscreener.com/celo/${pair.pairAddress!.toLowerCase()}` };
}
