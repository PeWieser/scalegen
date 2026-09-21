import type { NextConfig } from "next";

/**
 * Alles läuft clientseitig — es gibt keinen Server-Code und keine Datenbank.
 *
 *  - Cloud Pages (Cloudflare Pages) setzen beim Build `CF_PAGES=1`: daraus entsteht
 *    ein statischer Export ins Verzeichnis `out/` (Build-Ausgabe-Ordner `out`).
 *  - Ohne diese Variable baut `next build` wie gewohnt (lokale Vorschau).
 *
 * Zusätzlich lässt sich der statische Export mit `NEXT_STATIC_EXPORT=1` erzwingen.
 */
const staticExport =
  process.env.CF_PAGES === "1" || process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
