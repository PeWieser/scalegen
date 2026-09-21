"use client";

/**
 * Ablage — rein clientseitig im localStorage. Kein Server, keine Datenbank.
 *
 * Gespeichert werden ausschließlich die Parameter (ScaleParams), nie Geometrie.
 * Zusätzlich lässt sich die Ablage als JSON-Datei sichern und wieder einlesen,
 * damit nichts verlorengeht, wenn der Browser den Speicher freigibt.
 */

import type { ScaleParams, ScaleType } from "@/lib/scale-engine";

export interface SavedScale {
  /** = params.id — beim Sichern aktualisiert statt dupliziert. */
  id: string;
  name: string;
  type: ScaleType;
  params: ScaleParams;
  updatedAt: string;
}

const KEY = "scale-generator.ablage.v1";
const VERSION = 1;

interface Store {
  version: number;
  items: SavedScale[];
}

const EMPTY: Store = { version: VERSION, items: [] };

function isSaved(value: unknown): value is SavedScale {
  const item = value as SavedScale | null;
  return Boolean(
    item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      item.params &&
      typeof item.params.type === "string" &&
      item.params.range &&
      item.params.geometry &&
      item.params.ticks &&
      item.params.labels &&
      item.params.body,
  );
}

function readStore(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isSaved) : [];
    return { version: VERSION, items };
  } catch {
    return EMPTY;
  }
}

/** false, wenn der Browser den Speicher nicht freigibt (privater Modus, Quota). */
function writeStore(store: Store): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = `${KEY}.probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadSaved(): SavedScale[] {
  return readStore()
    .items.slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function saveScale(params: ScaleParams): SavedScale | null {
  const store = readStore();
  const row: SavedScale = {
    id: params.id,
    name: params.name.trim() || "Skala",
    type: params.type,
    params,
    updatedAt: new Date().toISOString(),
  };
  const items = [row, ...store.items.filter((item) => item.id !== row.id)];
  return writeStore({ version: VERSION, items }) ? row : null;
}

export function deleteScale(id: string): SavedScale[] {
  const store = readStore();
  const items = store.items.filter((item) => item.id !== id);
  writeStore({ version: VERSION, items });
  return items;
}

function downloadJson(filename: string, data: unknown): void {
  const bytes = new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ganze Ablage als JSON-Datei sichern. */
export function exportAblage(items: SavedScale[]): void {
  downloadJson("scale-generator-ablage.json", { version: VERSION, items });
}

/** Ablage aus einer JSON-Datei einlesen (vorhandene Einträge gleicher id werden ersetzt). */
export async function importAblage(file: File): Promise<SavedScale[]> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<Store> | SavedScale[];
  const incoming = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  const valid = incoming.filter(isSaved);

  const store = readStore();
  const known = new Map(store.items.map((item) => [item.id, item]));
  for (const item of valid) known.set(item.id, item);
  writeStore({ version: VERSION, items: [...known.values()] });
  return loadSaved();
}
