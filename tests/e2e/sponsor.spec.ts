import { test, expect } from "@playwright/test";
import { SPONSOR_ADDRESS } from "../../lib/sponsor-config";
const origin = "http://127.0.0.1:3046";
const deploymentHash = `0x${"1".padStart(64, "0")}`;

test("sponsor approval flow restores after reload and recovers a reverted approval without duplicate deposits", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((address) => {
    const state = window as unknown as { ethereum: unknown; sponsorSent: unknown[] };
    state.sponsorSent = [];
    state.ethereum = { request: async ({ method, params }: { method: string; params: unknown[] }) => {
      if (method === "eth_accounts") return [address];
      if (method === "eth_chainId") return 42220;
      if (method === "eth_sendTransaction") {
        state.sponsorSent.push(params[0]);
        const count = Number(sessionStorage.getItem("sponsor-test-count") || 0) + 1;
        sessionStorage.setItem("sponsor-test-count", String(count));
        return `0x${String(count).padStart(64, "0")}`;
      }
      throw new Error(`Unexpected method ${method}`);
    } };
  }, SPONSOR_ADDRESS);
  await page.route("**/api/progress", route => route.fulfill({ json: { progress: { version: 1, xp: 0, streak: 0, lastPlayed: null, daily: null }, identity: { address: SPONSOR_ADDRESS } } }));
  await page.route("**/api/tournament", route => route.fulfill({ json: { playerAddress: SPONSOR_ADDRESS, competition: null, identity: { verified: false, root: null } } }));
  await page.route("**/api/sponsor", async route => {
    const request = route.request().postDataJSON();
    const count = Number(await page.evaluate(() => sessionStorage.getItem("sponsor-test-count") || 0));
    const stage = request.action === "prepare" ? "deploy" : count === 1 || count === 2 ? "approve" : count === 3 ? "fund" : "funded";
    await route.fulfill({ json: {
      stage, address: SPONSOR_ADDRESS, amount: "6426.91913403696607823", amountRaw: "6426919134036966078230", gasEstimateCelo: "0.001",
      priceUsd: "0.0001150", estimatedUsd: "0.7391", quoteUrl: "https://dexscreener.com/celo/0x991f1aa7e0901f9ab3d583846bf5be0ebace1d7f", quotedAt: Date.now(), expiresAt: Date.now() + 300000,
      tournament: "Simulated test tournament", endsAt: Date.now() + 86400000,
      escrow: stage === "deploy" ? undefined : "0x1111111111111111111111111111111111111111",
      transactionResult: request.pendingHash ? count === 2 ? "reverted" : "success" : undefined,
      transaction: stage === "funded" ? undefined : { from: SPONSOR_ADDRESS, data: "0x1234", value: "0x0", ...(stage !== "deploy" ? { to: "0x1111111111111111111111111111111111111111" } : {}) },
      message: stage === "funded" ? "The G$ pool is funded on Celo." : undefined,
    } });
  });
  await page.goto("/fund");
  await page.getByRole("button", { name: "Prepare funding quote", exact: true }).click();
  await expect(page.getByText("Exact amount:", { exact: false })).toContainText("6426.91913403696607823");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sponsor-quote-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Deploy escrow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deploy escrow", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await page.getByRole("button", { name: "Approve this G$ amount", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await expect(page.locator(".game-error[role=alert]")).toContainText("transaction reverted");
  await page.getByRole("button", { name: "Approve this G$ amount", exact: true }).click();
  await page.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await page.getByRole("button", { name: "Fund escrow", exact: true }).click();
  await page.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pool funded", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fund escrow", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Number(sessionStorage.getItem("sponsor-test-count")))).toBe(4);
  expect(await page.getByText(deploymentHash, { exact: true }).textContent()).toBe(deploymentHash);
});

test("guests cannot prepare a funding transaction", async ({ page, context }) => {
  await page.goto("/fund");
  await expect(page.getByRole("heading", { name: "Fund the G$ pool" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare funding quote" })).toHaveCount(0);
  const response = await context.request.post(`${origin}/api/sponsor`, { headers: { origin }, data: { action: "prepare", playerAddress: null } });
  expect(response.status()).toBe(401);
});
