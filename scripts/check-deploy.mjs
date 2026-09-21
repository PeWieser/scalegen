#!/usr/bin/env node
/**
 * Deploy-Selbstprüfung — vor dem Push nach Cloudflare Pages ausführen.
 *
 *   node scripts/check-deploy.mjs
 *
 * Prüft genau die Dinge, die den Build auf Cloudflare Pages zum Scheitern bringen:
 *   1. Server-only-Code, der mit `output: "export"` unvereinbar ist
 *   2. Importe von Paketen, die nicht in package.json stehen
 *   3. Dateien, die für den statischen Export nötig sind
 *
 * Kein Build nötig, keine Abhängigkeiten, läuft in Sekunden.
 * Exit-Code 0 = bereit zum Deployen, 1 = es fehlt etwas.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
let failures = 0;
let notes = 0;

const fail = (msg) => {
  failures += 1;
  console.log(`  FEHLER  ${msg}`);
};
const warn = (msg) => {
  notes += 1;
  console.log(`  Hinweis ${msg}`);
};
const ok = (msg) => console.log(`  ok      ${msg}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "out") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

console.log("\n1) Server-only-Code (bricht output:\"export\")");
const forbidden = [
  ["src/app/api", "Route-Handler unter app/api"],
  ["src/db", "Datenbankzugriff (Drizzle/pg)"],
  ["drizzle.config.json", "Drizzle-Konfiguration"],
];
for (const [path, why] of forbidden) {
  if (existsSync(join(ROOT, path))) fail(`${path} vorhanden — ${why}. Löschen: bash scripts/cleanup-stale.sh`);
  else ok(`${path} nicht vorhanden`);
}

const sources = walk(join(ROOT, "src"));
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  if (/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(text)) {
    fail(`${relative(ROOT, file)} setzt force-dynamic — mit statischem Export unvereinbar`);
  }
  if (/from\s+["']next\/server["']/.test(text)) {
    fail(`${relative(ROOT, file)} importiert next/server — gehört nicht in eine statische Seite`);
  }
}
ok("keine force-dynamic-Angaben, keine next/server-Importe");

console.log("\n2) Toter Quellbaum (bricht den Type-Check)");
const stale = [
  ["src/core", "zweite Engine, braucht polygon-clipping"],
  ["src/features/scale-editor", "zweite Anwendung, importiert src/core"],
];
for (const [path, why] of stale) {
  if (existsSync(join(ROOT, path))) fail(`${path} vorhanden — ${why}. Löschen: bash scripts/cleanup-stale.sh`);
  else ok(`${path} nicht vorhanden`);
}

console.log("\n3) Abhängigkeiten: jeder Import muss in package.json stehen");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);
const missing = new Map();
const importRe = /(?:from|import)\s*\(?\s*["']([^"'./][^"']*)["']/g;
for (const file of sources.concat(walk(join(ROOT, "scripts")))) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(importRe)) {
    const spec = match[1];
    if (spec.startsWith("@/") || spec.startsWith("node:")) continue;
    const parts = spec.split("/");
    const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    if (!declared.has(name) && !missing.has(name)) {
      missing.set(name, relative(ROOT, file));
    }
  }
}
if (missing.size === 0) ok("alle importierten Pakete sind deklariert");
else for (const [name, file] of missing) fail(`Paket "${name}" fehlt in package.json (Import in ${file})`);

const unusedDb = ["pg", "drizzle-orm", "dotenv", "drizzle-kit", "@types/pg"].filter((n) => declared.has(n));
if (unusedDb.length > 0) {
  warn(`nicht mehr benutzte Pakete installiert: ${unusedDb.join(", ")} — optional entfernen: npm rm ${unusedDb.join(" ")}`);
}

console.log("\n4) Dateien für den statischen Export");
const required = [
  "public/_headers",
  "public/api/health",
  "public/images/engraved-dial.jpg",
  "public/images/panel-texture.jpg",
  "next.config.ts",
];
for (const path of required) {
  if (existsSync(join(ROOT, path))) ok(path);
  else fail(`${path} fehlt`);
}

const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
if (/output:\s*staticExport\s*\?\s*["']export["']/.test(config) || /output:\s*["']export["']/.test(config)) {
  ok('next.config.ts schaltet output:"export" für den statischen Export');
} else {
  fail('next.config.ts setzt output:"export" nicht — out/ würde nicht erzeugt');
}
if (/CF_PAGES/.test(config)) ok("CF_PAGES (Cloudflare Pages) wird erkannt");
else warn("CF_PAGES wird nicht erkannt — setze NEXT_STATIC_EXPORT=1 im Build-Befehl");

console.log("\n5) Vollständigkeit der Anwendung");
const app = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/features/scale/Workbench.tsx",
  "src/features/stage/Stage.tsx",
  "src/features/export/ExportDialog.tsx",
  "src/features/parameters/ParameterPanel.tsx",
  "src/lib/scale-engine/engine.ts",
  "src/lib/scale-engine/mesh.ts",
  "src/lib/exporters/index.ts",
  "src/lib/storage.ts",
  "src/store/editor.ts",
];
for (const path of app) {
  if (existsSync(join(ROOT, path))) ok(path);
  else fail(`${path} fehlt — die Anwendung ist unvollständig`);
}

console.log(
  `\n${failures === 0 ? "BEREIT ZUM DEPLOYEN" : `${failures} FEHLER — bitte beheben`}${
    notes > 0 ? ` · ${notes} Hinweise` : ""
  }\n`,
);
process.exit(failures === 0 ? 0 : 1);
