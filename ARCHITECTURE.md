# ARCHITECTURE.md — Scale Generator

Domain-Driven Design, strikt geschichtet. Die Kernregel:

> **Geometrie wird nie gespeichert. Sie wird aus Parametern berechnet — einmal, in einem
> React-freien Kern, den alle Exporte benutzen.**

```
src/
├─ lib/
│  ├─ scale-engine/        # CORE — reine Domäne, kein React, kein DOM
│  │  ├─ types.ts          # ScaleParams, ScaleDefinition, Tick, Label, ParamDomain
│  │  ├─ format.ts         # Zahlenformat, Nachkommastellen, Byte-Anzeige
│  │  ├─ engine.ts         # buildScale(): Parameter → ScaleDefinition
│  │  ├─ mesh.ts           # makeGrid(), buildSolid(): Höhenfeld → Dreiecksnetz
│  │  └─ solid.ts          # Marken + Höhenfeld aus einer ScaleDefinition
│  ├─ svg-renderer/        # Weltkoordinaten → SVG (Vorschau + Export)
│  ├─ canvas-renderer/     # isometrische Schattierung der 3D-Geometrie
│  ├─ exporters/           # svg-, dxf-, stl-, obj-Exporter + Auslöser
│  ├─ storage.ts           # Ablage im localStorage + JSON-Sicherung
│  └─ utils.ts
├─ components/ui/          # shadcn/ui-Primitiven (Button, Felder, Dialog, Tooltip)
├─ features/
│  ├─ scale/               # Workbench, EmptyState, TitleBlock, TypeGlyphs, AblageActions
│  ├─ parameters/          # ParameterPanel (die einzige Eingabeebene)
│  ├─ stage/               # Bühne + useDefinition()
│  └─ export/              # Exportdialog
└─ store/editor.ts         # Zustand: Parameter + zustandsbasiertes Undo/Redo

public/api/health          # statische Statusdatei (kein Server-Code)
```

> **Kein Backend.** Es gibt keinen API-Route-Handler, keine Datenbank, keinen
> Server-Zugriff zur Laufzeit. Jede Datei unter `src/` ist entweder reine Domäne
> oder Client-Code. Damit ist die Anwendung eine statisch auslieferbare Seite.

## 1. Der Kern: `scale-engine/`

Enthält Parameter, mathematische Berechnung, Tick-Erzeugung, Label-Erzeugung.
**Keine React-Abhängigkeit, keine Seiteneffekte, 100 % testbar.** Jede Funktion ist eine
reine Abbildung.

### Kernobjekte

```ts
ScaleParams        // alles, was der Nutzer eingibt — das einzige, was gespeichert wird
ScaleDefinition    // das Ergebnis: ticks[], labels[], domain, extents, counts, warnings
Tick               // value, major, position (Winkel ° bzw. Abstand mm),
                   // poly[4] (Weltkoordinaten), u/u0/u1/v0/v1 (Parameterraum)
LabelEntity        // value, text, x, y, rotation, width, height
ParamDomain        // map(u, v) → Punkt, Grenzen, wrapU
```

### Die eine Geometriequelle

Jede Marke ist **ein geschlossenes Viereck in Weltkoordinaten** (Millimeter, y nach oben).

```
            ┌── SVG:   <path d="…Z" fill="…">          gefüllt
Marke ──────┼── DXF:   POLYLINE, geschlossen, 4 Vertices  Kontur
            └── STL:   Höhe über dem Rechteck u0..u1 × v0..v1   Extrusion
```

Es gibt **keine dreifachen Implementierungen**. Ein Tick wird einmal erzeugt und von allen
Exporten gelesen. Damit ist „Export = Vorschau" keine Absichtserklärung, sondern eine
Folge der Architektur.

### Parameterraum

| Typ | u | v | `map(u, v)` |
| --- | --- | --- | --- |
| Kreis, Halbkreis, Kreisbogen | Winkel in Grad | Radius in mm | `(v·cos u, v·sin u)` |
| gerade Linie waagerecht | Abstand in mm | Querrichtung in mm | `(u, v)` |
| gerade Linie senkrecht | Abstand in mm | Querrichtung in mm | `(v, u)` |

Dieselbe Parametrisierung treibt den 3D-Mesher. Ein Kreis ist dort ein Rechteck im
(u, v)-Raum und wird beim Abbilden zur Bogenmarke — deshalb stimmt die3D-Marke exakt
mit der2D-Marke überein (bis auf die optionale Linienbreiten-Überschreitung).

### Rechenschritte in `buildScale()`

1. **Werte erzeugen**: Hauptteilungen aus `range` + `majorStep`, Nebenmarken wahlweise
   als feste Anzahl zwischen zwei Hauptteilungen oder als Schrittweite.
2. **Marken bauen**: Wert → t ∈ [0,1] → u (Winkel/Abstand) → Ankerlinie ± Länge →
   Viereck (bei Kreisen als Bogenkeil mit der Breite `width / r`).
3. **Beschriftung**: nur an Hauptteilungen, Zahl aus `decimalsOf(min, max, majorStep)`,
   Rotation radial (bei Bedarf um 180° gedreht, damit nichts auf dem Kopf steht).
4. **Grundkörper bestimmen**: umschließt **immer** alle Marken und das Beschriftungsband —
   dadurch kann im 3D-Export keine Marke aus der Platte ragen.
5. **Warnungen einsammeln**: nicht ganzzahlig geteilte Bereiche, begrenzte Markenlänge,
   Beschriftung über dem Außenradius, abgeschnittene Markenanzahl.

## 2. Renderer

**`svg-renderer/`** — eine einzige Umrechnung Weltkoordinaten → SVG (y negiert) mit
`polyToPathD()`, `labelTransform()`, `viewBoxOf()`, `defToSvgBody()`. Die Live-Vorschau
und der SVG-Export rufen dieselben Funktionen auf.

**`canvas-renderer/`** — `renderIso(canvas, grid, view)`: projiziert dasselbe
Dreiecksnetz, das auch in der STL steht, orthografisch (Gierwinkel + Elevationswinkel),
tiefensortiert und mit Lambert-Schattierung. Bewusst 2D-Canvas statt WebGL: die
Geometrie ist eine statische Draht-/Flächenmenge, kein Spiel.

## 3. Exporter

Alle vier liegen unter `lib/exporters/` und haben dieselbe Signatur: eine
`ScaleDefinition` rein, Bytes raus. `renderExport()` liefert zusätzlich Dateiname,
Einheit, Maßstab, Bytezahl und ehrliche Hinweise — derselbe Datensatz, den der
Exportdialog anzeigt. Es gibt **keinen zweiten Berechnungsweg** für die Vorschau.

Details der Formate: siehe `EXPORT_FORMATS.md`.

## 4. 3D: Höhenfeld statt Meshed SVG

`mesh.ts` ist der Grund, warum STL/CAM-tauglich ist:

1. Der Parameterraum wird in Zellen zerlegt. Bruchkanten sind die Kanten aller Marken
   plus eine Obergrenze für die Zellänge (3° bzw. 5 mm) für glatte Bögen.
2. Jede Zelle hat eine **konstante Höhe**: `Plattenstärke` oder `Plattenstärke ± Tiefe`,
   je nachdem, ob der Zellmittelpunkt in einer Marke liegt.
3. Daraus entsteht ein geschlossener Körper: Deckelflächen, Bodenfläche und an jeder
   Höhenstufe **senkrechte Wände**. Bei „Gravur" sind das die Wände der echten
   Teilstrichkanäle — kein Aufsatz, keine Schein-Geometrie.
4. Normale nach außen: jede Fläche wird gegen einen Außenhint geprüft und bei Bedarf
   umgedreht — dadurch ist das Netz für Slicer und CAM sauber orientiert.
5. Vollkreis: `wrapU` verbindet die erste und letzte Zelle. Marken, die über die Naht
   laufen, werden dort aufgeteilt, damit kein doppeltes Gesicht entsteht.

## 5. State

`store/editor.ts` (Zustand):

```ts
present: ScaleParams | null   // das Dokument
past: ScaleParams[]           // zustandsbasiertes Undo
future: ScaleParams[]         // Redo
selectedValue: number | null  // Auswahl (kein Dokumentinhalt → kein Undo)
```

`update(patch, transient?)` verschmilzt Teilmengen der Parametersektionen.
`transient === true` fasst Scrubbing-Bewegungen zu einer Undo-Stufe zusammen.

**Geometrie niemals im React-State.** `useDefinition()` berechnet `buildScale(present)`
in einem `useMemo`. Damit ist Undo billig (nur Parameter tauschen) und die Berechnung
erfolgt genau einmal je Änderung — und wird von Vorschau **und** Export gelesen.

## 6. Persistenz — rein clientseitig

`src/lib/storage.ts` hält die **Ablage** im `localStorage` des Browsers
(Schlüssel `scale-generator.ablage.v1`). Gespeichert werden ausschließlich
**Parameter** (`ScaleParams`) — niemals Geometrie. Eine gespeicherte Skala bleibt
auch dann gültig, wenn sich die Engine weiterentwickelt.

```ts
loadSaved(): SavedScale[]                  // nach Änderungszeit sortiert
saveScale(params): SavedScale | null       // aktualisiert bei gleicher id, sonst neu
deleteScale(id): SavedScale[]
exportAblage(items) / importAblage(file)   // JSON-Sicherung, Datei statt Konto
storageAvailable(): boolean                // ehrlicher Zustand bei gesperrtem Speicher
```

Bewusste Entscheidungen:

- **Keine Datenbank, kein Konto, kein Dienst.** Das Werkzeug muss auch ohne Netz und
  ohne Anmeldung funktionieren. Es gibt nichts, was ausfallen oder abgehört werden kann.
- **Ehrlicher Zustand statt Stillstand.** Ist der Speicher gesperrt (privater Modus) oder
  voll, meldet `saveScale` `null` und die Oberfläche zeigt einen klaren Hinweis — statt
  „erfolgreich gesichert" vorzutäuschen.
- **Sicherung als Datei.** Browser-Speicher ist entbehrlich. Deshalb kann die ganze
  Ablage als JSON-Datei gesichert und wieder eingelesen werden (`AblageActions`),
  an derselben Stelle im UI, an der die Ablage steht.
- **Nach dem Laden auslesen.** Die Ablage wird in einem `useEffect` gelesen, damit die
  serverseitig gerenderte Seite und der Hydration-Schritt identisch sind.

## 9. Deployment — Cloudflare Pages

Die Anwendung ist eine statische Seite. `next.config.ts` schaltet den statischen Export
über die Umgebungsvariable `CF_PAGES` ein, die Cloudflare Pages beim Build selbst setzt:

| Umgebung | Build | Ergebnis |
| --- | --- | --- |
| Cloudflare Pages | `npx next build` (CF_PAGES=1 ist gesetzt) | `out/` — statische Seite |
| lokal / Vorschau | `npm run build` | Server-Build (identischer Code) |

Einstellungen im Cloudflare-Dashboard (oder in `wrangler.toml`):

```
Build-Befehl:        npx next build
Build-Ausgabeordner: out
Umgebungsvariablen:  keine
```

Zusätzlich erzwingt `NEXT_STATIC_EXPORT=1 npx next build` denselben statischen Export,
zum Beispiel für `wrangler pages deploy out`.

`public/_headers` liegt im Ausgabeordner und setzt für Cloudflare Pages die Antwortköpfe:
`/api/health` als JSON ohne Zwischenspeicherung, Bilder und `_next/static/*` als
unveränderlich (langes Caching).

Details, die für den statischen Export wichtig sind:

- **Keine Route-Handler.** `app/api/**` existiert nicht. `/api/health` ist eine
  statische Datei unter `public/api/health` und wird wie jede andere Datei ausgeliefert.
- **Keine serverseitige Datenquelle.** `page.tsx` rendert ausschließlich die
  Client-Oberfläche, ohne `dynamic = "force-dynamic"` (im statischen Export nicht erlaubt).
- **Bilder über `<img>` statt `next/image`.** Kein Bild-Optimizer nötig
  (`images: { unoptimized: true }`), damit der Export ohne Server auskommt.
- **Relative Bildpfade** (`images/…`) statt `/images/…`, damit die Seite auch unter
  einem Unterverzeichnis oder einem beliebigen Host-Pfad läuft.
- **Fonts über `next/font`** werden beim Build eingebunden (kein Abruf zur Laufzeit).

## 7. UI-Schicht

- `components/ui/` — shadcn/ui-Primitiven: `Button` (cva), `Row`, `ValueInput`,
  `Segmented`, `SwitchRow`, `SectionTitle`, `MicroLabel`, `Dialog`, `Tooltip`.
- `features/` — die vier Aufgabenflächen. Jede kennt den Store, keine kennt die
  Geometrieberechnung im Detail außer `useDefinition()`.
- Zwei Spalten, eine Ebene: Parameter links, Bühne rechts, Schriftfeld unten.
  Keine Modal-Dialoge für Eigenschaften; der einzige Dialog der Anwendung ist der Export.

## 8. Prüfbarkeit

- `scale-engine` ist ohne DOM lauffähig: `buildScale()`, `makeGrid()`, `buildSolid()`,
  `toDxf()`, `toStl()`, `toObj()`, `toSvg()` sind deterministische Funktionen.
- Exporte lassen sich ohne Browser prüfen (Bytes vergleichen, DXF parsen, STL zählen).
- Die Typen sind strikt; alle Sektionen der Parameter sind Pflichtfelder im Objekt,
  sodass eine `ScaleDefinition` vollständig definiert ist.
