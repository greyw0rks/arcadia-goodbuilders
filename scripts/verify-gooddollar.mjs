import { createPublicClient, http, parseAbi } from 'viem';
import { celo } from 'viem/chains';
import { mkdir, writeFile } from 'node:fs/promises';
const client = createPublicClient({ chain: celo, transport: http(process.env.ARCADIA_CELO_RPC_URL || 'https://forno.celo.org', { timeout: 15000, retryCount: 1 }) });
const token = '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A';
const nameservice = '0x0F5dB7a64A6a64052693676CA898EC7F7A94FF4e';
const abi = parseAbi(['function getAddress(string) view returns(address)']);
const chainId = await client.getChainId();
if (chainId !== 42220) throw new Error('Expected Celo mainnet');
const blockNumber = await client.getBlockNumber();
const identity = await client.readContract({ address: nameservice, abi, functionName: 'getAddress', args: ['IDENTITY'], blockNumber });
const [symbol, decimals, tokenCode, identityCode] = await Promise.all([
  client.readContract({ address: token, abi: parseAbi(['function symbol() view returns(string)']), functionName: 'symbol', blockNumber }),
  client.readContract({ address: token, abi: parseAbi(['function decimals() view returns(uint8)']), functionName: 'decimals', blockNumber }),
  client.getCode({ address: token, blockNumber }), client.getCode({ address: identity, blockNumber }),
]);
const rootProbe = await client.readContract({ address: identity, abi: parseAbi(['function getWhitelistedRoot(address) view returns(address)']), functionName: 'getWhitelistedRoot', args: ['0x0000000000000000000000000000000000000000'], blockNumber });
const evidence = { checkedAt: new Date().toISOString(), chainId, blockNumber: String(blockNumber), token, symbol, decimals, nameservice, identity, tokenHasCode: !!tokenCode && tokenCode !== '0x', identityHasCode: !!identityCode && identityCode !== '0x', rootProbe, source: 'https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json', sourceBlobSha: 'd117ffec6881f7e963fe09c06dcf3dea00687142' };
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/gooddollar-celo.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
