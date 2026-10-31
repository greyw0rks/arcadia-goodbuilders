import { NextResponse } from "next/server";
import { erc20Abi, formatUnits, type Address } from "viem";
import { currentPlayer } from "@/lib/player-session";
import { celoClient, goodIdentity, GOODDOLLAR } from "@/lib/gooddollar";
import { progressStore } from "@/lib/progress-store";
import { ARCADIA_ESCROW, type RewardView } from "@/lib/reward-display";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { address } = await currentPlayer();
    const result: RewardView = { playerAddress: address, walletBalance: null, escrowBalance: null, checkedAt: null, chainError: null, historyError: null, receipts: [] };
    const client = celoClient();
    const [chain, history] = await Promise.allSettled([
      (async () => {
        if (await client.getChainId() !== GOODDOLLAR.chainId) throw new Error("Wrong network");
        const [escrow, wallet] = await Promise.all([
          client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "balanceOf", args: [ARCADIA_ESCROW] }),
          address ? client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "balanceOf", args: [address as Address] }) : null,
        ]);
        return { escrowBalance: formatUnits(escrow, 18), walletBalance: wallet === null ? null : formatUnits(wallet, 18), checkedAt: new Date().toISOString() };
      })(),
      (async () => {
        if (!address) return [];
        const identity = await goodIdentity(address);
        if (!identity.root) return [];
        const data = await progressStore().execute({ sql: "SELECT tx_hash, amount, recorded_at FROM reward_receipts WHERE identity_root = ? ORDER BY recorded_at DESC LIMIT 20", args: [identity.root] });
        return data.rows.map(row => ({ hash: String(row.tx_hash), amount: String(row.amount), recordedAt: Number(row.recorded_at) }));
      })(),
    ]);
    if (chain.status === "fulfilled") Object.assign(result, chain.value); else result.chainError = "Celo balances are unavailable. Your wallet and saved XP are unaffected.";
    if (history.status === "fulfilled") result.receipts = history.value; else result.historyError = "Reward history could not be checked. Try refreshing shortly.";
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store", vary: "Cookie" } });
  } catch { return NextResponse.json({ error: "Rewards are unavailable. Please try again." }, { status: 503 }); }
}
