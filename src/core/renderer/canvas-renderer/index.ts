/**
 * canvas-renderer – shaded orthographic rendering of a Mesh onto a 2D canvas.
 * Used by the export dialog to show the *actual* STL/OBJ geometry (not the SVG).
 */

import type { Mesh } from "@/core/exporters/mesh/mesh-builder";

export interface MeshViewOptions {
  /** Rotation around z (degrees). */
  yaw: number;
  /** Tilt (degrees), 0 = top-down, 90 = side view. */
  pitch: number;
  background?: string;
  faceColor?: [number, number, number];
  accent?: string;
}

export function renderMeshToCanvas(canvas: HTMLCanvasElement, mesh: Mesh, options: MeshViewOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cssW = canvas.clientWidth || 400;
  const cssH = canvas.clientHeight || 300;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = options.background ?? "#111318";
  ctx.fillRect(0, 0, cssW, cssH);
  if (mesh.triangleCount === 0) return;

  const yaw = (options.yaw * Math.PI) / 180;
  const pitch = (options.pitch * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const { min, max } = mesh.bounds;
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];

  // rotate: yaw around z, then pitch around x. Returns [sx, sy(screen up), depth]
  const project = (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - center[0], dy = y - center[1], dz = z - center[2];
    const rx = dx * cy - dy * sy;
    const ry = dx * sy + dy * cy;
    const uy = ry * cp + dz * sp; // screen up
    const depth = -ry * sp + dz * cp; // towards viewer
    return [rx, uy, depth];
  };

  const p = mesh.positions;
  const n = mesh.triangleCount;
  const projected = new Float32Array(n * 9);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n * 9; i += 3) {
    const [sx, sy2, d] = project(p[i], p[i + 1], p[i + 2]);
    projected[i] = sx;
    projected[i + 1] = sy2;
    projected[i + 2] = d;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy2 < minY) minY = sy2;
    if (sy2 > maxY) maxY = sy2;
  }
  const pad = 24;
  const scale = Math.min((cssW - pad * 2) / Math.max(maxX - minX, 1e-6), (cssH - pad * 2) / Math.max(maxY - minY, 1e-6));
  const ox = cssW / 2 - ((minX + maxX) / 2) * scale;
  const oy = cssH / 2 + ((minY + maxY) / 2) * scale;

  const light = [0.35, 0.45, 0.82];
  const ll = Math.hypot(light[0], light[1], light[2]);
  light[0] /= ll; light[1] /= ll; light[2] /= ll;
  const base = options.faceColor ?? [176, 184, 200];

  // painter's algorithm: back to front
  const order = new Array<number>(n);
  const depths = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    order[t] = t;
    const i = t * 9;
    depths[t] = (projected[i + 2] + projected[i + 5] + projected[i + 8]) / 3;
  }
  order.sort((a, b) => depths[a] - depths[b]);

  for (const t of order) {
    const i = t * 9;
    const ax = projected[i], ay = projected[i + 1];
    const bx = projected[i + 3], by = projected[i + 4];
    const cx = projected[i + 6], cy2 = projected[i + 7];
    // back-face culling in screen space (CCW = facing viewer)
    const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx - ax);
    if (area <= 0) continue;
    // normal in world space for shading
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    // rotate normal like the geometry for a view-relative light
    const rnx = nx * cy - ny * sy;
    const rny = nx * sy + ny * cy;
    const rn = [rnx, rny * cp + nz * sp, -rny * sp + nz * cp];
    const lambert = Math.max(0, rn[0] * light[0] + rn[1] * light[1] + rn[2] * light[2]);
    const shade = 0.28 + 0.72 * lambert;
    const r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), bl = Math.round(base[2] * shade);
    ctx.fillStyle = `rgb(${r},${g},${bl})`;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(ox + ax * scale, oy - ay * scale);
    ctx.lineTo(ox + bx * scale, oy - by * scale);
    ctx.lineTo(ox + cx * scale, oy - cy2 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
