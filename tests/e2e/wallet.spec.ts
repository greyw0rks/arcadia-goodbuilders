import { test, expect } from "@playwright/test";
import { decodeFunctionData, parseAbi, zeroAddress, type Hex } from "viem";
import { QUESTION_BANK } from "../../lib/questions";

import { origin, newAccount, injectWallet, snapshot, complete, signIn, startVerified, joinFree } from "../fixtures/wallet";

test("ten-second questions time out and advance automatically without another click", async ({ page }) => {
  const account = await startVerified(page);
  await expect(page.getByText("10 seconds each", { exact: true })).toBeVisible();
  const started = page.waitForResponse("**/api/games/start");
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  const { game } = await (await started).json();
  expect(game.deadline - game.serverNow).toBe(10_000);
  await expect(page.getByText("Time is up", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Question 2 of 10")).toBeVisible();
  const next = page.waitForResponse(response => response.url().endsWith("/api/games/action") && response.request().postDataJSON().action === "next");
  await page.locator(".answer-button").first().click();
  expect((await (await next).json()).game.questionIndex).toBe(2);
  await expect(page.getByText("Question 3 of 10")).toBeVisible();
});

test("an identity RPC outage cannot interrupt an authorized tournament run", async ({ page, context }) => {
  const account = newAccount();
  await injectWallet(page, account);
  await page.goto("/app?mode=daily");
  await signIn(page, account.address);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  await page.getByRole("button", { name: "Play tournament", exact: true }).click();
  await page.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  await expect(page.getByText("Question 1 of 10")).toBeVisible();
  const outage = (enabled: boolean) => fetch("http://127.0.0.1:18546/test/outage", { method: "POST", body: JSON.stringify({ address: account.address, enabled }) });
  await outage(true);
  try {
    for (let index = 0; index < 10; index++) {
      await expect(page.getByText(`Question ${index + 1} of 10`)).toBeVisible();
      await page.locator(".answer-button").first().click();
    }
    await expect(page.getByText("Game 1 · 100% XP rate", { exact: true })).toBeVisible();
    await expect(page.locator("#challenge [role=alert]")).toHaveCount(0);
    const next = await context.request.post(`${origin}/api/games/start`, { headers: { origin }, data: { mode: "tournament", playerAddress: account.address.toLowerCase() } });
    expect(next.status()).toBe(503); // A new run must still pass verification.
  } finally { await outage(false); }
});

test("three simulated players complete the tournament-to-profile journey with independent scores", async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const results = await Promise.all([0, 1, 2].map(async (playerIndex) => {
    const width = playerIndex === 1 ? 1440 : 390;
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    try {
      const account = newAccount();
      const page = await context.newPage();
      await injectWallet(page, account, [], 42220);
      await page.goto("/app?mode=daily");
      await signIn(page, account.address);
      await page.keyboard.press("Escape");
      async function play(mode: "daily" | "tournament") {
        const start = page.waitForResponse("**/api/games/start");
        await page.getByRole("button", { name: mode === "daily" ? "Start or resume tournament game" : "Start or resume tournament game", exact: true }).click();
        let game = (await (await start).json()).game;
        let correct = 0;
        const completed = page.waitForResponse(response => response.url().endsWith("/api/games/action") && response.request().postDataJSON().action === "finish");
        for (let index = 0; index < game.total; index++) {
          const source = QUESTION_BANK.find((question) => question.id === game.question.id)!;
          const answer = game.question.options.indexOf(source.options[source.answerIndex]);
          expect(answer).toBeGreaterThanOrEqual(0);
          const shouldBeCorrect = playerIndex === 0 || playerIndex === 1 && index % 2 === 0;
          const chosen = shouldBeCorrect ? answer : (answer + 1) % 4;
          const committed = page.waitForResponse("**/api/games/action");
          await page.locator(".answer-button").nth(chosen).click();
          expect((await (await committed).json()).game.feedback.correct).toBe(shouldBeCorrect);
          if (shouldBeCorrect) correct++;
          const next = page.waitForResponse(response => response.url().endsWith("/api/games/action") && response.request().postDataJSON().action === "next");
          game = (await (await next).json()).game;
        }

        const saved = (await (await completed).json()).game.result;
        expect(saved.correct).toBe(correct);
        expect(saved.creditedXp).toBe(50 + correct * 10);
        return saved.creditedXp as number;
      }
      await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
      await page.getByRole("button", { name: "Play tournament", exact: true }).click();
  await page.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
      await expect(page.locator("#challenge").getByText("3 easy, 3 medium, 2 hard and 2 extremely hard", { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`simulated-player-${playerIndex}-ready.png`), fullPage: true });
      const tournamentXp = await play("tournament");
      await page.goto("/profile");
      await expect(page.locator(".profile-progress").getByRole("definition").first()).toHaveText(String(tournamentXp));
      await expect(page.locator("#gooddollar").getByText("Verified GoodDollar wallet", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your tournament", exact: true })).toBeVisible();
      const entry = (await (await context.request.get(`${origin}/api/tournament`)).json()).competition.entry;
      expect(entry).toMatchObject({ completedGames: 1, xp: tournamentXp });
      expect((await snapshot(context)).progress.xp).toBe(0);
      return { player: playerIndex, tournamentXp };
    } finally { await context.close(); }
  }));
  expect(results.map((result) => result.tournamentXp)).toEqual([150, 100, 50]);
  await testInfo.attach("simulated-cohort", { body: JSON.stringify({ synthetic: true, players: results, humanFeedbackCollected: false }, null, 2), contentType: "application/json" });
});

test("arcade home preserves free launch entry, favicon and verified play gate", async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your daily arcade." })).toBeVisible();
    await expect(page.locator(".today-tournament").getByRole("definition").first()).toHaveText("Free");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
  }
  const icon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
  expect(icon).toMatch(/^\/icon\.svg(?:\?|$)/);
  expect((await page.request.get(icon!)).status()).toBe(200);
  expect((await page.request.get("/favicon.ico")).status()).toBe(200);
  await page.getByRole("link", { name: "Let’s play", exact: false }).click();
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`wallet-gate-${width}.png`), fullPage: true });
  }
});

test("numeric WalletConnect chain IDs complete sign-in without an unnecessary network switch", async ({ page, context }) => {
  const account = newAccount();
  await injectWallet(page, account, [], 42220);
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeEnabled();
  await signIn(page, account.address);
  expect((await snapshot(context)).identity.address).toBe(account.address.toLowerCase());
  expect(await page.evaluate(() => (window as unknown as { arcadiaTestWallet: { switchCount: number } }).arcadiaTestWallet.switchCount)).toBe(0);
});

test("numeric chain responses work after switching and still reject a network change during signing", async ({ page, context }) => {
  const account = newAccount();
  await injectWallet(page, account, [], 1);
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { arcadiaTestWallet: { chainAfterSign: number | null } }).arcadiaTestWallet.chainAfterSign = 1; });
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
  await expect(page.getByText("Your wallet account or network changed. Start sign-in again.")).toBeVisible();
  expect((await snapshot(context)).identity.address).toBeNull();
  await page.evaluate(() => { (window as unknown as { arcadiaTestWallet: { chainAfterSign: number | null } }).arcadiaTestWallet.chainAfterSign = null; });
  await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
  await expect(page.getByText("Signed in. Your quiz progress is saved to this wallet account.")).toBeVisible();
  expect((await snapshot(context)).identity.address).toBe(account.address.toLowerCase());
});

test("phone sign-in cancellation, verified play, cross-device restore and sign-out", async ({ browser }, testInfo) => {
  const account = newAccount();
  const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await first.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await injectWallet(page, account);
    await page.goto(`${origin}/app?mode=daily`);
    await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
    await page.evaluate(() => { (window as unknown as { arcadiaTestWallet: { reject: boolean } }).arcadiaTestWallet.reject = true; });
    await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
    await expect(page.getByText("Sign-in cancelled. Your progress has not changed.")).toBeVisible();
    expect((await snapshot(first)).identity.address).toBeNull();
    await page.evaluate(() => { (window as unknown as { arcadiaTestWallet: { reject: boolean } }).arcadiaTestWallet.reject = false; });
    await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
    await expect(page.getByText(account.address.toLowerCase(), { exact: true })).toBeVisible();
    const cookies = await first.cookies();
    expect(cookies.find(cookie => cookie.name === "__Host-arcadia_session")).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    await page.screenshot({ path: testInfo.outputPath("mobile-wallet.png") });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
    await page.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start or resume tournament game" })).toBeEnabled();
    const started = page.waitForResponse("**/api/games/start");
    await page.getByRole("button", { name: "Start or resume tournament game" }).click();
    const savedGameId = (await (await started).json()).game.id;
    for (let index = 0; index < 10; index++) {
      await page.locator(".answer-button").first().click();
      if (index < 9) await expect(page.getByText(`Question ${index + 2} of 10`)).toBeVisible();
    }
    await expect(page.getByText("Game 1 · 100% XP rate", { exact: true })).toBeVisible();
    const saved = await snapshot(first);
    const savedEntry = (await (await first.request.get(`${origin}/api/tournament`)).json()).competition.entry;
    expect(savedEntry.xp).toBeGreaterThanOrEqual(50);
    await page.reload();
    await expect(page.getByRole("heading", { name: "General Trivia", exact: true })).toBeVisible();
    expect(await snapshot(first)).toEqual(saved);
    const otherPage = await second.newPage();
    await injectWallet(otherPage, account);
    await otherPage.goto(`${origin}/app?mode=daily`);
    await expect(otherPage.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
    await signIn(otherPage, account.address);
    expect((await snapshot(second)).progress).toEqual(saved.progress);
    const restored = await second.request.post(`${origin}/api/games/action`, { headers: { origin }, data: { playerAddress: account.address.toLowerCase(), id: savedGameId, action: "finish" } });
    expect((await restored.json()).game.result.creditedXp).toBe(0);
    expect((await (await second.request.get(`${origin}/api/tournament`)).json()).competition.entry.xp).toBe(savedEntry.xp);
    await otherPage.screenshot({ path: testInfo.outputPath("desktop-wallet.png") });
    await page.locator(".wallet-button").click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
    expect((await snapshot(first)).progress.xp).toBe(0);
    expect((await snapshot(second)).progress).toEqual(saved.progress);
    expect(errors).toEqual([]);
  } finally { await first.close(); await second.close(); }
});

test("auth API enforces origin, browser binding, single-use challenges and account match", async ({ browser }) => {
  const account = newAccount();
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    await snapshot(first);
    const denied = await first.request.post(`${origin}/api/auth/challenge`, { headers: { origin: "https://celo.arcadia.uno" }, data: { address: account.address } });
    expect(denied.status()).toBe(403);
    const response = await first.request.post(`${origin}/api/auth/challenge`, { headers: { origin }, data: { address: account.address } });
    expect(response.headers()["cache-control"]).toContain("no-store");
    const challenge = await response.json();
    const signature = await account.signMessage({ message: challenge.message });
    const options = { headers: { origin }, data: { nonce: challenge.nonce, signature } };
    expect((await second.request.post(`${origin}/api/auth/verify`, options)).status()).toBe(401);
    expect((await first.request.post(`${origin}/api/auth/verify`, options)).status()).toBe(200);
    expect((await first.request.post(`${origin}/api/auth/verify`, options)).status()).toBe(401);
    expect((await complete(first)).status()).toBe(409);
    expect((await complete(first, account.address.toLowerCase())).status()).toBe(200);
    expect((await first.request.post(`${origin}/api/auth/logout`, { data: {} })).status()).toBe(403);
    expect((await snapshot(first)).identity.address).toBe(account.address.toLowerCase());
  } finally { await first.close(); await second.close(); }
});

test("background reads cannot replace the browser binding or clear a newer wallet session", async ({ context }) => {
  const account = newAccount();
  const reads = () => Promise.all(["/api/progress", "/api/tournament", "/api/rewards"].map(path => context.request.get(`${origin}${path}`, { headers: { cookie: "" } })));
  for (const response of await reads()) {
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  const issued = await context.request.post(`${origin}/api/auth/challenge`, { headers: { origin }, data: { address: account.address } });
  expect(issued.status()).toBe(200);
  const challenge = await issued.json();
  const binding = (await context.cookies()).find(cookie => cookie.name === "arcadia_player")?.value;
  expect(binding).toBeTruthy();
  // These requests carry the empty cookies of an earlier, still-pending page load.
  for (const response of await reads()) expect(response.headers()["set-cookie"]).toBeUndefined();
  expect((await context.cookies()).find(cookie => cookie.name === "arcadia_player")?.value).toBe(binding);
  const signature = await account.signMessage({ message: challenge.message });
  const verified = await context.request.post(`${origin}/api/auth/verify`, { headers: { origin }, data: { nonce: challenge.nonce, signature } });
  expect(verified.status()).toBe(200);
  const stale = await context.request.get(`${origin}/api/progress`, { headers: { cookie: `__Host-arcadia_session=${"f".repeat(64)}` } });
  expect(stale.headers()["set-cookie"]).toBeUndefined();
  expect((await snapshot(context)).identity.address).toBe(account.address.toLowerCase());
});

test("account changes refresh other tabs and never carry another wallet's XP", async ({ browser }) => {
  const account = newAccount();
  const otherAccount = newAccount();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await injectWallet(page, account, [otherAccount]);
    await page.goto(`${origin}/app?mode=daily`);
    await signIn(page, account.address);
    await complete(context, account.address.toLowerCase());
    const otherTab = await context.newPage();
    await injectWallet(otherTab, otherAccount, [], 42220);
    await otherTab.goto(`${origin}/app?mode=daily`);
    await expect(otherTab.getByRole("heading", { name: "General Trivia", exact: true })).toBeVisible();
    await page.evaluate((address) => { (window as unknown as { arcadiaTestWallet: { address: string } }).arcadiaTestWallet.address = address; }, otherAccount.address);
    await page.getByRole("button", { name: "Switch wallet", exact: true }).click();
    await page.getByRole("button", { name: "Sign in with selected wallet" }).click();
    await expect(page.getByText(otherAccount.address.toLowerCase(), { exact: true })).toBeVisible();
    await expect(otherTab.getByRole("heading", { name: "Join this week’s tournament." })).toBeVisible();
    await otherTab.getByRole("button", { name: "Join free tournament", exact: true }).click();
    await otherTab.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
    await expect(otherTab.getByRole("button", { name: "Start or resume tournament game" })).toBeEnabled();
    expect((await snapshot(context)).progress.xp).toBe(0);
    await otherTab.getByRole("button", { name: "Start or resume tournament game" }).click();
    await otherTab.locator(".wallet-button").click();
    await expect(otherTab.getByRole("button", { name: "Sign out", exact: true })).toBeDisabled();
    await expect(otherTab.getByText("Finish your current quiz before changing accounts.")).toBeVisible();
  } finally { await context.close(); }
});

test("a browser without a wallet cannot start any game, including direct API requests", async ({ page, context }) => {
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with wallet", exact: true }).click();
  await expect(page.getByText("Open Arcadia inside MiniPay or a browser with an Ethereum wallet, or choose Connect GoodWallet.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".answer-button")).toHaveCount(0);
  for (const mode of ["daily", "arcade", "tournament"]) {
    const response = await context.request.post("/api/games/start", { headers: { origin }, data: { mode, trivia: { game: "general", difficulty: "easy" } } });
    expect(response.status()).toBe(401);
    expect(await response.json()).not.toHaveProperty("game");
  }
  expect((await context.request.post("/api/games/action", { headers: { origin }, data: { id: "guessed", action: "read" } })).status()).toBe(401);
});

test("game-start request limits return a retry window without creating duplicate attempts", async ({ page, context }) => {
  const account = await startVerified(page);
  const ids = new Set<string>();
  let denied;
  // Allow one fixed-window boundary during the requests.
  for (let i = 0; i < 41; i++) {
    const response = await context.request.post(`${origin}/api/games/start`, { headers: { origin }, data: { playerAddress: account.address.toLowerCase(), mode: "tournament", trivia: { game: "general", difficulty: "mixed" } } });
    if (response.status() === 429) { denied = response; break; }
    expect(response.status()).toBe(200);
    ids.add((await response.json()).game.id);
  }
  expect(denied?.status()).toBe(429);
  expect(Number(denied?.headers()["retry-after"])).toBeGreaterThan(0);
  expect(ids.size).toBe(1);
  expect((await context.request.get(`${origin}/api/maintenance`)).status()).toBe(401);
  const cleanup = await context.request.get(`${origin}/api/maintenance`, { headers: { authorization: "Bearer arcadia-e2e-maintenance-only" } });
  expect(cleanup.status()).toBe(200);
  expect((await cleanup.json()).ok).toBe(true);
});

test("a stale tab resumes the current question without submitting its old answer again", async ({ page, context }) => {
  const account = await startVerified(page);
  const started = page.waitForResponse("**/api/games/start");
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  const { game } = await (await started).json();
  for (const action of ["answer", "next"]) {
    const response = await context.request.post(`${origin}/api/games/action`, {
      headers: { origin }, data: { playerAddress: account.address.toLowerCase(), id: game.id, action, questionIndex: 0, answerIndex: 0 },
    });
    expect(response.status()).toBe(200);
  }
  const conflict = page.waitForResponse("**/api/games/action");
  await page.locator(".answer-button").first().click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByText("Question 2 of 10")).toBeVisible();
  await expect(page.locator("#challenge").getByRole("alert")).toContainText("That question is no longer active");
  const refreshed = page.waitForResponse("**/api/games/action");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  expect((await refreshed).request().postDataJSON().action).toBe("read");
  await expect(page.locator("#challenge").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".answer-feedback")).toHaveCount(0);
  await page.locator(".answer-button").first().click();
  await expect(page.getByText("Question 3 of 10")).toBeVisible();
});

test("an expired-game response unlocks navigation and returns to the tournament", async ({ page }) => {
  const account = await startVerified(page);
  const started = page.waitForResponse("**/api/games/start");
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  const { game } = await (await started).json();
  // Exercise the browser's closing-time response without changing the clock
  // of the shared production server. Real expiry is covered by GameStore tests.
  await page.route("**/api/games/action", (route) => route.fulfill({ status: 409, json: {
    error: "This game has expired. Unfinished games earn no XP.",
    game: { ...game, phase: "expired", question: null, feedback: null, result: null },
  } }));
  await page.locator(".answer-button").first().click();
  await expect(page.getByRole("heading", { name: "This game has ended." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to today’s tournament" })).toBeVisible();
  await expect(page.locator(".arcade-sidebar")).toBeVisible();
  await page.locator(".wallet-button").click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
});

test("retrying a lost completion response credits a tournament game only once", async ({ page, context }) => {
  await startVerified(page);
  await page.getByRole("button", { name: "Start or resume tournament game" }).click();
  let dropCompletion = true;
  await page.route("**/api/games/action", async route => {
    if (route.request().postDataJSON().action !== "finish" || !dropCompletion) return route.continue();
    dropCompletion = false;
    expect((await route.fetch()).status()).toBe(200);
    await route.abort("failed");
  });
  for (let index = 0; index < 10; index++) {
    await page.locator(".answer-button").first().click();
    if (index < 9) await expect(page.getByText(`Question ${index + 2} of 10`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  const saved = (await (await context.request.get(`${origin}/api/tournament`)).json()).competition.entry;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Game 1 · 100% XP rate", { exact: true })).toBeVisible();
  const after = (await (await context.request.get(`${origin}/api/tournament`)).json()).competition.entry;
  expect(after.xp).toBe(saved.xp); expect(after.completedGames).toBe(1);
  expect((await snapshot(context)).progress.xp).toBe(0);
});


test("verified players enroll, complete ten-question games, and retain counts through linked wallets", async ({ browser }) => {
  const account = newAccount();
  const linked = newAccount();
  await fetch("http://127.0.0.1:18546/test/identity", { method: "POST", body: JSON.stringify({ address: linked.address, root: account.address }) });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await injectWallet(page, account, [linked]);
    await page.goto(`${origin}/app?mode=daily`);
    await signIn(page, account.address);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Join free tournament" }).click();
    await page.getByRole("button", { name: "Play tournament", exact: true }).click();
  await page.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
    await page.getByRole("button", { name: "Start or resume tournament game" }).click();
    for (let index = 0; index < 10; index++) {
      await expect(page.getByText(`Question ${index + 1} of 10`)).toBeVisible();
      await page.locator(".answer-button").first().click();
      if (index < 9) await expect(page.getByText(`Question ${index + 2} of 10`)).toBeVisible();
    }
    await expect(page.getByText("Game 1 · 100% XP rate", { exact: true })).toBeVisible();
    await expect(page.locator("#standings .standing-row").filter({ has: page.getByText("You", { exact: true }) })).toHaveCount(1);
    for (let i = 0; i < 3; i++) expect((await complete(context, account.address.toLowerCase(), "tournament")).status()).toBe(200);
    await page.locator(".wallet-button").click();
    await page.evaluate((address) => { (window as unknown as { arcadiaTestWallet: { address: string } }).arcadiaTestWallet.address = address; }, linked.address);
    await page.getByRole("button", { name: "Switch wallet", exact: true }).click();
    await page.getByRole("button", { name: "Sign in with selected wallet" }).click();
    await expect(page.getByText(linked.address.toLowerCase(), { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText("Your tournament details", { exact: true }).click();
    await expect(page.locator(".tournament-facts > div").filter({ hasText: "Next game multiplier" }).getByRole("definition")).toHaveText("75%");
    const next = await context.request.post(`${origin}/api/games/start`, { headers: { origin }, data: { mode: "tournament", playerAddress: linked.address.toLowerCase() } });
    expect((await next.json()).game).toMatchObject({ sequence: 5, multiplier: 75, total: 10 });
    expect((await context.request.post(`${origin}/api/challenge/complete`, { data: {} })).status()).toBe(410);
  } finally { await context.close(); }
});

test("connected verified accounts show a profile and keep connection choices under Switch wallet", async ({ page }, testInfo) => {
  const account = newAccount();
  await injectWallet(page, account);
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  await signIn(page, account.address);
  const panel = page.getByRole("region", { name: "Wallet account" });
  await expect(panel.getByText("Verified GoodDollar wallet", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Connect GoodWallet", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Sign in with selected wallet" })).toHaveCount(0);
  await panel.getByRole("link", { name: "View profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Your player profile" })).toBeVisible();
  await expect(page.locator("#gooddollar").getByText("Verified GoodDollar wallet", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verified GoodDollar wallet address")).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`profile-verified-${width}.png`), fullPage: true });
  }
  await page.reload();
  await page.locator(".wallet-button").click();
  await expect(panel.getByRole("button", { name: "Connect GoodWallet", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
});

test("an unverified playing wallet links only through its verified source and confirmed registry state", async ({ page, context }, testInfo) => {
  const playing = newAccount();
  const source = newAccount();
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: playing.address, root: zeroAddress } });
  await injectWallet(page, playing, [source], 42220);
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  await signIn(page, playing.address);
  const panel = page.getByRole("region", { name: "Wallet account" });
  await expect(panel.getByText("GoodDollar not linked", { exact: true })).toBeVisible();
  await panel.getByRole("link", { name: "Link GoodDollar wallet" }).click();
  const field = page.getByLabel("Verified GoodDollar wallet address");
  await expect(field).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`profile-unverified-${width}.png`), fullPage: true });
  }
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: source.address, root: zeroAddress } });
  const unverifiedSource = await context.request.post(`${origin}/api/identity/link`, { headers: { origin }, data: { playerAddress: playing.address.toLowerCase(), sourceAddress: source.address } });
  expect(unverifiedSource.status()).toBe(403);
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: source.address, root: source.address } });
  await field.fill(source.address);
  await page.getByRole("button", { name: "Use selected browser wallet" }).click();
  await expect(page.locator("#gooddollar").getByRole("alert")).toContainText("does not match");
  expect(await page.evaluate(() => (window as unknown as { arcadiaTestWallet: { transactions: unknown[] } }).arcadiaTestWallet.transactions.length)).toBe(0);
  await page.evaluate((address) => {
    const wallet = (window as unknown as { arcadiaTestWallet: { address: string; rejectTransaction: boolean } }).arcadiaTestWallet;
    wallet.address = address; wallet.rejectTransaction = true;
  }, source.address);
  await page.getByRole("button", { name: "Use selected browser wallet" }).click();
  await expect(page.locator("#gooddollar").getByRole("alert")).toContainText("Linking cancelled");
  expect((await snapshot(context)).identity.address).toBe(playing.address.toLowerCase());
  expect(await page.evaluate(() => (window as unknown as { arcadiaTestWallet: { transactions: unknown[] } }).arcadiaTestWallet.transactions.length)).toBe(0);
  await page.evaluate(() => { (window as unknown as { arcadiaTestWallet: { rejectTransaction: boolean } }).arcadiaTestWallet.rejectTransaction = false; });
  await page.getByRole("button", { name: "Use selected browser wallet" }).click();
  await expect(page.getByText("Link submitted.", { exact: false })).toBeVisible();
  await expect(page.locator("#gooddollar").getByText("GoodDollar not linked", { exact: true })).toBeVisible();
  expect((await snapshot(context)).identity.address).toBe(playing.address.toLowerCase());
  const transaction = await page.evaluate(() => (window as unknown as { arcadiaTestWallet: { transactions: { from: string; data: Hex }[] } }).arcadiaTestWallet.transactions[0]);
  expect(transaction.from).toBe(source.address.toLowerCase());
  const decoded = decodeFunctionData({ abi: parseAbi(["function connectAccount(address account)"]), data: transaction.data });
  expect(decoded.functionName).toBe("connectAccount");
  expect(decoded.args![0].toLowerCase()).toBe(playing.address.toLowerCase());
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: playing.address, root: source.address } });
  await page.getByRole("button", { name: "Recheck identity", exact: true }).click();
  await expect(page.locator("#gooddollar").getByText("Linked to GoodDollar", { exact: true })).toBeVisible();
  await expect(page.locator("#gooddollar").getByText(source.address.toLowerCase(), { exact: true })).toBeVisible();
  await expect(field).toHaveCount(0);
  expect((await snapshot(context)).identity.address).toBe(playing.address.toLowerCase());
  const relink = await context.request.post(`${origin}/api/identity/link`, { headers: { origin }, data: { playerAddress: playing.address.toLowerCase(), sourceAddress: source.address } });
  expect(relink.status()).toBe(409);
});

test("an unavailable identity check never asks an authenticated player to link an address", async ({ page }) => {
  const account = newAccount();
  await injectWallet(page, account);
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  await signIn(page, account.address);
  await page.route("**/api/tournament", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, identity: null, identityError: "Identity RPC unavailable" } });
  });
  await page.goto("/profile");
  await expect(page.locator("#gooddollar").getByText("Verification check unavailable", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verified GoodDollar wallet address")).toHaveCount(0);
  await expect(page.getByText("You’re signed in.", { exact: false })).toBeVisible();
});
