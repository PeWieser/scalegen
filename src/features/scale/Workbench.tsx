"use client";

import { Download, Redo2, Undo2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { MicroLabel } from "@/components/ui/field";
import { Tooltip, TooltipProvider } from "@/components/ui/overlay";
import {
  deleteScale,
  loadSaved,
  saveScale,
  storageAvailable,
  type SavedScale,
} from "@/lib/storage";
import { ExportDialog } from "@/features/export/ExportDialog";
import { ParameterPanel } from "@/features/parameters/ParameterPanel";
import { EmptyState } from "@/features/scale/EmptyState";
import { Mark } from "@/features/scale/TypeGlyphs";
import { TitleBlock } from "@/features/scale/TitleBlock";
import { Stage } from "@/features/stage/Stage";
import { useDefinition } from "@/features/stage/use-definition";
import { useEditor } from "@/store/editor";

/**
 * Werkbank: Kopf (Undo/Redo, Export) · Parameter · Bühne · Schriftfeld.
 * Alles clientseitig — die Ablage liegt im localStorage des Browsers.
 */
export function Workbench() {
  const [saved, setSaved] = React.useState<SavedScale[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);

  const present = useEditor((s) => s.present);
  const definition = useDefinition();
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const load = useEditor((s) => s.load);
  const select = useEditor((s) => s.select);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  // Ablage erst nach dem Mount laden — dadurch kein Unterschied beim Hydratisieren.
  React.useEffect(() => {
    setSaved(loadSaved());
    if (!storageAvailable()) {
      setNotice(
        "Dieser Browser speichert nicht dauerhaft (privater Modus?). Die Ablage gilt nur für diese Sitzung.",
      );
    }
  }, []);

  // Zustandsbasiertes Undo/Redo über Tastatur.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        select(null);
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const onSave = () => {
    if (!present) return;
    const row = saveScale(present);
    if (row) {
      setSaved(loadSaved());
      setNotice(null);
    } else {
      setNotice("Ablage gesperrt oder voll — die Skala konnte nicht gesichert werden.");
    }
  };

  const onDelete = (id: string) => {
    deleteScale(id);
    setSaved(loadSaved());
    setNotice(null);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--line-strong)] bg-[var(--surface-1)] px-5">
          <div className="flex items-center gap-3">
            <Mark className="h-6 w-6 text-[var(--accent)]" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--text)]">
              Scale Generator
            </span>
            <span className="hidden h-4 w-px bg-[var(--line-strong)] sm:block" />
            <MicroLabel className="hidden sm:block">
              technische Skalen · mm · 1:1 · alles lokal
            </MicroLabel>
          </div>

          {present && definition ? (
            <div className="flex items-center gap-2">
              <Tooltip label="Rückgängig (⌘Z)">
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rückgängig"
                    onClick={undo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip label="Wiederholen (Umschalt+⌘Z)">
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Wiederholen"
                    onClick={redo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </span>
              </Tooltip>
              <span className="mx-1 h-5 w-px bg-[var(--line-strong)]" />
              <Button variant="primary" size="md" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" />
                Exportieren
              </Button>
            </div>
          ) : null}
        </header>

        {present && definition ? (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="relative w-full shrink-0 overflow-hidden border-b border-[var(--line-strong)] bg-[var(--surface-0)] lg:w-[22.5rem] lg:border-b-0 lg:border-r">
              <img
                src="images/panel-texture.jpg"
                alt=""
                aria-hidden="true"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.09] mix-blend-overlay"
              />
              <ParameterPanel
                definition={definition}
                saved={saved}
                notice={notice}
                onLoadSaved={(row) => load(row.params)}
                onDeleteSaved={onDelete}
                onSave={onSave}
                onImported={setSaved}
              />
            </aside>
            <main className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-h-0">
              <Stage definition={definition} />
              <TitleBlock definition={definition} />
            </main>
          </div>
        ) : (
          <EmptyState
            saved={saved}
            notice={notice}
            onLoadSaved={(row) => load(row.params)}
            onDeleteSaved={onDelete}
            onImported={setSaved}
          />
        )}

        {definition ? (
          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} definition={definition} />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
