/**
 * stl-exporter – binary STL (units: mm) from a Mesh.
 */

import type { Mesh } from "@/core/exporters/mesh/mesh-builder";

export function meshToStl(mesh: Mesh, name = "scale"): ArrayBuffer {
  const count = mesh.triangleCount;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const header = `Scale Generator – ${name} – units: mm`.slice(0, 79);
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i) & 0x7f);
  view.setUint32(80, count, true);

  const p = mesh.positions;
  let offset = 84;
  for (let t = 0; t < count; t++) {
    const i = t * 9;
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
    // normal = (b - a) × (c - a)
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    for (let k = 0; k < 9; k++) view.setFloat32(offset + 12 + k * 4, p[i + k], true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }
  return buffer;
}
