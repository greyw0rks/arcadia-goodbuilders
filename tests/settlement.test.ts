import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, parseAbi, toHex, type Address, type Hex } from "viem";
import { allocationLeaf, allocationTree, pairHash, verifyClaimReceipt } from "../lib/settlement";
const address = (n: string) => `0x${n.repeat(40)}` as Address;
const escrow=address("1"), token=address("2"), a=address("3"), b=address("4"), c=address("5");
const tournament = keccak256(toHex("founding-week"));
describe("settlement proofs and receipts", () => {
  it("builds proofs for odd-sized allocations, bound to chain, escrow, player and amount", () => {
    const tree = allocationTree(42220, escrow, tournament, [{address:a,amount:100n},{address:b,amount:50n},{address:c,amount:1n}]);
    expect(tree.totalAllocated).toBe("151");
    for (const claim of tree.claims) {
      const leaf=allocationLeaf(42220,escrow,tournament,{address:claim.address,amount:BigInt(claim.amount)});
      expect(claim.proof.reduce(pairHash,leaf)).toBe(tree.root);
      expect(claim.proof.reduce(pairHash,allocationLeaf(42220,escrow,tournament,{address:claim.address,amount:BigInt(claim.amount)+1n}))).not.toBe(tree.root);
    }
    expect(allocationTree(1,escrow,tournament,[{address:a,amount:100n}]).root).not.toBe(allocationTree(42220,escrow,tournament,[{address:a,amount:100n}]).root);
  });
  it("requires matching claim and token-transfer logs and three confirmations", () => {
    const receipt = {status:"success",to:escrow,blockNumber:10n,logs:[
      {address:escrow,topics:encodeEventTopics({abi:parseAbi(["event Claimed(address indexed account,uint256 amount)"]),eventName:"Claimed",args:{account:a}}) as Hex[],data:encodeAbiParameters([{type:"uint256"}],[100n])},
      {address:token,topics:encodeEventTopics({abi:parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]),eventName:"Transfer",args:{from:escrow,to:a}}) as Hex[],data:encodeAbiParameters([{type:"uint256"}],[100n])},
    ]};
    const expected={escrow,token,address:a,amount:100n,head:12n};
    expect(verifyClaimReceipt(receipt,expected)).toBe(true);
    expect(() => verifyClaimReceipt(receipt,{...expected,head:11n})).toThrow();
    expect(() => verifyClaimReceipt(receipt,{...expected,amount:101n})).toThrow();
    expect(() => verifyClaimReceipt({...receipt,status:"reverted"},expected)).toThrow();
    expect(() => verifyClaimReceipt({...receipt,logs:receipt.logs.slice(0,1)},expected)).toThrow();
  });
});
