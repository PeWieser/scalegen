/**
 * obj-exporter – Wavefront OBJ (units: mm) from a Mesh. Vertices are de-duplicated.
 */

import type { Mesh } from "@/core/exporters/mesh/mesh-builder";

const fmt = (v: number) => {
  const s = v.toFixed(4);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

export function meshToObj(mesh: Mesh, name = "scale"): string {
  const p = mesh.positions;
  const index = new Map<string, number>();
  const vertices: string[] = [];
  const faces: string[] = [];

  const vertexId = (x: number, y: number, z: number): number => {
    const key = `${fmt(x)} ${fmt(y)} ${fmt(z)}`;
    let id = index.get(key);
    if (id === undefined) {
      id = vertices.length + 1;
      index.set(key, id);
      vertices.push(`v ${key}`);
    }
    return id;
  };

  for (let t = 0; t < mesh.triangleCount; t++) {
    const i = t * 9;
    const a = vertexId(p[i], p[i + 1], p[i + 2]);
    const b = vertexId(p[i + 3], p[i + 4], p[i + 5]);
    const c = vertexId(p[i + 6], p[i + 7], p[i + 8]);
    if (a === b || b === c || a === c) continue;
    faces.push(`f ${a} ${b} ${c}`);
  }

  return [
    `# Scale Generator – ${name}`,
    "# units: mm, scale 1:1, z up",
    `o ${name.replace(/\s+/g, "_")}`,
    ...vertices,
    ...faces,
    "",
  ].join("\n");
}
