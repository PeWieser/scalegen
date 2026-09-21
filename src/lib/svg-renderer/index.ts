/**
 * svg-renderer — Weltkoordinaten (mm, y nach oben) in SVG-Koordinaten (y nach unten).
 * Wird von der Live-Vorschau und vom SVG-Export gemeinsam benutzt.
 */

import type { LabelEntity, Point, ScaleDefinition } from "@/lib/scale-engine";

export function n(v: number): string {
  return (Math.round(v * 1e4) / 1e4).toString();
}

/** Eine Marke als geschlossener Pfad. */
export function polyToPathD(poly: Point[]): string {
  let d = "";
  poly.forEach((p, i) => {
    d += `${i === 0 ? "M" : "L"}${n(p.x)} ${n(-p.y)}`;
    if (i < poly.length - 1) d += " ";
  });
  return `${d} Z`;
}

export function labelTransform(l: LabelEntity): string {
  return `translate(${n(l.x)} ${n(-l.y)}) rotate(${n(-l.rotation)})`;
}

export function viewBoxOf(def: ScaleDefinition, pad = 0): string {
  const e = def.extents;
  return `${n(e.minX - pad)} ${n(-e.maxY - pad)} ${n(e.width + pad * 2)} ${n(
    e.height + pad * 2,
  )}`;
}

export interface SvgBodyOptions {
  tickFill?: string;
  labelFill?: string;
  fontFamily?: string;
  idPrefix?: string;
}

/** Geometrie als SVG-Fragment — identisch zu dem, was exportiert wird. */
export function defToSvgBody(def: ScaleDefinition, opts: SvgBodyOptions = {}): string {
  const {
    tickFill = "#000000",
    labelFill = "#000000",
    fontFamily = "Geist, Helvetica, Arial, sans-serif",
    idPrefix = "",
  } = opts;
  const paths = def.ticks.map((t) => `    <path d="${polyToPathD(t.poly)}"/>`).join("\n");
  const texts = def.labels
    .map(
      (l) =>
        `    <text transform="${labelTransform(l)}" x="0" y="0" text-anchor="middle" dominant-baseline="central">${escapeXml(
          l.text,
        )}</text>`,
    )
    .join("\n");

  return [
    `  <g id="${idPrefix}skalenmarken" fill="${tickFill}" stroke="none">`,
    paths,
    `  </g>`,
    `  <g id="${idPrefix}beschriftung" fill="${labelFill}" stroke="none" font-family="${fontFamily}" font-size="${n(
      def.params.labels.fontSize,
    )}" font-variant-numeric="tabular-nums">`,
    texts,
    `  </g>`,
  ].join("\n");
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
