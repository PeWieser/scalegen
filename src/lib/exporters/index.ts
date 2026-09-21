/**
 * exporters — ein Einstiegspunkt für alle Exportformate.
 * Alle Formate lesen dieselbe Geometriequelle (ScaleDefinition / Höhenfeld).
 */

import type { ScaleDefinition } from "@/lib/scale-engine";
import { buildMesh } from "@/lib/scale-engine";
import { toDxf } from "./dxf-exporter";
import { toObj } from "./obj-exporter";
import { toStl } from "./stl-exporter";
import { toSvg } from "./svg-exporter";

export type ExportFormat = "svg" | "dxf" | "stl" | "obj";

export const EXPORT_FORMATS: ExportFormat[] = ["svg", "dxf", "stl", "obj"];

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  mime: string;
  bytes: Uint8Array;
  size: number;
  triangles: number;
  unit: string;
  scale: string;
  notes: string[];
}

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  svg: "SVG",
  dxf: "DXF",
  stl: "STL",
  obj: "OBJ",
};

export const FORMAT_USE: Record<ExportFormat, string> = {
  svg: "Vektor für Plotter, Laser, Dokumentation",
  dxf: "CAD/CAM, Fräsen, Wasserstrahl, Gravur",
  stl: "3D-Druck, CAM-Simulation, Bearbeitung",
  obj: "3D-CAD, Rendering, Weiterverarbeitung",
};

const NOTES_2D = [
  "Beschriftung als echte Textobjekte enthalten.",
  "Marken als geschlossene Konturen, nicht als Striche.",
];

const NOTES_3D = [
  "Echte 3D-Geometrie aus dem Höhenfeld — kein Mesh der SVG.",
  "Beschriftung ist 2D-Geometrie und in 3D-Formaten nicht enthalten.",
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function exportFilename(def: ScaleDefinition, format: ExportFormat): string {
  const p = def.params;
  const base = [slug(p.name) || "skala", slug(p.type), `${p.range.min}-${p.range.max}`]
    .filter(Boolean)
    .join("_");
  return `${base}.${format}`;
}

export function renderExport(def: ScaleDefinition, format: ExportFormat): ExportResult {
  const filename = exportFilename(def, format);
  const is3d = format === "stl" || format === "obj";

  if (format === "svg") {
    const text = toSvg(def);
    const bytes = new TextEncoder().encode(text);
    return {
      format,
      filename,
      mime: "image/svg+xml",
      bytes,
      size: bytes.length,
      triangles: 0,
      unit: "mm",
      scale: "1:1",
      notes: NOTES_2D,
    };
  }

  if (format === "dxf") {
    const text = toDxf(def);
    const bytes = new TextEncoder().encode(text);
    return {
      format,
      filename,
      mime: "application/dxf",
      bytes,
      size: bytes.length,
      triangles: 0,
      unit: "mm",
      scale: "1:1",
      notes: [
        ...NOTES_2D,
        "DXF R12 (AC1009) — gelesen von LibreCAD, Fusion, Mach3, Gravostar.",
      ],
    };
  }

  const tris = buildMesh(def);
  const bytes =
    format === "stl" ? toStl(tris) : new TextEncoder().encode(toObj(tris));
  return {
    format,
    filename,
    mime: format === "stl" ? "model/stl" : "model/obj",
    bytes,
    size: bytes.length,
    triangles: tris.length,
    unit: "mm",
    scale: "1:1",
    notes: [
      ...NOTES_3D,
      format === "stl"
        ? "Binäres STL. STL ist einheitenlos — hier gilt 1 Einheit = 1 mm."
        : "Wavefront OBJ mit `v`/`f`-Listen.",
    ],
  };
}

export function triggerDownload(result: ExportResult): void {
  const blob = new Blob([result.bytes.slice().buffer as ArrayBuffer], {
    type: result.mime,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
