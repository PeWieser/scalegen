"use client";

import * as React from "react";
import { Check, Download, Info } from "lucide-react";
import type { ScaleDefinition } from "@/core/scale-engine";
import { buildFeatureFootprint, buildOutlinePolygon } from "@/core/scale-engine/footprint";
import { DEFAULT_EXPORT_OPTIONS, EXPORT_FORMATS, FORMAT_INFO, downloadResult, exportScale, type ExportFormat, type ExportOptions, type ExportResult } from "@/core/exporters";
import { renderMeshToCanvas } from "@/core/renderer/canvas-renderer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Kbd } from "@/components/ui/kbd";
import { cn, formatBytes } from "@/lib/utils";
import { NumberField } from "./NumberField";
import { useEditorStore } from "./store";

const LAST_FORMAT_KEY = "scale-generator:last-format";

/** Contour preview: the unioned footprints as filled shapes – exactly what the DXF contour mode contains. */
function footprintPreviewSvg(def: ScaleDefinition, includeOutline: boolean): string {
  const fp = buildFeatureFootprint(def);
  const n = (v: number) => v.toFixed(3);
  const d = fp
    .map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ") + " Z").join(" "))
    .join(" ");
  const b = includeOutline ? def.bounds : def.contentBounds;
  const m = 2;
  let outline = "";
  if (includeOutline) {
    const o = buildOutlinePolygon(def);
    outline = `<path d="${o.map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ") + " Z").join(" ")}" fill="none" stroke="#000" stroke-width="0.2" fill-rule="evenodd"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(b.minX - m)} ${n(b.minY - m)} ${n(b.maxX - b.minX + 2 * m)} ${n(b.maxY - b.minY + 2 * m)}">${outline}<path d="${d}" fill="#000" fill-rule="evenodd"/></svg>`;
}

function MeshPreview({ result }: { result: ExportResult }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [rot, setRot] = React.useState({ yaw: -30, pitch: 55 });
  const drag = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result.mesh) return;
    let frame = requestAnimationFrame(() => {
      if (canvasRef.current && result.mesh) renderMeshToCanvas(canvasRef.current, result.mesh, { yaw: rot.yaw, pitch: rot.pitch, background: "#0f1116" });
    });
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (canvasRef.current && result.mesh) renderMeshToCanvas(canvasRef.current, result.mesh, { yaw: rot.yaw, pitch: rot.pitch, background: "#0f1116" });
      });
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [result, rot]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none rounded-md active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, yaw: rot.yaw, pitch: rot.pitch };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          setRot({ yaw: drag.current.yaw + dx * 0.5, pitch: Math.max(0, Math.min(90, drag.current.pitch + dy * 0.5)) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        aria-label="3D-Vorschau des exportierten Körpers"
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        Ziehen zum Drehen · {result.mesh?.triangleCount.toLocaleString("de-DE")} Dreiecke
      </div>
    </div>
  );
}

export function ExportDialog({ def, open, onOpenChange }: { def: ScaleDefinition; open: boolean; onOpenChange: (open: boolean) => void }) {
  const name = useEditorStore((s) => s.name);
  const patch = useEditorStore((s) => s.patch);
  const [format, setFormat] = React.useState<ExportFormat>("dxf");
  const [options, setOptions] = React.useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [result, setResult] = React.useState<ExportResult | null>(null);
  const [computing, setComputing] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState<string | null>(null);
  const info = FORMAT_INFO[format];
  const is3d = info.kind === "3d";

  React.useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_FORMAT_KEY) as ExportFormat | null;
      if (last && EXPORT_FORMATS.includes(last)) setFormat(last);
    } catch {
      /* private mode etc. – keep default */
    }
  }, []);

  // Build the file whenever inputs change. 3D meshes are debounced slightly (they take longer).
  React.useEffect(() => {
    if (!open) return;
    setComputing(true);
    const delay = FORMAT_INFO[format].kind === "3d" ? 120 : 0;
    const t = setTimeout(() => {
      setResult(exportScale(def, format, options, name));
      setComputing(false);
    }, delay);
    return () => clearTimeout(t);
  }, [def, format, options, name, open]);

  React.useEffect(() => {
    if (!downloaded) return;
    const t = setTimeout(() => setDownloaded(null), 2500);
    return () => clearTimeout(t);
  }, [downloaded]);

  const previewSrc = React.useMemo(() => {
    if (!result || is3d) return null;
    const svg = format === "dxf" && options.dxfMode === "contour" ? footprintPreviewSvg(def, options.includeOutline) : (result.text ?? "");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [result, is3d, format, options, def]);

  const choose = (f: ExportFormat) => {
    setFormat(f);
    try {
      localStorage.setItem(LAST_FORMAT_KEY, f);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    if (!result) return;
    downloadResult(result);
    setDownloaded(result.filename);
  };

  const relief = def.params.relief;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl gap-0 p-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            download();
          }
        }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Exportieren</DialogTitle>
          <DialogDescription>Alle Formate entstehen aus derselben Geometrie wie die Vorschau. Einheiten: Millimeter, Maßstab 1:1.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <Tabs value={format} onValueChange={(v) => choose(v as ExportFormat)}>
            <TabsList className="grid w-full grid-cols-4">
              {EXPORT_FORMATS.map((f) => (
                <TabsTrigger key={f} value={f} className="font-mono">
                  {FORMAT_INFO[f].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="mt-2 text-xs text-muted-foreground">{info.description}</p>
        </div>

        <div className="grid gap-5 px-6 py-4 md:grid-cols-[1.25fr_1fr]">
          {/* preview */}
          <div className={cn("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border", is3d ? "bg-[#0f1116]" : "bg-white")}>
            {is3d ? (
              result?.mesh ? <MeshPreview result={result} /> : null
            ) : previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt={`Vorschau der ${info.label}-Datei`} className="h-full w-full object-contain p-3" />
            ) : null}
            {computing ? (
              <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">berechnet …</div>
            ) : null}
          </div>

          {/* facts + options */}
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Datei</dt>
              <dd className="truncate font-mono">{result?.filename ?? "–"}</dd>
              <dt className="text-muted-foreground">Größe</dt>
              <dd className="font-mono">{result ? formatBytes(result.bytes) : "–"}</dd>
              <dt className="text-muted-foreground">Einheiten</dt>
              <dd className="font-mono">mm</dd>
              <dt className="text-muted-foreground">Maßstab</dt>
              <dd className="font-mono">1:1</dd>
              {result?.facts.map((f) => (
                <React.Fragment key={f.label}>
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className={cn("font-mono", f.label === "Hinweis" && "text-warning")}>{f.value}</dd>
                </React.Fragment>
              ))}
            </dl>

            <div className="flex flex-col gap-3 border-t pt-3">
              {!is3d ? (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="includeOutline" className="text-xs text-foreground">
                    Kontur mit exportieren
                  </Label>
                  <Switch id="includeOutline" checked={options.includeOutline} onCheckedChange={(v) => setOptions((o) => ({ ...o, includeOutline: v }))} />
                </div>
              ) : null}

              {format === "dxf" ? (
                <div className="flex flex-col gap-1">
                  <Label>Geometrie</Label>
                  <ToggleGroup type="single" value={options.dxfMode} onValueChange={(v) => v && setOptions((o) => ({ ...o, dxfMode: v as ExportOptions["dxfMode"] }))}>
                    <ToggleGroupItem value="centerline">Mittellinien</ToggleGroupItem>
                    <ToggleGroupItem value="contour">Konturen</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {options.dxfMode === "centerline"
                      ? "Eine Linie je Strich – für Gravur mit V-Fräser, Laser oder Plotter. Breite bestimmt das Werkzeug."
                      : "Geschlossene Konturen mit den eingestellten Linienbreiten – für Taschenfräsen oder Ausschneiden."}
                  </p>
                </div>
              ) : null}

              {is3d ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Relief</Label>
                    <ToggleGroup type="single" value={relief.mode} onValueChange={(v) => v && patch("relief", { mode: v as "raised" | "engraved" })}>
                      <ToggleGroupItem value="raised">Erhaben</ToggleGroupItem>
                      <ToggleGroupItem value="engraved">Gravur</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField id="baseThickness" label="Plattenstärke" unit="mm" value={relief.baseThickness} min={0.2} step={0.5} onChange={(v) => patch("relief", { baseThickness: v })} />
                    {relief.mode === "raised" ? (
                      <NumberField id="reliefHeight" label="Extrusionshöhe" unit="mm" value={relief.height} min={0} step={0.1} onChange={(v) => patch("relief", { height: v })} />
                    ) : (
                      <NumberField id="reliefDepth" label="Gravurtiefe" unit="mm" hint="≥ Platte = Durchbruch" value={relief.depth} min={0} step={0.1} onChange={(v) => patch("relief", { depth: v })} />
                    )}
                  </div>
                  <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    Echter Volumenkörper, kein Bild: Striche und Ziffern mit den eingestellten Linienbreiten, Körper aus Innen-/Außenradius bzw. Rechteck.
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <div className="text-xs text-muted-foreground" aria-live="polite">
            {downloaded ? (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Check className="size-3.5 text-primary" /> Heruntergeladen: <span className="font-mono">{downloaded}</span>
              </span>
            ) : (
              <span>
                <Kbd>Strg</Kbd> + <Kbd>↵</Kbd> lädt herunter
              </span>
            )}
          </div>
          <Button onClick={download} disabled={!result || computing} className="min-w-[200px]">
            <Download />
            {info.label} herunterladen{result ? ` (${formatBytes(result.bytes)})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
