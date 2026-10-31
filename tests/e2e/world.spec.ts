import { test, expect } from "@playwright/test";
import { decodeFunctionData, erc20Abi } from "viem";
import { BUY_GD_URL, ARCADIA_ESCROW } from "../../lib/reward-display";
import { injectWallet, newAccount, signIn, startVerified, origin } from "../fixtures/wallet";

test("arcade screens remain complete without motion at mobile and desktop sizes", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const models: string[] = []; page.on("request", request => { if (request.url().endsWith(".glb")) models.push(request.url()); });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 740 ? 844 : 1000 });
    for (const path of width === 390 || width === 1440 ? ["/", "/tournaments", "/leaderboard", "/rewards", "/profile", "/app"] : ["/"]) {
      const tournamentReady = page.waitForResponse(response => response.url().includes("/api/tournament") && response.request().method() === "GET");
      await page.goto(path); await page.evaluate(() => document.fonts.ready);
      await tournamentReady;
      await expect(page.getByText("Loading", { exact: true })).toHaveCount(0);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator(".wallet-button")).toBeEnabled();
      await expect(page.locator(".topbar-rewards")).toHaveAccessibleName("Rewards");
      for (const link of await page.locator(".arcade-sidebar nav a:visible").all()) await expect(link).toHaveAccessibleName(/.+/);
      for (const img of await page.locator('img[src^="/world/"]').all()) await expect(img).toHaveJSProperty("complete", true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${path === "/" ? "home" : path.slice(1)}-${width}.png`), fullPage: true });
    }
  }
  expect(models).toEqual([]); expect(errors).toEqual([]);
});

test("3D loads lazily, pauses when idle and survives WebGL loss", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const scene = page.locator(".portal-feature .arcade-world");
  await expect(scene).toHaveAttribute("data-scene-state", "playing", { timeout: 30_000 });
  await page.getByRole("button", { name: "Pause scene animation" }).click();
  await expect(scene).toHaveAttribute("data-scene-state", "idle");
  await page.screenshot({ path: info.outputPath("home-live-3d-1440.png"), fullPage: true });
  await page.getByRole("button", { name: "Replay scene animation" }).click();
  await expect(scene).toHaveAttribute("data-scene-state", "idle", { timeout: 15_000 });
  await scene.locator("canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost")));
  await expect(scene).toHaveAttribute("data-scene-state", "static");
  await expect(scene.locator("img")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("link", { name: "Let’s play", exact: false })).toBeVisible();
});

test("free entry requires a wallet-approved zero-G$ receipt and can recover without resubmitting", async ({ page, context }, info) => {
  test.setTimeout(60_000);
  const account = newAccount(); await injectWallet(page, account, [], 42220);
  await page.goto("/app?genre=general"); await signIn(page, account.address); await page.keyboard.press("Escape");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await expect(page.getByRole("button", { name: "Join free tournament", exact: true })).toBeEnabled();
    await expect(page.locator(".trivia-grid")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Join free tournament", exact: true })).toHaveCount(1);
    await page.screenshot({ path: info.outputPath(`free-entry-${width}.png`), fullPage: true });
  }
  const start = () => context.request.post("/api/games/start", { headers: { origin }, data: { mode: "tournament", playerAddress: account.address.toLowerCase(), trivia: { game: "general", difficulty: "mixed" } } });
  expect((await start()).status()).toBe(409);
  await page.evaluate(() => { (window as any).arcadiaTestWallet.rejectTransaction = true; });
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  await expect(page.locator(".free-entry [role=alert]")).toBeVisible();
  expect((await start()).status()).toBe(409);
  await page.evaluate(() => { (window as any).arcadiaTestWallet.rejectTransaction = false; });
  let holdConfirmation = true;
  await page.route("**/api/tournament", route => {
    if (holdConfirmation && route.request().method() === "POST" && route.request().postDataJSON().action === "confirm") {
      return route.fulfill({ json: { stage: "pending", playerAddress: account.address.toLowerCase() } });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check entry confirmation", exact: true })).toBeEnabled({ timeout: 15_000 });
  expect((await start()).status()).toBe(409);
  const txs = await page.evaluate(() => (window as any).arcadiaTestWallet.transactions);
  expect(txs).toHaveLength(1);
  const decoded = decodeFunctionData({ abi: erc20Abi, data: txs[0].data });
  expect(decoded.functionName).toBe("approve"); expect(String(decoded.args![0]).toLowerCase()).toBe(ARCADIA_ESCROW); expect(decoded.args![1]).toBe(0n);
  expect(txs[0].value).toBe("0x0");
  await page.reload();
  await expect(page.getByRole("button", { name: "Check entry confirmation", exact: true })).toBeEnabled();
  holdConfirmation = false;
  await page.getByRole("button", { name: "Check entry confirmation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start or resume tournament game", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).arcadiaTestWallet.transactions)).toHaveLength(0);
  expect((await start()).status()).toBe(200);
  for (const mode of ["daily", "arcade"]) expect((await context.request.post("/api/games/start", { headers: { origin }, data: { mode, playerAddress: account.address.toLowerCase() } })).status()).toBe(410);
});

test("zero-G$ players see the correct DEX link and truthful reward status", async ({ page }) => {
  await startVerified(page, "/rewards");
  await expect(page.getByRole("heading", { name: "No G$ in your wallet?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Buy G$ now", exact: false })).toHaveAttribute("href", BUY_GD_URL);
  await expect(page.getByText("Claims are not open", { exact: true })).toBeVisible();
  await expect(page.locator(".reward-amount").first()).toContainText("6,426.92");
});

test("history is private and timed play never loads the 3D engine", async ({ page, context }) => {
  expect((await context.request.get("/api/history")).status()).toBe(401);
  await startVerified(page);
  const modelRequests: string[] = []; page.on("request", request => { if (request.url().endsWith(".glb")) modelRequests.push(request.url()); });
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  await expect(page.getByText("Question 1 of 10", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(modelRequests).toEqual([]);
  const history = await context.request.get("/api/history");
  expect(history.headers()["cache-control"]).toContain("no-store");
  expect((await history.json()).games).toEqual([]);
});
