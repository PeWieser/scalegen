/**
 * scale-engine/mesh — Höhenfeld zu echter 3D-Geometrie.
 *
 * Kein Mesh der SVG! Der Parameterraum (u = Winkel/Abstand, v = Radius/Quere)
 * wird in Zellen zerlegt, deren Höhe konstant ist. Dadurch entstehen echte
 * Gravurkanäle mit senkrechten Wänden — für CAM und 3D-Druck sauber.
 *
 * Wandflächen werden an jedem Gitterpunkt um die dort zusammentreffenden
 * Höhenstufen aufgeteilt (T-Knoten-Auflösung) — das Netz ist geschlossen.
 *
 * Reines Modul, keine Abhängigkeiten außer types.
 */

import type { Mark, ParamDomain, Point } from "./types";

export type Vec3 = [number, number, number];

export interface Tri {
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

export interface Grid {
  us: number[];
  vs: number[];
  /** Zellhöhen h[j][i] */
  h: number[][];
  map(u: number, v: number): Point;
  wrapU: boolean;
  zBase: number;
  zMark: number;
}

export interface GridOptions {
  domain: ParamDomain;
  marks: Mark[];
  /** Höhe des Grundkörpers (Plattenstärke) in mm. */
  zBase: number;
  /** Höhe der Marken: darüber (positiv) oder darunter (Gravur). */
  zMark: number;
  /** Längste Zelle in u: Grad bei Kreisen, mm bei geraden Skalen. */
  maxSeg: number;
}

function binaryLow(values: number[], x: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < x - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function binaryHigh(values: number[], x: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= x + 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

function uniqueSorted(values: number[], tol = 1e-6): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tol) out.push(v);
  }
  return out;
}

/** Normalisiert Marken in den Bereich [uMin, uMax) und teilt sie an der Naht. */
function normalizeMarks(marks: Mark[], uMin: number, uMax: number, wrap: boolean): Mark[] {
  const range = uMax - uMin;
  const out: Mark[] = [];
  for (const m of marks) {
    if (!(m.u1 > m.u0) || !(m.v1 > m.v0)) continue;
    if (!wrap) {
      out.push(m);
      continue;
    }
    const a = ((((m.u0 - uMin) % range) + range) % range) + uMin;
    const b = a + (m.u1 - m.u0);
    if (b <= uMax + 1e-9) {
      out.push({ ...m, u0: a, u1: b });
    } else {
      out.push({ ...m, u0: a, u1: uMax });
      out.push({ ...m, u0: uMin, u1: b - range });
    }
  }
  return out;
}

export function makeGrid(opts: GridOptions): Grid {
  const { domain, zBase, zMark, maxSeg } = opts;
  const wrapU = domain.wrapU;
  const marks = normalizeMarks(opts.marks, domain.uMin, domain.uMax, wrapU);

  const uBreaks: number[] = [domain.uMin, domain.uMax];
  const vBreaks: number[] = [domain.vMin, domain.vMax];
  for (const m of marks) {
    if (m.u0 > domain.uMin && m.u0 < domain.uMax) uBreaks.push(m.u0);
    if (m.u1 > domain.uMin && m.u1 < domain.uMax) uBreaks.push(m.u1);
    if (m.v0 > domain.vMin && m.v0 < domain.vMax) vBreaks.push(m.v0);
    if (m.v1 > domain.vMin && m.v1 < domain.vMax) vBreaks.push(m.v1);
  }

  const us: number[] = [];
  const uSorted = uniqueSorted(uBreaks, 1e-7);
  for (let i = 0; i < uSorted.length - 1; i++) {
    const a = uSorted[i];
    const b = uSorted[i + 1];
    us.push(a);
    const parts = Math.max(1, Math.ceil((b - a) / Math.max(1e-6, maxSeg)));
    for (let k = 1; k < parts; k++) us.push(a + ((b - a) * k) / parts);
  }
  us.push(uSorted[uSorted.length - 1]);

  const vs = uniqueSorted(vBreaks, 1e-7);

  const nu = us.length - 1;
  const nv = vs.length - 1;
  const h: number[][] = Array.from({ length: nv }, () => new Array<number>(nu).fill(zBase));

  for (const m of marks) {
    // Zellen liegen zwischen den Bruchkanten: [u0..u1] deckt i0 … i1 ab.
    const i0 = binaryLow(us, m.u0);
    const i1 = binaryHigh(us, m.u1) - (binaryHigh(us, m.u1) >= 0 ? 1 : 0);
    const j0 = binaryLow(vs, m.v0);
    const j1 = binaryHigh(vs, m.v1) - (binaryHigh(vs, m.v1) >= 0 ? 1 : 0);
    for (let j = j0; j <= j1; j++) {
      if (j < 0 || j >= nv) continue;
      const row = h[j];
      for (let i = i0; i <= i1; i++) {
        if (i < 0 || i >= nu) continue;
        row[i] = zMark;
      }
    }
  }

  return { us, vs, h, map: domain.map, wrapU, zBase, zMark };
}

/** Dreiecksnetz des Höhenfeldes. Geschlossen, Normale nach außen. */
export function buildSolid(grid: Grid, opts: { bottom?: boolean } = {}): Tri[] {
  const { us, vs, h, map, wrapU } = grid;
  const withBottom = opts.bottom !== false;
  const nu = us.length - 1;
  const nv = vs.length - 1;
  const out: Tri[] = [];
  if (nu < 1 || nv < 1) return out;

  const quad = (
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    ox: number,
    oy: number,
    oz: number,
  ) => {
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const az = p1[2] - p0[2];
    const bx = p3[0] - p0[0];
    const by = p3[1] - p0[1];
    const bz = p3[2] - p0[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nx * ox + ny * oy + nz * oz >= 0) {
      out.push({ a: p0, b: p1, c: p2 }, { a: p0, b: p2, c: p3 });
    } else {
      out.push({ a: p0, b: p3, c: p2 }, { a: p0, b: p2, c: p1 });
    }
  };

  const tri = (p0: Vec3, p1: Vec3, p2: Vec3, ox: number, oy: number) => {
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const az = p1[2] - p0[2];
    const bx = p2[0] - p0[0];
    const by = p2[1] - p0[1];
    const bz = p2[2] - p0[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nx * ox + ny * oy >= 0) out.push({ a: p0, b: p1, c: p2 });
    else out.push({ a: p0, b: p2, c: p1 });
  };

  // Höhe einer Zelle, Zelle außerhalb = Boden (0) — so sind Ränder mitbehandelt.
  const cellH = (i: number, j: number): number | null => {
    if (j < 0 || j >= nv) return null;
    let ii = i;
    if (ii < 0 || ii >= nu) {
      if (!wrapU) return null;
      ii = ii < 0 ? nu - 1 : 0;
    }
    return h[j][ii];
  };

  /**
   * Kritische Höhen an jedem Gitterpunkt: Enden aller Wandstücke, die dort
   * zusammentreffen. Wandflächen werden daran aufgeteilt (keine T-Knoten).
   */
  const critical: number[][][] = Array.from({ length: nv + 1 }, () =>
    Array.from({ length: nu + 1 }, () => [0]),
  );
  const addCritical = (i: number, j: number, z: number) => {
    let ii = i;
    if (ii < 0) ii = wrapU ? nu : 0;
    if (ii > nu) ii = wrapU ? 0 : nu;
    if (ii < 0 || ii > nu || j < 0 || j > nv) return;
    const list = critical[j][ii];
    if (!list.some((v) => Math.abs(v - z) < 1e-9)) list.push(z);
  };

  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      // vier Wandstücke laufen an (i, j) zusammen
      const pairs: [number | null, number | null][] = [
        [cellH(i - 1, j - 1), cellH(i - 1, j)],
        [cellH(i, j - 1), cellH(i, j)],
        [cellH(i - 1, j - 1), cellH(i, j - 1)],
        [cellH(i - 1, j), cellH(i, j)],
      ];
      for (const [a, b] of pairs) {
        const zA = a === null ? 0 : a;
        const zB = b === null ? 0 : b;
        if (zA === zB) continue;
        addCritical(i, j, zA);
        addCritical(i, j, zB);
      }
    }
  }
  if (wrapU) {
    for (let j = 0; j <= nv; j++) {
      const merged = uniqueSorted([...critical[j][0], ...critical[j][nu]], 1e-9);
      critical[j][0] = merged;
      critical[j][nu] = merged;
    }
  }

  const splitZ = (i0: number, j0: number, i1: number, j1: number, zLo: number, zHi: number) => {
    const pick = (i: number, j: number) => {
      let ii = i;
      if (ii < 0) ii = wrapU ? nu : 0;
      if (ii > nu) ii = wrapU ? 0 : nu;
      const list = critical[Math.max(0, Math.min(nv, j))][ii] ?? [0];
      return list.filter((z) => z > zLo + 1e-9 && z < zHi - 1e-9);
    };
    return {
      a: uniqueSorted([zLo, ...pick(i0, j0), zHi], 1e-9),
      b: uniqueSorted([zLo, ...pick(i1, j1), zHi], 1e-9),
    };
  };

  const p3 = (p: Point, z: number): Vec3 => [p.x, p.y, z];

  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const z = h[j][i];
      const u0 = us[i];
      const u1 = us[i + 1];
      const v0 = vs[j];
      const v1 = vs[j + 1];
      const p00 = map(u0, v0);
      const p10 = map(u1, v0);
      const p11 = map(u1, v1);
      const p01 = map(u0, v1);

      quad(p3(p00, z), p3(p10, z), p3(p11, z), p3(p01, z), 0, 0, 1);
      if (withBottom) {
        quad(p3(p00, 0), p3(p10, 0), p3(p11, 0), p3(p01, 0), 0, 0, -1);
      }

      const center = map((u0 + u1) / 2, (v0 + v1) / 2);
      const edges: [number, number, number, number, number, number][] = [
        [u0, v0, u1, v0, i, j - 1],
        [u1, v0, u1, v1, i + 1, j],
        [u1, v1, u0, v1, i, j + 1],
        [u0, v1, u0, v0, i - 1, j],
      ];

      for (const [ua, va, ub, vb, ni, nj] of edges) {
        const neighbor = cellH(ni, nj);
        const zN = neighbor === null ? 0 : neighbor;
        if (zN === z) continue;
        // Nur von der höheren Seite zeichnen — sonst zwei Flächen an derselben Kante.
        if (neighbor !== null && z < zN) continue;

        const A = map(ua, va);
        const B = map(ub, vb);
        const zLo = Math.min(z, zN);
        const zHi = Math.max(z, zN);
        const ox = (A.x + B.x) / 2 - center.x;
        const oy = (A.y + B.y) / 2 - center.y;

        const { a: zsA, b: zsB } = splitZ(
          Math.round(ua === u0 ? i : i + 1),
          Math.round(va === v0 ? j : j + 1),
          Math.round(ub === u0 ? i : i + 1),
          Math.round(vb === v0 ? j : j + 1),
          zLo,
          zHi,
        );

        // Dreiecksstreifen zwischen den beiden aufgeteilten Höhenkanten.
        let ia = 0;
        let ib = 0;
        while (ia < zsA.length - 1 || ib < zsB.length - 1) {
          const takeA =
            ib >= zsB.length - 1 ||
            (ia < zsA.length - 1 && zsA[ia + 1] <= zsB[ib + 1] + 1e-9);
          if (takeA) {
            tri(p3(A, zsA[ia]), p3(A, zsA[ia + 1]), p3(B, zsB[ib]), ox, oy);
            ia += 1;
          } else {
            tri(p3(A, zsA[ia]), p3(B, zsB[ib + 1]), p3(B, zsB[ib]), ox, oy);
            ib += 1;
          }
        }
      }
    }
  }

  return out;
}
