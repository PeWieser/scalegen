/**
 * scale-engine – domain types.
 *
 * Everything in here is plain data. No React, no DOM.
 * Units: millimetres. Angles: degrees, 0° = 12 o'clock, positive = clockwise.
 * Coordinate system of computed geometry: x → right, y → down (screen/SVG convention),
 * origin at the centre of circular scales / the midpoint of linear scales.
 * Exporters convert to their own conventions (DXF/STL: y up).
 */

export type ScaleType = "circle" | "semicircle" | "arc" | "linear";
export type Orientation = "horizontal" | "vertical";
/** Which side of the baseline something sits on. inside = towards the centre (circular) / below or left (linear). */
export type Side = "inside" | "outside";
export type MinorMode = "count" | "step";
export type ReliefMode = "raised" | "engraved";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The only thing React state ever holds. Geometry is always derived from this. */
export interface ScaleParams {
  type: ScaleType;
  geometry: {
    /** Radius of the baseline (the scale line itself). */
    radius: number;
    /** Angle of the minimum value. */
    startAngle: number;
    /** Angle of the maximum value (only free for "arc"; derived for circle/semicircle). */
    endAngle: number;
    /** Outline / body: inner radius (0 = full disc). */
    innerRadius: number;
    /** Outline / body: outer radius. */
    outerRadius: number;
    /** Linear scales: length of the baseline. */
    length: number;
    orientation: Orientation;
    /** Direction in which tick marks extend from the baseline. */
    tickSide: Side;
  };
  range: {
    min: number;
    max: number;
  };
  major: {
    /** Value distance between two major ticks. */
    step: number;
    length: number;
    width: number;
  };
  minor: {
    mode: MinorMode;
    /** mode = count: number of minor ticks BETWEEN two majors. */
    count: number;
    /** mode = step: value distance between minor ticks. */
    step: number;
    length: number;
    width: number;
  };
  labels: {
    enabled: boolean;
    /** Cap height in mm. */
    fontSize: number;
    position: Side;
    /** Clearance between tick end / baseline and the label box. */
    offset: number;
    /** Stroke width of the single-line engraving font. */
    strokeWidth: number;
  };
  baseline: {
    enabled: boolean;
    width: number;
  };
  relief: {
    mode: ReliefMode;
    /** Thickness of the body / plate. */
    baseThickness: number;
    /** raised: how far lines stand out. */
    height: number;
    /** engraved: how deep lines are cut. */
    depth: number;
  };
  overrides: {
    /** Tick values that are hidden (exact value keys, see valueKey()). */
    hiddenTicks: string[];
    /** Major tick values whose label is hidden. */
    hiddenLabels: string[];
  };
}

export type TickKind = "major" | "minor";

export interface Tick {
  id: string;
  value: number;
  kind: TickKind;
  /** Normalised position along the scale, 0 = min, 1 = max. */
  t: number;
  /** Angle in degrees (circular) – 0 for linear scales. */
  angle: number;
  /** Point on the baseline. */
  position: Vec2;
  /** Segment start (on baseline) and end (tick tip). */
  start: Vec2;
  end: Vec2;
  width: number;
  hidden: boolean;
}

export interface Label {
  id: string;
  /** id of the tick this label belongs to */
  tickId: string;
  value: number;
  text: string;
  /** Centre of the label's bounding box. */
  position: Vec2;
  rotation: number;
  fontSize: number;
  strokeWidth: number;
  /** Bounding box half extents (unrotated). */
  halfWidth: number;
  halfHeight: number;
  /** Polylines in world coordinates (mm). */
  strokes: Vec2[][];
  hidden: boolean;
}

export type BaselineGeometry =
  | { kind: "arc"; center: Vec2; radius: number; startAngle: number; endAngle: number; width: number }
  | { kind: "circle"; center: Vec2; radius: number; width: number }
  | { kind: "line"; a: Vec2; b: Vec2; width: number };

export type OutlineGeometry =
  | { kind: "ring"; center: Vec2; innerRadius: number; outerRadius: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number };

export type ScaleGeometry =
  | {
      kind: "circular";
      center: Vec2;
      radius: number;
      startAngle: number;
      endAngle: number;
      sweep: number;
      fullCircle: boolean;
    }
  | {
      kind: "linear";
      a: Vec2;
      b: Vec2;
      length: number;
      orientation: Orientation;
      /** Unit vector pointing to the "inside" side. */
      inside: Vec2;
    };

export type WarningCode =
  | "range-invalid"
  | "major-step-invalid"
  | "minor-step-invalid"
  | "too-many-ticks"
  | "outside-outline"
  | "labels-overlap"
  | "relief-depth"
  | "radius-invalid"
  | "outline-invalid";

export interface ScaleWarning {
  code: WarningCode;
  message: string;
}

/** The complete, computed scale. Never stored – always derived from ScaleParams. */
export interface ScaleDefinition {
  params: ScaleParams;
  geometry: ScaleGeometry;
  baseline: BaselineGeometry | null;
  outline: OutlineGeometry;
  ticks: Tick[];
  labels: Label[];
  /** Bounds of everything (content + outline). */
  bounds: Bounds;
  /** Bounds of content only (ticks, labels, baseline). */
  contentBounds: Bounds;
  warnings: ScaleWarning[];
  stats: {
    majorCount: number;
    minorCount: number;
    labelCount: number;
    hiddenCount: number;
  };
}
