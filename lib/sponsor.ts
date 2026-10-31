import { encodeDeployData, encodeFunctionData, erc20Abi, formatEther, formatUnits, isHash, keccak256, parseAbi, parseUnits, stringToHex, zeroAddress, type Address, type Hex } from "viem";
import artifact from "./escrow-artifact.json";
import { celoClient, GOODDOLLAR } from "./gooddollar";
import { games } from "./game-api";
import { WalletAuthError } from "./wallet-identity";
import { dollarQuote } from "./sponsor-quote";
import type { SponsorTransaction, SponsorView } from "./sponsor-types";
import { SPONSOR_GD_AMOUNT } from "./sponsor-config";

const escrowAbi = parseAbi([
  "function token() view returns(address)", "function identity() view returns(address)",
  "function manager() view returns(address)", "function tournamentId() view returns(bytes32)",
  "function endsAt() view returns(uint256)", "function poolCap() view returns(uint256)",
  "function totalFunded() view returns(uint256)", "function cancelled() view returns(bool)",
  "function fund(uint256 amount)",
]);
type Client = ReturnType<typeof celoClient>;
export async function sponsorTransactionStatus(address: Address, hash: string) {
  if (!isHash(hash)) throw new WalletAuthError("Invalid transaction hash.", 400);
  const client = celoClient();
  if (await client.getChainId() !== 42220) throw new WalletAuthError("The RPC is not connected to Celo.", 503);
  const receipt = await client.getTransactionReceipt({ hash }).catch(error => {
    if (error.name === "TransactionReceiptNotFoundError") return null;
    throw error;
  });
  if (!receipt) return "pending" as const;
  if (receipt.from.toLowerCase() !== address.toLowerCase()) throw new WalletAuthError("This transaction belongs to another wallet.", 403);
  return receipt.status;
}
async function transactionView(client: Client, transaction: SponsorTransaction) {
  const gas = await client.estimateGas({ account: transaction.from as Address, to: transaction.to as Address | undefined, data: transaction.data as Hex, value: 0n });
  const gasPrice = await client.getGasPrice();
  const cost = gas * gasPrice;
  if (await client.getBalance({ address: transaction.from as Address }) < cost) throw new WalletAuthError("This wallet needs CELO for the network fee before continuing.", 400);
  return { transaction, gasEstimateCelo: formatEther(cost) };
}
export async function prepareSponsor(address: Address): Promise<SponsorView> {
  const client = celoClient();
  const [chain, competition, quoteResponse, identity] = await Promise.all([
    client.getChainId(), games().competition(null),
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${GOODDOLLAR.token}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    client.readContract({ address: GOODDOLLAR.nameService, abi: parseAbi(["function getAddress(string) view returns(address)"]), functionName: "getAddress", args: ["IDENTITY"] }),
  ]);
  if (chain !== 42220 || identity === zeroAddress) throw new WalletAuthError("Celo contract configuration could not be verified.", 503);
  if (competition.status !== "open") throw new WalletAuthError("Funding setup is available while the current tournament is open.", 409);
  if (!quoteResponse.ok) throw new WalletAuthError("The G$ price provider is unavailable. Try again later.", 503);
  const quote = dollarQuote((await quoteResponse.json()).pairs ?? []);
  const amount = parseUnits(SPONSOR_GD_AMOUNT, 18);
  const [balance, decimals, tokenCode, identityCode] = await Promise.all([
    client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "decimals" }),
    client.getCode({ address: GOODDOLLAR.token }), client.getCode({ address: identity }),
  ]);
  if (decimals !== 18 || !tokenCode || tokenCode === "0x" || !identityCode || identityCode === "0x") throw new WalletAuthError("The G$ and identity contracts could not be verified.", 503);
  if (balance < amount) throw new WalletAuthError(`This wallet needs ${SPONSOR_GD_AMOUNT} G$ for the approved deposit. No transaction was sent.`, 400);
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode as Hex, args: [GOODDOLLAR.token, identity, keccak256(stringToHex(competition.id)), BigInt(competition.endsAt / 1000), amount] });
  const quotedAt = Date.now();
  return { stage: "deploy", address, amount: formatUnits(amount, 18), amountRaw: String(amount), priceUsd: quote.priceUsd, estimatedUsd: (Number(SPONSOR_GD_AMOUNT) * Number(quote.priceUsd)).toFixed(4), quotedAt,
    quoteUrl: quote.quoteUrl, expiresAt: quotedAt + 5 * 60_000, tournament: competition.title, endsAt: competition.endsAt,
    ...await transactionView(client, { from: address, data, value: "0x0" }) };
}

export async function sponsorStatus(address: Address, deploymentHash: string): Promise<SponsorView> {
  if (!isHash(deploymentHash)) throw new WalletAuthError("Enter the deployment transaction hash.", 400);
  const client = celoClient();
  if (await client.getChainId() !== 42220) throw new WalletAuthError("The RPC is not connected to Celo.", 503);
  const receipt = await client.getTransactionReceipt({ hash: deploymentHash }).catch(error => {
    if (error.name === "TransactionReceiptNotFoundError") return null;
    throw error;
  });
  if (!receipt) return { stage: "pending", address, message: "Waiting for the deployment to confirm on Celo. Refresh confirmation shortly." };
  if (receipt.status !== "success") throw new WalletAuthError("The deployment reverted. No escrow was created. Check the transaction before preparing another deployment.", 409);
  const escrow = receipt.contractAddress;
  if (!escrow || receipt.from.toLowerCase() !== address.toLowerCase() || receipt.to !== null) throw new WalletAuthError("This is not a direct escrow deployment from your signed-in wallet.", 403);
  const read = <T extends "token" | "identity" | "manager" | "tournamentId" | "endsAt" | "poolCap" | "totalFunded" | "cancelled">(functionName: T) => client.readContract({ address: escrow, abi: escrowAbi, functionName });
  const [tx, token, identity, manager, tournamentId, endsAt, cap, funded, cancelled] = await Promise.all([
    client.getTransaction({ hash: deploymentHash }), read("token"), read("identity"), read("manager"), read("tournamentId"), read("endsAt"), read("poolCap"), read("totalFunded"), read("cancelled"),
  ]);
  const expectedData = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode as Hex, args: [token, identity, tournamentId, endsAt, cap] });
  if (tx.input.toLowerCase() !== expectedData.toLowerCase() || token.toLowerCase() !== GOODDOLLAR.token.toLowerCase() || manager.toLowerCase() !== address.toLowerCase() || cap !== parseUnits(SPONSOR_GD_AMOUNT, 18)) throw new WalletAuthError("The deployed contract does not match the reviewed Arcadia escrow and approved deposit.", 403);
  const result = { address, escrow, amount: formatUnits(cap, 18), amountRaw: String(cap), endsAt: Number(endsAt) * 1000 };
  if (funded >= cap) return { ...result, stage: "funded", message: "The G$ pool is funded on Celo. Distribution still requires a finalized allocation after the tournament closes." };
  if (cancelled || BigInt(Math.floor(Date.now() / 1000)) >= endsAt + 30n * 86400n) throw new WalletAuthError("This escrow is closed to funding.", 409);
  if (funded !== 0n) throw new WalletAuthError("This escrow has a partial contribution. Review it on Celo before adding funds.", 409);
  const [balance, allowance] = await Promise.all([
    client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "allowance", args: [address, escrow] }),
  ]);
  if (balance < cap) throw new WalletAuthError("Your wallet does not have enough G$ to fund this pool.", 400);
  if (allowance < cap) return { ...result, stage: "approve", ...await transactionView(client, { from: address, to: GOODDOLLAR.token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [escrow, cap] }), value: "0x0" }) };
  await client.simulateContract({ address: escrow, abi: escrowAbi, functionName: "fund", args: [cap], account: address });
  return { ...result, stage: "fund", ...await transactionView(client, { from: address, to: escrow,
    data: encodeFunctionData({ abi: escrowAbi, functionName: "fund", args: [cap] }), value: "0x0" }) };
}
