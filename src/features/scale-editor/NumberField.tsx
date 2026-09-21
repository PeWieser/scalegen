"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  className?: string;
  hint?: string;
}

function formatForInput(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(decimals));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function parse(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === "." || normalized === "-.") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Numeric input with unit suffix. Commits live while typing (valid numbers only),
 * supports ↑/↓ stepping (Shift ×10, Alt ÷10), Escape reverts & leaves the field.
 */
export function NumberField({ id, label, value, onChange, unit, step = 1, min, max, decimals = 3, className, hint }: NumberFieldProps) {
  const [text, setText] = React.useState(() => formatForInput(value, decimals));
  const [focused, setFocused] = React.useState(false);
  const focusValue = React.useRef(value);
  const lastCommitted = React.useRef(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync from outside (undo/redo, other controls) – but never fight the user's in-progress typing.
  React.useEffect(() => {
    if (!focused || value !== lastCommitted.current) {
      setText(formatForInput(value, decimals));
      lastCommitted.current = value;
    }
  }, [value, focused, decimals]);

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const commit = (n: number) => {
    const v = clamp(Number(n.toFixed(6)));
    lastCommitted.current = v;
    if (v !== value) onChange(v);
    return v;
  };

  const invalid = focused && parse(text) === null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id} className="flex items-center justify-between">
        <span>{label}</span>
        {hint ? <span className="font-normal text-muted-foreground/70">{hint}</span> : null}
      </Label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text}
          aria-invalid={invalid || undefined}
          onFocus={(e) => {
            setFocused(true);
            focusValue.current = value;
            e.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            const n = parse(text);
            if (n !== null) {
              const v = commit(n);
              setText(formatForInput(v, decimals));
            } else {
              setText(formatForInput(value, decimals));
            }
          }}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const n = parse(next);
            if (n !== null) commit(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
              const delta = (e.key === "ArrowUp" ? 1 : -1) * step * factor;
              const base = parse(text) ?? value;
              const v = commit(base + delta);
              setText(formatForInput(v, decimals));
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              commit(focusValue.current);
              setText(formatForInput(focusValue.current, decimals));
              inputRef.current?.blur();
            } else if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
          className={cn(
            "font-mono h-8 w-full rounded-md border border-input bg-background px-2.5 pr-9 text-sm tabular-nums transition-colors placeholder:text-muted-foreground focus-visible:border-ring",
            invalid && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
