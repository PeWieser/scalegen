"use client";

import * as React from "react";
import { Download, FilePlus2, Library, Redo2, Undo2 } from "lucide-react";
import { SCALE_TYPE_LABELS, type ScaleDefinition } from "@/core/scale-engine";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScaleTypeIcon } from "./type-icons";
import { selectCanRedo, selectCanUndo, useEditorStore } from "./store";

export function Header({
  def,
  onExport,
  onLibrary,
}: {
  def: ScaleDefinition | null;
  onExport: () => void;
  onLibrary: () => void;
}) {
  const name = useEditorStore((s) => s.name);
  const setName = useEditorStore((s) => s.setName);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const newScale = useEditorStore((s) => s.newScale);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <ScaleTypeIcon type="arc" width={18} height={18} />
        </div>
        <span className="text-sm font-semibold tracking-tight">Scale Generator</span>
      </div>

      {def ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
              <ScaleTypeIcon type={def.params.type} />
              {SCALE_TYPE_LABELS[def.params.type]}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
              aria-label="Name der Skala"
              maxLength={120}
              className="h-8 min-w-0 max-w-xs flex-1 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus-visible:border-ring"
            />
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={canUndo ? -1 : 0} className="inline-flex rounded-md">
                  <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="Rückgängig">
                    <Undo2 />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canUndo ? "Rückgängig" : "Nichts rückgängig zu machen"} <Kbd className="ml-1">Strg</Kbd> <Kbd>Z</Kbd>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={canRedo ? -1 : 0} className="inline-flex rounded-md">
                  <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="Wiederholen">
                    <Redo2 />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canRedo ? "Wiederholen" : "Nichts zu wiederholen"} <Kbd className="ml-1">Strg</Kbd> <Kbd>⇧</Kbd> <Kbd>Z</Kbd>
              </TooltipContent>
            </Tooltip>

            <div className="mx-1 h-5 w-px bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => newScale()} aria-label="Neue Skala">
                  <FilePlus2 /> <span className="hidden md:inline">Neu</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Neue Skala mit Standardwerten – die aktuelle bleibt per Rückgängig erreichbar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onLibrary} aria-label="Bibliothek">
                  <Library /> <span className="hidden md:inline">Bibliothek</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Speichern und Öffnen <Kbd className="ml-1">Strg</Kbd> <Kbd>S</Kbd></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={onExport} className="ml-1">
                  <Download /> Exportieren
                </Button>
              </TooltipTrigger>
              <TooltipContent>SVG · DXF · STL · OBJ <Kbd className="ml-1">Strg</Kbd> <Kbd>E</Kbd></TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-end">
          <span className="text-xs text-muted-foreground">Technische Skalen für CNC, Frontplatten und Instrumente</span>
        </div>
      )}
    </header>
  );
}
