# DESIGN.md – Scale Generator

> „Ich möchte eine präzise technische Skala erzeugen und als CAD-/CAM-taugliche Datei exportieren.“

Dieses Dokument begründet jede Designentscheidung. Es ist bewusst auch eine Liste dessen,
was **nicht** gebaut wurde – denn Fokus heißt Nein sagen.

---

## 1. Der eine Auftrag

Das Produkt löst genau ein Problem. Alles im UI ist auf den 30-Sekunden-Pfad ausgerichtet:

1. **Halbkreis** wählen (Skalentyp, erste Sektion links)
2. **0 bis 80** eingeben (Wertebereich, zweite Sektion)
3. **Haupt-/Unterteilung** festlegen (dritte und vierte Sektion)
4. **Exportieren → DXF → herunterladen** (blauer Button rechts oben, `Strg+E`)

Die Reihenfolge der Sektionen im Parameterpanel ist die Reihenfolge, in der ein Mensch über eine Skala nachdenkt:
Form → Maße → Werte → Teilung → Beschriftung. Es gibt keine Tabs, keine Unterdialoge, keine zweite Ebene.

## 2. Bühne: links Eingabe, rechts Ergebnis

- **Links (360 px):** alle Parameter, scrollbar, eine Spalte.
- **Rechts:** die Vorschau. Sie ist das Zentrum – jede Eingabe ist dort sofort sichtbar.
- **Kopfzeile:** Name, Undo/Redo, Neu, Bibliothek, Exportieren. Sonst nichts.

Jede Funktion hat genau **einen** Ort:

| Funktion | Ort |
|---|---|
| Parameter der Skala | Parameterpanel |
| 3D-Parameter (Relief, Plattenstärke, Höhe/Tiefe) | Exportdialog, Tab STL/OBJ – weil sie nur dort Wirkung haben und dort live in 3D sichtbar sind |
| Kontur mitexportieren, DXF-Geometriemodus | Exportdialog, Tab SVG/DXF |
| Einzelne Striche/Beschriftungen ausblenden | Auswahl in der Vorschau → Auswahlkarte oben im Panel |
| Speichern/Öffnen | Bibliothek |

## 3. Weniger Denkarbeit statt weniger Knöpfe

Wir haben Eingabefelder nicht versteckt, sondern **Entscheidungen** entfernt:

- **Winkelkonvention:** 0° = 12 Uhr, im Uhrzeigersinn positiv – so denken Instrumentenbauer. Ein 270°-Messwerk ist `−135° … 135°`, ein Halbkreis `−90° … 90°`.
- **Kreis und Halbkreis haben einen festen Endwinkel.** Er wird angezeigt („(fest)“), aber nicht abgefragt. Wer freie Winkel will, nimmt „Kreisbogen“.
- **Beschriftungsdezimalen werden abgeleitet** aus Schrittweite und Minimalwert (`0.25` → zwei Nachkommastellen). Kein Formatfeld.
- **Labels sitzen automatisch kollisionsfrei:** Die Box jedes Labels wird tangential an einen Freiraumkreis gelegt (Radius ± Strichlänge ± Abstand). Bei „100“ auf 3 Uhr rückt das Label so weit nach innen, dass die Box den Strich nicht berührt – ohne dass der Nutzer rechnet.
- **Kontur linearer Skalen** ergibt sich aus dem Inhalt plus 3 mm Rand. Kein weiteres Feld.
- **Voller Kreis:** Der Strich bei `max` fällt auf `min` und wird automatisch weggelassen (0 = 360).
- **Standardwerte sind druckbar:** 0–100, Hauptteilung 10, 4 Unterteilungen, 4 mm Schrift, 0,6/0,3 mm Linien, Ø 100 mm Scheibe.

## 4. Direkte Manipulation

- **Hover** in der Vorschau hebt den Strich (und sein Label) hervor und sagt, was er ist und was ein Klick tut: „Hauptteilstrich 40 · Klicken zum Auswählen“.
- **Klick** wählt aus. Die Auswahlkarte zeigt Wert, Winkel, Position, Länge – und die zwei möglichen Aktionen: Strich ausblenden, Beschriftung ausblenden.
- **Entf** blendet aus, **Esc** hebt die Auswahl auf. Ausgeblendete Striche bleiben als gestrichelte Geister sichtbar und anklickbar – ehrlicher Zustand, kein Verschwinden.
- Zoom (Rad, `+`/`−`), Pan (Ziehen), Einpassen (`F`, Doppelklick), 100 % (`0`) = reale Größe bei 96 dpi.

**Nicht gebaut: Ziehen von Strichen zur Änderung der Teilung.** Die Semantik ist mehrdeutig (ändert sich die Schrittweite, der Bereich oder nur dieser Strich?) und für technische Arbeit ist die Zahleneingabe präziser. Auswahl + Tastatur ist die ehrliche Form direkter Manipulation für dieses Problem.

## 5. Ehrliche Zustände

- **Warnungen stehen in der Vorschau**, nicht in einem Log: ungültiger Bereich, Teilstriche außerhalb der Kontur (mit dem tatsächlichen r-Bereich), überlappende Beschriftungen, zu viele Striche (Obergrenze 5 000, wird genannt), Gravurtiefe ≥ Platte.
- **Kein Ladeindikator** in der Vorschau – es gibt nichts zu laden, die Engine rechnet in Millisekunden. Im Exportdialog steht ehrlich „berechnet …“, wenn ein Mesh gerade entsteht.
- **Export zeigt die Datei selbst:** SVG/DXF-Vorschau wird aus dem exportierten Dokument gerendert, STL/OBJ als schattiertes Rendering des tatsächlichen Dreiecksnetzes. Dazu Dateigröße, Einheiten (mm), Maßstab (1:1), Ebenen, Dreieckszahl, und ein Hinweis, wenn Geometrie am Körper beschnitten wurde.
- **Undo-Tooltip sagt „Nichts rückgängig zu machen“** statt stumm deaktiviert zu sein.
- **Leerer Zustand:** eine Einladung, ein Button. „Gespeicherte öffnen“ erscheint nur, wenn es tatsächlich gespeicherte Skalen gibt – kein toter Button.
- Jeder Klick antwortet sichtbar: Download → „Heruntergeladen: name.dxf“, Speichern → „Gespeichert“, Auswahl → blaue Hervorhebung.

## 6. Visuelle Hierarchie

- **Dark First**, genau ein Thema. Kein Theme-Switch (eine Einstellung weniger).
- **Geist Sans** für Text, **Geist Mono** für jede Zahl (Eingaben, Statuszeile, Fakten, Tooltips mit Werten). `font-variant-numeric: tabular-nums` global – Zahlen springen nicht.
- **Eine Akzentfarbe: Blau.** Sie bedeutet Fokus (Ring), Auswahl (Strich, Auswahlkarte), primäre Aktion (Exportieren, Neue Skala, Speichern). Sie dekoriert nichts. Warnungen sind bernstein, Fehler rot – beides sparsam.
- Fokus ist überall sichtbar (`:focus-visible` mit Ring), Tab-Reihenfolge folgt der Lesereihenfolge.

## 7. Undo/Redo: zustandsbasiert

Der Verlauf speichert komplette `ScaleParams`-Objekte, keine Aktionen. Dadurch ist jede Änderung – Radius, Winkel, Teilung, Label, Ausblenden, Typwechsel, sogar „Neu“ – rückgängig machbar, ohne dass irgendwo eine inverse Aktion implementiert sein müsste.
Tipp-Bursts im selben Feld (1,2 s) werden zu einem Schritt zusammengefasst, damit „80“ nicht zwei Undo-Schritte kostet. Limit: 200 Schritte.

## 8. Was bewusst fehlt (und warum)

| Nicht gebaut | Warum |
|---|---|
| Freier SVG-Editor, Formen, Text, Farben | Nicht das Problem. Wer gestalten will, importiert unser SVG in Inkscape. |
| Logarithmische / nichtlineare Skalen | Andere Domäne (Rechenschieber, Audio). Die Engine könnte es (Mapping `t → Wert` ist eine Funktion), das UI müsste eine zweite Denkweise einführen. Bewusst vertagt. |
| Zeiger, Ziffernblatt-Deko, Logos | Instrumentendesign, nicht Skalenerzeugung. |
| TrueType-Fonts für Beschriftung | Erzeugt Font-Abhängigkeit im Ziel-CAD, Konturen mit hunderten Knoten und unklare Gravurbreite. Die integrierte Single-Stroke-Schrift ist in allen vier Formaten identisch und direkt fräsbar. |
| Dezimaltrennzeichen-Option | Die Strichschrift kennt `,` – aber jede Option kostet Denkarbeit. Punkt ist die internationale technische Konvention. |
| Mehrere Skalen in einem Dokument | Eine Skala = eine Datei. Zusammenbau passiert im CAD. |
| Zoll als Einheit | Millimeter ist die CAM-Konvention; jedes CAM skaliert beim Import. Zwei Einheiten würden jede Zahl im UI mehrdeutig machen. |
| Theme-Switch, Sprachwahl, Layout-Optionen | Einstellungen, die nichts an der Skala ändern. |
| Cloud-Konten, Teilen, Kommentare | Dashboard-Denken. Die Bibliothek speichert Parameter, mehr nicht. |
| Tick-Drag zur Teilungsänderung | Siehe Abschnitt 4. |

## 9. Tastatur

`Strg+Z` / `Strg+⇧+Z` Undo/Redo · `Strg+E` Export · `Strg+S` Bibliothek · `F` Einpassen · `+`/`−`/`0` Zoom · `Esc` Auswahl/Dialog/Feld verlassen · `Entf` ausgewählten Strich ausblenden · `↑`/`↓` in Zahlenfeldern (⇧ ×10, ⌥ ÷10) · `Strg+↵` im Exportdialog lädt herunter.

## 10. Performance-Haltung

Zuerst Korrektheit. Gemessen: 1 000 Striche berechnet die Engine in ~6 ms, die Vorschau rendert sie als statische SVG-Ebene, die nur bei Parameter- oder Zoomänderung neu entsteht. Hover und Auswahl zeichnen nur die betroffenen Primitive darüber (Event-Delegation statt 1 000 Handler). Mesh-Erzeugung (~0,1–1,3 s bei 1 000 Strichen) passiert nur im Exportdialog, leicht entprellt, und wird ehrlich als „berechnet …“ angezeigt.
