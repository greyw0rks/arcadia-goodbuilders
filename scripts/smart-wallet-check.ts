import { createPublicClient, createWalletClient, http, parseAbi, type Address } from "viem";
import { anvil } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { verifyWalletSignature } from "../lib/wallet-signature";
async function main() {
  const transport = http("http://127.0.0.1:18547");
  const client = createPublicClient({ chain: anvil, transport });
  if (await client.getChainId() !== 31337) throw new Error("Only the local Anvil chain is supported");
  const wallet = createWalletClient({ chain: anvil, transport });
  const [deployer] = await wallet.getAddresses();
  const signer = privateKeyToAccount(generatePrivateKey());
  const artifact = JSON.parse(await readFile("contracts/out/Wallet1271.sol/Wallet1271.json", "utf8"));
  const hash = await wallet.deployContract({ account: deployer, abi: artifact.abi, bytecode: artifact.bytecode.object, args: [signer.address] });
  const receipt = await client.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress as Address;
  const reader = {
    getCode: (address: Address) => client.getCode({ address }),
    isValidSignature: (address: Address, digest: `0x${string}`, signature: `0x${string}`) => client.readContract({ address, abi: parseAbi(["function isValidSignature(bytes32,bytes) view returns(bytes4)"]), functionName: "isValidSignature", args: [digest,signature] }),
  };
  const message = "Arcadia smart-wallet integration check";
  const signature = await signer.signMessage({ message });
  const accepted = await verifyWalletSignature(address,message,signature,reader);
  const alteredRejected = !await verifyWalletSignature(address,message+" altered",signature,reader);
  if (!accepted || !alteredRejected) throw new Error("EIP-1271 integration failed");
  const evidence = {checkedAt:new Date().toISOString(),chainId:31337,contract:address,deploymentTransaction:hash,accepted,alteredRejected,note:"A real deployed EIP-1271 contract on local Anvil; not a physical MiniPay device test."};
  await mkdir("docs/evidence",{recursive:true}); await writeFile("docs/evidence/smart-wallet.json",JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
}
main().catch((error) => { console.error(error); process.exitCode=1; });
