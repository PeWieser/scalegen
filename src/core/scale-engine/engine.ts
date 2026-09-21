/**
 * scale-engine – the single source of geometry.
 *
 * computeScale(params) turns parameters into a fully resolved ScaleDefinition.
 * Preview, SVG, DXF, STL and OBJ all consume that same definition.
 */

import { layoutText } from "./stroke-font";
import type {
  BaselineGeometry,
  Bounds,
  Label,
  OutlineGeometry,
  ScaleDefinition,
  ScaleGeometry,
  ScaleParams,
  ScaleWarning,
  Tick,
  Vec2,
} from "./types";

export const MAX_TICKS = 5000;
/** Margin of the rectangular body around linear scales (mm). */
export const LINEAR_BODY_MARGIN = 3;

const DEG = Math.PI / 180;
const EPS = 1e-6;

/** Stable key for a tick value (used for ids and overrides). */
export function valueKey(value: number): string {
  const r = Math.round(value * 1e9) / 1e9;
  return (Object.is(r, -0) ? 0 : r).toString();
}

export function pointOnCircle(center: Vec2, radius: number, angleDeg: number): Vec2 {
  const a = angleDeg * DEG;
  return { x: center.x + radius * Math.sin(a), y: center.y - radius * Math.cos(a) };
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function extend(b: Bounds, x: number, y: number, pad = 0): void {
  if (x - pad < b.minX) b.minX = x - pad;
  if (x + pad > b.maxX) b.maxX = x + pad;
  if (y - pad < b.minY) b.minY = y - pad;
  if (y + pad > b.maxY) b.maxY = y + pad;
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function isFiniteBounds(b: Bounds): boolean {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.maxX) && Number.isFinite(b.maxY);
}

function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = Math.abs(n).toString();
  if (s.includes("e")) return 6;
  const i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
}

export function formatValue(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

/** Effective angles after applying the type's constraints. */
export function resolveAngles(params: ScaleParams): { start: number; end: number; sweep: number; fullCircle: boolean } {
  const { type, geometry } = params;
  const start = geometry.startAngle;
  let end: number;
  if (type === "circle") end = start + 360;
  else if (type === "semicircle") end = start + 180;
  else {
    end = geometry.endAngle;
    if (Math.abs(end - start) > 360) end = start + Math.sign(end - start) * 360;
  }
  const sweep = end - start;
  return { start, end, sweep, fullCircle: Math.abs(Math.abs(sweep) - 360) < EPS };
}

interface Frame {
  /** Point on the baseline for normalised position t. */
  at(t: number): Vec2;
  /** Unit vector pointing to the "inside" at t. */
  inside(t: number): Vec2;
  angle(t: number): number;
}

function makeFrame(geometry: ScaleGeometry): Frame {
  if (geometry.kind === "circular") {
    const { center, radius, startAngle, sweep } = geometry;
    return {
      at: (t) => pointOnCircle(center, radius, startAngle + t * sweep),
      inside: (t) => {
        const a = (startAngle + t * sweep) * DEG;
        return { x: -Math.sin(a), y: Math.cos(a) };
      },
      angle: (t) => startAngle + t * sweep,
    };
  }
  const { a, b, inside } = geometry;
  return {
    at: (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
    inside: () => inside,
    angle: () => 0,
  };
}

export function computeScale(params: ScaleParams): ScaleDefinition {
  const warnings: ScaleWarning[] = [];
  const { type, geometry: g, range, major, minor, labels: labelParams, baseline: bl, relief, overrides } = params;
  const center: Vec2 = { x: 0, y: 0 };

  // ---------------------------------------------------------------- geometry
  let geometry: ScaleGeometry;
  if (type === "linear") {
    const half = Math.max(g.length, 0) / 2;
    const horizontal = g.orientation === "horizontal";
    geometry = {
      kind: "linear",
      a: horizontal ? { x: -half, y: 0 } : { x: 0, y: half },
      b: horizontal ? { x: half, y: 0 } : { x: 0, y: -half },
      length: Math.max(g.length, 0),
      orientation: g.orientation,
      inside: horizontal ? { x: 0, y: 1 } : { x: -1, y: 0 },
    };
    if (!(g.length > 0)) warnings.push({ code: "radius-invalid", message: "Die Länge muss größer als 0 sein." });
  } else {
    const angles = resolveAngles(params);
    geometry = {
      kind: "circular",
      center,
      radius: Math.max(g.radius, 0),
      startAngle: angles.start,
      endAngle: angles.end,
      sweep: angles.sweep,
      fullCircle: angles.fullCircle,
    };
    if (!(g.radius > 0)) warnings.push({ code: "radius-invalid", message: "Der Radius muss größer als 0 sein." });
    if (type === "arc" && Math.abs(angles.sweep) < EPS)
      warnings.push({ code: "radius-invalid", message: "Start- und Endwinkel dürfen nicht gleich sein." });
    if (!(g.outerRadius > 0) || g.innerRadius < 0 || g.innerRadius >= g.outerRadius)
      warnings.push({
        code: "outline-invalid",
        message: "Der Außenradius muss größer als der Innenradius sein.",
      });
  }
  const frame = makeFrame(geometry);
  const fullCircle = geometry.kind === "circular" && geometry.fullCircle;
  const tickDir = g.tickSide === "inside" ? 1 : -1;

  // ------------------------------------------------------------------- range
  const span = range.max - range.min;
  const rangeValid = Number.isFinite(span) && span > 0;
  if (!rangeValid) warnings.push({ code: "range-invalid", message: "Der Maximalwert muss größer als der Minimalwert sein." });

  const majorValid = Number.isFinite(major.step) && major.step > 0;
  if (!majorValid) warnings.push({ code: "major-step-invalid", message: "Der Abstand der Hauptteilung muss größer als 0 sein." });

  const minorStep = minor.mode === "count" ? (minor.count > 0 && majorValid ? major.step / (minor.count + 1) : 0) : minor.step;
  const minorEnabled = minor.mode === "count" ? minor.count > 0 : minor.step > 0;
  const minorValid = !minorEnabled || (Number.isFinite(minorStep) && minorStep > 0);
  if (!minorValid) warnings.push({ code: "minor-step-invalid", message: "Die Schrittweite der Unterteilung muss größer als 0 sein." });

  const decimals = Math.max(decimalsOf(major.step), decimalsOf(range.min));

  // ------------------------------------------------------------------- ticks
  const ticks: Tick[] = [];
  const hiddenTicks = new Set(overrides.hiddenTicks);
  const hiddenLabels = new Set(overrides.hiddenLabels);
  const majorValues: number[] = [];

  const isMajorValue = (v: number) => {
    if (!majorValid) return false;
    const rel = (v - range.min) / major.step;
    return Math.abs(rel - Math.round(rel)) < 1e-6;
  };

  const pushTick = (value: number, kind: Tick["kind"]) => {
    const t = (value - range.min) / span;
    const position = frame.at(t);
    const n = frame.inside(t);
    const length = kind === "major" ? major.length : minor.length;
    const end = { x: position.x + n.x * length * tickDir, y: position.y + n.y * length * tickDir };
    const key = valueKey(value);
    ticks.push({
      id: `tick:${key}`,
      value: Number(key),
      kind,
      t,
      angle: frame.angle(t),
      position,
      start: position,
      end,
      width: kind === "major" ? major.width : minor.width,
      hidden: hiddenTicks.has(key),
    });
  };

  if (rangeValid && majorValid) {
    const n = Math.floor(span / major.step + 1e-6);
    if (n + 1 > MAX_TICKS) {
      warnings.push({
        code: "too-many-ticks",
        message: `Zu viele Teilstriche (${(n + 1).toLocaleString("de-DE")}). Es werden höchstens ${MAX_TICKS.toLocaleString("de-DE")} erzeugt – Abstand der Hauptteilung erhöhen.`,
      });
    }
    const count = Math.min(n, MAX_TICKS - 1);
    for (let k = 0; k <= count; k++) {
      const v = Number(valueKey(range.min + k * major.step));
      if (fullCircle && Math.abs(v - range.max) < EPS) continue; // coincides with min
      majorValues.push(v);
      pushTick(v, "major");
    }

    if (minorEnabled && minorValid) {
      const m = Math.floor(span / minorStep + 1e-6);
      const budget = MAX_TICKS - ticks.length;
      if (m + 1 - majorValues.length > budget) {
        warnings.push({
          code: "too-many-ticks",
          message: `Zu viele Unterteilungen (${(m + 1).toLocaleString("de-DE")}). Es werden höchstens ${MAX_TICKS.toLocaleString("de-DE")} Teilstriche erzeugt – Unterteilung verringern.`,
        });
      }
      let produced = 0;
      for (let j = 0; j <= m && produced < budget; j++) {
        const v = Number(valueKey(range.min + j * minorStep));
        if (v > range.max + EPS) break;
        if (isMajorValue(v)) continue;
        if (fullCircle && Math.abs(v - range.max) < EPS) continue;
        pushTick(v, "minor");
        produced++;
      }
    }
  }
  ticks.sort((a, b) => a.value - b.value);

  // ------------------------------------------------------------------ labels
  const labels: Label[] = [];
  const baselineHalf = bl.enabled ? bl.width / 2 : 0;
  if (labelParams.enabled && rangeValid && majorValid && labelParams.fontSize > 0) {
    const labelSide = labelParams.position;
    const sameSideAsTicks = labelSide === g.tickSide;
    const clearance = baselineHalf + (sameSideAsTicks ? major.length : 0) + labelParams.offset;

    for (const v of majorValues) {
      const key = valueKey(v);
      const text = formatValue(v, decimals);
      const layout = layoutText(text, labelParams.fontSize);
      const halfW = layout.width / 2 + labelParams.strokeWidth / 2;
      const halfH = layout.height / 2 + labelParams.strokeWidth / 2;
      const t = (v - range.min) / span;
      let position: Vec2;

      if (geometry.kind === "circular") {
        const a = (geometry.startAngle + t * geometry.sweep) * DEG;
        const u = { x: Math.sin(a), y: -Math.cos(a) }; // radial outward
        const dot = Math.abs(u.x) * halfW + Math.abs(u.y) * halfH;
        const k2 = halfW * halfW + halfH * halfH;
        let d: number;
        if (labelSide === "inside") {
          const rClear = Math.max(geometry.radius - clearance, 0);
          const disc = dot * dot - k2 + rClear * rClear;
          d = disc > 0 ? -dot + Math.sqrt(disc) : 0;
          if (d < 0) d = 0;
        } else {
          const rClear = geometry.radius + clearance;
          const disc = dot * dot - k2 + rClear * rClear;
          d = dot + Math.sqrt(Math.max(disc, 0));
        }
        position = { x: u.x * d, y: u.y * d };
      } else {
        const p = frame.at(t);
        const n = geometry.inside;
        const sign = labelSide === "inside" ? 1 : -1;
        const boxExtent = geometry.orientation === "horizontal" ? halfH : halfW;
        const dist = clearance + boxExtent;
        position = { x: p.x + n.x * dist * sign, y: p.y + n.y * dist * sign };
      }

      labels.push({
        id: `label:${key}`,
        tickId: `tick:${key}`,
        value: v,
        text,
        position,
        rotation: 0,
        fontSize: labelParams.fontSize,
        strokeWidth: labelParams.strokeWidth,
        halfWidth: halfW,
        halfHeight: halfH,
        strokes: layout.strokes.map((s) => s.map((p) => ({ x: p.x + position.x, y: p.y + position.y }))),
        hidden: hiddenLabels.has(key),
      });
    }
  }

  // ---------------------------------------------------------------- baseline
  let baseline: BaselineGeometry | null = null;
  if (bl.enabled && bl.width > 0) {
    if (geometry.kind === "circular") {
      baseline = geometry.fullCircle
        ? { kind: "circle", center, radius: geometry.radius, width: bl.width }
        : {
            kind: "arc",
            center,
            radius: geometry.radius,
            startAngle: geometry.startAngle,
            endAngle: geometry.endAngle,
            width: bl.width,
          };
    } else {
      baseline = { kind: "line", a: geometry.a, b: geometry.b, width: bl.width };
    }
  }

  // ---------------------------------------------------------- content bounds
  const content = emptyBounds();
  for (const tk of ticks) {
    if (tk.hidden) continue;
    extend(content, tk.start.x, tk.start.y, tk.width / 2);
    extend(content, tk.end.x, tk.end.y, tk.width / 2);
  }
  for (const lb of labels) {
    if (lb.hidden) continue;
    extend(content, lb.position.x - lb.halfWidth, lb.position.y - lb.halfHeight);
    extend(content, lb.position.x + lb.halfWidth, lb.position.y + lb.halfHeight);
  }
  if (baseline) {
    if (baseline.kind === "circle") {
      extend(content, center.x - baseline.radius, center.y - baseline.radius, baseline.width / 2);
      extend(content, center.x + baseline.radius, center.y + baseline.radius, baseline.width / 2);
    } else if (baseline.kind === "arc") {
      const lo = Math.min(baseline.startAngle, baseline.endAngle);
      const hi = Math.max(baseline.startAngle, baseline.endAngle);
      const pts = [pointOnCircle(center, baseline.radius, lo), pointOnCircle(center, baseline.radius, hi)];
      for (let c = Math.ceil(lo / 90) * 90; c <= hi; c += 90) pts.push(pointOnCircle(center, baseline.radius, c));
      for (const p of pts) extend(content, p.x, p.y, baseline.width / 2);
    } else {
      extend(content, baseline.a.x, baseline.a.y, baseline.width / 2);
      extend(content, baseline.b.x, baseline.b.y, baseline.width / 2);
    }
  }
  if (!isFiniteBounds(content)) {
    // Nothing visible – fall back to the baseline geometry so the preview has something to fit.
    if (geometry.kind === "circular") {
      extend(content, -geometry.radius, -geometry.radius);
      extend(content, geometry.radius, geometry.radius);
    } else {
      extend(content, geometry.a.x, geometry.a.y);
      extend(content, geometry.b.x, geometry.b.y);
    }
  }

  // ----------------------------------------------------------------- outline
  let outline: OutlineGeometry;
  if (geometry.kind === "circular") {
    outline = {
      kind: "ring",
      center,
      innerRadius: Math.max(0, Math.min(g.innerRadius, g.outerRadius)),
      outerRadius: Math.max(g.outerRadius, 0),
    };
    // Is all content inside the ring?
    let rMin = Infinity;
    let rMax = -Infinity;
    const consider = (x: number, y: number, pad = 0) => {
      const r = Math.hypot(x, y);
      rMin = Math.min(rMin, r - pad);
      rMax = Math.max(rMax, r + pad);
    };
    for (const tk of ticks) {
      if (tk.hidden) continue;
      consider(tk.start.x, tk.start.y, tk.width / 2);
      consider(tk.end.x, tk.end.y, tk.width / 2);
    }
    for (const lb of labels) {
      if (lb.hidden) continue;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) consider(lb.position.x + sx * lb.halfWidth, lb.position.y + sy * lb.halfHeight);
      // nearest point of the box to the centre may lie on an edge, not a corner
      const nx = Math.max(Math.abs(lb.position.x) - lb.halfWidth, 0);
      const ny = Math.max(Math.abs(lb.position.y) - lb.halfHeight, 0);
      rMin = Math.min(rMin, Math.hypot(nx, ny));
    }
    if (baseline) {
      rMin = Math.min(rMin, geometry.radius - baseline.width / 2);
      rMax = Math.max(rMax, geometry.radius + baseline.width / 2);
    }
    if (Number.isFinite(rMin) && (rMin < outline.innerRadius - 0.01 || rMax > outline.outerRadius + 0.01)) {
      warnings.push({
        code: "outside-outline",
        message: `Teilstriche oder Beschriftung liegen außerhalb der Kontur (Inhalt reicht von r = ${rMin.toFixed(1)} bis ${rMax.toFixed(1)} mm). Innen-/Außenradius anpassen.`,
      });
    }
  } else {
    const m = LINEAR_BODY_MARGIN;
    outline = {
      kind: "rect",
      x: content.minX - m,
      y: content.minY - m,
      width: content.maxX - content.minX + 2 * m,
      height: content.maxY - content.minY + 2 * m,
    };
  }

  const outlineBounds: Bounds =
    outline.kind === "ring"
      ? { minX: -outline.outerRadius, minY: -outline.outerRadius, maxX: outline.outerRadius, maxY: outline.outerRadius }
      : { minX: outline.x, minY: outline.y, maxX: outline.x + outline.width, maxY: outline.y + outline.height };

  // ------------------------------------------------------------ more checks
  const visibleLabels = labels.filter((l) => !l.hidden);
  for (let i = 0; i < visibleLabels.length; i++) {
    const a = visibleLabels[i];
    const b = visibleLabels[(i + 1) % visibleLabels.length];
    if (a === b) break;
    if (i === visibleLabels.length - 1 && !fullCircle) break;
    const overlap =
      Math.abs(a.position.x - b.position.x) < a.halfWidth + b.halfWidth &&
      Math.abs(a.position.y - b.position.y) < a.halfHeight + b.halfHeight;
    if (overlap) {
      warnings.push({
        code: "labels-overlap",
        message: "Beschriftungen überlappen sich. Schriftgröße verringern oder Hauptteilung vergrößern.",
      });
      break;
    }
  }
  if (relief.mode === "engraved" && relief.depth >= relief.baseThickness) {
    warnings.push({ code: "relief-depth", message: "Die Gravurtiefe muss kleiner als die Grundplattenstärke sein." });
  }

  const hiddenCount = ticks.filter((t) => t.hidden).length + labels.filter((l) => l.hidden).length;

  return {
    params,
    geometry,
    baseline,
    outline,
    ticks,
    labels,
    bounds: unionBounds(content, outlineBounds),
    contentBounds: content,
    warnings,
    stats: {
      majorCount: majorValues.length,
      minorCount: ticks.length - majorValues.length,
      labelCount: visibleLabels.length,
      hiddenCount,
    },
  };
}
