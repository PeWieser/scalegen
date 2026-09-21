# DESIGN.md — Scale Generator

Gestaltungsgrundsätze, Entscheidungen und bewusste Auslassungen.

---

## 1. Was das Produkt ist — und was nicht

> „Ich möchte eine präzise technische Skala erzeugen und als CAD-/CAM-taugliche Datei exportieren."

Das ist der gesamte Auftrag. Der Scale Generator erzeugt **eine** Sache: parametrische
Teilstrichskalen für Messgeräte, Frontplatten, Drehknöpfe, Instrumente und CNC/CAM.
Alles andere ist ausgeschlossen.

| Es ist | Es ist nicht |
| --- | --- |
| Ein Skalen-Rechner mit Export | Ein allgemeiner SVG-Editor |
| Ein Werkzeug für Millimeter und Werte | Ein Design-/Grafikprogramm |
| Eine Bühne: Eingabe links, Ergebnis rechts | Ein Dashboard mit Projekten und Diagrammen |
| Ein Geometrieerzeuger (Vektor + 3D) | Ein CAD-System mit Bemaßung und Konstruktion |

**Fokus heißt Nein sagen.** Die Liste der nicht gebauten Funktionen ist in Abschnitt 5
vollständig begründet. Sie ist Teil des Produkts, nicht seine Lücke.

---

## 2. Leitsätze und wie sie umgesetzt sind

### Weniger Denkarbeit statt weniger Knöpfe
Es gibt genau **eine** Parameterspalte, in fester Reihenfolge: Skalentyp → Geometrie →
Wertebereich → Hauptteilungen → Unterteilungen → Beschriftung → 3D/Extrusion → Ablage.
Keine Tabs, keine Ebenen, keine Dialoge für Parameter. Wer „0 bis 80, Halbkreis" denkt,
liest die Reihenfolge von oben nach unten ab und ist fertig.

### Direkte Manipulation
- Das Label eines jeden Zahlenfeldes ist ein **Ziehgreifer** (Cursor `ew-resize`). Ziehen
  ändert den Wert in Echtzeit (Umschalt ×5, Alt ×0,2).
- Teilstriche sind in der Vorschau **selektierbar**. Hover zeigt in der CSS-Transition (90 ms),
  was gewählt wird; ein Klick setzt die Auswahl und zeichnet einen Führungstrich mit
  Wert-Callout. Rechts oben steht der Ableser mit Art, Winkel/Abstand und Linienbreite.
- Pfeil ←/→ wandert von Marke zu Marke (Tastatur), Esc hebt die Auswahl auf.

### Export ist das Produkt
Der Exportdialog ist die größte Fläche der Anwendung, mit echter Dateivorschau,
echter Dateigröße, Einheit, Maßstab, Dreieckszahl und ehrlichen Hinweisen.
Der Primärbutton des Produkts lautet „Exportieren".

### Ehrliche Zustände
- Warnungen (nicht ganzzahlig geteilte Bereiche, begrenzte Markenlänge, Beschriftung über
  dem Außenradius, abgeschnittene Markenanzahl) erscheinen **sofort im Schriftfeld** und
  im Titelblock — nicht erst beim Export.
- Im 3D-Export steht fett und ohne Beschönigung: „Beschriftung ist 2D-Geometrie und in
  3D-Formaten nicht enthalten." Ein STL kann keine Textobjekte haben; das wird nicht
  verschwiegen.
- „Vorschau = Export" — weil technisch wahr.

### Keine Dark Patterns
Keine Cookie-Banner, keine künstliche Verknappung, kein „Nur heute", keine versteckten
Kosten, keine Nutzungsdaten. Es gibt kein Konto und keinen Dienst: Die Ablage liegt im
`localStorage` des eigenen Browsers und lässt sich als JSON-Datei sichern. Nichts wird
übertragen — es gibt keinen Server, der etwas empfangen könnte.

### Keine unnötigen Einstellungen
Jede Eingabe verändert die Geometrie. Es gibt keine Präferenzen, keine Themes, keine
Sprachauswahl, keine Einheitenwahl (Produktentscheidung: **Millimeter, immer**, Abschnitt 5).

### Jeder Klick erhält sichtbares Feedback
Alle Bedienelemente haben Übergänge (90–180 ms) für Farbe und Zustand. Der Primärbutton
hat `:active`. Das Zahlenfeld zeigt den Fokus in Signalblau. Das Sichern zeigt „Sichert …".
Der Export lädt eine echte Datei herunter — der Klick endet nicht im Nichts.

### Jede Funktion hat genau einen Ort
Undo/Redo im Kopf. Neue Skala unten im Panel **und** im Leerzustand (beide Male derselbe
Vorgang, an dessen natürlicher Stelle). Export ausschließlich im Kopf. Sichern ausschließlich
in der Ablage.

---

## 3. Visuelle Richtung

**Reales Vorbild:** ein eloxiertes Aluminium-Messgerätefrontpanel aus der Werkstatt —
siebbedruckte, gesperrte Mikrotext-Beschriftung, gravierte Teilstriche — gekreuzt mit dem
**Schriftfeld einer technischen Zeichnung nach DIN**. Das übernommene Merkmal ist das
Schriftfeld: Die Kennwerte stehen unten als gekastelter Titelblock, nicht als lose Statistik.

### Oberfläche und Palette
Dunkel nicht als Stil, sondern als Material: Anodisierung.

| Rolle | Wert | Herkunft |
| --- | --- | --- |
| Grundfläche | `#0B0E12` | eloxiertes Aluminium im Schatten |
| Panel / Erhebung | `#11151B` / `#161B22` / `#1C222B` | gestufte Bleche |
| Haarlinien | `#20272F` / `#2C343E` | Fugen zwischen Frontplattenfeldern |
| Text / gedämpft / faint | `#E7EDF3` / `#8A97A6` / `#5E6A78` | Siebdruckweiß, gestuft, nie reines Grau |
| **Akzent** | `#2F6BFF` | Signalblau: **nur** Fokus, Auswahl, Primäraktion |
| Zustand Warnung | `#D8A13A` | Bernstein, ausschließlich als Zustand |

Der Akzent darf nicht dekorieren. Deshalb ist er genau an drei Stellen sichtbar:
Fokusring, gewählter Teilstrich, Primärbutton (und der Führungsstrich des Callouts —
derselbe Sachverhalt „Auswahl").

### Typografie
**Geist Sans** für Texte, **Geist Mono** für jede Zahl — mit `font-variant-numeric:
tabular-nums`, damit Werte beim Ziehen nicht zappeln. Skala als Verhältnis 1.25
(11 · 13 · 16 · 20 · 25 · 31 px). Persönlichkeitsträger: **gesperrte Versalien-Mikrolabels**
(10 px, `letter-spacing .18em`) wie Siebdruckbeschriftung auf Frontplatten.

### Layoutentscheidung gegen den Default
Kein zentrierter Content-Container, keine Kachelwand. Vollflächige Bühne mit
**Millimeter-Maßstäben an Ober- und linkem Rand**, die live mit Zoom und Pan mitlaufen,
und einem Schriftfeld am Fuß. Die Anwendung sieht aus wie eine Zeichnung auf dem
Rasterbock, nicht wie ein SaaS-Panel. Links eine einzige Säule (360 px) ohne Cards.

### Bewegung
Maschinelle Präzision: Geometrie ohne Nachlauf (<100 ms), Farbwechsel 90 ms,
Dialogfahrt 180 ms (`cubic-bezier(.2,.8,.2,1)`), Panel-Einschub 220 ms.
`prefers-reduced-motion` schaltet alles auf nahezu 0 ms.

---

## 4. Zugänglichkeit

- Alle Bedienelemente sind nativ fokussierbar, mit sichtbarem Fokusring in Signalblau.
- Esc beendet jeden Modus: Exportdialog schließen, Auswahl aufheben.
- Die Bühne hat `tabIndex=0` und ist mit ←/→, `+`/`-`, `0`, Esc vollständig über die
  Tastatur bedienbar. Zahlenfelder reagieren auf ↑/↓ (Umschalt ×10, Alt ×0,1) und Eingabe.
- Segmented Controls sind `role="radiogroup"`/`radio`, Schalter `role="switch"`.
- Jedes Icon hat einen `aria-label` **und** einen Tooltip mit ehrlichem Text („Rückgängig (⌘Z)").
- Kontraste: Text `#E7EDF3` auf `#0B0E12` ≈ 15:1, gedämpft `#8A97A6` ≈ 6,5:1.
- Beschriftung in der Vorschau und im Export ist echter Text (SVG `<text>`, DXF `TEXT`),
  nicht in Pfade konvertiert — er bleibt editierbar und maschinenlesbar.

---

## 5. Was **nicht** gebaut wurde — und warum

| Nicht gebaut | Begründung |
| --- | --- |
| **Bemaßung, Toleranzen, Passungen** | Das ist CAD. Die Skala liefert Geometrie, nicht Konstruktion. |
| **Freie Beschriftungstexte, Einheitenzeichen, Logo-Import** | Der Wert ist die Beschriftung. Eigene Texte öffnen die Tür zum Schrifteditor. |
| **Schriftartenwahl / Buchstabenabstände** | Eine technische Skala braucht Lesbarkeit, keine Typografie-Werkzeuge. Fest: Geist Sans für Exporttext. |
| **Schriftpfade im STL/OBJ** | Ein STL kennt keine Textobjekte. Echtes Gravieren von Buchstaben erfordert einen Vektorfont-Tessellierer — das ist ein eigenes Produkt. Stattdessen: ehrlicher Hinweis im Exportdialog. |
| **Einheitenauswahl (inch, deg/cm)** | Zwei Einheitenwelten verdoppeln jede Zahl im Kopf. Produktentscheidung: Millimeter, immer, 1:1. Steht im Kopf und im Exportdialog. |
| **Markenrichtung nach außen** | Der Teilkreis ist die Ankerlinie, Marken wachsen nach innen — das deckt Frontplatten und Drehknöpfe ab. Eine zweite Richtung verdoppelt die Geometriefälle und die Denkarbeit. |
| **Beliebige Tick-Folgen (logarithmisch, nichtlineare Skalen)** | Eine logarithmische Skala verändert die Aussage des Werkzeugs fundamental (Werteanzeige statt Werteeinteilung). |
| **Graduation aus Tabellen/CSV** | Importformate sind ein eigenes Produktversprechen. |
| **Layer, Farben, Linientypen in DXF** | Eine Skala hat zwei Lagen: `SKALA` und `BESCHRIFTUNG`. Mehr ist Zeichnungsorganisation. |
| **Vorschau-Rotation in 2D, Bemaßungs-Raster einstellbar** | Das Raster ist 10 mm fest. Eine Einstellung, die niemand ändert, ist eine Einstellung zu viel. |
| **Accounts, Cloud, Teilen, Versionsverlauf** | Kein Dark Pattern, keine Plattform. Die Anwendung ist eine statische Seite für Cloudflare Pages; die Ablage liegt im Browser und lässt sich als Datei sichern. |
| **Server, Datenbank, API-Routen** | Gefordert ist eine rein clientseitige Anwendung. Alles rechnet im Browser; es gibt keinen Datenverkehr außer dem Laden der Seite selbst. Siehe `ARCHITECTURE.md`, Abschnitt 9 (Deployment). |
| **Live-Kollaboration, Mobile Editing** | Ein Frontplattenbauer sitzt am Rechner mit CAD daneben. Die Ansicht bleibt responsiv und benutzbar, aber es gibt keine dedizierte Mobile-Erfahrung. |
| **Automatisches Nachführen des Fit-to-View bei jeder Änderung** | Wäre eine störende Bewegung beim Ziehen. Fit erfolgt beim Öffnen und bei Typwechsel, sonst auf Knopfdruck (Taste 0). |
| **Undo für Auswahl und Zoom** | Undo gilt dem **Dokument**, also den Parametern. Ansicht ist kein Dokumentinhalt. |

---

## 6. Undo/Redo

**Zustandsbasiert, nicht aktionsbasiert.** Der Store hält `present`, `past`, `future` —
jede Änderung legt die komplette vorherige Parameterbelegung ab (max. 120 Stufen).
Es gibt keinen Patch-Rückweg, der Fehler reproduzieren könnte: Zurückzugehen bedeutet
wörtlich, einen früheren Zustand wieder einzusetzen.

- Jede Änderung — Radius, Winkel, Teilung, Label — ist rückgängig machbar.
- Zieh-Vorgänge (Scrubbing) fassen eine Bewegung zu **einer** Stufe zusammen
  (`transient` + `endEdit`), damit ein Wisch nicht 200 Stufen füllt.
- Geometrie liegt bewusst **nicht** im Store. Sie wird aus `present` berechnet
  (`useMemo`), was Undo billig und die App schnell hält.

## 7. Performance

Ziel: 1000 Teilstriche flüssig bearbeitbar.

- Geometrieberechnung ist ein `useMemo` über den Parameter-Zustand — keine Berechnung
  im Renderpfad, kein Re-Render ohne Zustandsänderung.
- Teilstriche sind Pfade mit einer CSS-Klasse. Der Hover läuft über **eine** delegierte
  Zeigerbehandlung und reine CSS-Transitions — React rendert bei Hover nicht neu.
- Die 3D-Vorschau rendert auf `<canvas>` (WebGL wäre Overkill), mit zwischengespeichertem
  Dreiecksnetz je Höhenfeld und rAF-Entprellung beim Drehen.
- Reihenfolge der Optimierung: erst Korrektheit, dann Messbarkeit. Es gibt keine
  vorsorglichen Memo-Schichten außer den drei oben genannten.
