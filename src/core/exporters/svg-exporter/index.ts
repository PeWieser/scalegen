/**
 * svg-exporter – standalone SVG in millimetres, built from the same primitives as the preview.
 */

import { buildSvgScene, serializeSvg } from "@/core/renderer/svg-renderer";
import type { ScaleDefinition } from "@/core/scale-engine/types";

export interface SvgExportOptions {
  includeOutline: boolean;
}

export function scaleToSvg(def: ScaleDefinition, options: SvgExportOptions): string {
  const scene = buildSvgScene(def, { includeHidden: false, includeOutline: options.includeOutline, margin: 2 });
  return serializeSvg(scene, { stroke: "#000000" });
}
