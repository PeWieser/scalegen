import type { ScaleParams, ScaleType } from "./types";

export const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  circle: "Kreis",
  semicircle: "Halbkreis",
  arc: "Kreisbogen",
  linear: "Gerade",
};

/** Angle presets per type (0° = 12 o'clock, clockwise). */
const ANGLE_PRESETS: Record<Exclude<ScaleType, "linear">, { start: number; end: number }> = {
  circle: { start: 0, end: 360 },
  semicircle: { start: -90, end: 90 },
  arc: { start: -135, end: 135 },
};

export function createDefaultParams(type: ScaleType = "semicircle"): ScaleParams {
  const angles = type === "linear" ? { start: -90, end: 90 } : ANGLE_PRESETS[type];
  return {
    type,
    geometry: {
      radius: 40,
      startAngle: angles.start,
      endAngle: angles.end,
      innerRadius: 0,
      outerRadius: 50,
      length: 100,
      orientation: "horizontal",
      tickSide: "inside",
    },
    range: { min: 0, max: 100 },
    major: { step: 10, length: 6, width: 0.6 },
    minor: { mode: "count", count: 4, step: 2, length: 3, width: 0.3 },
    labels: { enabled: true, fontSize: 4, position: "inside", offset: 1.5, strokeWidth: 0.4 },
    baseline: { enabled: true, width: 0.6 },
    relief: { mode: "engraved", baseThickness: 3, height: 1, depth: 0.5 },
    overrides: { hiddenTicks: [], hiddenLabels: [] },
  };
}

/**
 * Switches the scale type while keeping everything the user already decided
 * (range, ticks, labels). Only the angles are reset to the type's preset,
 * because they define what the type *is*.
 */
export function withScaleType(params: ScaleParams, type: ScaleType): ScaleParams {
  if (type === params.type) return params;
  const geometry = { ...params.geometry };
  if (type !== "linear") {
    const preset = ANGLE_PRESETS[type];
    geometry.startAngle = preset.start;
    geometry.endAngle = preset.end;
  }
  return { ...params, type, geometry, overrides: { hiddenTicks: [], hiddenLabels: [] } };
}
