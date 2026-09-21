"use client";

import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  MicroLabel,
  Row,
  SectionTitle,
  Segmented,
  SwitchRow,
  ValueInput,
} from "@/components/ui/field";
import { Tooltip } from "@/components/ui/overlay";
import type { SavedScale } from "@/lib/storage";
import { formatValue, type ScaleDefinition, type ScaleType } from "@/lib/scale-engine";
import { TYPE_NAMES } from "@/lib/scale-engine";
import { useEditor } from "@/store/editor";
import { AblageActions } from "@/features/scale/AblageActions";
import { ScaleGlyph } from "@/features/scale/TypeGlyphs";

const TYPE_ORDER: ScaleType[] = ["circle", "half-circle", "arc", "line"];
const TYPE_SHORT: Record<ScaleType, string> = {
  circle: "Kreis",
  "half-circle": "Halbkreis",
  arc: "Bogen",
  line: "Linie",
};
const snap = (v: number) => Math.round(v * 1000) / 1000;

export function ParameterPanel({
  definition,
  saved,
  notice,
  onLoadSaved,
  onDeleteSaved,
  onSave,
  onImported,
}: {
  definition: ScaleDefinition;
  saved: SavedScale[];
  notice?: string | null;
  onLoadSaved: (row: SavedScale) => void;
  onDeleteSaved: (id: string) => void;
  onSave: () => void;
  onImported: (items: SavedScale[]) => void;
}) {
  const params = useEditor((s) => s.present);
  const update = useEditor((s) => s.update);
  const setType = useEditor((s) => s.setType);
  const endEdit = useEditor((s) => s.endEdit);
  const create = useEditor((s) => s.create);
  const [flash, setFlash] = React.useState(false);

  if (!params) return null;
  const g = params.geometry;
  const r = params.range;
  const tk = params.ticks;
  const lp = params.labels;
  const bd = params.body;
  const isLine = params.type === "line";

  const step = tk.majorStep > 0 ? tk.majorStep : 1;
  const nMajor = Math.max(0, Math.floor((r.max - r.min) / step));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative flex h-full flex-col overflow-y-auto bg-transparent"
    >
      {/* Skalentyp */}
      <SectionTitle note="direkt">Skalentyp</SectionTitle>
      <div className="grid grid-cols-4 border-b border-[var(--line)]">
        {TYPE_ORDER.map((type) => {
          const active = params.type === type;
          return (
            <Tooltip key={type} label={`Skala ${TYPE_NAMES[type].toLowerCase()}`} side="bottom">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setType(type)}
                className={`flex flex-col items-center gap-1.5 border-r border-[var(--line)] py-3 transition-colors duration-150 outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  active
                    ? "bg-[var(--surface-2)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text)]"
                }`}
              >
                <ScaleGlyph type={type} className="h-7 w-7" />
                <span className="text-[9px] uppercase tracking-[0.14em]">{TYPE_SHORT[type]}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Geometrie */}
      <SectionTitle note="mm / °">Geometrie</SectionTitle>
      {isLine ? (
        <>
          <Row
            label="Länge"
            scrub={(d, m) => update({ geometry: { length: snap(g.length + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Länge in Millimeter"
              value={g.length}
              unit="mm"
              step={1}
              min={1}
              onChange={(v) => update({ geometry: { length: v } })}
            />
          </Row>
          <Row label="Orientierung">
            <Segmented
              ariaLabel="Orientierung"
              value={g.orientation}
              options={[
                { value: "horizontal", label: "waagerecht" },
                { value: "vertical", label: "senkrecht" },
              ]}
              onChange={(v) => update({ geometry: { orientation: v } })}
            />
          </Row>
        </>
      ) : (
        <>
          <Row
            label="Radius"
            hint="Teilkreis: Ankerlinie aller Marken, Marken wachsen nach innen."
            scrub={(d, m) => update({ geometry: { radius: snap(g.radius + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Radius in Millimeter"
              value={g.radius}
              unit="mm"
              step={0.5}
              min={1}
              onChange={(v) => update({ geometry: { radius: v } })}
            />
          </Row>
          <Row
            label="Startwinkel"
            hint="0° = 3 Uhr, positiv gegen den Uhrzeigersinn."
            scrub={(d, m) => update({ geometry: { startAngle: snap(g.startAngle + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Startwinkel in Grad"
              value={g.startAngle}
              unit="°"
              step={1}
              onChange={(v) => update({ geometry: { startAngle: v } })}
            />
          </Row>
          <Row
            label="Endwinkel"
            scrub={(d, m) => update({ geometry: { endAngle: snap(g.endAngle + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Endwinkel in Grad"
              value={g.endAngle}
              unit="°"
              step={1}
              onChange={(v) => update({ geometry: { endAngle: v } })}
            />
          </Row>
          <Row
            label="Innenradius"
            hint="Innenkante des Grundkörpers, begrenzt die Markenlänge."
            scrub={(d, m) => update({ geometry: { innerRadius: snap(g.innerRadius + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Innenradius in Millimeter"
              value={g.innerRadius}
              unit="mm"
              step={0.5}
              min={0}
              onChange={(v) => update({ geometry: { innerRadius: v } })}
            />
          </Row>
          <Row
            label="Außenradius"
            hint="Außenkante des Grundkörpers."
            scrub={(d, m) => update({ geometry: { outerRadius: snap(g.outerRadius + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Außenradius in Millimeter"
              value={g.outerRadius}
              unit="mm"
              step={0.5}
              min={1}
              onChange={(v) => update({ geometry: { outerRadius: v } })}
            />
          </Row>
        </>
      )}

      {/* Wertebereich */}
      <SectionTitle note={`${nMajor} Hauptteilungen`}>Wertebereich</SectionTitle>
      <Row
        label="Minimalwert"
        scrub={(d, m) => update({ range: { min: snap(r.min + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Minimalwert"
          value={r.min}
          step={1}
          onChange={(v) => update({ range: { min: v } })}
        />
      </Row>
      <Row
        label="Maximalwert"
        hint="Beispiele: 0 → 80 · −20 → 120 · 0 → 1"
        scrub={(d, m) => update({ range: { max: snap(r.max + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Maximalwert"
          value={r.max}
          step={1}
          onChange={(v) => update({ range: { max: v } })}
        />
      </Row>

      {/* Hauptteilungen */}
      <SectionTitle note="Wert / mm">Hauptteilungen</SectionTitle>
      <Row
        label="Abstand"
        scrub={(d, m) => update({ ticks: { majorStep: snap(tk.majorStep + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Abstand der Hauptteilung"
          value={tk.majorStep}
          step={1}
          min={0.0001}
          onChange={(v) => update({ ticks: { majorStep: v } })}
        />
      </Row>
      <Row
        label="Länge"
        scrub={(d, m) => update({ ticks: { majorLength: snap(tk.majorLength + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Länge der Hauptteilung"
          value={tk.majorLength}
          unit="mm"
          step={0.25}
          min={0.1}
          onChange={(v) => update({ ticks: { majorLength: v } })}
        />
      </Row>
      <Row
        label="Linienbreite"
        scrub={(d, m) => update({ ticks: { majorWidth: snap(tk.majorWidth + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Linienbreite der Hauptteilung"
          value={tk.majorWidth}
          unit="mm"
          step={0.05}
          min={0.01}
          onChange={(v) => update({ ticks: { majorWidth: v } })}
        />
      </Row>

      {/* Unterteilungen */}
      <SectionTitle note="Wert / mm">Unterteilungen</SectionTitle>
      <Row label="Festlegen über">
        <Segmented
          ariaLabel="Art der Unterteilung"
          value={tk.minorMode}
          options={[
            { value: "count", label: "Anzahl" },
            { value: "step", label: "Schrittweite" },
          ]}
          onChange={(v) => update({ ticks: { minorMode: v } })}
        />
      </Row>
      {tk.minorMode === "count" ? (
        <Row
          label="Anzahl"
          hint="Marken zwischen zwei Hauptteilungen."
          scrub={(d, m) =>
            update({ ticks: { minorCount: Math.max(0, Math.round(tk.minorCount + d * m)) } }, true)
          }
          onScrubEnd={endEdit}
        >
          <ValueInput
            ariaLabel="Anzahl Unterteilungen"
            value={tk.minorCount}
            step={1}
            min={0}
            max={49}
            onChange={(v) => update({ ticks: { minorCount: Math.round(v) } })}
          />
        </Row>
      ) : (
        <Row
          label="Schrittweite"
          hint="Werteabstand der Nebenmarke."
          scrub={(d, m) => update({ ticks: { minorStep: snap(tk.minorStep + d * m) } }, true)}
          onScrubEnd={endEdit}
        >
          <ValueInput
            ariaLabel="Schrittweite der Unterteilung"
            value={tk.minorStep}
            step={0.1}
            min={0.0001}
            onChange={(v) => update({ ticks: { minorStep: v } })}
          />
        </Row>
      )}
      <Row
        label="Länge"
        scrub={(d, m) => update({ ticks: { minorLength: snap(tk.minorLength + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Länge der Unterteilung"
          value={tk.minorLength}
          unit="mm"
          step={0.25}
          min={0.1}
          onChange={(v) => update({ ticks: { minorLength: v } })}
        />
      </Row>
      <Row
        label="Linienbreite"
        scrub={(d, m) => update({ ticks: { minorWidth: snap(tk.minorWidth + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Linienbreite der Unterteilung"
          value={tk.minorWidth}
          unit="mm"
          step={0.05}
          min={0.01}
          onChange={(v) => update({ ticks: { minorWidth: v } })}
        />
      </Row>

      {/* Beschriftung */}
      <SectionTitle note={`${definition.labels.length} Texte`}>Beschriftung</SectionTitle>
      <SwitchRow
        label="Beschriftung"
        checked={lp.enabled}
        onChange={(v) => update({ labels: { enabled: v } })}
        hint="Werte an den Hauptteilungen."
      />
      {lp.enabled ? (
        <>
          <Row
            label="Schriftgröße"
            scrub={(d, m) => update({ labels: { fontSize: snap(lp.fontSize + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Schriftgröße in Millimeter"
              value={lp.fontSize}
              unit="mm"
              step={0.25}
              min={0.5}
              onChange={(v) => update({ labels: { fontSize: v } })}
            />
          </Row>
          <Row label="Position">
            <Segmented
              ariaLabel="Position der Beschriftung"
              value={lp.position}
              options={[
                { value: "outside", label: "außen" },
                { value: "inside", label: "innen" },
              ]}
              onChange={(v) => update({ labels: { position: v } })}
            />
          </Row>
          <Row
            label="Abstand"
            hint="Zwischen Skala und Schrift."
            scrub={(d, m) => update({ labels: { offset: snap(lp.offset + d * m) } }, true)}
            onScrubEnd={endEdit}
          >
            <ValueInput
              ariaLabel="Abstand der Beschriftung"
              value={lp.offset}
              unit="mm"
              step={0.25}
              min={0}
              onChange={(v) => update({ labels: { offset: v } })}
            />
          </Row>
        </>
      ) : null}

      {/* 3D */}
      <SectionTitle note="STL · OBJ">3D / Extrusion</SectionTitle>
      <Row label="Modus" hint="Positiv: Linien stehen hervor. Gravur: Linien werden eingeschnitten.">
        <Segmented
          ariaLabel="3D-Modus"
          value={bd.mode}
          options={[
            { value: "positive", label: "positiv" },
            { value: "engrave", label: "gravur" },
          ]}
          onChange={(v) => update({ body: { mode: v } })}
        />
      </Row>
      <Row
        label="Plattenstärke"
        scrub={(d, m) => update({ body: { thickness: snap(bd.thickness + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Plattenstärke in Millimeter"
          value={bd.thickness}
          unit="mm"
          step={0.25}
          min={0.2}
          onChange={(v) => update({ body: { thickness: v } })}
        />
      </Row>
      <Row
        label={bd.mode === "positive" ? "Reliefhöhe" : "Gravurtiefe"}
        scrub={(d, m) => update({ body: { depth: snap(bd.depth + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Höhe oder Tiefe in Millimeter"
          value={bd.depth}
          unit="mm"
          step={0.05}
          min={0.01}
          onChange={(v) => update({ body: { depth: v } })}
        />
      </Row>
      <Row
        label="Linienbreite"
        hint="0 = Linienbreite aus der Vorschau übernehmen."
        scrub={(d, m) => update({ body: { lineWidth: snap(bd.lineWidth + d * m) } }, true)}
        onScrubEnd={endEdit}
      >
        <ValueInput
          ariaLabel="Linienbreite im 3D-Export"
          value={bd.lineWidth}
          unit="mm"
          step={0.05}
          min={0}
          onChange={(v) => update({ body: { lineWidth: v } })}
        />
      </Row>

      {/* Ablage */}
      <SectionTitle note={`${saved.length} gesichert`}>Ablage</SectionTitle>
      <Row label="Bezeichnung">
        <input
          aria-label="Bezeichnung der Skala"
          value={params.name}
          onChange={(e) => update({ name: e.target.value })}
          className="w-[10rem] rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[13px] text-[var(--text)] outline-none transition-colors hover:border-[var(--line)] focus:border-[var(--accent)] focus:bg-[var(--surface-2)]"
        />
      </Row>
      <div className="space-y-2 border-b border-[var(--line)] px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onSave();
            setFlash(true);
            window.setTimeout(() => setFlash(false), 1200);
          }}
        >
          {flash ? "Gesichert ✓" : "In der Ablage sichern"}
        </Button>
        <AblageActions saved={saved} onImported={onImported} />
        {notice ? <p className="text-[11px] leading-relaxed text-[var(--warn)]">{notice}</p> : null}
      </div>
      {saved.length === 0 ? (
        <p className="border-b border-[var(--line)] px-4 py-3 text-[11px] leading-relaxed text-[var(--text-faint)]">
          Noch nichts gesichert. Gesicherte Skalen erscheinen hier und in der Startansicht.
        </p>
      ) : (
        <ul>
          {saved.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 transition-colors hover:bg-[var(--surface-1)]"
            >
              <button
                type="button"
                onClick={() => onLoadSaved(row)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                title="Skala öffnen"
              >
                <ScaleGlyph type={row.type} className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-[var(--text)]">{row.name}</span>
                  <span className="block truncate font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-[var(--text-faint)]">
                    {formatValue(row.params.range.min, 0)} → {formatValue(row.params.range.max, 0)} ·{" "}
                    {row.params.type === "line" ? "linear" : `${row.params.geometry.startAngle}°→${row.params.geometry.endAngle}°`}
                  </span>
                </span>
              </button>
              <Tooltip label="Aus der Ablage löschen">
                <button
                  type="button"
                  aria-label={`${row.name} löschen`}
                  onClick={() => onDeleteSaved(row.id)}
                  className="rounded-[3px] p-1 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--warn)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto border-t border-[var(--line)] px-4 py-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => create(params.type)}>
          Neue Skala
        </Button>
        <MicroLabel className="mt-2 block leading-relaxed">
          Undo/Redo: ⌘Z · Umschalt+⌘Z
        </MicroLabel>
      </div>
    </motion.div>
  );
}
