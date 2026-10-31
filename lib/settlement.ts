import { concat, decodeEventLog, encodeAbiParameters, keccak256, parseAbi, type Address, type Hex } from "viem";
export interface Allocation { address: Address; amount: bigint }
export interface Claim { address: Address; amount: string; proof: Hex[] }
const claimAbi = parseAbi(["event Claimed(address indexed account, uint256 amount)"]);
const transferAbi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
export function allocationLeaf(chainId: number, escrow: Address, tournamentId: Hex, item: Allocation): Hex {
  return keccak256(encodeAbiParameters([{type:"uint256"}, {type:"address"}, {type:"bytes32"}, {type:"address"}, {type:"uint256"}], [BigInt(chainId), escrow, tournamentId, item.address, item.amount]));
}
export function pairHash(a: Hex, b: Hex): Hex { return keccak256(concat(a.toLowerCase() < b.toLowerCase() ? [a,b] : [b,a])); }
export function allocationTree(chainId: number, escrow: Address, tournamentId: Hex, allocations: Allocation[]) {
  const items = allocations.filter((a) => a.amount > 0n).toSorted((a,b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
  if (!items.length || new Set(items.map((a) => a.address.toLowerCase())).size !== items.length || allocations.some((a) => a.amount < 0n)) throw new Error("Positive unique allocations are required");
  const levels: Hex[][] = [items.map((item) => allocationLeaf(chainId, escrow, tournamentId, item))];
  while (levels.at(-1)!.length > 1) {
    const previous = levels.at(-1)!;
    levels.push(previous.filter((_,i) => i % 2 === 0).map((a,i) => previous[i * 2 + 1] ? pairHash(a, previous[i * 2 + 1]) : a));
  }
  const claims: Claim[] = items.map((item, index) => {
    const proof: Hex[] = []; let at = index;
    for (const level of levels.slice(0,-1)) { if (level[at ^ 1]) proof.push(level[at ^ 1]); at = Math.floor(at / 2); }
    return { address: item.address, amount: String(item.amount), proof };
  });
  return { root: levels.at(-1)![0], claims, totalAllocated: String(items.reduce((sum,item) => sum + item.amount,0n)) };
}
export function verifyClaimReceipt(receipt: { status: string; to: string | null; blockNumber: bigint; logs: {address: string; data: Hex; topics: Hex[]}[] }, expected: { escrow: Address; token: Address; address: Address; amount: bigint; head: bigint }) {
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== expected.escrow.toLowerCase() || expected.head - receipt.blockNumber < 2n) throw new Error("A successful escrow receipt with three confirmations is required");
  let claimed = false, transferred = false;
  for (const log of receipt.logs) {
    try {
      if (log.address.toLowerCase() === expected.escrow.toLowerCase()) {
        const event = decodeEventLog({ abi: claimAbi, data: log.data, topics: log.topics as [Hex,...Hex[]] });
        if (event.args.account.toLowerCase() === expected.address.toLowerCase() && event.args.amount === expected.amount) claimed = true;
      }
      if (log.address.toLowerCase() === expected.token.toLowerCase()) {
        const event = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics as [Hex,...Hex[]] });
        if (event.args.from.toLowerCase() === expected.escrow.toLowerCase() && event.args.to.toLowerCase() === expected.address.toLowerCase() && event.args.value === expected.amount) transferred = true;
      }
    } catch { /* Unrelated logs are expected in a transaction receipt. */ }
  }
  if (!claimed || !transferred) throw new Error("Receipt must contain the exact escrow claim and G$ transfer");
  return true;
}
