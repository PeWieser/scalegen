"use client";

import { useMemo } from "react";
import { buildScale, type ScaleDefinition } from "@/lib/scale-engine";
import { useEditor } from "@/store/editor";

/**
 * Geometrie wird nie im State gespeichert — sie wird aus den Parametern berechnet
 * und nur dann neu berechnet, wenn sich die Parameter ändern.
 */
export function useDefinition(): ScaleDefinition | null {
  const present = useEditor((state) => state.present);
  return useMemo(() => (present ? buildScale(present) : null), [present]);
}
