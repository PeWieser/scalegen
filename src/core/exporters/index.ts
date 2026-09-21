/**
 * exporters – one entry point for every format.
 * All formats read the same ScaleDefinition; no format has its own geometry.
 */

import { buildScaleMesh, type Mesh, type MeshResult } from "./mesh/mesh-builder";
import { scaleToDxf, type DxfMode } from "./dxf-exporter";
import { meshToObj } from "./obj-exporter";
import { meshToStl } from "./stl-exporter";
import { scaleToSvg } from "./svg-exporter";
import type { ScaleDefinition } from "@/core/scale-engine/types";

export type ExportFormat = "svg" | "dxf" | "stl" | "obj";

export const EXPORT_FORMATS: ExportFormat[] = ["svg", "dxf", "stl", "obj"];

export const FORMAT_INFO: Record<ExportFormat, { label: string; extension: string; mime: string; kind: "2d" | "3d"; description: string }> = {
  svg: { label: "SVG", extension: "svg", mime: "image/svg+xml", kind: "2d", description: "Vektorgrafik in mm – Laser, Plotter, Druck, Inkscape/Illustrator" },
  dxf: { label: "DXF", extension: "dxf", mime: "application/dxf", kind: "2d", description: "CAD/CAM-Austauschformat (R12) – Fusion, Estlcam, LibreCAD, VCarve" },
  stl: { label: "STL", extension: "stl", mime: "model/stl", kind: "3d", description: "Binäres Dreiecksnetz – 3D-Druck, CAM, CAD-Import" },
  obj: { label: "OBJ", extension: "obj", mime: "model/obj", kind: "3d", description: "Textbasiertes Netz mit geteilten Vertices – Blender, CAD" },
};

export interface ExportOptions {
  dxfMode: DxfMode;
  includeOutline: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { dxfMode: "centerline", includeOutline: true };

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  blob: Blob;
  bytes: number;
  units: "mm";
  scale: "1:1";
  /** Human-readable facts about the file – shown in the export dialog. */
  facts: { label: string; value: string }[];
  /** Only for 3D formats. */
  mesh?: Mesh;
  meshResult?: MeshResult;
  /** Raw text for 2D formats (used for previews). */
  text?: string;
}

function safeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[äÄ]/g, (m) => (m === "ä" ? "ae" : "Ae"))
    .replace(/[öÖ]/g, (m) => (m === "ö" ? "oe" : "Oe"))
    .replace(/[üÜ]/g, (m) => (m === "ü" ? "ue" : "Ue"))
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "skala";
}

const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export function exportScale(def: ScaleDefinition, format: ExportFormat, options: ExportOptions, name: string): ExportResult {
  const info = FORMAT_INFO[format];
  const filename = `${safeFilename(name)}.${info.extension}`;
  const b = def.bounds;
  const size = `${num(b.maxX - b.minX)} × ${num(b.maxY - b.minY)} mm`;

  if (format === "svg") {
    const text = scaleToSvg(def, { includeOutline: options.includeOutline });
    const blob = new Blob([text], { type: info.mime });
    return {
      format,
      filename,
      blob,
      bytes: blob.size,
      units: "mm",
      scale: "1:1",
      text,
      facts: [
        { label: "Zeichenfläche", value: size },
        { label: "Ebenen", value: options.includeOutline ? "Kontur, Skalenlinie, Haupt-, Unterteilung, Beschriftung" : "Skalenlinie, Haupt-, Unterteilung, Beschriftung" },
        { label: "Beschriftung", value: "Pfade (Strichschrift), keine Font-Abhängigkeit" },
      ],
    };
  }

  if (format === "dxf") {
    const text = scaleToDxf(def, { mode: options.dxfMode, includeOutline: options.includeOutline });
    const blob = new Blob([text], { type: info.mime });
    return {
      format,
      filename,
      blob,
      bytes: blob.size,
      units: "mm",
      scale: "1:1",
      text,
      facts: [
        { label: "Version", value: "DXF R12 (AC1009), $INSUNITS = mm" },
        { label: "Geometrie", value: options.dxfMode === "centerline" ? "Mittellinien (LINE, ARC, POLYLINE)" : "Geschlossene Konturen mit Linienbreite" },
        { label: "Ebenen", value: options.dxfMode === "centerline" ? "OUTLINE, BASELINE, TICKS_MAJOR, TICKS_MINOR, LABELS" : "OUTLINE, SCALE" },
        { label: "Ausdehnung", value: size },
      ],
    };
  }

  const meshResult = buildScaleMesh(def);
  const { mesh } = meshResult;
  const dims = mesh.bounds.max.map((v, i) => v - mesh.bounds.min[i]);
  const reliefLabel =
    meshResult.mode === "raised"
      ? `Erhaben, ${num(def.params.relief.height)} mm auf ${num(def.params.relief.baseThickness)} mm Platte`
      : meshResult.mode === "engraved"
        ? `Gravur, ${num(def.params.relief.depth)} mm tief in ${num(def.params.relief.baseThickness)} mm Platte`
        : `Durchbruch (Schablone), Platte ${num(def.params.relief.baseThickness)} mm`;

  const facts = [
    { label: "Körper", value: `${num(dims[0])} × ${num(dims[1])} × ${num(dims[2])} mm` },
    { label: "Relief", value: reliefLabel },
    { label: "Dreiecke", value: mesh.triangleCount.toLocaleString("de-DE") },
  ];
  if (meshResult.clippedArea > 0.01) {
    facts.push({ label: "Hinweis", value: `${num(meshResult.clippedArea)} mm² Geometrie lagen außerhalb des Körpers und wurden beschnitten` });
  }

  if (format === "stl") {
    const buffer = meshToStl(mesh, name);
    const blob = new Blob([buffer], { type: info.mime });
    return { format, filename, blob, bytes: blob.size, units: "mm", scale: "1:1", mesh, meshResult, facts: [{ label: "Kodierung", value: "Binär, ein Körper, z nach oben" }, ...facts] };
  }

  const text = meshToObj(mesh, name);
  const blob = new Blob([text], { type: info.mime });
  return { format, filename, blob, bytes: blob.size, units: "mm", scale: "1:1", mesh, meshResult, text, facts: [{ label: "Kodierung", value: "ASCII, Vertices dedupliziert, z nach oben" }, ...facts] };
}

export function downloadResult(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { Mesh, MeshResult, DxfMode };
