/**
 * mesh-builder – real 3D geometry from the 2D footprints.
 *
 * The solid is built as a closed 2.5D shell:
 *   raised:   body (0..base)            + features standing on top (base..base+height)
 *   engraved: body with pockets: lower slab (0..base-depth), pocket floors, upper slab (base-depth..base)
 * All caps are triangulated with earcut (holes supported); walls are generated per
 * polygon ring with outward-facing normals. Coordinates: mm, x right, y up, z up.
 */

import earcut from "earcut";
import type { MultiPolygon, Ring } from "polygon-clipping";
import { buildSolidFootprint, ringArea } from "@/core/scale-engine/footprint";
import type { ScaleDefinition } from "@/core/scale-engine/types";

export interface Mesh {
  /** Triangle soup: 9 numbers per triangle (ax ay az bx by bz cx cy cz). */
  positions: Float32Array;
  triangleCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface MeshResult {
  mesh: Mesh;
  /** Feature area (mm²) that lay outside the body and was clipped. */
  clippedArea: number;
  mode: "raised" | "engraved" | "through";
}

class TriangleSink {
  private data: number[] = [];

  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) {
    this.data.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }

  finish(): Mesh {
    const positions = new Float32Array(this.data);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    if (positions.length === 0) {
      min.fill(0);
      max.fill(0);
    }
    return { positions, triangleCount: positions.length / 9, bounds: { min, max } };
  }
}

/** Engine space is y-down; the mesh is y-up. */
function flipY(mp: MultiPolygon): MultiPolygon {
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x, -y] as [number, number])));
}

function addCap(sink: TriangleSink, mp: MultiPolygon, z: number, up: boolean) {
  for (const poly of mp) {
    const flat: number[] = [];
    const holes: number[] = [];
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r];
      if (ring.length < 4) continue;
      if (r > 0) holes.push(flat.length / 2);
      for (let i = 0; i < ring.length - 1; i++) flat.push(ring[i][0], ring[i][1]);
    }
    if (flat.length < 6) continue;
    const idx = earcut(flat, holes.length ? holes : undefined, 2);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 2;
      const b = idx[i + 1] * 2;
      const c = idx[i + 2] * 2;
      const ax = flat[a], ay = flat[a + 1];
      const bx = flat[b], by = flat[b + 1];
      const cx = flat[c], cy = flat[c + 1];
      const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      // Slivers are kept on purpose: dropping them would open the shell along their neighbours' edges.
      const ccw = cross >= 0;
      if (ccw === up) sink.tri(ax, ay, z, bx, by, z, cx, cy, z);
      else sink.tri(ax, ay, z, cx, cy, z, bx, by, z);
    }
  }
}

function addRingWalls(sink: TriangleSink, ring: Ring, isHole: boolean, z0: number, z1: number) {
  const area = ringArea(ring);
  if (Math.abs(area) < 1e-12) return;
  // Outer ring, CCW: solid on the left → outward normal is the right-hand normal.
  let rightNormal = area > 0;
  if (isHole) rightNormal = !rightNormal;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    if (ax === bx && ay === by) continue;
    if (rightNormal) {
      sink.tri(ax, ay, z0, bx, by, z0, bx, by, z1);
      sink.tri(ax, ay, z0, bx, by, z1, ax, ay, z1);
    } else {
      sink.tri(ax, ay, z0, bx, by, z1, bx, by, z0);
      sink.tri(ax, ay, z0, ax, ay, z1, bx, by, z1);
    }
  }
}

function addWalls(sink: TriangleSink, mp: MultiPolygon, z0: number, z1: number) {
  if (z1 <= z0) return;
  for (const poly of mp) for (let r = 0; r < poly.length; r++) addRingWalls(sink, poly[r], r > 0, z0, z1);
}

export function buildScaleMesh(def: ScaleDefinition): MeshResult {
  const fp = buildSolidFootprint(def);
  const outline: MultiPolygon = flipY(fp.body);
  const features = flipY(fp.features);
  const remainder = flipY(fp.remainder);
  const { mode, baseThickness, height, depth } = def.params.relief;
  const base = Math.max(baseThickness, 0.1);
  const sink = new TriangleSink();

  if (mode === "raised") {
    const top = base + Math.max(height, 0);
    addCap(sink, outline, 0, false);
    addWalls(sink, outline, 0, base);
    addCap(sink, remainder, base, true);
    if (top > base && features.length) {
      addWalls(sink, features, base, top);
      addCap(sink, features, top, true);
    }
    return { mesh: sink.finish(), clippedArea: fp.clippedArea, mode: "raised" };
  }

  if (depth >= base) {
    // Cut-through: the features become openings (stencil).
    addCap(sink, remainder, 0, false);
    addWalls(sink, remainder, 0, base);
    addCap(sink, remainder, base, true);
    return { mesh: sink.finish(), clippedArea: fp.clippedArea, mode: "through" };
  }

  const zStep = base - Math.max(depth, 0);
  addCap(sink, outline, 0, false);
  addWalls(sink, outline, 0, zStep);
  if (features.length) addCap(sink, features, zStep, true); // pocket floors
  addWalls(sink, remainder, zStep, base);
  addCap(sink, remainder, base, true);
  return { mesh: sink.finish(), clippedArea: fp.clippedArea, mode: "engraved" };
}
