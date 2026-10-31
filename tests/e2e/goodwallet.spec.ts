import { test, expect } from "@playwright/test";

// Opt in: exercises Reown's real relay and the configured public project ID.
// A real wallet signature remains a separate device acceptance check.
test.use({ trace: "off" });
test("GoodWallet pairs through the relay, cancels and keeps unverified play locked", async ({ page }, testInfo) => {
  test.skip(process.env.ARCADIA_LIVE_WALLETCONNECT_SMOKE !== "1", "Requires access to the live WalletConnect relay");
  test.setTimeout(100_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const authRequests: string[] = [];
  const diagnostics: object[] = [];
  const safeUrl = (url: string) => { const parsed = new URL(url); return parsed.origin + parsed.pathname; };
  page.on("requestfailed", (request) => diagnostics.push({ url: safeUrl(request.url()), failure: request.failure()?.errorText }));
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.push({ url: safeUrl(response.url()), status: response.status() }); });
  page.on("websocket", (socket) => { socket.on("socketerror", (error) => diagnostics.push({ url: safeUrl(socket.url()), error })); });
  page.on("request", (request) => {
    if (/\/api\/auth\/(challenge|verify)$/.test(request.url())) authRequests.push(request.method());
  });
  await page.goto("/app?mode=daily");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeEnabled();
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Connect GoodWallet", exact: true }).click();
    const qr = page.getByAltText("WalletConnect pairing QR code for GoodWallet");
    try { await expect(qr).toBeVisible({ timeout: 40_000 }); }
    catch (error) { console.log("GoodWallet network diagnostics:", JSON.stringify(diagnostics)); throw error; }
    const href = await page.getByRole("link", { name: "Open GoodWallet" }).getAttribute("href");
    const link = new URL(href!);
    expect(link.origin === "https://goodwallet.xyz").toBe(true);
    expect(/^wc:[a-f0-9]{64}@2\?/.test(link.searchParams.get("uri") ?? "")).toBe(true);
    expect(await qr.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (attempt === 0) {
      await qr.scrollIntoViewIfNeeded();
      // Pairing secrets must not be published in visual evidence.
      await page.screenshot({ path: testInfo.outputPath("mobile-goodwallet.png"), mask: [qr] });
    }
    await page.getByRole("button", { name: "Cancel connection", exact: true }).click();
    await expect(page.getByText("Sign-in cancelled. Your progress has not changed.")).toBeVisible();
    await expect(qr).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Connect GoodWallet", exact: true })).toBeEnabled();
  }
  expect(authRequests).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeVisible();
  await expect(page.locator(".answer-button")).toHaveCount(0);
});
