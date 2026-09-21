"use client";

import * as React from "react";
import { Check, FolderOpen, Save, Trash2 } from "lucide-react";
import { SCALE_TYPE_LABELS, type ScaleParams, type ScaleType } from "@/core/scale-engine";
import { coerceParams } from "@/core/scale-engine/validate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScaleTypeIcon } from "./type-icons";
import { useEditorStore } from "./store";

interface LibraryEntry {
  id: number;
  name: string;
  type: string;
  updatedAt: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LibraryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const present = useEditorStore((s) => s.present);
  const name = useEditorStore((s) => s.name);
  const savedId = useEditorStore((s) => s.savedId);
  const setName = useEditorStore((s) => s.setName);
  const markSaved = useEditorStore((s) => s.markSaved);
  const loadScale = useEditorStore((s) => s.loadScale);

  const [entries, setEntries] = React.useState<LibraryEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/scales", { cache: "no-store" });
      const data = (await res.json()) as { scales?: LibraryEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setEntries(data.scales ?? []);
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : "Bibliothek konnte nicht geladen werden.");
    }
  }, []);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  React.useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [feedback]);

  const existsOnServer = savedId !== null && entries?.some((e) => e.id === savedId);

  const save = async (asNew: boolean) => {
    if (!present) return;
    const trimmed = name.trim() || "Neue Skala";
    setBusy("save");
    setError(null);
    try {
      const update = !asNew && existsOnServer;
      const res = await fetch(update ? `/api/scales/${savedId}` : "/api/scales", {
        method: update ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, params: present }),
      });
      const data = (await res.json()) as { scale?: { id: number; updatedAt: string }; error?: string };
      if (!res.ok || !data.scale) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      markSaved(data.scale.id, data.scale.updatedAt);
      setFeedback(update ? "Aktualisiert" : "Gespeichert");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const openEntry = async (entry: LibraryEntry) => {
    setBusy(`open-${entry.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/scales/${entry.id}`, { cache: "no-store" });
      const data = (await res.json()) as { scale?: { id: number; name: string; params: ScaleParams; updatedAt: string }; error?: string };
      if (!res.ok || !data.scale) throw new Error(data.error ?? "Öffnen fehlgeschlagen.");
      const params = coerceParams(data.scale.params);
      if (!params) throw new Error("Die gespeicherten Parameter sind ungültig.");
      loadScale(params, data.scale.name, data.scale.id, data.scale.updatedAt);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Öffnen fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry: LibraryEntry) => {
    setBusy(`delete-${entry.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/scales/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Löschen fehlgeschlagen.");
      }
      setEntries((list) => (list ? list.filter((e) => e.id !== entry.id) : list));
      setFeedback(`„${entry.name}“ gelöscht`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Bibliothek</DialogTitle>
          <DialogDescription>Skalen auf dem Server speichern und später wieder öffnen. Gespeichert werden nur Parameter.</DialogDescription>
        </DialogHeader>

        {present ? (
          <div className="flex flex-col gap-2 border-b px-6 py-4">
            <Label htmlFor="scaleName">Aktuelle Skala speichern</Label>
            <div className="flex gap-2">
              <Input
                id="scaleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save(false);
                }}
                placeholder="Name der Skala"
                maxLength={120}
              />
              <Button onClick={() => void save(false)} disabled={busy === "save"} className="shrink-0">
                <Save />
                {existsOnServer ? "Aktualisieren" : "Speichern"}
              </Button>
              {existsOnServer ? (
                <Button variant="secondary" onClick={() => void save(true)} disabled={busy === "save"} className="shrink-0">
                  Als Kopie
                </Button>
              ) : null}
            </div>
            <div className="h-4 text-xs" aria-live="polite">
              {feedback ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <Check className="size-3.5 text-primary" /> {feedback}
                </span>
              ) : error ? (
                <span className="text-destructive">{error}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="max-h-[50vh] overflow-y-auto px-6 py-3">
          {entries === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Lade Bibliothek …</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine gespeicherten Skalen.{present ? " Speichere die aktuelle Skala oben." : ""}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <ScaleTypeIcon type={entry.type as ScaleType} width={18} height={18} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {entry.name}
                      {entry.id === savedId ? <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">geöffnet</span> : null}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {SCALE_TYPE_LABELS[entry.type as ScaleType] ?? entry.type} · {formatDate(entry.updatedAt)}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void openEntry(entry)} disabled={busy !== null}>
                    <FolderOpen /> Öffnen
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => void remove(entry)} disabled={busy !== null} aria-label={`„${entry.name}“ löschen`}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!present && error ? <p className="pb-3 text-center text-xs text-destructive">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
