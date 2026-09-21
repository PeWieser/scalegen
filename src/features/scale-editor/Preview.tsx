"use client";

import * as React from "react";
import { AlertTriangle, Maximize2, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ScaleDefinition } from "@/core/scale-engine";
import { buildSvgScene, type SvgPrimitive } from "@/core/renderer/svg-renderer";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, fmt } from "@/lib/utils";
import { useEditorStore } from "./store";

/** 100 % = real size on a 96 dpi screen. */
const PX_PER_MM_100 = 96 / 25.4;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 400;

const COLORS = {
  outline: "#4b5160",
  content: "#e6e8ee",
  hidden: "#5c6270",
  hover: "#8ec0ff",
  selected: "#3b82f6",
  grid: "rgba(255,255,255,0.05)",
  axis: "rgba(255,255,255,0.12)",
};

export interface PreviewHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

interface View {
  cx: number;
  cy: number;
  zoom: number; // px per mm
}

function primitiveElement(p: SvgPrimitive, stroke: string, strokeWidth: number, extra?: React.SVGProps<SVGElement>) {
  const common = { stroke, strokeWidth, fill: "none" as const, ...extra };
  if (p.kind === "line") return <line key={p.id} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...(common as React.SVGProps<SVGLineElement>)} />;
  if (p.kind === "circle") return <circle key={p.id} cx={p.cx} cy={p.cy} r={p.r} {...(common as React.SVGProps<SVGCircleElement>)} />;
  return <path key={p.id} d={p.d} strokeLinecap={p.linecap} strokeLinejoin="round" {...(common as React.SVGProps<SVGPathElement>)} />;
}

/** Static layer: everything that does not depend on hover/selection. Memoised on scene + zoom. */
const StaticLayer = React.memo(function StaticLayer({ primitives, minStroke }: { primitives: SvgPrimitive[]; minStroke: number }) {
  return (
    <g>
      {primitives.map((p) => {
        if (p.layer === "outline") return primitiveElement(p, COLORS.outline, Math.max(p.strokeWidth, minStroke), { strokeDasharray: `${minStroke * 6} ${minStroke * 4}` });
        if (p.hidden) return primitiveElement(p, COLORS.hidden, Math.max(p.strokeWidth, minStroke), { strokeDasharray: `${minStroke * 3} ${minStroke * 3}`, opacity: 0.8 });
        return primitiveElement(p, COLORS.content, Math.max(p.strokeWidth, minStroke));
      })}
    </g>
  );
});

/** Invisible, generous hit areas for ticks and labels (event delegation via data attributes). */
const HitLayer = React.memo(function HitLayer({ primitives, hitWidth }: { primitives: SvgPrimitive[]; hitWidth: number }) {
  return (
    <g stroke="transparent" fill="none" style={{ cursor: "pointer" }}>
      {primitives.map((p) => {
        if (!p.tickId) return null;
        const w = Math.max(p.strokeWidth * 2, hitWidth);
        if (p.kind === "line") return <line key={p.id} data-tick-id={p.tickId} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeWidth={w} strokeLinecap="square" />;
        if (p.kind === "path") return <path key={p.id} data-tick-id={p.tickId} d={p.d} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
        return null;
      })}
    </g>
  );
});

function pickGridStep(zoom: number): number {
  const candidates = [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000];
  for (const c of candidates) if (c * zoom >= 28) return c;
  return 1000;
}

export const Preview = React.forwardRef<PreviewHandle, { def: ScaleDefinition }>(function Preview({ def }, ref) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [view, setView] = React.useState<View>({ cx: 0, cy: 0, zoom: 6 });
  const [hover, setHover] = React.useState<{ tickId: string; x: number; y: number } | null>(null);
  const [cursorMm, setCursorMm] = React.useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = React.useState(false);
  const selectedTickId = useEditorStore((s) => s.selectedTickId);
  const select = useEditorStore((s) => s.select);
  const dragRef = React.useRef<{ startX: number; startY: number; cx: number; cy: number; moved: boolean; tickId: string | null } | null>(null);

  const scene = React.useMemo(() => buildSvgScene(def, { includeHidden: true, includeOutline: true, margin: 0 }), [def]);

  // ---- sizing
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = React.useCallback(() => {
    if (size.w === 0 || size.h === 0) return;
    const b = def.bounds;
    const bw = Math.max(b.maxX - b.minX, 1);
    const bh = Math.max(b.maxY - b.minY, 1);
    const zoom = Math.min((size.w - 64) / bw, (size.h - 96) / bh);
    setView({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) });
  }, [def.bounds, size.w, size.h]);

  // Fit once we know our size and whenever the scale type changes.
  const fittedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (size.w === 0) return;
    const key = def.params.type;
    if (fittedFor.current !== key) {
      fittedFor.current = key;
      fit();
    }
  }, [def.params.type, fit, size.w]);

  const zoomBy = React.useCallback((factor: number, px?: number, py?: number) => {
    setView((v) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      if (px === undefined || py === undefined) return { ...v, zoom };
      // keep the point under the cursor fixed
      const mx = v.cx + (px - size.w / 2) / v.zoom;
      const my = v.cy + (py - size.h / 2) / v.zoom;
      return { zoom, cx: mx - (px - size.w / 2) / zoom, cy: my - (py - size.h / 2) / zoom };
    });
  }, [size.w, size.h]);

  React.useImperativeHandle(ref, () => ({
    fit,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    resetZoom: () => setView((v) => ({ ...v, zoom: PX_PER_MM_100 })),
  }), [fit, zoomBy]);

  // Wheel zoom (non-passive so we can prevent page scroll)
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const toMm = React.useCallback((px: number, py: number) => ({
    x: view.cx + (px - size.w / 2) / view.zoom,
    y: view.cy + (py - size.h / 2) / view.zoom,
  }), [view, size.w, size.h]);

  const localPoint = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const { x, y } = localPoint(e);
    const tickId = (e.target as Element).getAttribute?.("data-tick-id") ?? null;
    dragRef.current = { startX: x, startY: y, cx: view.cx, cy: view.cy, moved: false, tickId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = localPoint(e);
    setCursorMm(toMm(x, y));
    const d = dragRef.current;
    if (d) {
      const dx = x - d.startX;
      const dy = y - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > 3) {
        d.moved = true;
        setPanning(true);
      }
      if (d.moved) {
        setView((v) => ({ ...v, cx: d.cx - dx / v.zoom, cy: d.cy - dy / v.zoom }));
        if (hover) setHover(null);
      }
      return;
    }
    const tickId = (e.target as Element).getAttribute?.("data-tick-id") ?? null;
    if (tickId) setHover({ tickId, x, y });
    else if (hover) setHover(null);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setPanning(false);
    if (!d) return;
    if (!d.moved) select(d.tickId);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onPointerLeave = () => {
    setHover(null);
    setCursorMm(null);
  };

  // ---- derived
  const vb = { x: view.cx - size.w / 2 / view.zoom, y: view.cy - size.h / 2 / view.zoom, w: size.w / view.zoom, h: size.h / view.zoom };
  const minStroke = Number((1 / view.zoom).toPrecision(2));
  const gridStep = pickGridStep(view.zoom);
  const hoveredTick = hover ? def.ticks.find((t) => t.id === hover.tickId) : undefined;
  const selectedTick = selectedTickId ? def.ticks.find((t) => t.id === selectedTickId) : undefined;
  const highlightPrims = (tickId: string | undefined) => (tickId ? scene.primitives.filter((p) => p.tickId === tickId) : []);

  const b = def.bounds;
  const isRing = def.outline.kind === "ring";
  const dims = isRing && def.outline.kind === "ring" ? `Ø ${fmt(def.outline.outerRadius * 2, 1)} mm` : `${fmt(b.maxX - b.minX, 1)} × ${fmt(b.maxY - b.minY, 1)} mm`;
  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-stage" style={{ touchAction: "none" }}>
      {size.w > 0 ? (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className={cn("block", panning ? "cursor-grabbing" : "cursor-crosshair")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onDoubleClick={fit}
          role="img"
          aria-label={`Vorschau: ${def.stats.majorCount} Hauptteilstriche, ${def.stats.minorCount} Unterteilstriche`}
        >
          <defs>
            <pattern id="grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
              <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke={COLORS.grid} strokeWidth={minStroke} />
            </pattern>
          </defs>
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />
          <line x1={vb.x} x2={vb.x + vb.w} y1={0} y2={0} stroke={COLORS.axis} strokeWidth={minStroke} />
          <line y1={vb.y} y2={vb.y + vb.h} x1={0} x2={0} stroke={COLORS.axis} strokeWidth={minStroke} />

          <StaticLayer primitives={scene.primitives} minStroke={minStroke} />

          {/* selection + hover highlights on top */}
          {selectedTick
            ? highlightPrims(selectedTick.id).map((p) => primitiveElement(p, COLORS.selected, Math.max(p.strokeWidth, minStroke * 2.5)))
            : null}
          {hoveredTick && hoveredTick.id !== selectedTickId
            ? highlightPrims(hoveredTick.id).map((p) => primitiveElement(p, COLORS.hover, Math.max(p.strokeWidth, minStroke * 2)))
            : null}
          {selectedTick ? (
            <circle cx={selectedTick.end.x} cy={selectedTick.end.y} r={minStroke * 4} fill={COLORS.selected} stroke="#0b0d12" strokeWidth={minStroke} />
          ) : null}

          <HitLayer primitives={scene.primitives} hitWidth={minStroke * 10} />
        </svg>
      ) : null}

      {/* hover tooltip – tells what is under the cursor and what a click does */}
      <AnimatePresence>
        {hover && hoveredTick ? (
          <motion.div
            key="hover"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
            style={{ left: Math.min(hover.x + 14, size.w - 220), top: Math.min(hover.y + 14, size.h - 60) }}
          >
            <div className="font-medium">
              {hoveredTick.kind === "major" ? "Hauptteilstrich" : "Unterteilstrich"} <span className="font-mono">{hoveredTick.value}</span>
              {hoveredTick.hidden ? <span className="text-muted-foreground"> · ausgeblendet</span> : null}
            </div>
            <div className="text-muted-foreground">
              {hoveredTick.id === selectedTickId ? "Ausgewählt · Entf blendet aus" : "Klicken zum Auswählen"}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* warnings – honest states, always visible next to the result */}
      {def.warnings.length > 0 ? (
        <div className="absolute left-3 top-3 z-10 flex max-w-md flex-col gap-1.5">
          {def.warnings.map((w, i) => (
            <div key={`${w.code}-${i}`} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* status bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-9 items-center justify-between gap-3 border-t border-border/70 bg-background/80 px-3 font-mono text-[11px] text-muted-foreground backdrop-blur">
        <div className="flex items-center gap-4">
          <span className="text-foreground">{dims}</span>
          <span>
            {def.stats.majorCount} Haupt · {def.stats.minorCount} Unter · {def.stats.labelCount} Beschr.
          </span>
          <span className="hidden min-w-[150px] lg:inline">{cursorMm ? `x ${fmt(cursorMm.x, 2)}  y ${fmt(-cursorMm.y, 2)}` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden xl:inline">Rad: Zoom · Ziehen: Verschieben · Doppelklick: Einpassen</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1 / 1.25)} aria-label="Verkleinern">
                <Minus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Verkleinern <Kbd className="ml-1">−</Kbd></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, zoom: PX_PER_MM_100 }))}
                className="h-8 min-w-[64px] rounded-md px-2 text-foreground hover:bg-accent"
                aria-label="Zoom auf 100 % (Originalgröße)"
              >
                {Math.round((view.zoom / PX_PER_MM_100) * 100)} %
              </button>
            </TooltipTrigger>
            <TooltipContent>Originalgröße (100 %)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1.25)} aria-label="Vergrößern">
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vergrößern <Kbd className="ml-1">+</Kbd></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={fit} aria-label="Ansicht einpassen">
                <Maximize2 /> Einpassen
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alles sichtbar machen <Kbd className="ml-1">F</Kbd></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
