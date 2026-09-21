/**
 * svg-renderer – turns a ScaleDefinition into SVG primitives.
 *
 * The preview (React) and the SVG exporter (string) consume the same primitives,
 * so the exported file is exactly what the user sees.
 */

import { pointOnCircle } from "@/core/scale-engine/engine";
import type { ScaleDefinition, Vec2 } from "@/core/scale-engine/types";

export type SvgLayer = "outline" | "baseline" | "ticks-major" | "ticks-minor" | "labels";

export const SVG_LAYER_LABELS: Record<SvgLayer, string> = {
  outline: "Kontur",
  baseline: "Skalenlinie",
  "ticks-major": "Hauptteilung",
  "ticks-minor": "Unterteilung",
  labels: "Beschriftung",
};

interface PrimitiveBase {
  id: string;
  layer: SvgLayer;
  strokeWidth: number;
  /** Tick this primitive belongs to (ticks and labels) – enables selection in the preview. */
  tickId?: string;
  hidden?: boolean;
}

export type SvgPrimitive =
  | (PrimitiveBase & { kind: "line"; x1: number; y1: number; x2: number; y2: number })
  | (PrimitiveBase & { kind: "path"; d: string; linecap: "butt" | "round" })
  | (PrimitiveBase & { kind: "circle"; cx: number; cy: number; r: number });

export interface SvgScene {
  primitives: SvgPrimitive[];
  /** In mm, engine coordinates (y down). */
  viewBox: { x: number; y: number; width: number; height: number };
}

const n = (v: number) => {
  const s = v.toFixed(4);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

export function arcPathD(center: Vec2, radius: number, startDeg: number, endDeg: number): string {
  const a = pointOnCircle(center, radius, startDeg);
  const b = pointOnCircle(center, radius, endDeg);
  const sweep = endDeg - startDeg;
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M ${n(a.x)} ${n(a.y)} A ${n(radius)} ${n(radius)} 0 ${largeArc} ${sweepFlag} ${n(b.x)} ${n(b.y)}`;
}

export function strokesPathD(strokes: Vec2[][]): string {
  return strokes
    .map((s) => s.map((p, i) => `${i === 0 ? "M" : "L"} ${n(p.x)} ${n(p.y)}`).join(" "))
    .join(" ");
}

export interface SceneOptions {
  /** Include hidden ticks/labels (marked with hidden=true) – used by the preview only. */
  includeHidden?: boolean;
  /** Include the outline layer. */
  includeOutline?: boolean;
  /** Margin around the bounds in mm. */
  margin?: number;
}

export function buildSvgScene(def: ScaleDefinition, options: SceneOptions = {}): SvgScene {
  const { includeHidden = false, includeOutline = true, margin = 2 } = options;
  const primitives: SvgPrimitive[] = [];

  if (includeOutline) {
    const o = def.outline;
    if (o.kind === "ring") {
      primitives.push({ kind: "circle", id: "outline-outer", layer: "outline", strokeWidth: 0.2, cx: o.center.x, cy: o.center.y, r: o.outerRadius });
      if (o.innerRadius > 0)
        primitives.push({ kind: "circle", id: "outline-inner", layer: "outline", strokeWidth: 0.2, cx: o.center.x, cy: o.center.y, r: o.innerRadius });
    } else {
      primitives.push({
        kind: "path",
        id: "outline-rect",
        layer: "outline",
        strokeWidth: 0.2,
        linecap: "butt",
        d: `M ${n(o.x)} ${n(o.y)} H ${n(o.x + o.width)} V ${n(o.y + o.height)} H ${n(o.x)} Z`,
      });
    }
  }

  if (def.baseline) {
    const b = def.baseline;
    if (b.kind === "circle") {
      primitives.push({ kind: "circle", id: "baseline", layer: "baseline", strokeWidth: b.width, cx: b.center.x, cy: b.center.y, r: b.radius });
    } else if (b.kind === "arc") {
      primitives.push({ kind: "path", id: "baseline", layer: "baseline", strokeWidth: b.width, linecap: "butt", d: arcPathD(b.center, b.radius, b.startAngle, b.endAngle) });
    } else {
      primitives.push({ kind: "line", id: "baseline", layer: "baseline", strokeWidth: b.width, x1: b.a.x, y1: b.a.y, x2: b.b.x, y2: b.b.y });
    }
  }

  for (const tick of def.ticks) {
    if (tick.hidden && !includeHidden) continue;
    primitives.push({
      kind: "line",
      id: tick.id,
      layer: tick.kind === "major" ? "ticks-major" : "ticks-minor",
      strokeWidth: tick.width,
      tickId: tick.id,
      hidden: tick.hidden,
      x1: tick.start.x,
      y1: tick.start.y,
      x2: tick.end.x,
      y2: tick.end.y,
    });
  }

  for (const label of def.labels) {
    if (label.hidden && !includeHidden) continue;
    primitives.push({
      kind: "path",
      id: label.id,
      layer: "labels",
      strokeWidth: label.strokeWidth,
      linecap: "round",
      tickId: label.tickId,
      hidden: label.hidden,
      d: strokesPathD(label.strokes),
    });
  }

  const b = includeOutline ? def.bounds : def.contentBounds;
  return {
    primitives,
    viewBox: {
      x: b.minX - margin,
      y: b.minY - margin,
      width: b.maxX - b.minX + 2 * margin,
      height: b.maxY - b.minY + 2 * margin,
    },
  };
}

export interface SerializeOptions {
  stroke?: string;
  background?: string | null;
}

/** Serialises a scene to a standalone SVG document in millimetres (1 user unit = 1 mm). */
export function serializeSvg(scene: SvgScene, options: SerializeOptions = {}): string {
  const { stroke = "#000000", background = null } = options;
  const { x, y, width, height } = scene.viewBox;
  const layers: SvgLayer[] = ["outline", "baseline", "ticks-major", "ticks-minor", "labels"];
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${n(width)}mm" height="${n(height)}mm" viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}" fill="none" stroke="${stroke}" stroke-linecap="butt" stroke-linejoin="round">`,
  );
  out.push(`  <desc>Scale Generator – Einheiten: mm, Maßstab 1:1</desc>`);
  if (background) out.push(`  <rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${background}" stroke="none"/>`);
  for (const layer of layers) {
    const prims = scene.primitives.filter((p) => p.layer === layer && !p.hidden);
    if (prims.length === 0) continue;
    out.push(`  <g id="${layer}" inkscape:groupmode="layer" inkscape:label="${SVG_LAYER_LABELS[layer]}">`);
    for (const p of prims) {
      if (p.kind === "line") out.push(`    <line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke-width="${n(p.strokeWidth)}"/>`);
      else if (p.kind === "circle") out.push(`    <circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" stroke-width="${n(p.strokeWidth)}"/>`);
      else out.push(`    <path d="${p.d}" stroke-width="${n(p.strokeWidth)}"${p.linecap === "round" ? ' stroke-linecap="round"' : ""}/>`);
    }
    out.push("  </g>");
  }
  out.push("</svg>");
  return out.join("\n") + "\n";
}
