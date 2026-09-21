"use client";

/**
 * editor — zustandsbasiertes Undo/Redo.
 * Gespeichert wird ausschließlich der Zustand (Parameter), nie eine Aktion.
 * Geometrie wird nie im State gehalten — sie wird aus Parametern berechnet.
 */

import { create } from "zustand";
import {
  createParams,
  withType,
  type ScaleParams,
  type ScaleType,
} from "@/lib/scale-engine";

export type ScalePatch = {
  [K in keyof ScaleParams]?: ScaleParams[K] extends object
    ? Partial<ScaleParams[K]>
    : ScaleParams[K];
} & { id?: string; name?: string; type?: ScaleType };

interface EditorState {
  present: ScaleParams | null;
  past: ScaleParams[];
  future: ScaleParams[];
  selectedValue: number | null;
  dragHistory: boolean;
  create: (type?: ScaleType) => void;
  load: (params: ScaleParams) => void;
  setType: (type: ScaleType) => void;
  update: (patch: ScalePatch, transient?: boolean) => void;
  endEdit: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  select: (value: number | null) => void;
}

const LIMIT = 120;

function merge(base: ScaleParams, patch: ScalePatch): ScaleParams {
  return {
    ...base,
    ...patch,
    geometry: { ...base.geometry, ...(patch.geometry ?? {}) },
    range: { ...base.range, ...(patch.range ?? {}) },
    ticks: { ...base.ticks, ...(patch.ticks ?? {}) },
    labels: { ...base.labels, ...(patch.labels ?? {}) },
    body: { ...base.body, ...(patch.body ?? {}) },
  } as ScaleParams;
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `sk_${Date.now().toString(36)}_${counter}`;
}

export const useEditor = create<EditorState>((set, get) => ({
  present: null,
  past: [],
  future: [],
  selectedValue: null,
  dragHistory: false,

  create: (type = "half-circle") => {
    const next = createParams(type, newId());
    const state = get();
    set({
      present: next,
      past: state.present ? [...state.past, state.present].slice(-LIMIT) : state.past,
      future: [],
      selectedValue: null,
      dragHistory: false,
    });
  },

  load: (params) => {
    const state = get();
    set({
      present: params,
      past: state.present ? [...state.past, state.present].slice(-LIMIT) : state.past,
      future: [],
      selectedValue: null,
      dragHistory: false,
    });
  },

  setType: (type) => {
    const state = get();
    if (!state.present) return;
    set({
      present: withType(state.present, type),
      past: [...state.past, state.present].slice(-LIMIT),
      future: [],
    });
  },

  update: (patch, transient = false) => {
    const state = get();
    if (!state.present) return;
    const next = merge(state.present, patch);
    if (transient) {
      set({
        present: next,
        past: state.dragHistory
          ? state.past
          : [...state.past, state.present].slice(-LIMIT),
        future: [],
        dragHistory: true,
      });
    } else {
      set({
        present: next,
        past: [...state.past, state.present].slice(-LIMIT),
        future: [],
        dragHistory: false,
      });
    }
  },

  endEdit: () => set({ dragHistory: false }),

  undo: () => {
    const state = get();
    if (!state.present || state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    set({
      present: previous,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future].slice(0, LIMIT),
      dragHistory: false,
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    set({
      present: next,
      past: state.present ? [...state.past, state.present].slice(-LIMIT) : state.past,
      future: state.future.slice(1),
      dragHistory: false,
    });
  },

  clear: () => set({ present: null, past: [], future: [], selectedValue: null }),

  select: (value) => set({ selectedValue: value }),
}));
