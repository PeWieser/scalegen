/**
 * Prüflauf für die Exportmodule — läuft ohne Browser.
 *   npx tsx scripts/verify-export.ts
 */
import { writeFileSync } from "node:fs";
import {
  buildGrid,
  buildMesh,
  buildScale,
  createParams,
  type Tri,
} from "../src/lib/scale-engine";
import { toDxf } from "../src/lib/exporters/dxf-exporter";
import { toObj } from "../src/lib/exporters/obj-exporter";
import { toStl } from "../src/lib/exporters/stl-exporter";
import { toSvg } from "../src/lib/exporters/svg-exporter";

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  if (ok) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Watertight-Prüfung: jede Kante muss genau in zwei Dreiecken vorkommen. */
function checkWatertight(tris: Tri[]): { edges: number; open: number } {
  const count = new Map<string, number>();
  const key = (p: number[]) => p.map((v) => Math.round(v * 1e6)).join(",");
  for (const t of tris) {
    const v = [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const a = key(v[i]);
      const b = key(v[(i + 1) % 3]);
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(e, (count.get(e) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const [, n] of count) if (n !== 2) open += 1;
  return { edges: count.size, open };
}

function scenario(title: string, params: ReturnType<typeof createParams>) {
  console.log(`\n${title}`);
  const def = buildScale(params);
  check(def.counts.total > 0, "Teilstriche erzeugt", `${def.counts.total} Marken`);
  check(def.labels.length > 0, "Beschriftung erzeugt", `${def.labels.length} Texte`);

  const svg = toSvg(def);
  const svgPaths = (svg.match(/<path /g) ?? []).length;
  check(svgPaths === def.counts.total, "SVG: ein Pfad je Marke", `${svgPaths} Pfade`);
  check(svg.includes("</svg>"), "SVG: vollständiges Dokument");
  check(svg.includes('width="'), "SVG: Millimetermaße gesetzt");

  const dxf = toDxf(def);
  const polylines = (dxf.match(/\nPOLYLINE\n/g) ?? []).length;
  const texts = (dxf.match(/\nTEXT\n/g) ?? []).length;
  check(polylines === def.counts.total, "DXF: eine Kontur je Marke", `${polylines} POLYLINE`);
  check(texts === def.labels.length, "DXF: ein TEXT je Beschriftung", `${texts} TEXT`);
  check(dxf.trimEnd().endsWith("EOF"), "DXF: mit EOF geschlossen");
  check(dxf.startsWith("0\nSECTION\n2\nHEADER"), "DXF: HEADER zuerst");

  const grid = buildGrid(def);
  const start = Date.now();
  const tris = buildMesh(def);
  const ms = Date.now() - start;
  check(tris.length > 0, "3D: Dreiecksnetz erzeugt", `${tris.length} Dreiecke in ${ms} ms`);

  const { edges, open } = checkWatertight(tris);
  check(open === 0, "3D: geschlossener Körper (watertight)", `${edges} Kanten, ${open} offen`);

  const stl = toStl(tris);
  const declared = new DataView(stl.buffer, stl.byteOffset).getUint32(80, true);
  check(declared === tris.length, "STL: Dreieckszahl in der Kopfzeile stimmt", `${declared}`);
  check(stl.length === 84 + tris.length * 50, "STL: Binärlänge korrekt", `${stl.length} B`);

  const obj = toObj(tris);
  check((obj.match(/^v /gm) ?? []).length === tris.length * 3, "OBJ: drei Vertices je Dreieck");
  check((obj.match(/^f /gm) ?? []).length === tris.length, "OBJ: eine Fläche je Dreieck");

  writeFileSync(`/tmp/scale-${params.type}-${params.body.mode}.svg`, svg);
  writeFileSync(`/tmp/scale-${params.type}-${params.body.mode}.dxf`, dxf);
  writeFileSync(`/tmp/scale-${params.type}-${params.body.mode}.stl`, stl);
  writeFileSync(`/tmp/scale-${params.type}-${params.body.mode}.obj`, obj);
}

// 1) Erfolgskriterium: Halbkreis, 0 bis 80, Haupt- und Unterteilungen
const half = createParams("half-circle", "check1");
scenario("Halbkreis 0…80 · 5 Unterteilungen · Gravur", half);

// 2) Positiv-Modus
const positive = createParams("circle", "check2");
positive.body.mode = "positive";
positive.range = { min: -20, max: 120 };
positive.ticks.majorStep = 20;
positive.ticks.minorMode = "step";
positive.ticks.minorStep = 5;
scenario("Vollkreis −20…120 · Schrittweite 5 · Positiv", positive);

// 3) Gerade Linie mit Bruchzahlen
const line = createParams("line", "check3");
line.range = { min: 0, max: 1 };
line.ticks.majorStep = 0.1;
line.ticks.minorCount = 1;
line.ticks.majorStep = 0.25;
scenario("Gerade Linie 0…1 · Dezimalwerte", line);

// 4) Leistung: 1000 Teilstriche
const heavy = createParams("circle", "check4");
heavy.range = { min: 0, max: 1000 };
heavy.ticks.majorStep = 10;
heavy.ticks.minorCount = 4;
heavy.labels.enabled = false;
const t0 = Date.now();
const heavyDef = buildScale(heavy);
const t1 = Date.now();
const heavyTris = buildMesh(heavyDef);
const t2 = Date.now();
console.log(`\nLeistung: ${heavyDef.counts.total} Marken`);
check(heavyDef.counts.total === 500, "1000er-Bereich: Markenanzahl plausibel", `${heavyDef.counts.total}`);
check(t1 - t0 < 300, "Geometrie < 300 ms", `${t1 - t0} ms`);
check(t2 - t1 < 4000, "3D-Netz < 4 s", `${t2 - t1} ms für ${heavyTris.length} Dreiecke`);

console.log(`\n${failures === 0 ? "ALLE PRÜFUNGEN BESTANDEN" : `${failures} PRÜFUNGEN FEHLGESCHLAGEN`}`);
process.exit(failures === 0 ? 0 : 1);
