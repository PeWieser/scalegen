/**
 * scale-engine/solid — verbindet ScaleDefinition mit dem Höhenfeld-Mesher.
 * Wird von STL-Export, OBJ-Export und der3D-Vorschau gemeinsam benutzt.
 */

import { buildSolid, makeGrid, type Grid, type Tri } from "./mesh";
import type { Mark, ScaleDefinition } from "./types";

const D2R = Math.PI / 180;

/** Marken im Parameterraum — optional mit überschriebener Linienbreite für den 3D-Export. */
export function markRects(def: ScaleDefinition, lineWidthOverride = 0): Mark[] {
  const circular = def.domain.kind === "circular";
  return def.ticks.map((t) => {
    const width = lineWidthOverride > 0 ? lineWidthOverride : t.width;
    if (Math.abs(width - t.width) < 1e-9) {
      return { u0: t.u0, u1: t.u1, v0: t.v0, v1: t.v1 };
    }
    if (circular) {
      const rMid = (t.v0 + t.v1) / 2 || 0.001;
      const du = Math.max(0.001, width / rMid / D2R);
      return { u0: t.u - du / 2, u1: t.u + du / 2, v0: t.v0, v1: t.v1 };
    }
    return { u0: t.u - width / 2, u1: t.u + width / 2, v0: t.v0, v1: t.v1 };
  });
}

export function bodyHeights(def: ScaleDefinition): { zBase: number; zMark: number } {
  const { mode, thickness, depth } = def.params.body;
  const zBase = Math.max(0.05, thickness);
  const zMark =
    mode === "positive"
      ? zBase + Math.max(0, depth)
      : Math.max(0.05, zBase - Math.max(0, depth));
  return { zBase, zMark };
}

export function buildGrid(def: ScaleDefinition): Grid {
  const { zBase, zMark } = bodyHeights(def);
  const circular = def.domain.kind === "circular";
  return makeGrid({
    domain: def.domain,
    marks: markRects(def, def.params.body.lineWidth),
    zBase,
    zMark,
    maxSeg: circular ? 3 : 5,
  });
}

export function buildMesh(def: ScaleDefinition, opts: { bottom?: boolean } = {}): Tri[] {
  return buildSolid(buildGrid(def), opts);
}
