// Functional production check: real relay pairing, no wallet approval or signing.
const { chromium, expect } = require("@playwright/test");
const { mkdir, writeFile } = require("node:fs/promises");

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.PLAYWRIGHT_HOST_RESOLVER_RULES ? [`--host-resolver-rules=${process.env.PLAYWRIGHT_HOST_RESOLVER_RULES}`] : [],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const authRequests = [];
    page.on("request", (request) => {
      if (/\/api\/auth\/(challenge|verify)$/.test(request.url())) authRequests.push(request.method());
    });
    await page.goto("https://g.arcadia.uno/app");
    await expect(page.getByRole("button", { name: "Connect wallet to play" })).toBeEnabled();
    expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href")).toMatch(/^\/icon\.svg(?:\?|$)/);
    expect(await page.locator(".wordmark-logo").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: "Connect GoodWallet", exact: true }).click();
      const qr = page.getByAltText("WalletConnect pairing QR code for GoodWallet");
      await expect(qr).toBeVisible({ timeout: 40_000 });
      expect(await qr.evaluate((image) => image.naturalWidth > 0)).toBe(true);
      const link = new URL(await page.getByRole("link", { name: "Open GoodWallet" }).getAttribute("href"));
      expect(link.origin === "https://goodwallet.xyz").toBe(true);
      expect(/^wc:[a-f0-9]{64}@2\?/.test(link.searchParams.get("uri") || "")).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (attempt === 0) {
        await mkdir("docs/evidence/brand-release", { recursive: true });
        await qr.scrollIntoViewIfNeeded();
        await page.screenshot({ path: "docs/evidence/brand-release/production-goodwallet.png", mask: [qr] });
      }
      await page.getByRole("button", { name: "Cancel connection", exact: true }).click();
      await expect(page.getByText("Sign-in cancelled. Your progress has not changed.")).toBeVisible();
      await expect(qr).toHaveCount(0);
    }
    expect(authRequests).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("#challenge")).not.toHaveAttribute("inert", "");
    const result = {
      checkedAt: new Date().toISOString(), origin: "https://g.arcadia.uno", status: "passed",
      checks: ["Gateway A favicon metadata", "header logo loaded", "real relay QR rendered twice", "GoodWallet v2 deep link", "cancellation and retry", "unverified play remains locked", "no authentication requests", "mobile layout fits"],
      dnsOverride: Boolean(process.env.PLAYWRIGHT_HOST_RESOLVER_RULES),
      walletApprovalTested: false,
    };
    await writeFile("docs/evidence/goodwallet-production-smoke.json", JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
