import { test, expect, type Page } from "@playwright/test";
import { zeroAddress } from "viem";
import { TRIVIA_QUESTION_BANK } from "../../lib/question-bank";
import { TRIVIA_GAMES, TRIVIA_MIX } from "../../lib/trivia-catalog";
import type { GameView } from "../../lib/game-types";
import { origin, newAccount, injectWallet, signIn, startVerified, joinFree } from "../fixtures/wallet";

const bank = new Map(TRIVIA_QUESTION_BANK.map(question => [question.id, question]));
const actionResponse = (page: Page, action: string) => page.waitForResponse(response => response.url().endsWith("/api/games/action") && response.request().postDataJSON().action === action);

async function playRound(page: Page, game: GameView, inspect?: (game: GameView) => Promise<void>) {
  const saved = actionResponse(page, "finish");
  for (let index = game.questionIndex; index < game.total; index++) {
    expect(game.question).not.toBeNull();
    expect(Object.keys(game.question!).sort()).toEqual(["id", "options", "prompt"]);
    const source = bank.get(game.question!.id)!;
    expect(source).toBeTruthy();
    expect(game.difficulty).toBe(TRIVIA_MIX[index]);
    if (inspect) await inspect(game);
    const answerIndex = game.question!.options.indexOf(source.options[source.answerIndex]);
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    const answer = actionResponse(page, "answer");
    const next = actionResponse(page, "next");
    await page.locator(".answer-button").nth(answerIndex).click();
    expect((await (await answer).json()).game.feedback.correct).toBe(true);
    game = (await (await next).json()).game;
  }
  const result = (await (await saved).json()).game as GameView;
  await expect(page.getByText("You answered 10 of 10 correctly.", { exact: true })).toBeVisible();
  return result;
}

async function clickStart(page: Page, name: string): Promise<GameView> {
  const response = page.waitForResponse("**/api/games/start");
  await page.locator("#challenge").getByRole("button", { name, exact: true }).click();
  const started = await response;
  expect(started.status()).toBe(200);
  return (await started.json()).game;
}

test("verified tournament genre selection fits phones and desktop", async ({ page }, testInfo) => {
  await startVerified(page, "/app");
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await expect(page.getByRole("heading", { name: "Choose today’s genre." })).toBeVisible();
    await expect(page.locator(".trivia-grid")).not.toContainText("500");
    for (const game of TRIVIA_GAMES) await expect(page.getByRole("button", { name: `Choose ${game.title}`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`tournament-genres-${width}.png`), fullPage: true });
  }
  for (const game of TRIVIA_GAMES) {
    await page.getByRole("button", { name: `Choose ${game.title}`, exact: true }).click();
    await expect(page.getByRole("heading", { name: game.title, exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Difficulty" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start or resume tournament game" })).toBeEnabled();
    await page.getByRole("button", { name: "Change genre before starting" }).click();
  }
});

for (const catalog of TRIVIA_GAMES) {
  test(`${catalog.title} locks a scored genre round, resumes and advances automatically`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = await startVerified(page, "/app");
    await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
    await page.getByRole("button", { name: `Choose ${catalog.title}`, exact: true }).click();
    const game = await clickStart(page, "Start or resume tournament game");
    expect(game.trivia).toEqual({ game: catalog.id, difficulty: "mixed" });
    expect(game.tournamentRound).toMatchObject({ kind: "genre", daySequence: 1, multiplier: 100, genre: catalog.id });
    expect(game.deadline! - game.serverNow).toBe(10_000);
    await expect(page.locator(".game-mode-switch")).toHaveCount(0);
    await expect(page.locator(".app-header nav")).toBeHidden();
    await expect(page.locator(".app-rail")).toBeHidden();
    await expect(page.locator(".answer-button").last()).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${catalog.id}-390.png`), fullPage: true });
    const completed = await playRound(page, game, async current => {
      expect(bank.get(current.question!.id)!.game).toBe(catalog.id);
      if (current.questionIndex === 1) {
        const resumed = await context.request.post("/api/games/start", { headers: { origin }, data: { mode: "tournament", playerAddress: account.address.toLowerCase(), trivia: { game: "crypto", difficulty: "easy" } } });
        expect(resumed.status()).toBe(200);
        expect((await resumed.json()).game).toMatchObject({ id: game.id, questionIndex: 1, question: current.question, deadline: current.deadline });
      }
    });
    expect(completed.result).toMatchObject({ correct: 10, total: 10, creditedXp: 150 });
    const otherGenre = catalog.id === "crypto" ? "movies" : "crypto";
    const conflict = await context.request.post("/api/games/start", { headers: { origin }, data: { mode: "tournament", playerAddress: account.address.toLowerCase(), trivia: { game: otherGenre, difficulty: "mixed" } } });
    expect(conflict.status()).toBe(409);
    await page.reload();
    await expect(page.getByRole("heading", { name: catalog.title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change genre before starting" })).toHaveCount(0);
    const competition = (await (await context.request.get("/api/tournament")).json()).competition;
    expect(competition.entry).toMatchObject({ xp: 150, daily: { genre: catalog.id, completedGames: 1, genreGamesRemaining: 3 } });
  });
}

test("four daily genre games switch to mixed games and enforce the declining XP and 5 XP cap", async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startVerified(page, "/app");
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  await page.getByRole("button", { name: "Choose Maths Trivia", exact: true }).click();
  let totalXp = 0;
  for (const [index, xp] of [150, 150, 150, 150, 112, 75, 37, 15, 15, 5, 5].entries()) {
    const game = await clickStart(page, index === 0 ? "Start or resume tournament game" : index < 4 ? "Play next tournament game" : "Play mixed quiz");
    expect(game.tournamentRound).toMatchObject({ daySequence: index + 1, kind: index < 4 ? "genre" : "mixed" });
    const genres = new Set<string>();
    const complete = await playRound(page, game, async current => { genres.add(bank.get(current.question!.id)!.game!); });
    expect(genres.size).toBe(index < 4 ? 1 : 4);
    expect(complete.result?.creditedXp).toBe(xp);
    totalXp += xp;
    await expect(page.locator(".result-stats > div").last().locator("strong > span[aria-hidden=true]")).toHaveText(String(xp));
    if (index === 0) await page.screenshot({ path: testInfo.outputPath("result-390.png"), fullPage: true });
    if (index === 3) {
      await expect(page.getByText("Your four daily genre games are complete.", { exact: false })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("mixed-games-unlocked-390.png"), fullPage: true });
    }
    if (index === 8) {
      await expect(page.getByText("The 5 XP cap now applies", { exact: false })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("normal-games-cap-390.png"), fullPage: true });
    }
  }
  const competition = (await (await context.request.get("/api/tournament")).json()).competition;
  expect(competition.entry).toMatchObject({ xp: totalXp, daily: { completedGames: 11, normalGamesPlayed: 7, nextMaxXp: 5 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/leaderboard");
    await expect(page.locator(".personal-standing")).toContainText(`${totalXp} XP`);
    await page.screenshot({ path: testInfo.outputPath(`populated-leaderboard-${width}.png`), fullPage: true });
    await page.goto("/profile");
    await expect(page.locator(".profile-progress").getByRole("definition").first()).toHaveText(String(totalXp));
    await expect(page.locator(".history-row")).toHaveCount(11);
    await page.screenshot({ path: testInfo.outputPath(`populated-profile-${width}.png`), fullPage: true });
  }
});

test("every mode rejects unverified and unavailable identities; an on-chain linked wallet unlocks play", async ({ page, context }, testInfo) => {
  const account = newAccount();
  const root = newAccount();
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: account.address, root: zeroAddress } });
  await injectWallet(page, account);
  await page.goto("/app");
  await signIn(page, account.address);
  await page.keyboard.press("Escape");
  for (const [mode, label] of [["tournament", "Tournament"], ["daily", "Daily quiz"], ["arcade", "Mixed practice"]]) {
    // All historical API modes still enforce identity before any game data is returned.
    await expect(page.getByRole("heading", { name: "Verify your wallet to play." })).toBeVisible();
    await expect(page.locator(".answer-button")).toHaveCount(0);
    const denied = await context.request.post("/api/games/start", { headers: { origin }, data: { mode, playerAddress: account.address.toLowerCase() } });
    expect(denied.status()).toBe(403);
    expect(await denied.json()).not.toHaveProperty("game");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("verification-required-390.png"), fullPage: true });
  await context.request.post("http://127.0.0.1:18546/test/outage", { data: { address: account.address, enabled: true } });
  try {
    await page.reload();
    await expect(page.getByText("Your identity check is temporarily unavailable.", { exact: false })).toBeVisible();
    for (const mode of ["daily", "arcade", "tournament"]) {
      const denied = await context.request.post("/api/games/start", { headers: { origin }, data: { mode, playerAddress: account.address.toLowerCase() } });
      expect(denied.status()).toBe(503);
      expect(await denied.json()).not.toHaveProperty("game");
    }
  } finally { await context.request.post("http://127.0.0.1:18546/test/outage", { data: { address: account.address, enabled: false } }); }
  await context.request.post("http://127.0.0.1:18546/test/identity", { data: { address: account.address, root: root.address } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Join this week’s tournament." })).toBeVisible();
  const joined = await joinFree(context, account.address.toLowerCase());
  expect(joined.status()).toBe(200);
  for (const mode of ["daily", "arcade", "tournament"]) {
    const allowed = await context.request.post("/api/games/start", { headers: { origin }, data: { mode, playerAddress: account.address.toLowerCase(), trivia: { game: "movies", difficulty: "easy" } } });
    expect(allowed.status()).toBe(mode === "tournament" ? 200 : 410);
    if (mode === "tournament") expect((await allowed.json()).game.phase).toBe("playing");
  }
});

for (const mode of ["daily", "arcade"]) {
  test(`legacy ${mode} links lead to the unified tournament and mixed flow`, async ({ page, context }) => {
    const account = await startVerified(page, `/app?mode=${mode}`);
    await expect(page.getByRole("heading", { name: "Join this week’s tournament." })).toBeVisible();
    await expect(page.locator(".game-mode-switch")).toHaveCount(0);
    expect((await context.request.post("/api/games/start", { headers: { origin }, data: { mode, playerAddress: account.address.toLowerCase() } })).status()).toBe(410);
  });
}


test("the UTC reset returns a completed tournament player to genre selection", async ({ page }) => {
  await page.clock.install();
  let phase: "live" | "arm" | "reset" = "live";
  const nextDay = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.route("**/api/tournament", async route => {
    if (route.request().method() !== "GET" || phase === "live") return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    if (data.competition.entry) {
      const daily = data.competition.entry.daily;
      data.competition.entry.daily = phase === "arm" ? { ...daily, resetsAt: await page.evaluate(() => Date.now() + 5000) } : {
        ...daily, day: nextDay, genre: null, completedGames: 0, genreGamesRemaining: 4,
        normalGamesPlayed: 0, nextKind: "genre", nextMultiplier: 100, nextMaxXp: 150,
        resetsAt: Date.parse(`${nextDay}T00:00:00Z`) + 86_400_000,
      };
    }
    await route.fulfill({ response, json: data });
  });
  await startVerified(page, "/app");
  await page.getByRole("button", { name: "Join free tournament", exact: true }).click();
  await page.getByRole("button", { name: "Choose General Trivia", exact: true }).click();
  await playRound(page, await clickStart(page, "Start or resume tournament game"));
  await expect(page.getByRole("button", { name: "Play next tournament game" })).toBeEnabled();
  phase = "arm";
  const refreshed = page.waitForResponse(response => response.url().endsWith("/api/tournament") && response.request().method() === "GET");
  await page.getByRole("button", { name: "Recheck identity", exact: true }).click();
  await refreshed;
  await expect(page.getByRole("button", { name: "Play next tournament game" })).toBeEnabled();
  phase = "reset";
  await page.clock.fastForward(5500);
  await expect(page.getByRole("heading", { name: "Choose today’s genre." })).toBeVisible();
  await expect(page.getByText("You answered 10 of 10 correctly.")).toHaveCount(0);
  await expect(page.locator(".tournament-facts").getByText("150", { exact: true })).toBeVisible();
});


test("long token amounts and protocol names wrap on small phones", async ({ page }, testInfo) => {
  await startVerified(page);
  await page.route("**/api/games/start", async route => {
    const response = await route.fetch();
    const data = await response.json();
    // A deterministic rendering fixture for the long strings in the crypto bank.
    data.game.question = { ...data.game.question,
      prompt: "A token has 18 decimals. How many tokens are 20,000,000,000,000,000,000 base units?",
      options: ["20", "200", "2,000,000,000,000,000,000,000", "getWhitelistedRoot(address)"] };
    await route.fulfill({ response, json: data });
  });
  await clickStart(page, "Start or resume tournament game");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".answer-button").last()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`long-question-${width}.png`), fullPage: true });
  }
});
