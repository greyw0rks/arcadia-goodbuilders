import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeDeployData, erc20Abi, parseAbi, parseUnits, type Hex } from "viem";
import { SPONSOR_GD_AMOUNT } from "../lib/sponsor-config";
import artifact from "../lib/escrow-artifact.json";
const { rpc, values } = vi.hoisted(() => ({
  rpc: { getChainId: vi.fn(), getTransactionReceipt: vi.fn(), getTransaction: vi.fn(), readContract: vi.fn(), estimateGas: vi.fn(), getGasPrice: vi.fn(), getBalance: vi.fn(), simulateContract: vi.fn() },
  values: {} as Record<string, unknown>,
}));
const sponsor = "0xc61bbc0cf5694ef410a578a9833f77c173790450";
const token = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const escrow = "0x1111111111111111111111111111111111111111";
const identity = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const tournamentId = `0x${"b".repeat(64)}`;
const cap = parseUnits(SPONSOR_GD_AMOUNT, 18);
vi.mock("../lib/gooddollar", () => ({ celoClient: () => rpc, GOODDOLLAR: { token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" } }));
vi.mock("../lib/game-api", () => ({ games: vi.fn() }));
import { sponsorStatus, sponsorTransactionStatus } from "../lib/sponsor";
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(values, { token, identity, manager: sponsor, tournamentId, endsAt: BigInt(Math.floor(Date.now() / 1000) + 86400), poolCap: cap, totalFunded: 0n, cancelled: false, balanceOf: cap, allowance: 0n });
  rpc.getChainId.mockResolvedValue(42220);
  rpc.getTransactionReceipt.mockResolvedValue({ status: "success", from: sponsor, to: null, contractAddress: escrow });
  rpc.getTransaction.mockResolvedValue({ input: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode as Hex, args: [token, identity, tournamentId, values.endsAt, cap] }) });
  rpc.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => values[functionName]);
  rpc.estimateGas.mockResolvedValue(100000n); rpc.getGasPrice.mockResolvedValue(1000n); rpc.getBalance.mockResolvedValue(10n ** 18n);
});
describe("sponsor transaction preparation", () => {
  it("approves only the exact pool cap for the verified deployment", async () => {
    const result = await sponsorStatus(sponsor, hash);
    expect(result.stage).toBe("approve");
    expect(result.transaction?.to).toBe(token);
    expect(decodeFunctionData({ abi: erc20Abi, data: result.transaction!.data as Hex })).toMatchObject({ functionName: "approve", args: [escrow, cap] });
  });
  it("simulates funding and never prepares a second deposit into a funded pool", async () => {
    values.allowance = cap;
    const result = await sponsorStatus(sponsor, hash);
    expect(result.stage).toBe("fund");
    expect(decodeFunctionData({ abi: parseAbi(["function fund(uint256 amount)"]), data: result.transaction!.data as Hex })).toMatchObject({ functionName: "fund", args: [cap] });
    expect(rpc.simulateContract).toHaveBeenCalledOnce();
    values.totalFunded = cap;
    expect(await sponsorStatus(sponsor, hash)).toMatchObject({ stage: "funded" });
    expect((await sponsorStatus(sponsor, hash)).transaction).toBeUndefined();
  });
  it("rejects a different sender and a contract whose creation code does not match", async () => {
    rpc.getTransactionReceipt.mockResolvedValueOnce({ status: "success", from: escrow, to: null, contractAddress: escrow });
    await expect(sponsorStatus(sponsor, hash)).rejects.toMatchObject({ status: 403 });
    rpc.getTransaction.mockResolvedValueOnce({ input: "0x6000" });
    await expect(sponsorStatus(sponsor, hash)).rejects.toMatchObject({ status: 403 });
  });
  it("distinguishes pending and reverted receipts and rejects another wallet's receipt", async () => {
    rpc.getTransactionReceipt.mockRejectedValueOnce(Object.assign(new Error("not mined"), { name: "TransactionReceiptNotFoundError" }));
    expect(await sponsorTransactionStatus(sponsor, hash)).toBe("pending");
    rpc.getTransactionReceipt.mockResolvedValueOnce({ from: sponsor, status: "reverted" });
    expect(await sponsorTransactionStatus(sponsor, hash)).toBe("reverted");
    rpc.getTransactionReceipt.mockResolvedValueOnce({ from: escrow, status: "success" });
    await expect(sponsorTransactionStatus(sponsor, hash)).rejects.toMatchObject({ status: 403 });
  });
});
