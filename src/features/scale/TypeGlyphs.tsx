import type { ScaleType } from "@/lib/scale-engine";

/**
 * Handgezeichnete Vektormarken — Teilstriche als Glyphen, damit man den
 * Skalentyp am Strichbild erkennt und nicht am Schriftzug.
 */

export function ScaleGlyph({ type, className }: { type: ScaleType; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="square">
        {type === "circle" ? (
          <>
            <path d="M16 4.5 A11.5 11.5 0 0 1 27.5 16 A11.5 11.5 0 0 1 16 27.5 A11.5 11.5 0 0 1 4.5 16 A11.5 11.5 0 0 1 16 4.5" />
            <path d="M16 4.5v4M24.1 7.9l-2.8 2.8M27.5 16h-4M24.1 24.1l-2.8-2.8M16 27.5v-4M7.9 24.1l2.8-2.8M4.5 16h4M7.9 7.9l2.8 2.8" />
          </>
        ) : null}
        {type === "half-circle" ? (
          <>
            <path d="M4.5 21A13.5 13.5 0 0 1 27.5 21" />
            <path d="M4.5 21v-4.5M9.8 12.2l2.6 2.8M17.5 8.5v4.2M25.2 12.2l-2.6 2.8M27.5 21v-4.5" />
          </>
        ) : null}
        {type === "arc" ? (
          <>
            <path d="M6.5 23.5A15 15 0 0 1 25.5 23.5" />
            <path d="M6.5 23.5l1.6-4.1M11.6 14.9l2.4 3.2M20.4 14.9l-2.4 3.2M25.5 23.5l-1.6-4.1" />
          </>
        ) : null}
        {type === "line" ? (
          <>
            <path d="M4 22h24" />
            <path d="M4 22v-6M10 22v-3.5M16 22v-3.5M22 22v-3.5M28 22v-6" />
          </>
        ) : null}
      </g>
    </svg>
  );
}

/** Bildmarke des Produkts: Skalenbogen mit drei Teilstrichen. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path
        d="M5.5 31.5A19 19 0 0 1 34.5 31.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
        <path d="M5.5 31.5v-8.5" />
        <path d="M20 12.5v6.5" />
        <path d="M34.5 31.5v-8.5" />
      </g>
      <path d="M12.6 18.2l1.5 4.3M27.4 18.2l-1.5 4.3" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
