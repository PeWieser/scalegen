/**
 * obj-exporter — Wavefront OBJ, Text, Millimeter, Maßstab 1:1.
 * Dieselbe Dreiecksgeometrie wie der STL-Export (scale-engine/mesh).
 */

import type { Tri } from "@/lib/scale-engine";

function num(v: number): string {
  return (Math.round(v * 1e5) / 1e5).toFixed(5);
}

export function toObj(tris: Tri[]): string {
  const lines: string[] = [
    "# Scale Generator · OBJ · Einheit mm · Massstab 1:1",
    `# Dreiecke: ${tris.length}`,
    "o skala",
  ];
  for (const t of tris) {
    lines.push(`v ${num(t.a[0])} ${num(t.a[1])} ${num(t.a[2])}`);
    lines.push(`v ${num(t.b[0])} ${num(t.b[1])} ${num(t.b[2])}`);
    lines.push(`v ${num(t.c[0])} ${num(t.c[1])} ${num(t.c[2])}`);
  }
  for (let i = 0; i < tris.length; i++) {
    const a = i * 3 + 1;
    lines.push(`f ${a} ${a + 1} ${a + 2}`);
  }
  return `${lines.join("\n")}\n`;
}
