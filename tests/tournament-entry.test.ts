import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, erc20Abi } from "viem";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
import { ARCADIA_ESCROW } from "../lib/reward-display";
const { rpc } = vi.hoisted(() => ({ rpc: { getChainId: vi.fn(), getTransactionReceipt: vi.fn(), getTransaction: vi.fn(), getBlock: vi.fn(), getBlockNumber: vi.fn() } }));
vi.mock("../lib/gooddollar", async original => ({ ...await original<typeof import("../lib/gooddollar")>(), celoClient: () => rpc }));
import { assertFreeWeek, confirmFreeEntry, freeEntryData, hasTournamentEntry } from "../lib/tournament-entry";
const address = "0x1111111111111111111111111111111111111111";
const stranger = "0x2222222222222222222222222222222222222222";
const token = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const hash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const now = Date.parse("2026-10-31T14:00:00Z");
const stores: ProgressStore[] = [];
function receipt() { return { status: "success", from: address, to: token, blockNumber: 500n, blockHash, logs: [{ address: token, topics: encodeEventTopics({ abi: erc20Abi, eventName: "Approval", args: { owner: address, spender: ARCADIA_ESCROW } }), data: encodeAbiParameters([{ type: "uint256" }], [0n]) }] }; }
async function setup() { const db = new ProgressStore({ url: "file::memory:" }); stores.push(db); return { db, competition: await new GameStore(db).competition(address, now) }; }
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now);
  rpc.getChainId.mockResolvedValue(42220); rpc.getTransactionReceipt.mockResolvedValue(receipt());
  rpc.getTransaction.mockResolvedValue({ input: freeEntryData, value: 0n });
  rpc.getBlock.mockResolvedValue({ timestamp: BigInt(now / 1000), hash: blockHash }); rpc.getBlockNumber.mockResolvedValue(501n);
});
afterEach(() => { stores.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
it("requires a successful zero approval, enrolls once and preserves a recoverable proof", async () => {
  const { db, competition } = await setup();
  expect(await hasTournamentEntry(db, competition.id, address)).toBe(false);
  expect(await confirmFreeEntry(db, competition, address, address, hash)).toBe("confirmed");
  expect(await hasTournamentEntry(db, competition.id, address)).toBe(true);
  expect(await confirmFreeEntry(db, competition, address, address, hash)).toBe("confirmed");
  expect((await db.execute("SELECT * FROM tournament_entry_proofs")).rows).toHaveLength(1);
  expect((await new GameStore(db).competition(address, now)).entry?.completedGames).toBe(0);
  await expect(confirmFreeEntry(db, competition, stranger, stranger, hash)).rejects.toMatchObject({ status: 409 });
});
it("never enrolls an unmined, unconfirmed or noncanonical transaction", async () => {
  const { db, competition } = await setup();
  rpc.getTransactionReceipt.mockRejectedValueOnce(Object.assign(new Error("pending"), { name: "TransactionReceiptNotFoundError" }));
  expect(await confirmFreeEntry(db, competition, address, address, hash)).toBe("pending");
  rpc.getBlockNumber.mockResolvedValueOnce(500n);
  expect(await confirmFreeEntry(db, competition, address, address, hash)).toBe("pending");
  rpc.getBlock.mockResolvedValueOnce({ timestamp: BigInt(now / 1000), hash: "0xwrong" });
  expect(await confirmFreeEntry(db, competition, address, address, hash)).toBe("pending");
  expect(await hasTournamentEntry(db, competition.id, address)).toBe(false);
});
it("rejects a reverted receipt, another wallet, nonzero approval or mismatched event", async () => {
  const { db, competition } = await setup();
  rpc.getTransactionReceipt.mockResolvedValueOnce({ ...receipt(), status: "reverted" });
  await expect(confirmFreeEntry(db, competition, address, address, hash)).rejects.toMatchObject({ status: 409 });
  rpc.getTransactionReceipt.mockResolvedValueOnce({ ...receipt(), from: stranger });
  await expect(confirmFreeEntry(db, competition, address, address, hash)).rejects.toMatchObject({ status: 403 });
  rpc.getTransaction.mockResolvedValueOnce({ input: freeEntryData.slice(0, -1) + "1", value: 0n });
  await expect(confirmFreeEntry(db, competition, address, address, hash)).rejects.toMatchObject({ status: 403 });
  rpc.getTransactionReceipt.mockResolvedValueOnce({ ...receipt(), logs: [] });
  await expect(confirmFreeEntry(db, competition, address, address, hash)).rejects.toMatchObject({ status: 403 });
  expect(await hasTournamentEntry(db, competition.id, address)).toBe(false);
});
it("does not reuse old approvals or silently grant free entry after the launch week", async () => {
  const { db, competition } = await setup();
  rpc.getBlock.mockResolvedValueOnce({ timestamp: BigInt(competition.startsAt / 1000 - 1), hash: blockHash });
  await expect(confirmFreeEntry(db, competition, address, address, hash)).rejects.toMatchObject({ status: 403 });
  expect(() => assertFreeWeek({ ...competition, endsAt: now + 30 * 86400_000 }, Date.parse("2026-11-06T00:00:00Z"))).toThrow("US$1 weekly G$ passes are not open yet");
});
