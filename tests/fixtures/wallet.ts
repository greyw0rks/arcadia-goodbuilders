import { expect, type BrowserContext, type Page } from "@playwright/test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount, Hex } from "viem";
export const origin = "http://127.0.0.1:3046";
export const newAccount = () => privateKeyToAccount(generatePrivateKey());
export async function injectWallet(page: Page, account: PrivateKeyAccount, others: PrivateKeyAccount[] = [], chain: string | number = "0x1") {
  const accounts = [account, ...others];
  await page.exposeFunction("arcadiaTestSend", async (transaction: object) => {
    const response = await page.request.post("http://127.0.0.1:18546/test/transaction", { data: transaction });
    return (await response.json()).hash;
  });
  await page.exposeFunction("arcadiaTestSign", async ({ message, address }: { message: Hex; address: string }) => {
    const signer = accounts.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
    if (!signer) throw new Error("Unknown test account");
    return signer.signMessage({ message: { raw: message } });
  });
  await page.addInitScript(({ address, chain }) => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const state = { address, chain, reject: false, rejectTransaction: false, switchCount: 0, chainAfterSign: null as number | null, transactions: [] as unknown[] };
    Object.assign(window, {
      arcadiaTestWallet: state,
      ethereum: {
        isMiniPay: true,
        on: (event: string, fn: (...args: unknown[]) => void) => { (listeners[event] ??= []).push(fn); },
        removeListener: (event: string, fn: (...args: unknown[]) => void) => { listeners[event] = (listeners[event] ?? []).filter((listener) => listener !== fn); },
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_accounts" || method === "eth_requestAccounts") return [state.address];
          if (method === "eth_chainId") return state.chain;
          if (method === "wallet_switchEthereumChain") { state.chain = typeof state.chain === "number" ? 42220 : "0xa4ec"; state.switchCount++; return null; }
          if (method === "eth_sendTransaction") {
            if (state.rejectTransaction) throw Object.assign(new Error("User rejected transaction"), { code: 4001 });
            state.transactions.push(params![0]);
            const tx = params![0] as { data?: string };
            if (tx.data?.startsWith("0x095ea7b3") && tx.data.endsWith("0".repeat(64))) return (window as unknown as { arcadiaTestSend(tx: unknown): Promise<string> }).arcadiaTestSend(tx);
            return `0x${"b".repeat(64)}`;
          }
          if (method === "personal_sign") {
            if (state.reject) throw Object.assign(new Error("User rejected signature"), { code: 4001 });
            if (state.chainAfterSign !== null) state.chain = state.chainAfterSign;
            return (window as unknown as { arcadiaTestSign(args: object): Promise<string> }).arcadiaTestSign({ message: params![0], address: params![1] });
          }
          throw new Error(`Unexpected wallet request: ${method}`);
        },
      },
    });
  }, { address: account.address, chain });
}

export async function snapshot(context: BrowserContext) {
  const response = await context.request.get(`${origin}/api/progress`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function joinFree(context: BrowserContext, playerAddress: string) {
  const response = await context.request.post(`${origin}/api/tournament`, { headers: { origin }, data: { action: "prepare", playerAddress } });
  if (!response.ok()) return response;
  const prepared = await response.json();
  if (prepared.stage === "confirmed") return response;
  const receipt = await context.request.post("http://127.0.0.1:18546/test/transaction", { data: prepared.transaction });
  const { hash } = await receipt.json();
  return context.request.post(`${origin}/api/tournament`, { headers: { origin }, data: { action: "confirm", playerAddress, transactionHash: hash } });
}
export async function complete(context: BrowserContext, playerAddress: string | null = null, mode = "tournament") {
  const headers = { origin };
  if (playerAddress && mode === "tournament") await joinFree(context, playerAddress);
  const started = await context.request.post(`${origin}/api/games/start`, { headers, data: { playerAddress, mode, trivia: mode === "tournament" ? { game: "general", difficulty: "mixed" } : undefined } });
  if (!started.ok()) return started;
  let { game } = await started.json();
  if (game.phase === "complete") return context.request.post(`${origin}/api/games/action`, { headers, data: { playerAddress, id: game.id, action: "finish" } });
  for (let index = game.questionIndex; index < game.total; index++) {
    await context.request.post(`${origin}/api/games/action`, { headers, data: { playerAddress, id: game.id, action: "answer", questionIndex: index, answerIndex: 0 } });
    await context.request.post(`${origin}/api/games/action`, { headers, data: { playerAddress, id: game.id, action: "next", questionIndex: index } });
  }
  return context.request.post(`${origin}/api/games/action`, { headers, data: { playerAddress, id: game.id, action: "finish" } });
}

export async function signIn(page: Page, address: string) {
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
  await expect(page.getByText(address.toLowerCase(), { exact: true })).toBeVisible();
  await expect(page.getByText("Signed in. Your quiz progress is saved to this wallet account.")).toBeVisible();
}


export async function startVerified(page: Page, path = "/app?genre=general") {
  const account = newAccount();
  await injectWallet(page, account);
  await page.goto(path);
  await signIn(page, account.address);
  await page.keyboard.press("Escape");
  if (path === "/app?genre=general") {
    await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start or resume tournament game", exact: true })).toBeEnabled();
  }
  return account;
}
