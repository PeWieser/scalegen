/**
 * dxf-exporter — ASCII DXF R12 (AC1009) für maximale CAM-/Postprozessor-Kompatibilität.
 *
 *   - Jede Marke ist eine GESCHLOSSENE POLYLINE (Kontur des Vierecks) auf Lage "SKALA".
 *     Konturen statt Striche: Laser, Fräse und Wasserstrahl bekommen echte Geometrie.
 *   - Beschriftung als TEXT auf Lage "BESCHRIFTUNG", zentriert (72/73 = Mitte/Mitte).
 *   - Koordinaten in Millimeter, y nach oben, Maßstab 1:1 — identisch zur Vorschau.
 */

import type { ScaleDefinition } from "@/lib/scale-engine";

function num(v: number): string {
  return (Math.round(v * 1e6) / 1e6).toFixed(6);
}

function pair(code: number, value: string | number): string {
  return `${code}\n${typeof value === "number" ? num(value) : value}\n`;
}

export function toDxf(def: ScaleDefinition): string {
  const e = def.extents;
  let out = "";

  // HEADER
  out += pair(0, "SECTION") + pair(2, "HEADER");
  out += pair(9, "$ACADVER") + pair(1, "AC1009");
  out += pair(9, "$EXTMIN") + pair(10, e.minX) + pair(20, e.minY) + pair(30, 0);
  out += pair(9, "$EXTMAX") + pair(10, e.maxX) + pair(20, e.maxY) + pair(30, 0);
  out += pair(0, "ENDSEC");

  // TABLES
  out += pair(0, "SECTION") + pair(2, "TABLES");
  out += pair(0, "TABLE") + pair(2, "LAYER") + pair(70, "2");
  for (const layer of ["SKALA", "BESCHRIFTUNG"]) {
    out += pair(0, "LAYER") + pair(2, layer) + pair(70, "0") + pair(62, "7") + pair(6, "CONTINUOUS");
  }
  out += pair(0, "ENDTAB") + pair(0, "ENDSEC");

  // ENTITIES
  out += pair(0, "SECTION") + pair(2, "ENTITIES");

  for (const t of def.ticks) {
    out += pair(0, "POLYLINE");
    out += pair(8, "SKALA");
    out += pair(66, "1");
    out += pair(70, "1");
    out += pair(30, 0);
    for (const p of t.poly) {
      out += pair(0, "VERTEX");
      out += pair(8, "SKALA");
      out += pair(10, p.x) + pair(20, p.y) + pair(30, 0);
    }
    out += pair(0, "SEQEND");
    out += pair(8, "SKALA");
  }

  for (const l of def.labels) {
    out += pair(0, "TEXT");
    out += pair(8, "BESCHRIFTUNG");
    out += pair(10, l.x) + pair(20, l.y) + pair(30, 0);
    out += pair(40, l.height);
    out += pair(1, l.text);
    out += pair(50, l.rotation);
    out += pair(72, "1");
    out += pair(73, "2");
    out += pair(11, l.x) + pair(21, l.y) + pair(31, 0);
  }

  out += pair(0, "ENDSEC");
  out += pair(0, "EOF");
  return out;
}
