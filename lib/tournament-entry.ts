import { decodeEventLog, encodeFunctionData, erc20Abi, isHash, type Address, type Hex } from "viem";
import { celoClient, GOODDOLLAR } from "./gooddollar";
import { ARCADIA_ESCROW } from "./reward-display";
import type { ProgressStore } from "./progress-store";
import type { CompetitionView } from "./game-types";
import { WalletAuthError } from "./wallet-identity";

export const FREE_WEEK_END = Date.parse("2026-11-06T00:00:00Z");
export const freeEntryData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ARCADIA_ESCROW, 0n] });
export function assertFreeWeek(competition: CompetitionView, now = Date.now()) {
  if (competition.status !== "open" || now >= competition.endsAt) throw new WalletAuthError("This tournament is closed for entry.", 409);
  if (competition.startsAt >= FREE_WEEK_END || now >= FREE_WEEK_END) throw new WalletAuthError("The free launch week has ended. US$1 weekly G$ passes are not open yet.", 409);
}
export async function hasTournamentEntry(db: ProgressStore, tournamentId: string, root: string) {
  return (await db.execute({ sql: "SELECT 1 FROM tournament_entry_proofs WHERE tournament_id = ? AND identity_root = ?", args: [tournamentId, root] })).rows.length > 0;
}
export async function confirmFreeEntry(db: ProgressStore, competition: CompetitionView, address: Address, root: string, hash: unknown) {
  assertFreeWeek(competition);
  if (typeof hash !== "string" || !isHash(hash)) throw new WalletAuthError("Confirm your free entry transaction before joining.", 400);
  const existing = (await db.execute({ sql: "SELECT tournament_id, identity_root, payer FROM tournament_entry_proofs WHERE tx_hash = ?", args: [hash.toLowerCase()] })).rows[0];
  if (existing) {
    if (existing.tournament_id !== competition.id || existing.identity_root !== root || existing.payer !== address.toLowerCase()) throw new WalletAuthError("This entry transaction has already been used.", 409);
    return "confirmed" as const;
  }
  const client = celoClient();
  if (await client.getChainId() !== 42220) throw new WalletAuthError("The entry network must be Celo.", 503);
  const receipt = await client.getTransactionReceipt({ hash: hash as Hex }).catch(error => {
    if (error.name === "TransactionReceiptNotFoundError") return null;
    throw error;
  });
  if (!receipt) return "pending" as const;
  if (receipt.status !== "success") throw new WalletAuthError("Your entry transaction reverted. Check your wallet before trying again.", 409);
  if (receipt.from.toLowerCase() !== address.toLowerCase() || receipt.to?.toLowerCase() !== GOODDOLLAR.token.toLowerCase()) throw new WalletAuthError("This entry transaction is not from your playing wallet to G$ on Celo.", 403);
  const [transaction, block, head] = await Promise.all([client.getTransaction({ hash: hash as Hex }), client.getBlock({ blockNumber: receipt.blockNumber }), client.getBlockNumber()]);
  if (transaction.input.toLowerCase() !== freeEntryData.toLowerCase() || transaction.value !== 0n) throw new WalletAuthError("Free entry requires exactly a zero-G$ approval to the Arcadia escrow.", 403);
  if (block.hash !== receipt.blockHash || head < receipt.blockNumber + 1n) return "pending" as const;
  const timestamp = Number(block.timestamp) * 1000;
  if (timestamp < competition.startsAt || timestamp >= Math.min(competition.endsAt, FREE_WEEK_END)) throw new WalletAuthError("This transaction is outside the free launch week.", 403);
  const event = receipt.logs.some(log => {
    if (log.address.toLowerCase() !== GOODDOLLAR.token.toLowerCase()) return false;
    try {
      const parsed = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      return parsed.eventName === "Approval" && parsed.args.owner.toLowerCase() === address.toLowerCase() && parsed.args.spender.toLowerCase() === ARCADIA_ESCROW && parsed.args.value === 0n;
    } catch { return false; }
  });
  if (!event) throw new WalletAuthError("A matching zero-G$ approval was not found in this transaction.", 403);
  await db.write(async tx => {
    // A unique transaction hash prevents cross-week and cross-identity reuse.
    const used = (await tx.execute({ sql: "SELECT tournament_id, identity_root, payer FROM tournament_entry_proofs WHERE tx_hash = ?", args: [hash.toLowerCase()] })).rows[0];
    if (used && (used.tournament_id !== competition.id || used.identity_root !== root || used.payer !== address.toLowerCase())) throw new WalletAuthError("This entry transaction has already been used.", 409);
    await tx.execute({ sql: "INSERT OR IGNORE INTO tournament_entry_proofs (tournament_id, identity_root, payer, tx_hash, block_number, confirmed_at) VALUES (?, ?, ?, ?, ?, ?)", args: [competition.id, root, address.toLowerCase(), hash.toLowerCase(), String(receipt.blockNumber), Date.now()] });
    await tx.execute({ sql: "INSERT OR IGNORE INTO tournament_entries (tournament_id, identity_root, joined_at) VALUES (?, ?, ?)", args: [competition.id, root, Date.now()] });
  });
  return "confirmed" as const;
}
