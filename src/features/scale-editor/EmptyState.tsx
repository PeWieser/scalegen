"use client";

import * as React from "react";
import { motion } from "motion/react";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "./store";

export function EmptyState({ onLibrary }: { onLibrary: () => void }) {
  const newScale = useEditorStore((s) => s.newScale);
  const [hasSaved, setHasSaved] = React.useState(false);

  // Only offer "open" when there actually is something to open – no dead buttons.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/scales", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { scales: [] }))
      .then((d: { scales?: unknown[] }) => {
        if (!cancelled) setHasSaved((d.scales?.length ?? 0) > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full items-center justify-center bg-stage p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex max-w-md flex-col items-center text-center"
      >
        <svg width="160" height="96" viewBox="0 0 160 96" fill="none" stroke="currentColor" className="mb-6 text-muted-foreground" aria-hidden>
          <path d="M16 88 A64 64 0 0 1 144 88" strokeWidth="1.5" />
          {Array.from({ length: 9 }).map((_, i) => {
            const a = Math.PI + (i / 8) * Math.PI;
            const x1 = 80 + 64 * Math.cos(a);
            const y1 = 88 + 64 * Math.sin(a);
            const x2 = 80 + 54 * Math.cos(a);
            const y2 = 88 + 54 * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.5" className={i === 6 ? "text-primary" : ""} />;
          })}
          {Array.from({ length: 32 }).map((_, i) => {
            if (i % 4 === 0) return null;
            const a = Math.PI + (i / 32) * Math.PI;
            const x1 = 80 + 64 * Math.cos(a);
            const y1 = 88 + 64 * Math.sin(a);
            const x2 = 80 + 59 * Math.cos(a);
            const y2 = 88 + 59 * Math.sin(a);
            return <line key={`m${i}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" opacity="0.6" />;
          })}
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight">Erstelle deine erste technische Skala</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Typ wählen, Wertebereich eingeben, Teilung festlegen – und als SVG, DXF, STL oder OBJ exportieren. Maßstab 1:1, in Millimetern.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" onClick={() => newScale()} autoFocus>
            <Plus /> Neue Skala
          </Button>
          {hasSaved ? (
            <Button size="lg" variant="secondary" onClick={onLibrary}>
              <FolderOpen /> Gespeicherte öffnen
            </Button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
