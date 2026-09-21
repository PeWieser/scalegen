"use client";

import { Download, Upload } from "lucide-react";
import * as React from "react";
import { exportAblage, importAblage, type SavedScale } from "@/lib/storage";

/**
 * Datensicherung der Ablage. Rein clientseitig: eine JSON-Datei, kein Konto,
 * kein Dienst. Genau ein Ort im UI — dort, wo die Ablage steht.
 */
export function AblageActions({
  saved,
  onImported,
}: {
  saved: SavedScale[];
  onImported: (items: SavedScale[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Ablage aus JSON-Datei einlesen"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const items = await importAblage(file);
            onImported(items);
            setMessage(`${items.length} Skalen in der Ablage.`);
          } catch {
            setMessage("Datei nicht lesbar — erwartet wird eine Ablage als JSON.");
          }
        }}
      />
      <button
        type="button"
        onClick={() => exportAblage(saved)}
        disabled={saved.length === 0}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border border-[var(--line)] px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
      >
        <Download className="h-3 w-3" />
        Sichern
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border border-[var(--line)] px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
      >
        <Upload className="h-3 w-3" />
        Einlesen
      </button>
      {message ? (
        <span role="status" className="basis-full text-[10px] text-[var(--warn)]">
          {message}
        </span>
      ) : null}
    </div>
  );
}
