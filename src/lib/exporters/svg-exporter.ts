/**
 * svg-exporter — SVG 1.1, Millimeter, Maßstab 1:1.
 * Greift auf dieselbe Geometriequelle zurück wie die Vorschau (svg-renderer).
 */

import type { ScaleDefinition } from "@/lib/scale-engine";
import { defToSvgBody, n, viewBoxOf } from "@/lib/svg-renderer";

export function toSvg(def: ScaleDefinition): string {
  const e = def.extents;
  const pad = Math.max(1, def.params.labels.fontSize * 0.5);
  const width = e.width + pad * 2;
  const height = e.height + pad * 2;
  const p = def.params;

  const header = [
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
    `<!-- Scale Generator · ${p.name} · ${p.type} · Bereich ${p.range.min}…${p.range.max} · Einheit mm · Maßstab 1:1 -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${n(width)}mm" height="${n(
      height,
    )}mm" viewBox="${viewBoxOf(def, pad)}">`,
    `  <title>${p.name}</title>`,
    `  <desc>Technische Skala, erzeugt mit Scale Generator. Weltkoordinaten in mm, y nach oben.</desc>`,
  ].join("\n");

  const footer = `</svg>\n`;

  return `${header}\n${defToSvgBody(def)}\n${footer}`;
}
