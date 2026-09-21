"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { MicroLabel } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/overlay";
import { formatValue, type ScaleDefinition, TYPE_NAMES } from "@/lib/scale-engine";

function Cell({
  label,
  value,
  wide,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-center gap-0.5 border-r border-[var(--line)] px-3.5 py-2 ${
        wide ? "min-w-0 flex-1" : "w-[8.5rem] shrink-0"
      }`}
    >
      <MicroLabel>{label}</MicroLabel>
      <span
        className={`truncate font-[family-name:var(--font-mono)] text-[12px] tabular-nums ${
          accent ? "text-[var(--accent)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Schriftfeld nach DIN — die Kennwerte stehen im Kästchen, nicht als lose Statistik.
 */
export function TitleBlock({ definition }: { definition: ScaleDefinition }) {
  const p = definition.params;
  const span = p.range.max - p.range.min;
  const nMajor = definition.counts.major;
  const warnings = definition.warnings;

  return (
    <div className="flex h-[58px] shrink-0 items-stretch overflow-x-auto border-t border-[var(--line-strong)] bg-[var(--surface-1)]">
      <Cell label="Typ" value={TYPE_NAMES[p.type]} />
      <Cell
        label="Wertebereich"
        value={`${formatValue(p.range.min, definition.decimals)} → ${formatValue(
          p.range.max,
          definition.decimals,
        )}`}
      />
      <Cell
        label="Hauptteilung"
        value={`${formatValue(p.ticks.majorStep, definition.decimals)} · ${nMajor} Stück`}
      />
      <Cell
        label="Unterteilung"
        value={
          p.ticks.minorMode === "count"
            ? `${p.ticks.minorCount} je Hauptteilung`
            : `Schritt ${formatValue(p.ticks.minorStep, definition.decimals)}`
        }
      />
      <Cell label="Marken" value={`${definition.counts.total} ( ${definition.counts.minor} )`} accent />
      <Cell
        label="Ausdehnung"
        value={`${definition.extents.width.toFixed(1)} × ${definition.extents.height.toFixed(1)} mm`}
      />
      <Cell
        label="Modus"
        value={p.body.mode === "positive" ? "Positiv" : `Gravur ${p.body.depth} mm`}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3.5">
        {warnings.length > 0 ? (
          <Tooltip label={warnings.join(" · ")} side="top">
            <span className="flex min-w-0 items-center gap-2 text-[var(--warn)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[11px]">{warnings[0]}</span>
            </span>
          </Tooltip>
        ) : (
          <span className="flex items-center gap-2 text-[var(--text-faint)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="text-[11px]">Geometrie konsistent · Spanne {span.toFixed(2)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
