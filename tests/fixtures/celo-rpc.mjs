// Local test-only RPC. Production code has no identity-verification bypass.
import { createServer } from 'node:http';
import { encodeAbiParameters, encodeEventTopics, erc20Abi, toFunctionSelector, zeroAddress } from 'viem';
import { createHash } from 'node:crypto';
const identity = '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42';
const aliases = new Map();
const outages = new Set();
const transactions = new Map();
let head = 256;
const token = '0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a';
const escrow = '0x876b0684b3d156434c3fc83dc807ec274c3c9273';
const blockHash = n => `0x${n.toString(16).padStart(64, '0')}`;
const reply = (type, value) => encodeAbiParameters([{type}], [value]);
createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET') return res.end('{}');
  if (req.url === '/test/identity') { const {address, root} = JSON.parse(body); aliases.set(address.toLowerCase(), root.toLowerCase()); return res.end('{}'); }
  if (req.url === '/test/outage') { const {address, enabled} = JSON.parse(body); if (enabled) outages.add(address.toLowerCase()); else outages.delete(address.toLowerCase()); return res.end('{}'); }
  if (req.url === '/test/transaction') {
    const tx = JSON.parse(body); head += 2;
    const hash = `0x${createHash('sha256').update(JSON.stringify(tx) + head).digest('hex')}`;
    const block = head - 1;
    const logs = tx.to?.toLowerCase() === token && tx.data?.startsWith(toFunctionSelector('approve(address,uint256)')) ? [{ address: token, topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Approval', args: { owner: tx.from, spender: escrow } }), data: encodeAbiParameters([{ type: 'uint256' }], [BigInt(`0x${tx.data.slice(-64)}`)]), blockHash: blockHash(block), blockNumber: `0x${block.toString(16)}`, transactionHash: hash, transactionIndex: '0x0', logIndex: '0x0', removed: false }] : [];
    transactions.set(hash, { ...tx, hash, block, logs, timestamp: Math.floor(Date.now() / 1000) });
    return res.end(JSON.stringify({ hash }));
  }
  const execute = ({id, method, params}) => {
    let result;
    if (method === 'eth_chainId') result = '0xa4ec';
    else if (method === 'eth_blockNumber') result = `0x${head.toString(16)}`;
    else if (method === 'eth_getTransactionReceipt') { const tx = transactions.get(params[0]); result = tx ? { transactionHash: tx.hash, blockNumber: `0x${tx.block.toString(16)}`, blockHash: blockHash(tx.block), from: tx.from, to: tx.to, status: '0x1', logs: tx.logs, transactionIndex: '0x0', cumulativeGasUsed: '0xc350', gasUsed: '0xc350', effectiveGasPrice: '0x1', type: '0x2', contractAddress: null, logsBloom: `0x${'0'.repeat(512)}` } : null; }
    else if (method === 'eth_getTransactionByHash') { const tx = transactions.get(params[0]); result = tx ? { from: tx.from, to: tx.to, input: tx.data, value: tx.value ?? '0x0', hash: tx.hash, blockNumber: `0x${tx.block.toString(16)}`, blockHash: blockHash(tx.block), nonce: '0x1', gas: '0xc350', gasPrice: '0x1', chainId: '0xa4ec', transactionIndex: '0x0', v: '0x0', r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}`, type: '0x2' } : null; }
    else if (method === 'eth_getBlockByNumber') { const n = params[0] === 'latest' ? head : Number(BigInt(params[0])); const tx = [...transactions.values()].find(t => t.block === n); result = { hash: blockHash(n), number: `0x${n.toString(16)}`, timestamp: `0x${(tx?.timestamp ?? Math.floor(Date.now() / 1000)).toString(16)}`, transactions: [], gasLimit: '0x1000000', gasUsed: '0xc350', size: '0x200', difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', baseFeePerGas: '0x1', miner: zeroAddress, nonce: '0x0000000000000000', parentHash: blockHash(n - 1), sha3Uncles: blockHash(0), receiptsRoot: blockHash(0), stateRoot: blockHash(0), transactionsRoot: blockHash(0), logsBloom: `0x${'0'.repeat(512)}`, uncles: [] }; }
    else if (method === 'eth_getCode') result = '0x6000';
    else if (method === 'eth_call') {
      const data = params[0].data;
      const selector = data.slice(0,10);
      if (selector === toFunctionSelector('getWhitelistedRoot(address)') && outages.has(`0x${data.slice(-40)}`.toLowerCase())) return {id,jsonrpc:'2.0',error:{code:-32000,message:'Simulated identity RPC outage'}};
      if (selector === toFunctionSelector('getAddress(string)')) result = reply('address', identity);
      else if (selector === toFunctionSelector('getWhitelistedRoot(address)')) { const address = `0x${data.slice(-40)}`.toLowerCase(); result = reply('address', aliases.get(address) ?? address); }
      else if (selector === toFunctionSelector('isWhitelisted(address)')) result = reply('bool', data.slice(-40) !== zeroAddress.slice(2));
      else if (selector === toFunctionSelector('isValidSignature(bytes32,bytes)')) result = reply('bytes4', '0xffffffff');
      else if (selector === toFunctionSelector('balanceOf(address)')) result = reply('uint256', data.slice(-40).toLowerCase() === escrow.slice(2) ? 6426919134036966078230n : 0n);
      else return {id,jsonrpc:'2.0',error:{code:-32601,message:'Unsupported test call'}};
    } else return {id,jsonrpc:'2.0',error:{code:-32601,message:'Unsupported test method'}};
    return {id,jsonrpc:'2.0',result};
  };
  const parsed = JSON.parse(body); res.end(JSON.stringify(Array.isArray(parsed) ? parsed.map(execute) : execute(parsed)));
}).listen(18546, '127.0.0.1');
