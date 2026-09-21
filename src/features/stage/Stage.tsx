"use client";

import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import * as React from "react";
import { MicroLabel } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/overlay";
import {
  formatValue,
  type Point,
  type ScaleDefinition,
  type Tick,
} from "@/lib/scale-engine";
import { labelTransform, n, polyToPathD } from "@/lib/svg-renderer";
import { useEditor } from "@/store/editor";

interface View {
  k: number;
  x: number;
  y: number;
}

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 80;

function bodyLoops(def: ScaleDefinition): string[] {
  const d = def.domain;
  const loops: string[] = [];
  const toSvg = (p: Point) => `${n(p.x)} ${n(-p.y)}`;
  if (d.kind === "circular") {
    const steps = 96;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = d.uMin + ((d.uMax - d.uMin) * i) / steps;
      outer.push(toSvg(d.map(u, d.vMax)));
      inner.push(toSvg(d.map(u, d.vMin)));
    }
    if (d.wrapU) {
      loops.push(`M${outer.join("L")} Z`);
      loops.push(`M${inner.join("L")} Z`);
    } else {
      loops.push(`M${[...outer, ...inner.reverse()].join("L")} Z`);
    }
  } else {
    const corners = [
      d.map(d.uMin, d.vMin),
      d.map(d.uMax, d.vMin),
      d.map(d.uMax, d.vMax),
      d.map(d.uMin, d.vMax),
    ];
    loops.push(`M${corners.map(toSvg).join("L")} Z`);
  }
  return loops;
}

function niceStep(scale: number, target: number): number {
  const steps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  return steps.find((s) => s * scale >= target) ?? 1000;
}

/**
 * Bühne: Live-Vorschau mit Zoom, Pan, Fit to View, Millimetermaßstäben
 * und direkter Manipulation der Teilstriche.
 */
export function Stage({ definition }: { definition: ScaleDefinition }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const panRef = React.useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  );
  const rafRef = React.useRef<number | null>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [view, setView] = React.useState<View>({ k: 1, x: 0, y: 0 });
  const [hovered, setHovered] = React.useState<Tick | null>(null);

  const selectedValue = useEditor((s) => s.selectedValue);
  const select = useEditor((s) => s.select);
  const ticks = definition.ticks;
  const selected = React.useMemo(
    () => (selectedValue === null ? null : (ticks.find((t) => t.value === selectedValue) ?? null)),
    [ticks, selectedValue],
  );

  // Maße der Bühne
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: host.clientWidth, h: host.clientHeight });
    });
    ro.observe(host);
    setSize({ w: host.clientWidth, h: host.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = React.useCallback(
    (w: number, h: number) => {
      const e = definition.extents;
      const pad = 56;
      const boxW = Math.max(1e-3, e.width);
      const boxH = Math.max(1e-3, e.height);
      const k = Math.min((w - pad * 2) / boxW, (h - pad * 2) / boxH);
      const cx = (e.minX + e.maxX) / 2;
      const cy = -((e.minY + e.maxY) / 2);
      setView({ k: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k)), x: w / 2 - cx * k, y: h / 2 - cy * k });
    },
    [definition.extents],
  );

  // Einmal einpassen: beim ersten Rendern und bei Typwechsel.
  const typeRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    if (typeRef.current === definition.params.id + definition.type) return;
    typeRef.current = definition.params.id + definition.type;
    fit(size.w, size.h);
  }, [size.w, size.h, definition.params.id, definition.type, fit]);

  // Zoom mit dem Rad — non-passive, damit die Seite nicht mitscrollt.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.k * Math.exp(-e.deltaY * 0.0016)));
        const ratio = k / v.k;
        return { k, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Tastatur: Marke wandern, Zoom, Fit, Auswahl aufheben.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      select(null);
      setHovered(null);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const index = selected ? ticks.indexOf(selected) : -1;
      const next = ticks[Math.max(0, Math.min(ticks.length - 1, index + dir))];
      if (next) select(next.value);
      return;
    }
    if (e.key === "+" || e.key === "-") {
      e.preventDefault();
      const factor = e.key === "+" ? 1.25 : 0.8;
      setView((v) => ({ ...v, k: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.k * factor)) }));
    }
    if (e.key === "0") {
      e.preventDefault();
      fit(size.w, size.h);
    }
  };

  const tickIndex = (target: EventTarget | null): number => {
    const el = target as SVGElement | null;
    const raw = el?.getAttribute?.("data-tick");
    return raw ? Number(raw) : -1;
  };

  const readout = hovered ?? selected;

  // Maßstabsleisten in Bildschirmkoordinaten
  const stepX = niceStep(view.k, 92);
  const stepY = niceStep(view.k, 46);
  const worldLeft = -view.x / view.k;
  const worldRight = (size.w - view.x) / view.k;
  const worldTop = -view.y / view.k;
  const worldBottom = (size.h - view.y) / view.k;
  const xMarks: number[] = [];
  for (let v = Math.ceil(worldLeft / stepX) * stepX; v <= worldRight; v += stepX) {
    xMarks.push(v);
  }
  const yMarks: number[] = [];
  for (let v = Math.ceil(worldTop / stepY) * stepY; v <= worldBottom; v += stepY) {
    yMarks.push(v);
  }

  const callout = readout
    ? {
        x: readout.center.x * view.k + view.x,
        y: -readout.center.y * view.k + view.y - 16,
      }
    : null;

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative min-h-[340px] flex-1 overflow-hidden bg-[var(--surface-0)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(47,107,255,0.07)_0%,transparent_60%)]" />

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0 touch-none"
        style={{ cursor: panRef.current ? "grabbing" : "default" }}
        onPointerMove={(e) => {
          const pan = panRef.current;
          if (pan) {
            const dx = e.clientX - pan.x;
            const dy = e.clientY - pan.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pan.moved = true;
            const nv = { x: pan.vx + dx, y: pan.vy + dy };
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                setView((v) => ({ ...v, x: nv.x, y: nv.y }));
              });
            }
            pan.x = e.clientX;
            pan.y = e.clientY;
            pan.vx = nv.x;
            pan.vy = nv.y;
            return;
          }
          const i = tickIndex(e.target);
          const next = i >= 0 ? ticks[i] : null;
          setHovered((prev) => (prev === next ? prev : next));
        }}
        onPointerDown={(e) => {
          const i = tickIndex(e.target);
          if (i >= 0) {
            select(ticks[i].value);
            return;
          }
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerUp={(e) => {
          const pan = panRef.current;
          panRef.current = null;
          if (pan && !pan.moved) select(null);
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => setHovered(null)}
      >
        {/* Millimeterraster */}
        <defs>
          <pattern
            id="mmgrid"
            width={10 * view.k}
            height={10 * view.k}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${view.x % (10 * view.k)} ${view.y % (10 * view.k)})`}
          >
            <path
              d={`M${10 * view.k} 0 L0 0 0 ${10 * view.k}`}
              fill="none"
              stroke="var(--line)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mmgrid)" opacity="0.75" />

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Grundkörper — was im 3D-Export als Platte entsteht */}
          {bodyLoops(definition).map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={1 / view.k}
              strokeDasharray={`${4 / view.k} ${4 / view.k}`}
            />
          ))}

          {/* Beschriftung */}
          <g
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
            fontSize={definition.params.labels.fontSize}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {definition.labels.map((l) => (
              <text key={l.id} transform={labelTransform(l)} textAnchor="middle" dominantBaseline="central">
                {l.text}
              </text>
            ))}
          </g>

          {/* Teilstriche */}
          <g>
            {ticks.map((t, i) => {
              const isSelected = selected !== null && t.value === selected.value;
              return (
                <path
                  key={t.id}
                  data-tick={i}
                  d={polyToPathD(t.poly)}
                  className={isSelected ? "scale-tick scale-tick--selected" : "scale-tick"}
                />
              );
            })}
          </g>
        </g>

        {/* Maßstabsleisten */}
        <g className="pointer-events-none">
          <rect x="0" y="0" width={size.w} height="18" fill="var(--surface-1)" opacity="0.92" />
          <rect x="0" y="0" width="18" height={size.h} fill="var(--surface-1)" opacity="0.92" />
          <path d={`M0 18 H${size.w} M18 0 V${size.h}`} stroke="var(--line-strong)" strokeWidth="1" />
          {xMarks.map((v) => {
            const x = v * view.k + view.x;
            return (
              <g key={`x${v}`}>
                <path d={`M${x} 10 V18`} stroke="var(--text-faint)" strokeWidth="1" />
                <text x={x + 3} y="9" className="ruler-text">
                  {formatValue(v, stepX < 1 ? 1 : 0)}
                </text>
              </g>
            );
          })}
          {yMarks.map((v) => {
            const y = v * view.k + view.y;
            return (
              <g key={`y${v}`}>
                <path d={`M10 ${y} H18`} stroke="var(--text-faint)" strokeWidth="1" />
                <text x="3" y={y - 3} className="ruler-text">
                  {formatValue(-v, stepY < 1 ? 1 : 0)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Führungstrich und Callout der ausgewählten Marke */}
        {callout && readout ? (
          <g pointerEvents="none">
            <path
              d={`M${readout.center.x * view.k + view.x} ${-readout.center.y * view.k + view.y} L${
                callout.x + 6
              } ${callout.y + 4}`}
              stroke="var(--accent)"
              strokeWidth="1"
            />
            <text
              x={callout.x + 9}
              y={callout.y + 4}
              className="callout-text"
              fill="var(--accent)"
            >
              {formatValue(readout.value, definition.decimals)}
            </text>
          </g>
        ) : null}
      </svg>

      {/* Ableser */}
      <div className="pointer-events-none absolute right-4 top-7 w-[13.5rem] rounded-[3px] border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-3 py-2.5">
        <MicroLabel>{readout ? "gewählte Marke" : "Vorschau"}</MicroLabel>
        {readout ? (
          <>
            <div className="mt-1 font-[family-name:var(--font-mono)] text-[19px] tabular-nums leading-none text-[var(--text)]">
              {formatValue(readout.value, definition.decimals)}
            </div>
            <dl className="mt-2 space-y-0.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--text-muted)]">
              <div className="flex justify-between gap-2">
                <dt>Art</dt>
                <dd>{readout.major ? "Hauptteilung" : "Unterteilung"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{definition.domain.kind === "circular" ? "Winkel" : "Abstand"}</dt>
                <dd>
                  {readout.position.toFixed(2)}
                  {definition.domain.kind === "circular" ? "°" : " mm"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Linienbreite</dt>
                <dd>{readout.width.toFixed(2)} mm</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-faint)]">
            Zeige auf einen Teilstrich, um ihn zu wählen. Pfeiltasten wandern von Marke zu Marke.
          </p>
        )}
      </div>

      {/* Werkzeugleiste */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-[3px] border border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-1">
        <Tooltip label="Verkleinern">
          <button
            type="button"
            aria-label="Verkleinern"
            onClick={() => setView((v) => ({ ...v, k: Math.max(ZOOM_MIN, v.k * 0.8) }))}
            className="rounded-[2px] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <span className="w-14 text-center font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--text-muted)]">
          {(view.k * 100).toFixed(0)} %
        </span>
        <Tooltip label="Vergrößern">
          <button
            type="button"
            aria-label="Vergrößern"
            onClick={() => setView((v) => ({ ...v, k: Math.min(ZOOM_MAX, v.k * 1.25) }))}
            className="rounded-[2px] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <span className="mx-0.5 h-5 w-px bg-[var(--line-strong)]" />
        <Tooltip label="Einpassen (Taste 0)">
          <button
            type="button"
            aria-label="Einpassen"
            onClick={() => fit(size.w, size.h)}
            className="rounded-[2px] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip label="Auswahl aufheben (Esc)">
          <button
            type="button"
            aria-label="Auswahl aufheben"
            onClick={() => select(null)}
            className="rounded-[2px] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>

      <MicroLabel className="pointer-events-none absolute bottom-5 left-8 hidden lg:block">
        Rad zoomen · Ziehen verschiebt · Klick wählt eine Marke · gestrichelt: Grundkörper
      </MicroLabel>
    </div>
  );
}
