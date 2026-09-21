/**
 * dxf-exporter – DXF R12 (AC1009), units mm, y up.
 *
 * Two geometry modes:
 *   centerline – ticks as LINE, baseline as ARC/CIRCLE, labels as open POLYLINE (V-bit engraving)
 *   contour    – every feature as closed POLYLINE contour with its real width (pocketing / cutting)
 *
 * Layers: OUTLINE, BASELINE, TICKS_MAJOR, TICKS_MINOR, LABELS (centerline)
 *         OUTLINE, SCALE (contour)
 */

import type { MultiPolygon, Ring } from "polygon-clipping";
import { buildFeatureFootprint } from "@/core/scale-engine/footprint";
import type { ScaleDefinition, Vec2 } from "@/core/scale-engine/types";

export type DxfMode = "centerline" | "contour";

export interface DxfOptions {
  mode: DxfMode;
  includeOutline: boolean;
}

const f = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return (Object.is(r, -0) ? 0 : r).toFixed(4);
};

class DxfWriter {
  private lines: string[] = [];

  pair(code: number, value: string | number) {
    this.lines.push(String(code), typeof value === "number" ? f(value) : value);
  }

  line(layer: string, a: Vec2, b: Vec2) {
    this.pair(0, "LINE");
    this.pair(8, layer);
    this.pair(10, a.x);
    this.pair(20, -a.y);
    this.pair(30, 0);
    this.pair(11, b.x);
    this.pair(21, -b.y);
    this.pair(31, 0);
  }

  circle(layer: string, c: Vec2, r: number) {
    this.pair(0, "CIRCLE");
    this.pair(8, layer);
    this.pair(10, c.x);
    this.pair(20, -c.y);
    this.pair(30, 0);
    this.pair(40, r);
  }

  /** Engine angles: 0° = top, clockwise. DXF: counter-clockwise from +x. */
  arc(layer: string, c: Vec2, r: number, startDeg: number, endDeg: number) {
    const norm = (a: number) => ((a % 360) + 360) % 360;
    const sweep = endDeg - startDeg;
    const dxfStart = sweep > 0 ? 90 - endDeg : 90 - startDeg;
    const dxfEnd = sweep > 0 ? 90 - startDeg : 90 - endDeg;
    this.pair(0, "ARC");
    this.pair(8, layer);
    this.pair(10, c.x);
    this.pair(20, -c.y);
    this.pair(30, 0);
    this.pair(40, r);
    this.pair(50, norm(dxfStart));
    this.pair(51, norm(dxfEnd));
  }

  polyline(layer: string, points: Vec2[], closed: boolean) {
    if (points.length < 2) return;
    this.pair(0, "POLYLINE");
    this.pair(8, layer);
    this.pair(66, "1");
    this.pair(70, closed ? "1" : "0");
    this.pair(10, 0);
    this.pair(20, 0);
    this.pair(30, 0);
    for (const p of points) {
      this.pair(0, "VERTEX");
      this.pair(8, layer);
      this.pair(10, p.x);
      this.pair(20, -p.y);
      this.pair(30, 0);
    }
    this.pair(0, "SEQEND");
    this.pair(8, layer);
  }

  toString() {
    return this.lines.join("\r\n") + "\r\n";
  }
}

const LAYERS: Record<string, number> = {
  OUTLINE: 8,
  BASELINE: 7,
  TICKS_MAJOR: 7,
  TICKS_MINOR: 7,
  LABELS: 7,
  SCALE: 7,
};

function ringToPoints(ring: Ring): Vec2[] {
  const pts = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
  return pts;
}

export function scaleToDxf(def: ScaleDefinition, options: DxfOptions): string {
  const w = new DxfWriter();
  const b = def.bounds;

  // ---- HEADER
  w.pair(0, "SECTION");
  w.pair(2, "HEADER");
  w.pair(9, "$ACADVER");
  w.pair(1, "AC1009");
  w.pair(9, "$INSUNITS");
  w.pair(70, "4");
  w.pair(9, "$EXTMIN");
  w.pair(10, b.minX);
  w.pair(20, -b.maxY);
  w.pair(30, 0);
  w.pair(9, "$EXTMAX");
  w.pair(10, b.maxX);
  w.pair(20, -b.minY);
  w.pair(30, 0);
  w.pair(0, "ENDSEC");

  // ---- TABLES
  w.pair(0, "SECTION");
  w.pair(2, "TABLES");
  w.pair(0, "TABLE");
  w.pair(2, "LTYPE");
  w.pair(70, "1");
  w.pair(0, "LTYPE");
  w.pair(2, "CONTINUOUS");
  w.pair(70, "64");
  w.pair(3, "Solid line");
  w.pair(72, "65");
  w.pair(73, "0");
  w.pair(40, 0);
  w.pair(0, "ENDTAB");
  w.pair(0, "TABLE");
  w.pair(2, "LAYER");
  w.pair(70, String(Object.keys(LAYERS).length));
  for (const [name, color] of Object.entries(LAYERS)) {
    w.pair(0, "LAYER");
    w.pair(2, name);
    w.pair(70, "0");
    w.pair(62, String(color));
    w.pair(6, "CONTINUOUS");
  }
  w.pair(0, "ENDTAB");
  w.pair(0, "ENDSEC");

  // ---- ENTITIES
  w.pair(0, "SECTION");
  w.pair(2, "ENTITIES");

  if (options.includeOutline) {
    const o = def.outline;
    if (o.kind === "ring") {
      w.circle("OUTLINE", o.center, o.outerRadius);
      if (o.innerRadius > 0) w.circle("OUTLINE", o.center, o.innerRadius);
    } else {
      w.polyline(
        "OUTLINE",
        [
          { x: o.x, y: o.y },
          { x: o.x + o.width, y: o.y },
          { x: o.x + o.width, y: o.y + o.height },
          { x: o.x, y: o.y + o.height },
        ],
        true,
      );
    }
  }

  if (options.mode === "centerline") {
    if (def.baseline) {
      const bl = def.baseline;
      if (bl.kind === "circle") w.circle("BASELINE", bl.center, bl.radius);
      else if (bl.kind === "arc") w.arc("BASELINE", bl.center, bl.radius, bl.startAngle, bl.endAngle);
      else w.line("BASELINE", bl.a, bl.b);
    }
    for (const tick of def.ticks) {
      if (tick.hidden) continue;
      w.line(tick.kind === "major" ? "TICKS_MAJOR" : "TICKS_MINOR", tick.start, tick.end);
    }
    for (const label of def.labels) {
      if (label.hidden) continue;
      for (const stroke of label.strokes) w.polyline("LABELS", stroke, false);
    }
  } else {
    const footprint: MultiPolygon = buildFeatureFootprint(def);
    for (const poly of footprint) for (const ring of poly) w.polyline("SCALE", ringToPoints(ring), true);
  }

  w.pair(0, "ENDSEC");
  w.pair(0, "EOF");
  return w.toString();
}
