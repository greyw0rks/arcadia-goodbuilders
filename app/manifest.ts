import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcadia Quiz Arcade",
    short_name: "Arcadia",
    description: "Daily tournaments, mixed trivia and XP progression on Celo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#f7f6f2",
    icons: [
      { src: "/brand/arcadia-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/arcadia-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
