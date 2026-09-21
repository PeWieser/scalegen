/**
 * Single-stroke ("Gravurschrift") font for numeric labels.
 *
 * Glyphs are defined as polylines on a 4 × 7 grid (x 0..4, y 0..7, y up).
 * Because labels are pure line geometry, they are identical in the preview,
 * in SVG/DXF (as polylines) and in STL/OBJ (as extruded strokes) – without any
 * font dependency in the target application.
 */

import type { Vec2 } from "./types";

type GlyphStrokes = ReadonlyArray<ReadonlyArray<readonly [number, number]>>;

interface Glyph {
  strokes: GlyphStrokes;
  /** Horizontal advance in grid units (including spacing). */
  advance: number;
  /** Ink width in grid units. */
  width: number;
}

export const GLYPH_HEIGHT = 7;
const ADVANCE = 5.6;

const GLYPHS: Record<string, Glyph> = {
  "0": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [1.2, 0],
        [2.8, 0],
        [3.6, 0.6],
        [4, 1.8],
        [4, 5.2],
        [3.6, 6.4],
        [2.8, 7],
        [1.2, 7],
        [0.4, 6.4],
        [0, 5.2],
        [0, 1.8],
        [0.4, 0.6],
        [1.2, 0],
      ],
    ],
  },
  "1": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [0.8, 5.2],
        [2.2, 7],
        [2.2, 0],
      ],
    ],
  },
  "2": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [0.1, 5.6],
        [0.6, 6.6],
        [1.5, 7],
        [2.5, 7],
        [3.5, 6.5],
        [4, 5.5],
        [3.9, 4.6],
        [3.3, 3.7],
        [0, 0],
        [4, 0],
      ],
    ],
  },
  "3": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [0.2, 7],
        [3.9, 7],
        [1.8, 4.3],
        [2.6, 4.3],
        [3.5, 3.9],
        [4, 3],
        [4, 1.2],
        [3.3, 0.3],
        [2.5, 0],
        [1.4, 0],
        [0.5, 0.4],
        [0, 1.3],
      ],
    ],
  },
  "4": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [3, 0],
        [3, 7],
        [0, 2.1],
        [4.2, 2.1],
      ],
    ],
  },
  "5": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [3.8, 7],
        [0.6, 7],
        [0.2, 3.8],
        [1.2, 4.4],
        [2.4, 4.5],
        [3.4, 4],
        [4, 3],
        [4, 1.3],
        [3.3, 0.3],
        [2.4, 0],
        [1.4, 0],
        [0.5, 0.4],
        [0, 1.2],
      ],
    ],
  },
  "6": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [3.4, 7],
        [2, 7],
        [0.9, 6.3],
        [0.2, 4.8],
        [0, 3],
        [0, 1.4],
        [0.6, 0.4],
        [1.5, 0],
        [2.5, 0],
        [3.4, 0.4],
        [4, 1.4],
        [4, 2.6],
        [3.4, 3.6],
        [2.5, 4],
        [1.5, 4],
        [0.6, 3.6],
        [0, 2.7],
      ],
    ],
  },
  "7": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [0, 7],
        [4, 7],
        [1.4, 0],
      ],
    ],
  },
  "8": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [2, 3.8],
        [1.1, 4.1],
        [0.5, 4.8],
        [0.5, 6.1],
        [1.2, 7],
        [2.8, 7],
        [3.5, 6.1],
        [3.5, 4.8],
        [2.9, 4.1],
        [2, 3.8],
      ],
      [
        [2, 3.8],
        [0.8, 3.3],
        [0, 2.3],
        [0, 1],
        [0.9, 0],
        [3.1, 0],
        [4, 1],
        [4, 2.3],
        [3.2, 3.3],
        [2, 3.8],
      ],
    ],
  },
  "9": {
    width: 4,
    advance: ADVANCE,
    strokes: [
      [
        [0.6, 0],
        [2, 0],
        [3.1, 0.7],
        [3.8, 2.2],
        [4, 4],
        [4, 5.6],
        [3.4, 6.6],
        [2.5, 7],
        [1.5, 7],
        [0.6, 6.6],
        [0, 5.6],
        [0, 4.4],
        [0.6, 3.4],
        [1.5, 3],
        [2.5, 3],
        [3.4, 3.4],
        [4, 4.3],
      ],
    ],
  },
  "-": {
    width: 3,
    advance: 4.6,
    strokes: [
      [
        [0.3, 3.5],
        [3.3, 3.5],
      ],
    ],
  },
  ".": {
    width: 1,
    advance: 2.4,
    strokes: [
      [
        [0.6, 0],
        [0.6, 0.7],
      ],
    ],
  },
  ",": {
    width: 1,
    advance: 2.4,
    strokes: [
      [
        [0.8, 0.8],
        [0.8, 0],
        [0.3, -0.9],
      ],
    ],
  },
  " ": { width: 0, advance: 3, strokes: [] },
};

export interface TextLayout {
  /** Polylines in local coordinates: centred on (0,0), x right, y DOWN, in mm. */
  strokes: Vec2[][];
  /** Ink width in mm. */
  width: number;
  /** Cap height in mm. */
  height: number;
}

/**
 * Lays out a numeric string with the given cap height (mm).
 * Unknown characters are skipped silently (labels are numbers only).
 */
export function layoutText(text: string, fontSize: number): TextLayout {
  const scale = fontSize / GLYPH_HEIGHT;
  const glyphs = Array.from(text)
    .map((ch) => GLYPHS[ch])
    .filter((g): g is Glyph => Boolean(g));

  if (glyphs.length === 0) return { strokes: [], width: 0, height: fontSize };

  let penX = 0;
  let inkWidth = 0;
  const raw: Vec2[][] = [];

  for (const g of glyphs) {
    for (const stroke of g.strokes) {
      raw.push(stroke.map(([gx, gy]) => ({ x: (penX + gx) * scale, y: gy * scale })));
    }
    inkWidth = (penX + g.width) * scale;
    penX += g.advance;
  }

  // Centre horizontally and vertically, flip y (grid is y-up, world is y-down).
  const halfW = inkWidth / 2;
  const halfH = fontSize / 2;
  const strokes = raw.map((s) => s.map((p) => ({ x: p.x - halfW, y: halfH - p.y })));

  return { strokes, width: inkWidth, height: fontSize };
}

/** Width in mm a text will occupy (without laying it out). */
export function measureText(text: string, fontSize: number): number {
  return layoutText(text, fontSize).width;
}
