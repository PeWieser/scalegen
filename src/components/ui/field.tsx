"use client";

/**
 * Felder in der Handschrift eines Messgerätefrontpanels:
 * gesperrte Versalien links, tabellarische Mono-Werte rechts, Haarlinie darunter.
 * Das Label ist ein Ziehgreifer (direkte Manipulation) — Ziehen ändert den Wert.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export function MicroLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Row({
  label,
  children,
  hint,
  scrub,
  onScrubEnd,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  scrub?: (delta: number, multiplier: number) => void;
  onScrubEnd?: () => void;
}) {
  const drag = React.useRef<{ x: number; moved: boolean } | null>(null);
  return (
    <div className="group/row border-b border-[var(--line)] px-4 py-2 transition-colors hover:bg-[var(--surface-1)]">
      <div className="flex items-center justify-between gap-3">
        <span
          onPointerDown={(e) => {
            if (!scrub) return;
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, moved: false };
          }}
          onPointerMove={(e) => {
            if (!scrub || !drag.current) return;
            const dx = e.clientX - drag.current.x;
            if (Math.abs(dx) < 3 && !drag.current.moved) return;
            drag.current.moved = true;
            drag.current.x = e.clientX;
            scrub(dx * 0.25, e.shiftKey ? 5 : e.altKey ? 0.2 : 1);
          }}
          onPointerUp={(e) => {
            if (!scrub || !drag.current) return;
            (e.target as Element).releasePointerCapture(e.pointerId);
            drag.current = null;
            onScrubEnd?.();
          }}
          className={cn(
            "truncate",
            scrub && "cursor-ew-resize select-none touch-none active:text-[var(--accent)]",
          )}
          title={scrub ? "Ziehen ändert den Wert" : undefined}
        >
          <MicroLabel>{label}</MicroLabel>
        </span>
        <div className="flex items-center gap-1.5">{children}</div>
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function ValueInput({
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 1e6) / 1e6).replace(".", ",");

  const commit = (raw: string) => {
    const parsed = parseNumber(raw);
    if (parsed === null) {
      setDraft(null);
      return;
    }
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
    setDraft(null);
  };

  return (
    <span className="flex items-baseline gap-1">
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={shown}
        step={step}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseNumber(e.target.value);
          if (parsed !== null) {
            let next = parsed;
            if (min !== undefined) next = Math.max(min, next);
            if (max !== undefined) next = Math.min(max, next);
            onChange(next);
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            let next = Math.round((value + dir * step * factor) * 1e6) / 1e6;
            if (min !== undefined) next = Math.max(min, next);
            if (max !== undefined) next = Math.min(max, next);
            onChange(next);
          }
        }}
        className="w-[5.5rem] rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 text-right font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-[var(--text)] outline-none transition-colors hover:border-[var(--line)] focus:border-[var(--accent)] focus:bg-[var(--surface-2)]"
      />
      {unit ? (
        <span className="w-6 shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-faint)]">
          {unit}
        </span>
      ) : null}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex overflow-hidden rounded-[3px] border border-[var(--line)]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-2.5 py-1 text-[11px] tracking-[0.06em] uppercase transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              active
                ? "bg-[var(--accent)] text-white"
                : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <Row label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[18px] w-8 rounded-full border transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]",
          checked
            ? "border-[var(--accent)] bg-[var(--accent)]"
            : "border-[var(--line-strong)] bg-[var(--surface-2)]",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-3 w-3 rounded-full bg-white transition-transform duration-150",
            checked ? "translate-x-[16px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </Row>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line-strong)] bg-[var(--surface-1)] px-4 py-2">
      <MicroLabel className="text-[var(--text)]">{children}</MicroLabel>
      {note ? (
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-faint)]">
          {note}
        </span>
      ) : null}
    </div>
  );
}
