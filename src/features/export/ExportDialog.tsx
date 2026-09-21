"use client";

import { Download, RotateCw, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { MicroLabel } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlay";
import { renderIso } from "@/lib/canvas-renderer/iso";
import {
  EXPORT_FORMATS,
  FORMAT_LABEL,
  FORMAT_USE,
  renderExport,
  triggerDownload,
  type ExportFormat,
} from "@/lib/exporters";
import { buildGrid, formatBytes, formatValue, type ScaleDefinition } from "@/lib/scale-engine";
import { defToSvgBody, viewBoxOf } from "@/lib/svg-renderer";

function Fact({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2">
      <MicroLabel>{label}</MicroLabel>
      <span
        className={`text-right text-[12px] text-[var(--text)] ${
          mono ? "font-[family-name:var(--font-mono)] tabular-nums" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Exportdialog: echte Vorschau des Exports, echte Dateigröße, ehrliche Hinweise.
 * Für 3D-Formate wird dieselbe Geometrie schattiert isometrisch dargestellt,
 * die auch in der Datei steht — inklusive echter Gravurkanäle.
 */
export function ExportDialog({
  open,
  onOpenChange,
  definition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: ScaleDefinition;
}) {
  const [format, setFormat] = React.useState<ExportFormat>("dxf");
  const [iso, setIso] = React.useState({ yaw: -0.65, elevation: 0.95 });
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragRef = React.useRef<{ x: number; y: number } | null>(null);

  const is3d = format === "stl" || format === "obj";
  const result = React.useMemo(
    () => (open ? renderExport(definition, format) : null),
    [open, definition, format],
  );
  const grid = React.useMemo(
    () => (open && is3d ? buildGrid(definition) : null),
    [open, is3d, definition],
  );

  React.useEffect(() => {
    if (!grid || !canvasRef.current) return;
    renderIso(canvasRef.current, grid, iso, { background: "#0b0e12" });
  }, [grid, iso]);

  const p = definition.params;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ariaLabel="Export">
        <div className="flex h-[3.5rem] shrink-0 items-center justify-between border-b border-[var(--line-strong)] px-5">
          <div className="flex items-baseline gap-4">
            <DialogTitle>Export</DialogTitle>
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--text-faint)]">
              {p.name} · {formatValue(p.range.min, definition.decimals)} →{" "}
              {formatValue(p.range.max, definition.decimals)} · mm · 1:1
            </span>
          </div>
          <button
            type="button"
            aria-label="Exportdialog schließen (Esc)"
            onClick={() => onOpenChange(false)}
            className="rounded-[3px] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Vorschau */}
          <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-[var(--surface-0)] p-6">
            {is3d ? (
              <canvas
                ref={canvasRef}
                className="h-full w-full cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                  dragRef.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerMove={(e) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  const dx = e.clientX - drag.x;
                  const dy = e.clientY - drag.y;
                  dragRef.current = { x: e.clientX, y: e.clientY };
                  setIso((v) => ({
                    yaw: v.yaw + dx * 0.008,
                    elevation: Math.max(0.15, Math.min(1.5, v.elevation + dy * 0.006)),
                  }));
                }}
                onPointerUp={(e) => {
                  dragRef.current = null;
                  (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#e9e7e1] p-4 shadow-[inset_0_2px_18px_rgba(11,14,18,0.22)]">
                <svg
                  viewBox={viewBoxOf(definition, 2)}
                  preserveAspectRatio="xMidYMid meet"
                  className="h-full w-full"
                  role="img"
                  aria-label="Vorschau des Vektorexports"
                >
                  <g dangerouslySetInnerHTML={{ __html: defToSvgBody(definition) }} />
                </svg>
              </div>
            )}

            <span className="absolute left-6 top-5 rounded-[2px] border border-[var(--line-strong)] bg-[var(--surface-1)]/90 px-2 py-1">
              <MicroLabel>
                {is3d ? "3D-Geometrie · drehen mit Ziehen" : "Vektor · exakt wie in der Datei"}
              </MicroLabel>
            </span>
          </div>

          {/* Kennwerte */}
          <div className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-[var(--line-strong)] bg-[var(--surface-1)] lg:w-[21rem] lg:border-l lg:border-t-0">
            <div className="flex border-b border-[var(--line-strong)]">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 border-r border-[var(--line)] py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset ${
                    format === f
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  }`}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>

            <div className="px-5 py-3">
              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                {FORMAT_USE[format]}
              </p>
            </div>

            <div className="px-5">
              <Fact label="Datei" value={<span className="text-[11px]">{result?.filename}</span>} mono={false} />
              <Fact label="Einheit" value="mm" />
              <Fact label="Maßstab" value="1:1" />
              <Fact label="Dateigröße" value={formatBytes(result?.size ?? 0)} />
              <Fact label="Teilstriche" value={String(definition.counts.total)} />
              {definition.labels.length > 0 ? (
                <Fact label="Beschriftungen" value={String(definition.labels.length)} />
              ) : null}
              {is3d ? (
                <>
                  <Fact label="Dreiecke" value={String(result?.triangles ?? 0)} />
                  <Fact
                    label="Modus"
                    value={p.body.mode === "positive" ? "Positiv (erhaben)" : "Gravur (eingeschnitten)"}
                  />
                  <Fact label="Platte / Tiefe" value={`${p.body.thickness} / ${p.body.depth} mm`} />
                </>
              ) : null}
              <Fact
                label="Zeichnung"
                value={`${definition.extents.width.toFixed(1)} × ${definition.extents.height.toFixed(1)} mm`}
              />
            </div>

            <ul className="space-y-2 px-5 py-4">
              {result?.notes.map((note) => (
                <li key={note} className="flex gap-2 text-[11px] leading-relaxed text-[var(--text-faint)]">
                  <span className="mt-[6px] h-1 w-1 shrink-0 bg-[var(--accent)]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto border-t border-[var(--line-strong)] p-5">
              <DialogDescription className="mb-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Vorschau = Export. Die Datei enthält exakt diese Geometrie, in Millimetern,
                Maßstab 1:1.
              </DialogDescription>
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  if (result) triggerDownload(result);
                }}
              >
                <Download className="h-4 w-4" />
                {FORMAT_LABEL[format]} herunterladen
              </Button>
              {is3d ? (
                <button
                  type="button"
                  onClick={() => setIso({ yaw: -0.65, elevation: 0.95 })}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Ansicht zurücksetzen
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
