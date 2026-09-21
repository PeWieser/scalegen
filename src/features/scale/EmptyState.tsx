"use client";

import { motion } from "motion/react";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MicroLabel } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/overlay";
import { formatValue, TYPE_NAMES } from "@/lib/scale-engine";
import type { SavedScale } from "@/lib/storage";
import { useEditor } from "@/store/editor";
import { AblageActions } from "@/features/scale/AblageActions";
import { Mark, ScaleGlyph } from "@/features/scale/TypeGlyphs";

/**
 * Leerzustand: große Einladung statt leerer Toolbar.
 * Keine deaktivierten Funktionen — es gibt schlicht noch nichts zu tun.
 */
export function EmptyState({
  saved,
  notice,
  onLoadSaved,
  onDeleteSaved,
  onImported,
}: {
  saved: SavedScale[];
  notice?: string | null;
  onLoadSaved: (row: SavedScale) => void;
  onDeleteSaved: (id: string) => void;
  onImported: (items: SavedScale[]) => void;
}) {
  const create = useEditor((s) => s.create);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-1 overflow-hidden">
      <img
        src="images/engraved-dial.jpg"
        alt=""
        aria-hidden="true"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
      />
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(11,14,18,0.97)_0%,rgba(11,14,18,0.86)_42%,rgba(11,14,18,0.35)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(47,107,255,0.14)_0%,transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 flex w-full max-w-[720px] flex-col justify-center px-8 py-16 sm:px-14"
      >
        <div className="flex items-center gap-3 text-[var(--accent)]">
          <Mark className="h-9 w-9" />
          <MicroLabel className="text-[var(--accent)]">Scale Generator · Werkstattausgabe</MicroLabel>
        </div>

        <h1 className="mt-8 max-w-[15ch] text-[clamp(2.4rem,5.4vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-[var(--text)]">
          Erstelle deine erste technische Skala
        </h1>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--text-muted)]">
          Halbkreis wählen, 0 bis 80 eingeben, Teilungen festlegen, DXF exportieren. Die
          Geometrie ist immer exakt das, was exportiert wird — in SVG, DXF, STL und OBJ.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Button variant="primary" size="md" onClick={() => create("half-circle")}>
            Neue Skala
            <ArrowRight className="h-4 w-4" />
          </Button>
          <MicroLabel>Danach: Typ · Werte · Teilung · Export</MicroLabel>
        </div>

        {saved.length > 0 ? (
          <section className="mt-14 border-t border-[var(--line-strong)] pt-5">
            <MicroLabel>Ablage · {saved.length} gesicherte Skalen · nur in diesem Browser</MicroLabel>
            {notice ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--warn)]">{notice}</p>
            ) : null}
            <ul className="mt-3 max-w-[38rem]">
              {saved.map((row) => (
                <li
                  key={row.id}
                  className="group flex items-center gap-3 border-b border-[var(--line)] py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => onLoadSaved(row)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <ScaleGlyph
                      type={row.type}
                      className="h-6 w-6 shrink-0 text-[var(--text-faint)] transition-colors group-hover:text-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-[var(--text)]">
                        {row.name}
                      </span>
                      <span className="block truncate font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--text-faint)]">
                        {TYPE_NAMES[row.type]} · {formatValue(row.params.range.min, 0)} →{" "}
                        {formatValue(row.params.range.max, 0)} · Hauptteilung{" "}
                        {formatValue(row.params.ticks.majorStep, 0)}
                      </span>
                    </span>
                  </button>
                  <Tooltip label="Aus der Ablage löschen">
                    <button
                      type="button"
                      aria-label={`${row.name} löschen`}
                      onClick={() => onDeleteSaved(row.id)}
                      className="rounded-[3px] p-1.5 text-[var(--text-faint)] opacity-0 transition-all hover:bg-white/[0.06] hover:text-[var(--warn)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
            <div className="mt-4 max-w-[22rem]">
              <AblageActions saved={saved} onImported={onImported} />
            </div>
          </section>
        ) : null}
      </motion.div>
    </div>
  );
}
