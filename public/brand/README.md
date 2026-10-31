# Arcadia brand kit

The Gateway A combines an arcade entrance with a forward cut. The wordmark is Manrope ExtraBold with custom spacing, distributed as vector outlines.

## Files

- arcadia-logo: primary horizontal logo, transparent SVG and PNG.
- arcadia-logo-white / arcadia-logo-ink: one-color versions.
- arcadia-logo-stacked: vertical lockup.
- arcadia-mark-violet / white / ink: standalone mark.
- arcadia-avatar: 1024 × 1024 social avatar.
- arcadia-app-icon and arcadia-icon-32 / 180 / 192 / 512: app and browser icons. The app serves this artwork through dedicated `app/icon.svg` and `app/favicon.ico` metadata files (ICO embeds the original 32px PNG).
- arcadia-banner-x: 1500 × 500 profile banner, with room for the profile photo.
- arcadia-banner-wide: SVG master and 2400 × 800 PNG for websites.
- arcadia-social-card: 1200 × 630 sharing image.
- arcadia-brand-board: 2400 × 1800 identity overview.
- arcadia-brand-guide.pdf: two-page vector overview and usage guide.
- tokens.json: color and typography tokens.

Use SVG for print and flexible sizing. Transparent PNGs are provided for tools that do not accept SVG. Keep 25% of the symbol's width clear around a logo; 24 px is the recommended minimum symbol size. Do not stretch or add effects.

## Provenance

Original vector symbol and compositions authored for Arcadia, October 2026. All lettering is outlined. Manrope and Barlow Condensed are open fonts under the included OFL licenses. No stock imagery or third-party logo marks are used.

Rebuild from scripts/build-brandkit.cjs in the Arcadia GoodBuilders source. Its isolated tooling uses fontkit, @resvg/resvg-js, pdfkit and svg-to-pdfkit; these tools are not app runtime dependencies.
