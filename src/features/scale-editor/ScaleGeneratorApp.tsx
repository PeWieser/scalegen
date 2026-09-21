"use client";

import * as React from "react";
import { computeScale, valueKey } from "@/core/scale-engine";
import { EmptyState } from "./EmptyState";
import { ExportDialog } from "./ExportDialog";
import { Header } from "./Header";
import { LibraryDialog } from "./LibraryDialog";
import { ParameterPanel } from "./ParameterPanel";
import { Preview, type PreviewHandle } from "./Preview";
import { useEditorStore } from "./store";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function ScaleGeneratorApp() {
  const hydrated = useEditorStore((s) => s.hydrated);
  const present = useEditorStore((s) => s.present);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const select = useEditorStore((s) => s.select);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const previewRef = React.useRef<PreviewHandle>(null);

  // Geometry is never stored – it is derived from the parameters, memoised per parameter object.
  const def = React.useMemo(() => (present ? computeScale(present) : null), [present]);

  React.useEffect(() => {
    void useEditorStore.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const typing = isTypingTarget(e.target);
      const state = useEditorStore.getState();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "e" && state.present) {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        setLibraryOpen(true);
        return;
      }
      if (typing || mod || !state.present) return;

      if (key === "f") previewRef.current?.fit();
      else if (e.key === "+" || e.key === "=") previewRef.current?.zoomIn();
      else if (e.key === "-") previewRef.current?.zoomOut();
      else if (e.key === "0") previewRef.current?.resetZoom();
      else if (e.key === "Escape") select(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedTickId) {
        e.preventDefault();
        const value = Number(state.selectedTickId.slice("tick:".length));
        state.toggleTickHidden(valueKey(value));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, select]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header def={def} onExport={() => setExportOpen(true)} onLibrary={() => setLibraryOpen(true)} />
      <main className="flex min-h-0 flex-1">
        {!hydrated ? (
          <div className="flex-1 bg-stage" />
        ) : def ? (
          <>
            <aside className="w-[360px] shrink-0 border-r border-border/70 bg-background" aria-label="Parameter">
              <ParameterPanel def={def} />
            </aside>
            <section className="min-w-0 flex-1" aria-label="Vorschau">
              <Preview ref={previewRef} def={def} />
            </section>
          </>
        ) : (
          <div className="flex-1">
            <EmptyState onLibrary={() => setLibraryOpen(true)} />
          </div>
        )}
      </main>
      {def ? <ExportDialog def={def} open={exportOpen} onOpenChange={setExportOpen} /> : null}
      <LibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </div>
  );
}
