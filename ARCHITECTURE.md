# ARCHITECTURE.md – Scale Generator

## Leitprinzip

**Eine Geometriequelle.** Die Skala wird ausschließlich parametrisch beschrieben (`ScaleParams`).
Daraus berechnet die Engine eine `ScaleDefinition`. Vorschau, SVG, DXF, STL und OBJ lesen
diese eine Definition. Es gibt keine zweite Implementierung von Strich- oder Labelgeometrie.

```
ScaleParams  ──computeScale()──▶  ScaleDefinition  ──▶  svg-renderer   ──▶  Vorschau (React)
(React-State)                     (nie gespeichert)  │                  └─▶  SVG-Export (String)
                                                     ├─▶  dxf-exporter (Mittellinien)
                                                     ├─▶  footprint (2D-Polygone) ──▶ dxf-exporter (Konturen)
                                                     │                              └─▶ mesh-builder ──▶ STL / OBJ
                                                     └─▶  canvas-renderer (3D-Vorschau des Meshes)
```

## Verzeichnisstruktur (Domain-Driven)

```
src/
  core/                          # Domäne – keine React-Abhängigkeit, 100 % testbar
    scale-engine/
      types.ts                   # ScaleParams, ScaleDefinition, Tick, Label, Geometrien, Warnungen
      defaults.ts                # Standardwerte, Typwechsel (withScaleType)
      engine.ts                  # computeScale(): Winkel, Ticks, Labels, Baseline, Kontur, Bounds, Warnungen
      stroke-font.ts             # Single-Stroke-Gravurschrift (Ziffern, −, ., ,)
      footprint.ts               # 2D-Flächen: Striche/Labels/Baseline als Polygone, boolesche Operationen
      validate.ts                # coerceParams(): unsichere Eingaben (API, localStorage) → gültige Params
      index.ts
    renderer/
      svg-renderer/              # ScaleDefinition → SVG-Primitive (+ Serialisierung)
      canvas-renderer/           # Mesh → schattiertes Canvas-Rendering
    exporters/
      mesh/mesh-builder.ts       # 2D-Footprints → geschlossenes 3D-Netz (erhaben / graviert / Durchbruch)
      svg-exporter/              # nutzt svg-renderer
      dxf-exporter/              # DXF R12, Mittellinien oder Konturen
      stl-exporter/              # binäres STL
      obj-exporter/              # Wavefront OBJ
      index.ts                   # exportScale(): ein Einstieg, alle Formate, Fakten für den Dialog
  features/scale-editor/         # UI dieses Features
    store.ts                     # Zustand: nur Parameter + Verlauf + Auswahl
    ScaleGeneratorApp.tsx        # Bühne, Tastatur, Hydration
    ParameterPanel.tsx           # links
    Preview.tsx                  # rechts (Zoom/Pan/Fit, Hover, Auswahl, Warnungen)
    ExportDialog.tsx             # Export mit Vorschau, Fakten, Optionen
    LibraryDialog.tsx            # Speichern/Öffnen (Server)
    EmptyState.tsx, Header.tsx, NumberField.tsx, type-icons.tsx
  components/ui/                 # shadcn/ui-Primitive (Button, Input, Switch, Select, Tabs, Dialog, Tooltip, ToggleGroup, Kbd)
  app/
    page.tsx, layout.tsx, globals.css
    api/scales/route.ts          # GET (Liste), POST (anlegen)
    api/scales/[id]/route.ts     # GET, PUT, DELETE
  db/schema.ts                   # Tabelle scales (name, type, params jsonb, timestamps)
```

Abhängigkeitsrichtung: `app → features → core`. `core` importiert nie aus `features` oder `app`
und kennt weder React noch DOM (Ausnahme: `canvas-renderer` zeichnet in ein übergebenes `HTMLCanvasElement`,
`exporters/index.ts` erzeugt `Blob`s für den Download).

## Kernobjekte

```ts
ScaleParams        // React-State. type, geometry, range, major, minor, labels, baseline, relief, overrides
ScaleDefinition    // Ergebnis. params, geometry, baseline, outline, ticks[], labels[], bounds, warnings, stats
Tick               // id, value, kind (major|minor), t (0..1), angle, position, start, end, width, hidden
Label              // id, tickId, value, text, position, rotation, fontSize, strokeWidth, halfWidth/Height, strokes[][], hidden
```

**Regel:** Geometrie steht nie im React-State. `ScaleGeneratorApp` berechnet `def = useMemo(() => computeScale(present), [present])`.
Ein Parameterobjekt → genau eine Berechnung.

## Die Geometrie-Engine (`engine.ts`)

Koordinaten: Millimeter, x nach rechts, y nach unten (SVG-Konvention), Ursprung im Kreismittelpunkt
bzw. in der Mitte einer linearen Skala. Winkel: 0° = 12 Uhr, im Uhrzeigersinn positiv.
Punkt auf dem Kreis: `x = r·sin θ`, `y = −r·cos θ`.

1. **Winkel auflösen** (`resolveAngles`): Kreis → `end = start + 360`, Halbkreis → `start + 180`, Bogen → frei (auf ±360 begrenzt). `fullCircle` = |sweep| = 360.
2. **Frame**: eine kleine Abstraktion `at(t)`, `inside(t)`, `angle(t)` für kreisförmige und lineare Skalen. Danach ist der gesamte Rest typunabhängig.
3. **Hauptteilung**: `v_k = min + k·step`, `k = 0 … ⌊span/step⌋` (mit 1e-6-Toleranz gegen Fließkommafehler). Bei Vollkreis wird `v = max` verworfen (fällt auf `min`).
4. **Unterteilung**: Schrittweite = `step/(count+1)` oder explizit. Werte, die auf Hauptstrichen liegen, werden übersprungen. Harte Obergrenze `MAX_TICKS = 5000` mit Warnung.
5. **Ticks**: `start = at(t)`, `end = start + inside(t)·length·(±1)` je nach `tickSide`. Werte werden über `valueKey()` (9 Nachkommastellen) stabil identifiziert – das ist auch der Schlüssel für Ausblendungen.
6. **Labels**: Text über `formatValue`, Layout über die Strichschrift. Platzierung kreisförmig: Boxmittelpunkt `c = d·u` auf dem Radialvektor `u`, so dass die achsparallele Box den Freiraumkreis `r_clear` genau berührt:
   `d = −k + √(k² − |h|² + r_clear²)` (innen) bzw. `d = k + √(…)` (außen), mit `k = |u_x|·w/2 + |u_y|·h/2`.
   Linear: Normalenabstand = Freiraum + halbe Boxausdehnung.
7. **Baseline** (Kreis/Bogen/Linie) und **Kontur** (Ring/Scheibe bzw. Rechteck aus Inhalt + 3 mm).
8. **Bounds** (Inhalt, Kontur) und **Warnungen** (Bereich, Schrittweiten, Überlauf, Inhalt außerhalb der Kontur inkl. r-Bereich, Labelüberlappung, Gravurtiefe).

Laufzeit: ~3 ms für 40 Striche, ~6 ms für 1 000 Striche (Node, ohne JIT-Warmup).

## Footprints und Mesh

`footprint.ts` wandelt Linien in Flächen: Striche → Rechtecke (butt), Baseline → dicker Bogen/Ring/Rechteck,
Labelstriche → Rechtecke + Kreise an den Knoten (runde Enden/Ecken, wie `stroke-linecap: round` im SVG).
`polygon-clipping` (Martinez-Algorithmus) vereinigt alles zu **einem** MultiPolygon – Überlappungen (Strich über Baseline) sind aufgelöst.

`buildSolidFootprint` liefert: `outline`, `features = F ∩ O`, `remainder = O − F` und `body` (Kontur mit den
Schnittknoten, falls Features den Rand kreuzen – hält die Wände topologisch dicht).

`mesh-builder.ts` baut daraus eine **geschlossene 2.5D-Hülle** (y wird nach oben gespiegelt, z nach oben):

| Modus | Aufbau |
|---|---|
| erhaben | Boden `O` (z=0, −z) · Wände `O` (0…base) · Deckel `O−F` (z=base) · Wände `F∩O` (base…base+h) · Deckel `F∩O` (z=base+h) |
| graviert | Boden `O` · Wände `O` (0…base−t) · Taschenböden `F∩O` (z=base−t) · Wände `O−F` (base−t…base) · Deckel `O−F` (z=base) |
| Durchbruch (t ≥ base) | Boden/Wände/Deckel von `O−F` – eine Schablone |

Deckel werden mit `earcut` trianguliert (Löcher unterstützt); die Orientierung wird pro Dreieck aus dem Vorzeichen des Kreuzprodukts hergestellt. Wände entstehen pro Ring mit nach außen zeigender Normale (Ringfläche + Loch/Außenring entscheiden die Wicklung). Ergebnis in Tests: 0 doppelte Kanten, 0 offene Kanten – in allen Modi, auch bei beschnittenen Features.

## Renderer

- **svg-renderer**: `buildSvgScene(def)` → typisierte Primitive (`line`, `circle`, `path`) mit Ebene, Strichbreite, `tickId`. `serializeSvg(scene)` schreibt daraus das Exportdokument (mm, `viewBox` in mm, Ebenen als `<g id>` mit Inkscape-Labels). Die Vorschau mappt dieselben Primitive auf React-Elemente.
- **canvas-renderer**: orthografische Projektion des Meshes, Painter-Sortierung, Lambert-Schattierung, Backface-Culling – zeigt im Exportdialog das tatsächliche STL/OBJ.

## State (`store.ts`, Zustand)

```
present: ScaleParams | null   past: ScaleParams[]   future: ScaleParams[]
name, savedId, savedAt, selectedTickId, hydrated
```

- `commit(next, coalesceKey)` ist der einzige Weg, `present` zu ändern. Gleicher Schlüssel innerhalb von 1,2 s → kein neuer Verlaufseintrag (Tipp-Bursts).
- `patch(section, values)` für Felder, `setType`, `toggleTickHidden`, `toggleLabelHidden`, `newScale`, `loadScale`.
- `persist` speichert nur `present`, `name`, `savedId`, `savedAt` in `localStorage` (Reload verliert keine Arbeit). `merge` läuft durch `coerceParams`, damit alte Datenformate nie die Engine erreichen. `skipHydration` + `rehydrate()` im Effekt vermeiden Hydration-Mismatch.

## Server

Next.js App Router, PostgreSQL via Drizzle. Tabelle `scales(id, name, type, params jsonb, created_at, updated_at)`.
Die API speichert ausschließlich Parameter – Geometrie wird beim Öffnen neu berechnet. Eingaben werden mit
`coerceParams` normalisiert; ungültige Payloads erhalten 400 mit Klartext.

## UI-Bausteine

shadcn/ui-Komponenten (new-york, CSS-Variablen, Tailwind v4 `@theme inline`) liegen als Quellcode in `components/ui`.
Radix liefert Fokusmanagement, Escape-Verhalten und ARIA. `lucide-react` für Icons, `motion` nur für zwei dezente Übergänge (Hover-Tooltip, Leerzustand).

## Performance-Entscheidungen (gemessen, nicht geraten)

- Vorschau-Ebenen sind `React.memo`: `StaticLayer` (Inhalt) und `HitLayer` (Trefferflächen) hängen nur von Szene + Zoom ab. Hover/Auswahl zeichnen zusätzliche Primitive darüber – kein Re-Render der 1 000 Striche pro Mausbewegung.
- Ein Pointer-Handler pro SVG (Event-Delegation über `data-tick-id`), statt 2 000 Handler.
- Mesh-Erzeugung nur im Exportdialog, 120 ms entprellt; SVG/DXF sofort.
- Nicht optimiert, weil nicht nötig: Web Worker für Meshes (1,3 s bei 1 000 Strichen sind ein Exportvorgang, kein Live-Pfad).

## Testbarkeit

`core/` hat keine React-Abhängigkeit und läuft unter Node (`npx tsx`). Während der Entwicklung wurden Engine, alle vier Exporter und die Wasserdichtigkeit der Meshes (Kantenpaarung) so verifiziert.
