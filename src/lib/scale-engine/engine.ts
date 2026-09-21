import {
  decimalsOf,
  formatPlain,
  formatValue,
  round9,
} from "./format";
import type {
  Extents,
  GeometryParams,
  LabelEntity,
  ParamDomain,
  Point,
  ScaleDefinition,
  ScaleParams,
  ScaleType,
  Tick,
} from "./types";

const D2R = Math.PI / 180;

const BASE: Omit<ScaleParams, "id" | "name" | "type"> = {
  geometry: {
    radius: 45,
    startAngle: 180,
    endAngle: 0,
    innerRadius: 30,
    outerRadius: 55,
    length: 120,
    orientation: "horizontal",
  },
  range: { min: 0, max: 80 },
  ticks: {
    majorStep: 10,
    majorLength: 8,
    majorWidth: 0.8,
    minorMode: "count",
    minorCount: 4,
    minorStep: 2,
    minorLength: 4.5,
    minorWidth: 0.4,
  },
  labels: { enabled: true, fontSize: 4.5, position: "outside", offset: 2 },
  body: { mode: "engrave", thickness: 4, depth: 0.6, lineWidth: 0 },
};

export const TYPE_PRESETS: Record<ScaleType, Partial<GeometryParams>> = {
  circle: { radius: 45, startAngle: 0, endAngle: 360, innerRadius: 28, outerRadius: 55 },
  "half-circle": { radius: 45, startAngle: 180, endAngle: 0, innerRadius: 28, outerRadius: 55 },
  arc: { radius: 65, startAngle: 150, endAngle: 30, innerRadius: 50, outerRadius: 74 },
  line: { length: 120, orientation: "horizontal" },
};

export const TYPE_NAMES: Record<ScaleType, string> = {
  circle: "Kreis",
  "half-circle": "Halbkreis",
  arc: "Kreisbogen",
  line: "Gerade Linie",
};

export function createParams(type: ScaleType, id: string): ScaleParams {
  return {
    id,
    name: TYPE_NAMES[type],
    type,
    geometry: { ...BASE.geometry, ...TYPE_PRESETS[type] },
    range: { ...BASE.range },
    ticks: { ...BASE.ticks },
    labels: { ...BASE.labels },
    body: { ...BASE.body },
  };
}

/** Typwechsel setzt nur die geometrischen Vorgaben um, Werte und Teilung bleiben erhalten. */
export function withType(params: ScaleParams, type: ScaleType): ScaleParams {
  return {
    ...params,
    type,
    name: params.name === TYPE_NAMES[params.type] ? TYPE_NAMES[type] : params.name,
    geometry: { ...params.geometry, ...TYPE_PRESETS[type] },
  };
}

function polar(radius: number, deg: number): Point {
  return {
    x: round9(radius * Math.cos(deg * D2R)),
    y: round9(radius * Math.sin(deg * D2R)),
  };
}

interface RawTick {
  value: number;
  major: boolean;
}

function generateValues(
  params: ScaleParams,
  warnings: string[],
): RawTick[] {
  const { min, max } = params.range;
  const tk = params.ticks;
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];

  const step = tk.majorStep > 0 ? tk.majorStep : span;
  const nMajor = Math.max(1, Math.floor(span / step + 1e-9));
  const majors: number[] = [];
  for (let i = 0; i <= nMajor; i++) majors.push(round9(min + i * step));

  const last = majors[majors.length - 1];
  if (span - (last - min) > Math.abs(step) * 1e-6) {
    warnings.push(
      `Die Hauptteilung ${formatValue(step, decimalsOf(step))} teilt ${formatValue(
        min,
        decimalsOf(min),
      )}–${formatValue(max, decimalsOf(max))} nicht ganzzahlig — letzte Hauptteilung ${formatValue(
        last,
        decimalsOf(step, min),
      )}.`,
    );
  }

  const items: RawTick[] = majors.map((value) => ({ value, major: true }));

  if (tk.minorMode === "count") {
    const n = Math.max(0, Math.min(49, Math.round(tk.minorCount)));
    if (n > 0) {
      for (let i = 0; i < majors.length - 1; i++) {
        for (let k = 1; k <= n; k++) {
          items.push({ value: round9(majors[i] + (k * step) / (n + 1)), major: false });
        }
      }
    }
  } else {
    const ms = tk.minorStep;
    if (ms > 0) {
      const ratio = step / ms;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-6 || Math.round(ratio) < 2) {
        warnings.push(
          `Die Unterteilung ${formatValue(ms, decimalsOf(ms))} geht in die Hauptteilung ${formatValue(
            step,
            decimalsOf(step),
          )} nicht auf.`,
        );
      }
      for (let v = min; v <= max + Math.abs(step) * 1e-9; v = round9(v + ms)) {
        const clash = majors.some((m) => Math.abs(m - v) <= Math.abs(step) * 1e-9);
        if (!clash) items.push({ value: v, major: false });
      }
    }
  }

  items.sort((a, b) => a.value - b.value);

  const limit = 4000;
  if (items.length > limit) {
    warnings.push(
      `${items.length} Marken sind zu viele — auf ${limit} begrenzt. Vergrößere die Teilung.`,
    );
    return items.slice(0, limit);
  }
  return items;
}

export function buildScale(params: ScaleParams): ScaleDefinition {
  const g = params.geometry;
  const tk = params.ticks;
  const lp = params.labels;
  const warnings: string[] = [];
  const isLinear = params.type === "line";
  const decimals = decimalsOf(
    params.range.min,
    params.range.max,
    tk.majorStep,
    tk.minorMode === "step" ? tk.minorStep : 0,
  );

  const map = isLinear
    ? g.orientation === "horizontal"
      ? (u: number, v: number): Point => ({ x: round9(u), y: round9(v) })
      : (u: number, v: number): Point => ({ x: round9(v), y: round9(u) })
    : (u: number, v: number): Point => polar(v, u);

  const sweep = g.endAngle - g.startAngle;
  const wrapU = !isLinear && Math.abs(sweep) >= 359.99;

  const domain: ParamDomain = isLinear
    ? {
        kind: "linear",
        uMin: 0,
        uMax: Math.max(g.length, 0.001),
        vMin: 0,
        vMax: 1,
        wrapU: false,
        map,
      }
    : {
        kind: "circular",
        uMin: g.startAngle,
        uMax: g.endAngle,
        vMin: Math.max(0, g.innerRadius),
        vMax: Math.max(g.outerRadius, g.innerRadius + 0.001),
        wrapU,
        map,
      };

  const raw = generateValues(params, warnings);
  const ticks: Tick[] = [];

  const span = params.range.max - params.range.min || 1;
  const anchor = isLinear ? 0 : g.radius;

  let clampedLength = false;
  let overshoot = false;

  raw.forEach((rawTick, index) => {
    const length = rawTick.major ? tk.majorLength : tk.minorLength;
    const width = Math.max(0.01, rawTick.major ? tk.majorWidth : tk.minorWidth);
    const t = (rawTick.value - params.range.min) / span;
    const u = isLinear
      ? t * domain.uMax
      : g.startAngle + t * (g.endAngle - g.startAngle);

    let v0: number;
    let v1: number;
    if (isLinear) {
      v0 = 0;
      v1 = Math.max(0.01, length);
    } else {
      v1 = anchor;
      v0 = anchor - Math.max(0.01, length);
      const floor = Math.max(0, g.innerRadius);
      if (v0 < floor) {
        v0 = floor;
        clampedLength = true;
      }
    }

    if (!isLinear && v1 > Math.max(g.outerRadius, g.radius)) overshoot = true;

    let u0: number;
    let u1: number;
    let poly: Point[];
    if (isLinear) {
      u0 = u - width / 2;
      u1 = u + width / 2;
      if (g.orientation === "horizontal") {
        poly = [
          { x: round9(u0), y: round9(v0) },
          { x: round9(u1), y: round9(v0) },
          { x: round9(u1), y: round9(v1) },
          { x: round9(u0), y: round9(v1) },
        ];
      } else {
        poly = [
          { x: round9(v0), y: round9(u0) },
          { x: round9(v1), y: round9(u0) },
          { x: round9(v1), y: round9(u1) },
          { x: round9(v0), y: round9(u1) },
        ];
      }
    } else {
      const rMid = (v0 + v1) / 2 || 0.001;
      const du = Math.max(0.001, width / rMid / D2R);
      u0 = u - du / 2;
      u1 = u + du / 2;
      poly = [
        polar(v0, u0),
        polar(v1, u0),
        polar(v1, u1),
        polar(v0, u1),
      ];
    }

    // Vollkreis: die Marke bei 0° und 360° fällt zusammen.
    if (wrapU && ticks.length > 0) {
      const first = ticks[0];
      const delta = Math.abs(u - first.position);
      if (Math.min(delta, 360 - delta) < 1e-6) return;
    }

    const center = isLinear
      ? map((u0 + u1) / 2, (v0 + v1) / 2)
      : map(u, (v0 + v1) / 2);

    ticks.push({
      id: rawTick.major ? `M${index}` : `m${index}`,
      index,
      value: rawTick.value,
      major: rawTick.major,
      poly,
      center,
      u,
      u0,
      u1,
      v0,
      v1,
      width,
      position: round9(u),
    });
  });

  if (clampedLength) {
    warnings.push("Teilstrichlänge überschreitet den Innenradius — Marken sind begrenzt.");
  }
  if (overshoot) {
    warnings.push("Marken liegen außerhalb des Außenradius.");
  }

  // Beschriftung
  const labels: LabelEntity[] = [];
  const maxTickLength = ticks.reduce(
    (acc, t) => Math.max(acc, Math.abs(t.v1 - t.v0)),
    0,
  );

  if (lp.enabled && ticks.length > 0) {
    const labelTicks = ticks.filter((t) => t.major);
    for (const t of labelTicks) {
      const text = formatValue(t.value, decimals);
      const w = text.length * lp.fontSize * 0.58;
      const h = lp.fontSize;
      let x: number;
      let y: number;
      let rotation = 0;
      if (isLinear) {
        const v = lp.position === "outside" ? maxTickLength + lp.offset + h / 2 : -(lp.offset + h / 2);
        const p = map(t.u, v);
        x = p.x;
        y = p.y;
        rotation = 0;
      } else {
        const r =
          lp.position === "outside"
            ? g.radius + lp.offset + h / 2
            : g.radius - maxTickLength - lp.offset - h / 2;
        const p = polar(Math.max(0.5, r), t.u);
        x = p.x;
        y = p.y;
        const norm = ((t.u % 360) + 360) % 360;
        rotation = norm > 90 && norm < 270 ? t.u + 180 : t.u;
      }
      labels.push({
        id: `L${t.index}`,
        value: t.value,
        text,
        x,
        y,
        rotation,
        width: w,
        height: h,
      });
    }
    if (!isLinear && lp.position === "outside" && g.radius + lp.offset + lp.fontSize > g.outerRadius) {
      warnings.push("Die Beschriftung ragt über den Außenradius hinaus.");
    }
  }

  // Grundkörper: umschließt stets Marken und Beschriftungsband.
  let vMin = domain.vMin;
  let vMax = domain.vMax;
  let uMin = domain.uMin;
  let uMax = domain.uMax;
  for (const t of ticks) {
    vMin = Math.min(vMin, t.v0, t.v1);
    vMax = Math.max(vMax, t.v0, t.v1);
    uMin = Math.min(uMin, t.u0, t.u1);
    uMax = Math.max(uMax, t.u0, t.u1);
  }
  for (const l of labels) {
    const a = Math.abs(l.rotation) * D2R;
    const r = Math.max(
      (Math.abs(l.width * Math.cos(a)) + Math.abs(l.height * Math.sin(a))) / 2,
      (Math.abs(l.width * Math.sin(a)) + Math.abs(l.height * Math.cos(a))) / 2,
    );
    vMin = isLinear ? Math.min(vMin, l.y - r) : Math.min(vMin, Math.hypot(l.x, l.y) - r);
    vMax = isLinear ? Math.max(vMax, l.y + r) : Math.max(vMax, Math.hypot(l.x, l.y) + r);
    uMin = isLinear ? Math.min(uMin, l.x - r) : uMin;
    uMax = isLinear ? Math.max(uMax, l.x + r) : uMax;
  }
  if (isLinear) {
    if (g.orientation === "vertical") {
      uMin = 0;
      uMax = Math.max(g.length, uMax);
    }
  }
  domain.vMin = vMin;
  domain.vMax = vMax;
  domain.uMin = wrapU ? g.startAngle : uMin;
  domain.uMax = wrapU ? g.endAngle : uMax;

  // Zeichnungsrahmen
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const push = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const t of ticks) for (const p of t.poly) push(p.x, p.y);
  for (const l of labels) {
    const a = l.rotation * D2R;
    const hw = l.width / 2;
    const hh = l.height / 2;
    for (const [sx, sy] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as const) {
      push(
        l.x + sx * Math.cos(a) - sy * Math.sin(a),
        l.y + sx * Math.sin(a) + sy * Math.cos(a),
      );
    }
  }
  if (!Number.isFinite(minX)) {
    const p = map(domain.uMin, domain.vMin);
    minX = p.x;
    minY = p.y;
    maxX = p.x;
    maxY = p.y;
  }
  const extents: Extents = {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0.001, maxX - minX),
    height: Math.max(0.001, maxY - minY),
  };

  return {
    type: params.type,
    params,
    ticks,
    labels,
    domain,
    extents,
    counts: {
      total: ticks.length,
      major: ticks.filter((t) => t.major).length,
      minor: ticks.filter((t) => !t.major).length,
    },
    decimals,
    warnings,
  };
}

/** Beschriftungszahl für Statistiken (z. B. Titelblock). */
export function describeValue(value: number, decimals: number): string {
  return formatPlain(value, decimals);
}
