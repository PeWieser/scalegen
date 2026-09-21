# EXPORT_FORMATS.md — Scale Generator

Alle vier Formate lesen **dieselbe Geometriequelle**: `ScaleDefinition` aus
`lib/scale-engine`. Es gibt für kein Format eine zweite Zeichenroutine.

**Für alle Formate:** Einheit **Millimeter**, Maßstab **1:1** (1 Einheit = 1 mm),
Weltkoordinaten mit **y nach oben** (CAD-Konvention), Ursprung wie in der Vorschau.

Grundregel: *Export = Vorschau.* Was im dunklen Feld rechts zu sehen ist, steht in der Datei.

---

## SVG — `*.svg`

| | |
| --- | --- |
| Zweck | Vektor für Plotter, Laser, Dokumentation, Web |
| Kodierung | UTF-8, SVG 1.1 |
| Maße | `width`/`height` in `mm`, passendes `viewBox` |
| Geometrie | jede Marke ein `<path>` mit geschlossenem Pfad, `fill`, kein `stroke` |
| Beschriftung | `<text>` mit `text-anchor="middle"`, `dominant-baseline="central"`, Rotation als `transform` |
| Struktur | `<g id="skalenmarken">` und `<g id="beschriftung">` |
| Nachkommastellen | 4 (Ausgabe auf 1e-4 gerundet) |

Bewusste Entscheidungen:
- **Flächen statt Striche.** Eine Marke mit „Linienbreite 0,8 mm" ist eine Fläche von
  0,8 mm Breite. Ein `stroke` wäre von jedem Werkzeug anders interpretiert worden
  (Skalierung des Strichs, `vector-effect`, Plotter-Pen-Zuordnung). Fläche ist eindeutig.
- **Beschriftung bleibt Text.** Keine Pfade — der Nutzer kann in jedem Vektorprogramm
  weiterarbeiten. Wer Pfade braucht, konvertiert dort.
- **Keine Gruppen pro Marke, keine Attribute ohne Nutzen.** Die Datei bleibt klein und
  für Postprozessoren gut lesbar.
- `shape-rendering="geometricPrecision"` wird nicht erzwungen; die Geometrie ist exakt.

## DXF — `*.dxf`

| | |
| --- | --- |
| Zweck | CAD/CAM, Fräsen, Wasserstrahl, Gravur, Schneiden |
| Version | **DXF R12 (AC1009)**, ASCII |
| Lagen | `SKALA` (Teilstriche), `BESCHRIFTUNG` (Texte) |
| Geometrie | `POLYLINE` + `VERTEX` + `SEQEND`, geschlossen (Gruppe 70 = 1), 4 Ecken |
| Beschriftung | `TEXT`, zentriert (72 = 1, 73 = 2), Höhe = Schriftgröße in mm, Gruppe 50 = Rotation in Grad |
| Header | `$ACADVER`, `$EXTMIN`, `$EXTMAX` |
| Nachkommastellen | 6 |

Bewusste Entscheidungen:
- **R12 statt R2000.** Moderne Schreiber nehmen `LWPOLYLINE`; alte CAM-Postprozessoren,
  Graviergeräte und Maschinensteuerungen nehmen oft nur R12. Für dieses Publikum zählt
  Kompatibilität mehr als Komfort. Der Preis: `VERTEX` ist etwas wortreicher.
- **Geschlossene Konturen statt Striche.** Ein Laser- oder Fräsprozess braucht eine
  Kontur mit Anfang und Ende, keine Strichstärke. Jede Marke ist eine in sich
  geschlossene Fläche — sie kann direkt als Bahn oder als Ausschnitt verwendet werden.
- **Keine Polylinien-Breite (Gruppe 40/43).** Die Breite steckt in der Kontur. Damit
  hängt das Ergebnis nicht von der Linienbreiten-Interpretation des Zielprogramms ab.
- **Zwei Lagen, nicht mehr.** Layer-Organisation ist Aufgabe der Zeichnung, nicht der Skala.
- **TEXT statt MTEXT.** MTEXT ist ein R2000-Merkmal und wird von vielen Postprozessoren
  ignoriert. Ein `TEXT`-Objekt pro Zahl ist unbestreitbar.
- Dezimalkomma wie in der Vorschau (deutsche Schreibweise, z. B. `0,5`). Wer einen Punkt
  braucht, ändert das in der Nachbearbeitung — die Zahl steht als Zeichenkette im Objekt.

## STL — `*.stl`

| | |
| --- | --- |
| Zweck | 3D-Druck, CAM-Simulation, Bearbeitung |
| Kodierung | **binär** (80 Byte Kopf, Dreieckszahl, 50 Byte je Dreieck) |
| Geometrie | echtes Dreiecksnetz des Höhenfeldes, Normale nach außen |
| Einheit | STL ist einheitenlos — hier gilt **1 Einheit = 1 mm** |
| Enthalten | Grundkörper + Marken |
| Nicht enthalten | Beschriftung (siehe unten) |

### Wie die 3D-Geometrie entsteht

Die STL ist **kein Screenshot und kein Mesh der SVG**. Sie wird aus dem Parameterraum
gebaut (`lib/scale-engine/mesh.ts`):

1. **Zerlegung.** Der Parameterraum (Winkel × Radius bzw. Abstand × Querrichtung) wird
   in ein Gitter geteilt. Die Kanten liegen exakt auf den Rändern jeder Marke;
   zusätzlich wird jede Zelle auf höchstens 3° (bzw. 5 mm) Länge unterteilt, damit Bögen
   rund bleiben.
2. **Höhenfeld.** Jede Zelle hat eine konstante Höhe:
   - Grundfläche: `Plattenstärke`
   - innerhalb einer Marke: `Plattenstärke + Reliefhöhe` (Modus **positiv**) bzw.
     `Plattenstärke − Gravurtiefe` (Modus **Gravur**)
3. **Körper.** Daraus entstehen Deckelflächen, eine durchgehende Bodenfläche und an
   jeder Höhenstufe senkrechte Wandflächen. Bei „Gravur" sind das die Wände **echter
   Kanäle** — die Platte hat Löcher in der gewünschten Tiefe, kein aufgelegtes Material.
4. **Orientierung.** Jede Fläche wird gegen einen Außenhint geprüft und bei Bedarf
   umgedreht. Das Netz ist orientiert und geschlossen (watertight).
5. **Naht.** Ein Vollkreis wird über `wrapU` verbunden; Marken auf der Naht werden
   aufgeteilt, damit keine doppelten Flächen entstehen.

Parameter und ihre Bedeutung:

| Parameter | Bedeutung |
| --- | --- |
| Plattenstärke | Extrusionshöhe des Grundkörpers (mm) |
| Reliefhöhe / Gravurtiefe | Höhe der Linien über bzw. Tiefe unter der Plattenoberfläche (mm) |
| Linienbreite | Breite der Linien in 3D. **0 = Linienbreite aus der Vorschau übernehmen** |

CAM kann damit direkt arbeiten: Die Gravurkanäle haben senkrechte Wände und einen flachen
Boden in konstanter Tiefe — genau das, was ein Schaftfräser oder Laser erwartet.

## OBJ — `*.obj`

| | |
| --- | --- |
| Zweck | 3D-CAD, Rendering, Weiterverarbeitung |
| Kodierung | Text, Wavefront OBJ |
| Geometrie | `v`-Liste + `f`-Liste, dieselben Dreiecke wie STL |
| Einheit | mm, Maßstab 1:1 |
| Objektname | `o skala` |

Bewusste Entscheidung: keine `vt`/`vn`/`usemtl`. Eine Skala ist Fertigungsgeometrie,
kein Rendering-Asset. Wer Normalen braucht, leitet sie aus den Flächen ab.

---

## Beschriftung in 3D — ehrliche Ausnahme

SVG und DXF enthalten die Beschriftung als echte Textobjekte. **STL und OBJ enthalten
sie nicht.** Gründe:

- Ein STL kennt keine Textobjekte, nur Dreiecke.
- Buchstaben müssten über einen Vektorfont zu Flächen tesselliert und dann in das
  Höhenfeld übertragen werden — das ist eine eigene Geometriebibliothek (Schriftschnitte,
  Konturlöcher wie in „A", „O", „8").
- Eine halbherzige Lösung (Rechteck-Plaketten, Punktraster) wäre für den Nutzer eine
  Überraschung in der Datei. Das wäre ein Dark Pattern.

Stattdessen steht im Exportdialog unmissverständlich dabei: *„Beschriftung ist
2D-Geometrie und in 3D-Formaten nicht enthalten."* Wer gravierte Zahlen braucht,
gravieren die DXF (Textobjekte) — dafür ist das Format gemacht.

---

## Dateigröße und Skalierung im Dialog

Der Exportdialog zeigt **echte Werte**, gerechnet aus den exportierten Bytes:
Dateiname, Einheit, Maßstab, Dateigröße, Anzahl Teilstriche, Anzahl Beschriftungen,
Dreieckszahl (STL/OBJ) und die Zeichnungsausdehnung in mm. Es wird nichts geschätzt.
