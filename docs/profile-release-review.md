# Profile release review — October 30, 2026

The live `/profile` route was previously a 404. The completed local account work now ships a profile, direct/linked/unverified GoodDollar states, and a verified-source linking flow. Signed-in players see account actions; connection buttons require an explicit wallet switch.

The independent Impeccable review requested mobile gutters and containment of a collapsing bottom margin. Both were corrected and re-captured at 390×844 and 1440×1000. The final reviewer scored both fixes resolved, found no visible regressions from them, and returned `ship` for the reviewed fixes. The component detector returned no findings. Captures are preserved under `docs/evidence/profile-release/`.

The documentation sub-agent hit a provider rate limit, so the documentation check was completed inline. No design-system replacement was made. Files checked: `DESIGN.md`, `PRODUCT.md`, `docs/profile-surface.md`, `components/ProfileApp.tsx`, `components/WalletButton.tsx`, `components/IdentityLink.tsx` and relevant `app/globals.css` rules.

- Palette: existing paper, ink navy, violet actions and mint verification states.
- Type: existing Barlow Condensed display and Manrope UI.
- Layout: a 900px maximum content column with mobile gutters and safe-area navigation clearance.
- Controls: existing action styles and a labeled 16px-input linking form.
- States: guest, checking, unavailable, verified, linked and unverified remain distinct.

The pre-existing DESIGN.md has no machine-readable frontmatter or sidecar; this ordinary extension preserves that format rather than repairing unrelated format drift.

Forty-nine unit checks passed before content expansion. Thirteen browser scenarios passed in the initial run, which then hit a test-locator conflict with Next.js's route announcer. After scoping that assertion to the GoodDollar region, all three profile-specific scenarios passed: connected verified account, approved-source linking with mismatch/unverified-source/cancellation guards, and unavailable identity checks. The later combined MVP release records the final full suite.

The linked-wallet test controls the provider and local identity registry. Physical GoodWallet/MiniPay approval and real on-chain linking are not established by those tests.
