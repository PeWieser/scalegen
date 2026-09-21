import type { NextConfig } from "next";

/**
 * Die Anwendung ist vollständig clientseitig: kein Route-Handler, keine Datenbank,
 * kein Server-Zugriff. Es gibt zwei Build-Ziele, je nachdem wo gebaut wird.
 *
 *  1) Statischer Export nach `out/` — Cloudflare Pages (oder jeder statische Hoster).
 *     Ausgelöst durch `CF_PAGES=1`, das Cloudflare Pages beim Build selbst setzt,
 *     oder erzwungen durch `NEXT_STATIC_EXPORT=1`.
 *
 *       Build-Befehl:        NEXT_STATIC_EXPORT=1 npm run build
 *       Build-Ausgabeordner: out
 *
 *  2) Ohne diese Variablen entsteht ein normaler Build (für lokale Vorschau),
 *     der mit `npm start` läuft.
 *
 * Beide Varianten kompilieren exakt denselben Code — es gibt keine serverseitigen
 * Anteile, die im Export fehlen würden.
 */
const staticExport =
  process.env.CF_PAGES === "1" ||
  process.env.CF_PAGES_URL !== undefined ||
  process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
