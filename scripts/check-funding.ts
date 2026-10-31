import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeEventLog, decodeFunctionData, erc20Abi, formatEther, formatUnits, parseAbi, parseUnits, type Hex } from "viem";
import { celoClient, GOODDOLLAR } from "../lib/gooddollar";
import { sponsorStatus } from "../lib/sponsor";
import { SPONSOR_ADDRESS, SPONSOR_GD_AMOUNT } from "../lib/sponsor-config";

async function main() {
  const [deploymentHash, approvalHash, fundingHash] = process.argv.slice(2) as Hex[];
  if (![deploymentHash, approvalHash, fundingHash].every(hash => /^0x[0-9a-f]{64}$/i.test(hash ?? ""))) throw new Error("Usage: check-funding.ts DEPLOYMENT_HASH APPROVAL_HASH FUNDING_HASH");
  const client = celoClient();
  const status = await sponsorStatus(SPONSOR_ADDRESS, deploymentHash);
  if (status.stage !== "funded" || !status.escrow) throw new Error("The reviewed escrow is not fully funded.");
  const escrow = status.escrow as Hex;
  const amount = parseUnits(SPONSOR_GD_AMOUNT, 18);
  const [head, deployment, approval, funding, deploymentTx, approvalTx, fundingTx, balance] = await Promise.all([
    client.getBlockNumber(), client.getTransactionReceipt({ hash: deploymentHash }), client.getTransactionReceipt({ hash: approvalHash }), client.getTransactionReceipt({ hash: fundingHash }),
    client.getTransaction({ hash: deploymentHash }), client.getTransaction({ hash: approvalHash }), client.getTransaction({ hash: fundingHash }),
    client.readContract({ address: GOODDOLLAR.token, abi: erc20Abi, functionName: "balanceOf", args: [escrow] }),
  ]);
  for (const receipt of [deployment, approval, funding]) {
    if (receipt.status !== "success" || receipt.from.toLowerCase() !== SPONSOR_ADDRESS || head - receipt.blockNumber < 2n) throw new Error("Successful sponsor receipts with at least three confirmations are required.");
  }
  const plan = JSON.parse(readFileSync("docs/evidence/sponsor-plan.json", "utf8"));
  if (deploymentTx.input.toLowerCase() !== plan.transaction.data.toLowerCase()) throw new Error("Deployment differs from the reviewed unsigned plan.");
  const approved = decodeFunctionData({ abi: erc20Abi, data: approvalTx.input });
  if (approvalTx.to?.toLowerCase() !== GOODDOLLAR.token.toLowerCase() || approved.functionName !== "approve" || String(approved.args[0]).toLowerCase() !== escrow.toLowerCase() || approved.args[1] !== amount) throw new Error("The exact escrow allowance was not approved.");
  const fundedAbi = parseAbi(["function fund(uint256 amount)", "event Funded(address indexed sponsor, uint256 amount)"]);
  const fundedCall = decodeFunctionData({ abi: fundedAbi, data: fundingTx.input });
  if (fundingTx.to?.toLowerCase() !== escrow.toLowerCase() || fundedCall.args[0] !== amount) throw new Error("The funding call differs from the approved deposit.");
  const hasEvent = (kind: "Funded" | "Transfer") => funding.logs.some(log => {
    try {
      if (kind === "Funded" && log.address.toLowerCase() === escrow.toLowerCase()) {
        const event = decodeEventLog({ abi: fundedAbi, data: log.data, topics: log.topics });
        return event.eventName === "Funded" && event.args.sponsor.toLowerCase() === SPONSOR_ADDRESS && event.args.amount === amount;
      }
      if (kind === "Transfer" && log.address.toLowerCase() === GOODDOLLAR.token.toLowerCase()) {
        const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics, eventName: "Transfer" });
        return event.args.from.toLowerCase() === SPONSOR_ADDRESS && event.args.to.toLowerCase() === escrow.toLowerCase() && event.args.value === amount;
      }
    } catch { return false; }
    return false;
  });
  if (!hasEvent("Funded") || !hasEvent("Transfer") || balance !== amount) throw new Error("Expected funding event, exact G$ transfer and matching pool balance are required.");
  const receipts = [deployment, approval, funding].map(receipt => ({ hash: receipt.transactionHash, blockNumber: String(receipt.blockNumber), confirmations: String(head - receipt.blockNumber + 1n), gasCostCelo: formatEther(receipt.gasUsed * receipt.effectiveGasPrice) }));
  const evidence = { checkedAt: new Date().toISOString(), chainId: 42220, escrow, sponsor: SPONSOR_ADDRESS, token: GOODDOLLAR.token, amount: SPONSOR_GD_AMOUNT, amountRaw: String(amount), contractBalance: formatUnits(balance, 18), endsAt: status.endsAt, deploymentMatchesReviewedPlan: true, exactApproval: true, exactTransfer: true, fundedEvent: true, funded: true, walletApprovedByUser: true, transactionsSentByAgent: false, receipts };
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync("docs/evidence/escrow-funded.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch(error => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
