# EXPORT_FORMATS.md – Scale Generator

Export ist das Produkt. Alle Formate entstehen aus **derselben** `ScaleDefinition` wie die Vorschau.
Was du siehst, ist, was in der Datei steht – geometrisch identisch, nur ohne Farben.

Gemeinsam für alle Formate:

| Eigenschaft | Wert |
|---|---|
| Einheit | Millimeter |
| Maßstab | 1:1 |
| Ursprung | Kreismittelpunkt (kreisförmige Skalen) bzw. Mitte der Skalenlinie (linear) |
| Beschriftung | Geometrie (Strichschrift), nie Text-Objekte → keine Font-Abhängigkeit |
| Ausgeblendete Striche/Labels | werden **nicht** exportiert |
| Dateiname | aus dem Skalennamen, ASCII-sicher (`Front-Panel-0-80.dxf`) |

Der Exportdialog zeigt vor dem Download: eine Vorschau der Datei, Dateigröße, Einheiten, Maßstab und formatspezifische Fakten.

---

## Koordinatensysteme

Die Engine rechnet in SVG-Konvention (y nach unten). Beim Export wird umgerechnet:

| Format | x | y | z |
|---|---|---|---|
| SVG | rechts | **unten** (SVG-Standard) | – |
| DXF | rechts | **oben** (`y_dxf = −y_engine`) | – |
| STL / OBJ | rechts | **oben** | oben (Platte liegt auf z = 0) |

Winkel: In der Anwendung 0° = 12 Uhr, im Uhrzeigersinn. Im DXF werden Bögen in die DXF-Konvention (gegen den Uhrzeigersinn ab +x) umgerechnet: `φ = 90° − θ`.

---

## SVG

**Für:** Laser, Schneidplotter, Druckvorlagen, Inkscape/Illustrator, Web.

- `width`/`height` in `mm`, `viewBox` in mm → 1 Benutzereinheit = 1 mm. Jede Software, die SVG-Einheiten respektiert, importiert maßstabsgetreu.
- Kein Füllen, nur Konturen: `fill="none"`, Strichbreiten in mm, Farbe Schwarz.
- Ebenen als Gruppen mit Inkscape-Labels:

  | `id` | Inhalt |
  |---|---|
  | `outline` | Kontur (Ring/Scheibe bzw. Rechteck), 0,2 mm, optional |
  | `baseline` | Skalenlinie (Kreis, Bogen oder Linie) |
  | `ticks-major` | Hauptteilstriche als `<line>` |
  | `ticks-minor` | Unterteilstriche als `<line>` |
  | `labels` | Beschriftung als `<path>` (Polylinien, `stroke-linecap="round"`) |

- Striche haben `butt`-Enden → die Strichlänge ist exakt die eingestellte Länge.
- Option: *Kontur mit exportieren* (an/aus).

Beispielkopf:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="104mm" height="104mm" viewBox="-52 -52 104 104" fill="none" stroke="#000000">
  <g id="ticks-major" inkscape:groupmode="layer" inkscape:label="Hauptteilung">
    <line x1="-40" y1="0" x2="-34" y2="0" stroke-width="0.6"/>
```

---

## DXF

**Für:** CAM (Fusion 360, Estlcam, VCarve, LightBurn), CAD (LibreCAD, AutoCAD, FreeCAD).

- **Version:** R12 / `AC1009` – das kompatibelste DXF, das jedes CAM liest. Header mit `$INSUNITS = 4` (mm) und `$EXTMIN/$EXTMAX`.
- **Tabellen:** `LTYPE` (CONTINUOUS) und `LAYER`.
- **Zwei Geometriemodi** (Option im Dialog):

  ### Mittellinien (Standard)
  Eine Linie je Strich – für Gravur mit V-Fräser, Laser, Plotter oder Nadel. Die Breite bestimmt das Werkzeug.

  | Ebene | Entitäten |
  |---|---|
  | `OUTLINE` | `CIRCLE` (Außen-/Innenradius) bzw. geschlossene `POLYLINE` (Rechteck) |
  | `BASELINE` | `CIRCLE` (Vollkreis), `ARC` (Bogen) oder `LINE` |
  | `TICKS_MAJOR` | `LINE` |
  | `TICKS_MINOR` | `LINE` |
  | `LABELS` | offene `POLYLINE` je Schriftzug-Strich |

  ### Konturen
  Alle Elemente als **geschlossene** `POLYLINE`-Konturen mit den eingestellten Linienbreiten – vereinigt (keine Überlappungen), für Taschenfräsen, Ausschneiden oder Ätzmasken.

  | Ebene | Entitäten |
  |---|---|
  | `OUTLINE` | wie oben |
  | `SCALE` | geschlossene `POLYLINE` (Außenkonturen und Löcher, z. B. das Innere einer „0“) |

  Bögen werden mit einer Sehnenabweichung ≤ 0,01 mm segmentiert (bei r = 50 mm: 0,3°-Schritte).

- Koordinaten mit 4 Nachkommastellen (0,1 µm).
- Keine Lineweights im R12-Format – im Mittellinienmodus sind Breiten bewusst Werkzeugsache; wer sie braucht, nimmt den Konturmodus.

---

## STL

**Für:** 3D-Druck (Zifferblätter, Skalenringe), CAM-Reliefs, Import als Körper ins CAD.

Die STL ist **kein** Abbild der SVG, sondern ein aus den Parametern gebauter Volumenkörper:

- **Körper:** Ring/Scheibe aus Innen-/Außenradius (kreisförmig) bzw. Rechteck (linear), Stärke = *Plattenstärke*.
- **Erhaben:** Striche, Skalenlinie und Ziffern stehen um *Extrusionshöhe* über der Platte.
- **Gravur:** dieselben Elemente sind um *Gravurtiefe* in die Platte eingeschnitten. Ist die Tiefe ≥ Plattenstärke, entsteht ein Durchbruch (Schablone) – der Dialog benennt das.
- **Linienbreiten** sind die im Panel eingestellten Breiten (Haupt-/Unterteilung, Skalenlinie, Beschriftung). Ziffern haben runde Strichenden – identisch mit SVG/DXF-Konturmodus.
- Geometrie außerhalb des Körpers wird beschnitten; der Dialog nennt die beschnittene Fläche in mm² und die Vorschau warnt vorher.

Technisch:

| Eigenschaft | Wert |
|---|---|
| Kodierung | binär, Little-Endian, 80-Byte-Header `Scale Generator – <name> – units: mm` |
| Normalen | pro Dreieck berechnet, nach außen |
| Topologie | eine geschlossene Hülle: jede Kante gehört zu genau zwei Dreiecken (verifiziert für alle Modi) |
| Lage | Platte auf z = 0, z nach oben; x/y wie DXF |
| Größe | ca. 300 KB (Halbkreis 0–80), ~4 MB bei 1 000 Strichen |

Aufbau der Hülle (2.5D): Boden · Außenwände · Deckel mit Aussparungen · Taschenböden bzw. Feature-Deckel · Feature-Wände. Flächen werden mit *earcut* trianguliert, Flächenvereinigungen mit *polygon-clipping* berechnet (siehe ARCHITECTURE.md).

Hinweis für CAM: Das Netz ist manifold, Slicer und Fusion/Meshmixer importieren es als einen Körper. Für saubere Toolpaths auf Frontplatten ist meist der **DXF-Export** das bessere Werkzeug – STL ist für Reliefs und Druck gedacht.

---

## OBJ

**Für:** Blender, CAD/CAM-Tools, die OBJ bevorzugen.

- Dasselbe Netz wie STL, ASCII.
- Vertices dedupliziert (`v x y z`, 4 Nachkommastellen), Dreiecke als `f a b c`, ein Objekt `o <name>`.
- Kopfzeilen dokumentieren Einheit und Achsen (`# units: mm, scale 1:1, z up`).
- Keine Normalen/Materialien – bewusst schlank; jede Software berechnet Normalen aus der konsistenten Wicklung.

---

## Beschriftung als Strichschrift

Ziffern `0–9`, `−`, `.`, `,` sind als Polylinien auf einem 4 × 7-Raster definiert (`core/scale-engine/stroke-font.ts`).
Schriftgröße = Versalhöhe in mm, Linienbreite frei wählbar (Standard 0,4 mm).

Warum keine Outline-Fonts:

1. **Identisch in allen Formaten.** Preview, SVG, DXF-Mittellinie, DXF-Kontur und STL zeigen exakt dieselbe Ziffer.
2. **Direkt fräsbar.** Eine Mittellinie pro Strich ist genau das, was ein V-Fräser oder Laser braucht – ohne Offsetting im CAM.
3. **Keine Abhängigkeit.** Das Ziel-CAD braucht keine Schrift installiert; keine Ersatzschrift, kein Versatz.
4. **Wenige Knoten.** Eine „8“ hat 20 Knoten, nicht 200.

---

## Prüfung

Während der Entwicklung wurde jeder Exporter unter Node ausgeführt und geprüft:

- SVG: gültiges XML, mm-Einheiten, 5 Ebenen, Strichanzahl = Engine.
- DXF: R12-Struktur (HEADER/TABLES/ENTITIES/EOF), 41 `LINE`, 1 `ARC`, 18 `POLYLINE` für die Standard-Halbkreisskala 0–80; Konturmodus 31 geschlossene Polylinien.
- STL/OBJ: Dreieckszahl, Bounding-Box (z. B. 100 × 100 × 3 mm), Kantenpaarung: 0 offene, 0 doppelte Kanten in allen Modi, inkl. Durchbruch und beschnittener Features.
