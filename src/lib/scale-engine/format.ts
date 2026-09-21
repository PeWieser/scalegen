/** Zahlformatierung: eine Quelle für Vorschau, Beschriftung und Export. */

export function round9(v: number): number {
  return Math.round(v * 1e9) / 1e9;
}

/** Nachkommastellen, die die Angabe verlangt (aus Steps/Randwerten abgeleitet). */
export function decimalsOf(...values: number[]): number {
  let d = 0;
  for (const raw of values) {
    const v = Math.abs(raw);
    if (!Number.isFinite(v)) continue;
    const s = v.toFixed(6).replace(/0+$/, "");
    const i = s.indexOf(".");
    if (i >= 0) d = Math.max(d, Math.min(4, s.length - i - 1));
  }
  return d;
}

/** Deutsche Schreibweise mit fester Stellenzahl — tabellarisch ausgerichtet. */
export function formatValue(value: number, decimals: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPlain(value: number, decimals: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toFixed(decimals);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMeasure(value: number, unit: string): string {
  const d = decimalsOf(value);
  return `${formatValue(value, d)} ${unit}`;
}
