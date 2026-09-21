/**
 * stl-exporter — Binäres STL (kompakt, von jedem CAM/Slicer gelesen).
 *
 * Die Geometrie ist echte 3D-Geometrie aus dem Höhenfeld-Mesher (scale-engine/mesh):
 *   Grundkörper + Marken als erhabenes Relief (positiv) oder als echte Gravurkanäle
 *   mit senkrechten Wänden (engrave). Kein Mesh der SVG, kein Screenshot.
 *
 * Einheiten: Millimeter, Maßstab 1:1 (STL ist einheitenlos; Konvention mm).
 */

import type { Tri } from "@/lib/scale-engine";

export function toStl(tris: Tri[]): Uint8Array {
  const buffer = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const header = "Scale Generator - STL - Einheit mm - Massstab 1:1";
  for (let i = 0; i < 80; i++) {
    bytes[i] = i < header.length ? header.charCodeAt(i) & 0x7f : 32;
  }
  view.setUint32(80, tris.length, true);

  let offset = 84;
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

    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    offset += 12;
    for (const v of [t.a, t.b, t.c]) {
      view.setFloat32(offset, v[0], true);
      view.setFloat32(offset + 4, v[1], true);
      view.setFloat32(offset + 8, v[2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return bytes;
}
