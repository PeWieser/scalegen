/**
 * coerceParams – turns untrusted input (API payloads, localStorage) into valid ScaleParams.
 * Unknown keys are dropped, missing/invalid values fall back to defaults.
 */

import { createDefaultParams } from "./defaults";
import type { ScaleParams, ScaleType } from "./types";

const TYPES: ScaleType[] = ["circle", "semicircle", "arc", "linear"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 10000) : [];
}

export function coerceParams(input: unknown): ScaleParams | null {
  if (!isRecord(input)) return null;
  const type = oneOf(input.type, TYPES, "semicircle");
  const d = createDefaultParams(type);
  const g = isRecord(input.geometry) ? input.geometry : {};
  const r = isRecord(input.range) ? input.range : {};
  const ma = isRecord(input.major) ? input.major : {};
  const mi = isRecord(input.minor) ? input.minor : {};
  const l = isRecord(input.labels) ? input.labels : {};
  const b = isRecord(input.baseline) ? input.baseline : {};
  const re = isRecord(input.relief) ? input.relief : {};
  const o = isRecord(input.overrides) ? input.overrides : {};

  return {
    type,
    geometry: {
      radius: num(g.radius, d.geometry.radius),
      startAngle: num(g.startAngle, d.geometry.startAngle),
      endAngle: num(g.endAngle, d.geometry.endAngle),
      innerRadius: num(g.innerRadius, d.geometry.innerRadius),
      outerRadius: num(g.outerRadius, d.geometry.outerRadius),
      length: num(g.length, d.geometry.length),
      orientation: oneOf(g.orientation, ["horizontal", "vertical"] as const, d.geometry.orientation),
      tickSide: oneOf(g.tickSide, ["inside", "outside"] as const, d.geometry.tickSide),
    },
    range: { min: num(r.min, d.range.min), max: num(r.max, d.range.max) },
    major: { step: num(ma.step, d.major.step), length: num(ma.length, d.major.length), width: num(ma.width, d.major.width) },
    minor: {
      mode: oneOf(mi.mode, ["count", "step"] as const, d.minor.mode),
      count: num(mi.count, d.minor.count),
      step: num(mi.step, d.minor.step),
      length: num(mi.length, d.minor.length),
      width: num(mi.width, d.minor.width),
    },
    labels: {
      enabled: bool(l.enabled, d.labels.enabled),
      fontSize: num(l.fontSize, d.labels.fontSize),
      position: oneOf(l.position, ["inside", "outside"] as const, d.labels.position),
      offset: num(l.offset, d.labels.offset),
      strokeWidth: num(l.strokeWidth, d.labels.strokeWidth),
    },
    baseline: { enabled: bool(b.enabled, d.baseline.enabled), width: num(b.width, d.baseline.width) },
    relief: {
      mode: oneOf(re.mode, ["raised", "engraved"] as const, d.relief.mode),
      baseThickness: num(re.baseThickness, d.relief.baseThickness),
      height: num(re.height, d.relief.height),
      depth: num(re.depth, d.relief.depth),
    },
    overrides: { hiddenTicks: stringList(o.hiddenTicks), hiddenLabels: stringList(o.hiddenLabels) },
  };
}
