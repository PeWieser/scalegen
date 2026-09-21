# Scale Generator

Technische Skalen für Messgeräte, Frontplatten, Drehknöpfe, Instrumente und CNC/CAM —
parametrisch erzeugt und als **SVG, DXF, STL und OBJ** exportiert.

**Alles läuft im Browser.** Es gibt keinen Server, keine Datenbank, keine API, kein Konto.
Die Anwendung ist eine statische Seite und wird auf **Cloudflare Pages** ausgeliefert.

> Mission: „Ich möchte eine präzise technische Skala erzeugen und als CAD-/CAM-taugliche
> Datei exportieren." Nichts anderes. Kein SVG-Editor, kein CAD, kein Dashboard.

Dokumentation: [DESIGN.md](DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[EXPORT_FORMATS.md](EXPORT_FORMATS.md)

---

## 1. Deploy auf Cloudflare Pages — in 5 Minuten

### A) Über Git (empfohlen)

1. **Repo aufräumen.** Im Repository liegen zwei Quellbäume nebeneinander; der zweite
   (`src/core/**`, `src/features/scale-editor/**`, `src/app/api/**`, `src/db/**`) ist toter
   Code und **bricht den Build**. Ein Befehl entfernt ihn:

   ```bash
   bash scripts/cleanup-stale.sh
   node scripts/check-deploy.mjs     # muss „BEREIT ZUM DEPLOYEN" ausgeben
   git add -A && git commit -m "Server-Code entfernt, rein clientseitig" && git push
   ```

2. **Cloudflare Dashboard** → *Workers & Pages* → *Create* → *Pages* → *Connect to Git*
   → Repository `scalegen` auswählen.

3. **Build-Einstellungen** exakt so eintragen:

   | Feld | Wert |
   | --- | --- |
   | Framework preset | *Next.js (Static HTML Export)* — oder *None* |
   | Build command | `NEXT_STATIC_EXPORT=1 npm run build` |
   | Build output directory | `out` |
   | Root directory | *(leer)* |
   | Environment variables | `NEXT_STATIC_EXPORT` = `1` |

4. **Save and Deploy.** Fertig. Die URL lautet `https://<projekt>.pages.dev`.

### B) Direkt-Upload (ohne Git)

```bash
npm ci
NEXT_STATIC_EXPORT=1 npm run build      # erzeugt ./out
npx wrangler pages deploy out --project-name=scalegen
```

### Warum genau diese Einstellungen

- `NEXT_STATIC_EXPORT=1` schaltet in `next.config.ts` `output: "export"` ein. Cloudflare
  setzt beim Build zwar selbst `CF_PAGES=1` (wird ebenfalls erkannt), aber die explizite
  Variable macht den Export **unabhängig von jeder Erkennung**. Ohne sie entstünde ein
  Server-Build — und dann gäbe es kein `out/`, das Cloudflare ausliefern könnte.
- Build-Ausgabeordner **`out`** (nicht `.next`, nicht `dist`).
- **Keine Umgebungsvariablen für die Laufzeit nötig.** Es wird nichts nachgeladen, keine
  Datenbank verbunden. `NEXT_STATIC_EXPORT` wirkt nur beim Build.
- `public/_headers` wird mitkopiert und setzt die Antwortköpfe (Health als JSON ohne
  Cache, Bilder und `_next/static/*` unveränderlich mit langem Cache).

---

## 2. Wenn der Build fehlschlägt

Die beiden bisher aufgetretenen Fehler und ihre Ursache — beide liegen an Dateien, die
**nicht** zu dieser Anwendung gehören:

| Fehler im Log | Ursache | Lösung |
| --- | --- | --- |
| `Cannot find module '@radix-ui/react-label'` in `src/components/ui/label.tsx` | shadcn-CLI-Datei ohne installiertes Paket | Paket ist inzwischen in `package.json`; alternativ Datei löschen |
| `Cannot find module 'polygon-clipping'` in `src/core/exporters/dxf-exporter/index.ts` | fremder Quellbaum `src/core/**` | `bash scripts/cleanup-stale.sh` |
| `export const dynamic = "force-dynamic"` / *API Routes cannot be used with output: export* | Route-Handler unter `src/app/api/**` | `bash scripts/cleanup-stale.sh` |
| `DATABASE_URL is required` | `src/db/index.ts` aus dem PostgreSQL-Template | `bash scripts/cleanup-stale.sh` |
| *Build output directory "out" does not exist* | `output: "export"` war nicht aktiv | Build-Befehl und Env-Variable wie oben setzen |

Selbstprüfung vor jedem Push:

```bash
node scripts/check-deploy.mjs
```

Das Skript prüft ohne Build in Sekunden: Server-only-Code, tote Quellbäume, fehlende
Paketdeklarationen, nötige Dateien und die Vollständigkeit der Anwendung. Exit-Code 0
heißt: deploybar.

---

## 3. Lokal entwickeln

```bash
npm install
npm run dev          # http://localhost:3000
```

Statischen Export wie auf Cloudflare erzeugen und ansehen:

```bash
NEXT_STATIC_EXPORT=1 npm run build
npx serve out        # oder: python3 -m http.server -d out 3000
```

Geometrie und Exporte ohne Browser prüfen:

```bash
npx tsx scripts/verify-export.ts
```

Das liefert für vier Szenarien (Halbkreis/Gravur, Vollkreis/Positiv, gerade Linie mit
Dezimalwerten, 500 Marken) die Prüfungen: SVG-Pfade je Marke, DXF-Konturen und Texte,
STL-Binärlänge und Dreieckszahl, OBJ-Vertices/Flächen und **geschlossene 3D-Körper**
(jede Kante genau zweimal belegt).

---

## 4. Bedienung

Der Erfolgsweg ist drei Klicks lang: **Halbkreis** → **0 bis 80** → **Exportieren**.

```
┌──────────────────────────────────────────────────────────────┐
│ Scale Generator            [↶] [↷]  [ Exportieren ]          │
├───────────────────┬──────────────────────────────────────────┤
│ Skalentyp         │                                          │
│ Geometrie         │            Live-Vorschau                 │
│ Wertebereich      │   (Zoom · Pan · Fit · Marke wählen)      │
│ Hauptteilungen    │                                          │
│ Unterteilungen    │                                          │
│ Beschriftung      │                                          │
│ 3D / Extrusion    │                                          │
│ Ablage            │                                          │
├───────────────────┴──────────────────────────────────────────┤
│ Schriftfeld: Typ · Bereich · Teilung · Marken · Ausdehnung   │
└──────────────────────────────────────────────────────────────┘
```

- **Direkte Manipulation.** Jedes Zahlenlabel ist ein Ziehgreifer — ziehen ändert den Wert
  (Umschalt ×5, Alt ×0,2). Teilstriche sind in der Vorschau wählbar; Pfeiltasten wandern
  von Marke zu Marke.
- **Tastatur.** `⌘Z` / `Strg+Z` rückgängig, `Umschalt+⌘Z` wiederholen, `0` einpassen,
  `+`/`-` zoomen, `Esc` schließt Dialog und Auswahl.
- **Undo/Redo** ist zustandsbasiert: jede Änderung von Radius, Winkel, Teilung oder
  Beschriftung lässt sich zurücknehmen.
- **Ablage** liegt im `localStorage` dieses Browsers und lässt sich als JSON-Datei sichern
  und wieder einlesen (Bereich „Ablage"). Nichts verlässt den Rechner.
- **Exportdialog** zeigt die echte Datei: Vektorvorschau für SVG/DXF, schattierte
  3D-Ansicht derselben Geometrie für STL/OBJ (mit Ziehen drehbar), dazu Dateigröße,
  Einheit, Maßstab, Dreieckszahl und ehrliche Hinweise.

### Skalentypen und Parameter

| Gruppe | Parameter |
| --- | --- |
| Typ | Kreis · Halbkreis · Kreisbogen · Gerade Linie |
| Geometrie | Radius, Startwinkel, Endwinkel, Innenradius, Außenradius — bei linear: Länge, Orientierung |
| Wertebereich | Minimalwert, Maximalwert (z. B. 0→80, −20→120, 0→1) |
| Hauptteilungen | Abstand, Länge, Linienbreite |
| Unterteilungen | Anzahl **oder** Schrittweite, Länge, Linienbreite |
| Beschriftung | ein/aus, Schriftgröße, Position innen/außen, Abstand |
| 3D | Modus positiv/Gravur, Plattenstärke, Reliefhöhe/Gravurtiefe, Linienbreite |

Alle Winkel: 0° = 3 Uhr, positiv gegen den Uhrzeigersinn. Alle Längen: Millimeter.

### Exportformate

| Format | Inhalt | Einheit / Maßstab |
| --- | --- | --- |
| **SVG** | Marken als gefüllte Pfade, Beschriftung als `<text>` | mm / 1:1 |
| **DXF** | R12 (AC1009), geschlossene `POLYLINE` je Marke, `TEXT` je Beschriftung, Lagen `SKALA` + `BESCHRIFTUNG` | mm / 1:1 |
| **STL** | binär, echter 3D-Körper mit Gravurkanälen bzw. Relief | mm / 1:1 |
| **OBJ** | Wavefront, `v`/`f`-Listen, dieselbe Geometrie wie STL | mm / 1:1 |

STL und OBJ enthalten **keine Beschriftung** — ein STL kennt keine Textobjekte. Das steht
so im Exportdialog. Details: [EXPORT_FORMATS.md](EXPORT_FORMATS.md).

---

## 5. Aufbau

```
src/
├─ lib/
│  ├─ scale-engine/     # Kern: Parameter → Geometrie → Höhenfeld → Dreiecksnetz
│  ├─ svg-renderer/     # Weltkoordinaten → SVG (Vorschau + Export)
│  ├─ canvas-renderer/  # isometrische Schattierung der 3D-Geometrie
│  ├─ exporters/        # svg-, dxf-, stl-, obj-Exporter
│  └─ storage.ts        # Ablage im localStorage + JSON-Sicherung
├─ components/ui/       # Button, Felder, Dialog, Tooltip
├─ features/
│  ├─ scale/            # Workbench, EmptyState, TitleBlock, AblageActions
│  ├─ parameters/       # ParameterPanel — die einzige Eingabeebene
│  ├─ stage/            # Bühne + useDefinition()
│  └─ export/           # Exportdialog
└─ store/editor.ts      # Zustand: Parameter + zustandsbasiertes Undo/Redo
```

Der Kern liegt unter `src/lib/scale-engine` und ist **React-frei und damit testbar**:
`buildScale()` macht aus Parametern eine `ScaleDefinition`, `mesh.ts` macht daraus einen
geschlossenen 3D-Körper. Jede Marke ist ein geschlossenes Viereck — SVG füllt es, DXF gibt
es als Kontur aus, STL extrudiert es. Deshalb gilt: **Export = Vorschau.**

Geometrie wird nie gespeichert, nur berechnet; der State enthält ausschließlich Parameter.
Details und Begründungen: [ARCHITECTURE.md](ARCHITECTURE.md).

## 6. Technik

Next.js 16 (App Router, statischer Export) · TypeScript strict · Tailwind CSS 4 ·
shadcn/ui · lucide-react · Motion · Zustand · Geist Sans/Mono.

Optional aufräumen — die PostgreSQL-Reste des Ursprungstemplates werden nicht benutzt:

```bash
npm rm pg drizzle-orm dotenv drizzle-kit @types/pg
```
