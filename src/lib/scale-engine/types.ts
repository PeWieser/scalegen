/**
 * scale-engine — reine Domänentypen.
 * Keine React-Abhängigkeit, keine Seiteneffekte. 100 % testbar.
 *
 * Konventionen:
 *  - Weltkoordinaten in Millimeter, y zeigt nach OBEN (CAD-Konvention).
 *  - Winkel in Grad, 0° = 3 Uhr, positiv gegen den Uhrzeigersinn.
 *  - Eine Marke ist IMMER ein geschlossenes Viereck in Weltkoordinaten.
 *    SVG füllt es, DXF gibt es als geschlossene Polyline aus, STL/OBJ extrudiert es.
 *    Dadurch stimmen alle Exporte exakt mit der Vorschau überein.
 */

export interface Point {
  x: number;
  y: number;
}

export type ScaleType = "circle" | "half-circle" | "arc" | "line";

export interface GeometryParams {
  /** Teilkreis: Ankerlinie aller Marken. Marken wachsen nach innen. */
  radius: number;
  startAngle: number;
  endAngle: number;
  /** Innenkante des Grundkörpers, begrenzt die Markenlänge nach innen. */
  innerRadius: number;
  /** Außenkante des Grundkörpers. */
  outerRadius: number;
  /** Länge linearer Skalen (Achse 0 … L). */
  length: number;
  orientation: "horizontal" | "vertical";
}

export interface RangeParams {
  min: number;
  max: number;
}

export interface TickParams {
  /** Abstand der Hauptteilungen in Werteinheiten. */
  majorStep: number;
  majorLength: number;
  majorWidth: number;
  /** 'count' = Anzahl Marken zwischen zwei Hauptteilungen, 'step' = Schrittweite. */
  minorMode: "count" | "step";
  minorCount: number;
  minorStep: number;
  minorLength: number;
  minorWidth: number;
}

export interface LabelParams {
  enabled: boolean;
  fontSize: number;
  position: "inside" | "outside";
  /** Abstand der Beschriftung zur Skala. */
  offset: number;
}

export interface BodyParams {
  /** 'positive' = Marken stehen hervor, 'engrave' = Marken werden eingeschnitten. */
  mode: "positive" | "engrave";
  /** Plattenstärke / Extrusionshöhe in mm. */
  thickness: number;
  /** Gravurtiefe bzw. Reliefhöhe in mm. */
  depth: number;
  /** 3D-Linienbreite in mm. 0 = Breite aus der Vorschau übernehmen. */
  lineWidth: number;
}

export interface ScaleParams {
  id: string;
  name: string;
  type: ScaleType;
  geometry: GeometryParams;
  range: RangeParams;
  ticks: TickParams;
  labels: LabelParams;
  body: BodyParams;
}

/** Parameterraum: u = Winkel (°) bzw. Abstand (mm), v = Radius bzw. Querrichtung (mm). */
export interface ParamDomain {
  kind: "circular" | "linear";
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  /** Vollkreis: u-Wrap, damit keine Naht entsteht. */
  wrapU: boolean;
  map(u: number, v: number): Point;
}

export interface Tick {
  id: string;
  index: number;
  value: number;
  major: boolean;
  /** geschlossenes Viereck in Weltkoordinaten (mm), y nach oben */
  poly: Point[];
  center: Point;
  /** Marke im Parameterraum — dieselbe Quelle für den 3D-Mesher. */
  u: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  width: number;
  /** Winkel in Grad (kreisförmig) bzw. Abstand in mm (linear). */
  position: number;
}

export interface LabelEntity {
  id: string;
  value: number;
  text: string;
  x: number;
  y: number;
  /** Rotation in Grad, CCW in Weltkoordinaten. */
  rotation: number;
  width: number;
  height: number;
}

export interface Extents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Mark {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface ScaleDefinition {
  type: ScaleType;
  params: ScaleParams;
  ticks: Tick[];
  labels: LabelEntity[];
  domain: ParamDomain;
  extents: Extents;
  counts: { total: number; major: number; minor: number };
  decimals: number;
  warnings: string[];
}
