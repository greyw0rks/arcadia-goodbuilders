import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./arcade.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://g.arcadia.uno";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Arcadia | Daily quiz arcade on Celo",
    template: "%s | Arcadia",
  },
  description: "Play Arcadia's daily quiz, build your streak and compete in free XP tournaments on Celo.",
  applicationName: "Arcadia",
  manifest: "/manifest.webmanifest",
  icons: { icon: { url: "/icon.svg?v=gateway-a", type: "image/svg+xml", sizes: "any" }, apple: "/brand/arcadia-icon-180.png" },
  openGraph: {
    title: "Arcadia | Daily quiz arcade on Celo",
    description: "Daily quizzes. Friendly competition. Make today a good run.",
    url: siteUrl,
    siteName: "Arcadia",
    type: "website",
    images: [{ url: "/brand/arcadia-social-card.png", width: 1200, height: 630, alt: "Arcadia — Make today a good run." }],
  },
  twitter: { card: "summary_large_image", title: "Arcadia — Make today a good run.", images: ["/brand/arcadia-social-card.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
