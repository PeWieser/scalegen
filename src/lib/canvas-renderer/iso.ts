/**
 * canvas-renderer — schattierte Projektion derselben 3D-Geometrie, die exportiert wird.
 * Wird ausschließlich für die Vorschau im Exportdialog benutzt (WebGL ist Overkill).
 */

import { buildSolid, type Grid, type Vec3 } from "@/lib/scale-engine";

export interface IsoView {
  yaw: number;
  elevation: number;
}

export interface IsoOptions {
  padding?: number;
  showBottom?: boolean;
  background?: string;
}

interface Flat {
  pts: [number, number, number][];
  shade: number;
  depth: number;
}

const meshCache = new WeakMap<Grid, Map<boolean, ReturnType<typeof buildSolid>>>();

/** Dreiecksnetz pro Höhenfeld zwischenspeichern — macht das Rotieren flüssig. */
function trianglesOf(grid: Grid, bottom: boolean) {
  let entry = meshCache.get(grid);
  if (!entry) {
    entry = new Map();
    meshCache.set(grid, entry);
  }
  let tris = entry.get(bottom);
  if (!tris) {
    tris = buildSolid(grid, { bottom });
    entry.set(bottom, tris);
  }
  return tris;
}

function rgb(base: [number, number, number], shade: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * shade)));
  return `rgb(${f(base[0])},${f(base[1])},${f(base[2])})`;
}

export function renderIso(
  canvas: HTMLCanvasElement,
  grid: Grid,
  view: IsoView,
  opts: IsoOptions = {},
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 480;
  const cssH = canvas.clientHeight || 320;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = opts.background ?? "#0B0E12";
  ctx.fillRect(0, 0, cssW, cssH);

  const tris = trianglesOf(grid, opts.showBottom ?? false);
  if (tris.length === 0) return;

  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const ce = Math.cos(view.elevation);
  const se = Math.sin(view.elevation);

  // Kameraachsen: rechts r, oben u, zur Kamera c (rechtshändig, z = oben)
  const r: Vec3 = [cy, -sy, 0];
  const u: Vec3 = [sy * se, cy * se, ce];
  const c: Vec3 = [-sy * ce, -cy * ce, se];

  const project = (p: Vec3): [number, number, number] => [
    p[0] * r[0] + p[1] * r[1] + p[2] * r[2],
    p[0] * u[0] + p[1] * u[1] + p[2] * u[2],
    p[0] * c[0] + p[1] * c[1] + p[2] * c[2],
  ];

  const faces: Flat[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const light: Vec3 = [-0.35, -0.55, 0.82];

  for (const t of tris) {
    const ux = t.b[0] - t.a[0];
    const uy = t.b[1] - t.a[1];
    const uz = t.b[2] - t.a[2];
    const vx = t.c[0] - t.a[0];
    const vy = t.c[1] - t.a[1];
    const vz = t.c[2] - t.a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const pa = project(t.a);
    const pb = project(t.b);
    const pc = project(t.c);
    for (const p of [pa, pb, pc]) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }

    const lam = Math.abs(nx * light[0] + ny * light[1] + nz * light[2]);
    faces.push({
      pts: [pa, pb, pc],
      shade: 0.34 + 0.66 * lam,
      depth: (pa[2] + pb[2] + pc[2]) / 3,
    });
  }

  const pad = opts.padding ?? 18;
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((cssW - pad * 2) / spanX, (cssH - pad * 2) / spanY);
  const ox = cssW / 2 - ((minX + maxX) / 2) * scale;
  const oy = cssH / 2 + ((minY + maxY) / 2) * scale;

  faces.sort((a, b) => a.depth - b.depth);

  const steel: [number, number, number] = [132, 146, 162];
  const edge = "rgba(11,14,18,0.35)";
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = edge;

  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach((p, i) => {
      const x = p[0] * scale + ox;
      const y = oy - p[1] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = rgb(steel, f.shade);
    ctx.fill();
    ctx.stroke();
  }
}
