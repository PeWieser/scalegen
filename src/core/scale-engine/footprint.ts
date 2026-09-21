/**
 * 2D footprints – the scale as solid polygons.
 *
 * Converts the line geometry of a ScaleDefinition (ticks, baseline, label strokes)
 * into closed polygons with real widths and unions them into one MultiPolygon.
 * Used by the mesh builder (STL/OBJ) and by the DXF exporter in contour mode.
 *
 * Coordinates stay in engine space (mm, y down); consumers convert as needed.
 */

import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Polygon, Ring } from "polygon-clipping";
import { pointOnCircle } from "./engine";
import type { ScaleDefinition, Vec2 } from "./types";

/** Max chord error when approximating arcs (mm). */
export const ARC_TOLERANCE = 0.01;

export function arcSegmentCount(radius: number, sweepDeg: number, tolerance = ARC_TOLERANCE): number {
  if (radius <= tolerance) return 4;
  const stepRad = 2 * Math.acos(1 - tolerance / radius);
  const stepDeg = (stepRad * 180) / Math.PI;
  return Math.max(4, Math.ceil(Math.abs(sweepDeg) / stepDeg));
}

export function arcPoints(center: Vec2, radius: number, startDeg: number, endDeg: number): Vec2[] {
  const n = arcSegmentCount(radius, endDeg - startDeg);
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) pts.push(pointOnCircle(center, radius, startDeg + ((endDeg - startDeg) * i) / n));
  return pts;
}

export function circlePoints(center: Vec2, radius: number): Vec2[] {
  const n = arcSegmentCount(radius, 360);
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) pts.push(pointOnCircle(center, radius, (360 * i) / n));
  return pts;
}

const toRing = (pts: Vec2[]): Ring => {
  const ring: Ring = pts.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring;
};

/** Rectangle around segment a→b with the given width (butt caps). */
function segmentRect(a: Vec2, b: Vec2, width: number, capExtend = 0): Polygon {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    const h = width / 2;
    return [toRing([{ x: a.x - h, y: a.y - h }, { x: a.x + h, y: a.y - h }, { x: a.x + h, y: a.y + h }, { x: a.x - h, y: a.y + h }])];
  }
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * (width / 2);
  const ny = ux * (width / 2);
  const ax = a.x - ux * capExtend;
  const ay = a.y - uy * capExtend;
  const bx = b.x + ux * capExtend;
  const by = b.y + uy * capExtend;
  return [
    toRing([
      { x: ax + nx, y: ay + ny },
      { x: bx + nx, y: by + ny },
      { x: bx - nx, y: by - ny },
      { x: ax - nx, y: ay - ny },
    ]),
  ];
}

function dot(center: Vec2, radius: number): Polygon {
  const n = 12;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return [toRing(pts)];
}

/** Thick arc (annular sector) as polygon; full circle as ring with hole. */
function thickArc(center: Vec2, radius: number, width: number, startDeg: number, endDeg: number): Polygon {
  const rOut = radius + width / 2;
  const rIn = Math.max(radius - width / 2, 0);
  const outer = arcPoints(center, rOut, startDeg, endDeg);
  if (rIn <= 1e-9) return [toRing([...outer, center])];
  const inner = arcPoints(center, rIn, endDeg, startDeg);
  return [toRing([...outer, ...inner])];
}

function thickCircle(center: Vec2, radius: number, width: number): Polygon {
  const rOut = radius + width / 2;
  const rIn = Math.max(radius - width / 2, 0);
  const outer = toRing(circlePoints(center, rOut));
  if (rIn <= 1e-9) return [outer];
  return [outer, toRing(circlePoints(center, rIn).reverse())];
}

export interface FootprintLayers {
  baseline: Polygon[];
  majorTicks: Polygon[];
  minorTicks: Polygon[];
  labels: Polygon[];
}

/** Raw (not yet unioned) polygons per layer. */
export function buildFeaturePolygons(def: ScaleDefinition): FootprintLayers {
  const layers: FootprintLayers = { baseline: [], majorTicks: [], minorTicks: [], labels: [] };

  if (def.baseline) {
    const b = def.baseline;
    if (b.kind === "circle") layers.baseline.push(thickCircle(b.center, b.radius, b.width));
    else if (b.kind === "arc") layers.baseline.push(thickArc(b.center, b.radius, b.width, b.startAngle, b.endAngle));
    else layers.baseline.push(segmentRect(b.a, b.b, b.width));
  }

  for (const tick of def.ticks) {
    if (tick.hidden || tick.width <= 0) continue;
    (tick.kind === "major" ? layers.majorTicks : layers.minorTicks).push(segmentRect(tick.start, tick.end, tick.width));
  }

  for (const label of def.labels) {
    if (label.hidden || label.strokeWidth <= 0) continue;
    const r = label.strokeWidth / 2;
    for (const stroke of label.strokes) {
      for (let i = 0; i < stroke.length; i++) {
        layers.labels.push(dot(stroke[i], r)); // round joins & caps
        if (i < stroke.length - 1) layers.labels.push(segmentRect(stroke[i], stroke[i + 1], label.strokeWidth));
      }
    }
  }
  return layers;
}

/** All features unioned into one MultiPolygon (overlaps resolved). */
export function buildFeatureFootprint(def: ScaleDefinition): MultiPolygon {
  const layers = buildFeaturePolygons(def);
  const all = [...layers.baseline, ...layers.majorTicks, ...layers.minorTicks, ...layers.labels];
  if (all.length === 0) return [];
  // Union in chunks: keeps argument counts sane for very dense scales (thousands of ticks + glyph strokes).
  const CHUNK = 1500;
  let acc: MultiPolygon = [];
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    acc = acc.length ? polygonClipping.union(acc, ...chunk) : polygonClipping.union(chunk[0], ...chunk.slice(1));
  }
  return acc;
}

/** The body / outline as a polygon (ring with hole, disc or rectangle). */
export function buildOutlinePolygon(def: ScaleDefinition): Polygon {
  const o = def.outline;
  if (o.kind === "rect") {
    return [
      toRing([
        { x: o.x, y: o.y },
        { x: o.x + o.width, y: o.y },
        { x: o.x + o.width, y: o.y + o.height },
        { x: o.x, y: o.y + o.height },
      ]),
    ];
  }
  const outer = toRing(circlePoints(o.center, o.outerRadius));
  if (o.innerRadius <= 1e-9) return [outer];
  return [outer, toRing(circlePoints(o.center, o.innerRadius).reverse())];
}

export interface SolidFootprint {
  outline: Polygon;
  /**
   * The body as seen by the boolean engine: identical to `outline`, but with the
   * vertices where features cross the boundary – keeps walls topologically watertight.
   */
  body: MultiPolygon;
  /** Features clipped to the outline. */
  features: MultiPolygon;
  /** Outline minus features. */
  remainder: MultiPolygon;
  /** Area of features that had to be clipped away (mm²) – 0 if everything fits. */
  clippedArea: number;
}

export function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

export function multiPolygonArea(mp: MultiPolygon): number {
  let area = 0;
  for (const poly of mp) for (let i = 0; i < poly.length; i++) area += Math.abs(ringArea(poly[i])) * (i === 0 ? 1 : -1);
  return area;
}

/** Everything the 3D builder needs, computed once. */
export function buildSolidFootprint(def: ScaleDefinition): SolidFootprint {
  const outline = buildOutlinePolygon(def);
  const rawFeatures = buildFeatureFootprint(def);
  const features = rawFeatures.length ? polygonClipping.intersection(rawFeatures, outline) : [];
  const remainder = rawFeatures.length ? polygonClipping.difference(outline, rawFeatures) : [outline];
  const clippedArea = Math.max(0, multiPolygonArea(rawFeatures) - multiPolygonArea(features));
  // Only when something was clipped do features touch the boundary; then rebuild the body
  // from the two parts so its ring carries the same split vertices as remainder + features.
  const body: MultiPolygon =
    clippedArea > 1e-9 && features.length ? polygonClipping.union(remainder, features) : [outline];
  return { outline, body, features, remainder, clippedArea };
}
