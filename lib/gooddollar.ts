import { createPublicClient, http, parseAbi, zeroAddress, type Address } from "viem";
import { celo } from "viem/chains";
import { WalletAuthError } from "./wallet-identity";

export const GOODDOLLAR = {
  chainId: 42220,
  token: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
  nameService: "0x0F5dB7a64A6a64052693676CA898EC7F7A94FF4e" as Address,
  decimals: 18,
  verifyUrl: "https://goodwallet.xyz",
};
export const identityAbi = parseAbi([
  "function getWhitelistedRoot(address account) view returns (address)",
  "function isWhitelisted(address account) view returns (bool)",
  "function connectAccount(address account)",
]);
export function celoClient() {
  return createPublicClient({ chain: celo, transport: http(process.env.ARCADIA_CELO_RPC_URL || "https://forno.celo.org", { timeout: 8000, retryCount: 1 }) });
}
export async function goodIdentity(address: string | null) {
  if (!address) return { verified: false, root: null, identityContract: null, verificationUrl: GOODDOLLAR.verifyUrl };
  try {
    const client = celoClient();
    if (await client.getChainId() !== 42220) throw new Error("Wrong RPC network");
    const blockNumber = await client.getBlockNumber();
    const identityContract = await client.readContract({ address: GOODDOLLAR.nameService, abi: parseAbi(["function getAddress(string) view returns(address)"]), functionName: "getAddress", args: ["IDENTITY"], blockNumber });
    if (identityContract === zeroAddress) throw new Error("Identity registry unavailable");
    const root = await client.readContract({ address: identityContract, abi: identityAbi, functionName: "getWhitelistedRoot", args: [address as Address], blockNumber });
    const verified = root !== zeroAddress && await client.readContract({ address: identityContract, abi: identityAbi, functionName: "isWhitelisted", args: [root], blockNumber });
    return { verified, root: verified ? root.toLowerCase() : null, identityContract, verificationUrl: GOODDOLLAR.verifyUrl, checkedBlock: String(blockNumber) };
  } catch { throw new WalletAuthError("GoodDollar identity could not be checked on Celo. Try again shortly.", 503); }
}
