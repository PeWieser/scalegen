"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultParams, withScaleType, type ScaleParams, type ScaleType } from "@/core/scale-engine";
import { coerceParams } from "@/core/scale-engine/validate";

/** Consecutive edits of the same field within this window collapse into one undo step. */
const COALESCE_MS = 1200;
const HISTORY_LIMIT = 200;

type ObjectSection = Exclude<keyof ScaleParams, "type">;

export interface EditorState {
  /** The only source of truth for geometry. null = no scale yet (empty state). */
  present: ScaleParams | null;
  past: ScaleParams[];
  future: ScaleParams[];
  name: string;
  /** id in the server library, if this scale was saved/loaded. */
  savedId: number | null;
  savedAt: string | null;
  /** True once localStorage has been read on the client. */
  hydrated: boolean;
  selectedTickId: string | null;
  lastEditKey: string | null;
  lastEditAt: number;

  newScale: (type?: ScaleType) => void;
  loadScale: (params: ScaleParams, name: string, savedId: number | null, savedAt: string | null) => void;
  patch: <K extends ObjectSection>(section: K, values: Partial<ScaleParams[K]>) => void;
  setType: (type: ScaleType) => void;
  replaceParams: (params: ScaleParams, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (tickId: string | null) => void;
  toggleTickHidden: (valueKey: string) => void;
  toggleLabelHidden: (valueKey: string) => void;
  showAllHidden: () => void;
  setName: (name: string) => void;
  markSaved: (id: number, at: string) => void;
  setHydrated: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => {
      const commit = (next: ScaleParams, coalesceKey: string | null) => {
        const s = get();
        const now = Date.now();
        const coalesce = coalesceKey !== null && s.lastEditKey === coalesceKey && now - s.lastEditAt < COALESCE_MS && s.present;
        if (coalesce) {
          set({ present: next, lastEditAt: now });
          return;
        }
        const past = s.present ? [...s.past.slice(-(HISTORY_LIMIT - 1)), s.present] : s.past;
        set({ present: next, past, future: [], lastEditKey: coalesceKey, lastEditAt: now });
      };

      return {
        present: null,
        past: [],
        future: [],
        name: "Neue Skala",
        savedId: null,
        savedAt: null,
        hydrated: false,
        selectedTickId: null,
        lastEditKey: null,
        lastEditAt: 0,

        newScale: (type = "semicircle") => {
          const next = createDefaultParams(type);
          commit(next, null);
          set({ name: "Neue Skala", savedId: null, savedAt: null, selectedTickId: null });
        },

        loadScale: (params, name, savedId, savedAt) => {
          commit(params, null);
          set({ name, savedId, savedAt, selectedTickId: null });
        },

        patch: (section, values) => {
          const present = get().present;
          if (!present) return;
          const next: ScaleParams = { ...present, [section]: { ...present[section], ...values } };
          commit(next, `${section}.${Object.keys(values).sort().join(",")}`);
        },

        setType: (type) => {
          const present = get().present;
          if (!present || present.type === type) return;
          commit(withScaleType(present, type), null);
          set({ selectedTickId: null });
        },

        replaceParams: (params, coalesceKey) => commit(params, coalesceKey ?? null),

        undo: () => {
          const s = get();
          if (s.past.length === 0 || !s.present) return;
          const previous = s.past[s.past.length - 1];
          set({
            present: previous,
            past: s.past.slice(0, -1),
            future: [s.present, ...s.future].slice(0, HISTORY_LIMIT),
            lastEditKey: null,
            selectedTickId: null,
          });
        },

        redo: () => {
          const s = get();
          if (s.future.length === 0 || !s.present) return;
          const [next, ...rest] = s.future;
          set({ present: next, past: [...s.past, s.present], future: rest, lastEditKey: null, selectedTickId: null });
        },

        select: (tickId) => set({ selectedTickId: tickId }),

        toggleTickHidden: (key) => {
          const present = get().present;
          if (!present) return;
          const set_ = new Set(present.overrides.hiddenTicks);
          if (set_.has(key)) set_.delete(key);
          else set_.add(key);
          commit({ ...present, overrides: { ...present.overrides, hiddenTicks: [...set_] } }, null);
        },

        toggleLabelHidden: (key) => {
          const present = get().present;
          if (!present) return;
          const set_ = new Set(present.overrides.hiddenLabels);
          if (set_.has(key)) set_.delete(key);
          else set_.add(key);
          commit({ ...present, overrides: { ...present.overrides, hiddenLabels: [...set_] } }, null);
        },

        showAllHidden: () => {
          const present = get().present;
          if (!present) return;
          commit({ ...present, overrides: { hiddenTicks: [], hiddenLabels: [] } }, null);
        },

        setName: (name) => set({ name }),
        markSaved: (id, at) => set({ savedId: id, savedAt: at }),
        setHydrated: () => set({ hydrated: true }),
      };
    },
    {
      name: "scale-generator:editor",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ present: s.present, name: s.name, savedId: s.savedId, savedAt: s.savedAt }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<EditorState, "present" | "name" | "savedId" | "savedAt">>;
        return {
          ...current,
          present: p.present ? coerceParams(p.present) : null,
          name: typeof p.name === "string" && p.name ? p.name : current.name,
          savedId: typeof p.savedId === "number" ? p.savedId : null,
          savedAt: typeof p.savedAt === "string" ? p.savedAt : null,
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const selectCanUndo = (s: EditorState) => s.past.length > 0;
export const selectCanRedo = (s: EditorState) => s.future.length > 0;
