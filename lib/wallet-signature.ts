import { createPublicClient, http, type Address, type Hex } from "viem";
import { celo } from "viem/chains";
import { hashMessage, verifyMessage } from "viem/utils";
import { WalletAuthError } from "./wallet-identity";

const signatureAbi = [{
  type: "function", name: "isValidSignature", stateMutability: "view",
  inputs: [{ name: "hash", type: "bytes32" }, { name: "signature", type: "bytes" }],
  outputs: [{ name: "magicValue", type: "bytes4" }],
}] as const;

export interface ContractSignatureReader {
  getCode(address: Address): Promise<Hex | undefined>;
  isValidSignature(address: Address, digest: Hex, signature: Hex): Promise<Hex>;
}

function celoReader(): ContractSignatureReader {
  const client = createPublicClient({ chain: celo, transport: http(process.env.ARCADIA_CELO_RPC_URL || "https://forno.celo.org", { timeout: 5_000, retryCount: 0 }) });
  return {
    getCode: async (address) => {
      if (await client.getChainId() !== celo.id) throw new Error("The signature RPC must serve Celo mainnet");
      return client.getCode({ address });
    },
    isValidSignature: (address, digest, signature) => client.readContract({ address, abi: signatureAbi, functionName: "isValidSignature", args: [digest, signature] }),
  };
}

// GoodQuest's EOA-first / EIP-1271 fallback, with the sign-in bound to Celo.
export async function verifyWalletSignature(address: Address, message: string, signature: Hex, reader?: ContractSignatureReader): Promise<boolean> {
  try {
    if (await verifyMessage({ address, message, signature })) return true;
  } catch { /* Smart wallets may return signatures of arbitrary length. */ }
  const contract = reader ?? celoReader();
  try {
    const code = await contract.getCode(address);
    if (!code || code === "0x") return false;
    return (await contract.isValidSignature(address, hashMessage(message), signature)).toLowerCase() === "0x1626ba7e";
  } catch {
    throw new WalletAuthError("Your wallet signature could not be checked on Celo. Please try again.", 503);
  }
}
