"use client";

import * as React from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { SCALE_TYPE_LABELS, resolveAngles, valueKey, type ScaleDefinition, type ScaleParams, type ScaleType } from "@/core/scale-engine";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Kbd } from "@/components/ui/kbd";
import { fmt } from "@/lib/utils";
import { NumberField } from "./NumberField";
import { ScaleTypeIcon } from "./type-icons";
import { useEditorStore } from "./store";

const TYPES: ScaleType[] = ["circle", "semicircle", "arc", "linear"];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-3">{children}</div>;
}

function SideToggle({
  id,
  label,
  value,
  onChange,
  labels,
}: {
  id: string;
  label: string;
  value: "inside" | "outside";
  onChange: (v: "inside" | "outside") => void;
  labels: [string, string];
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <ToggleGroup id={id} type="single" value={value} onValueChange={(v) => v && onChange(v as "inside" | "outside")} aria-label={label}>
        <ToggleGroupItem value="inside">{labels[0]}</ToggleGroupItem>
        <ToggleGroupItem value="outside">{labels[1]}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function SelectionCard({ def, params }: { def: ScaleDefinition; params: ScaleParams }) {
  const selectedTickId = useEditorStore((s) => s.selectedTickId);
  const select = useEditorStore((s) => s.select);
  const toggleTickHidden = useEditorStore((s) => s.toggleTickHidden);
  const toggleLabelHidden = useEditorStore((s) => s.toggleLabelHidden);
  const tick = selectedTickId ? def.ticks.find((t) => t.id === selectedTickId) : undefined;
  if (!tick) return null;
  const key = valueKey(tick.value);
  const label = def.labels.find((l) => l.tickId === tick.id);
  const labelHidden = params.overrides.hiddenLabels.includes(key);
  const circular = def.geometry.kind === "circular";

  return (
    <section className="border-b border-primary/40 bg-primary/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-primary">Auswahl</h2>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={() => select(null)} aria-label="Auswahl aufheben">
          <X className="size-3.5" /> <Kbd>Esc</Kbd>
        </Button>
      </div>
      <p className="mt-1 text-sm font-medium">
        {tick.kind === "major" ? "Hauptteilstrich" : "Unterteilstrich"} <span className="font-mono">{tick.value}</span>
        {tick.hidden ? <span className="ml-2 text-xs font-normal text-muted-foreground">(ausgeblendet)</span> : null}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
        {circular ? (
          <>
            <dt>Winkel</dt>
            <dd className="text-foreground">{fmt(tick.angle, 2)}°</dd>
          </>
        ) : null}
        <dt>Position</dt>
        <dd className="text-foreground">
          x {fmt(tick.start.x, 2)} · y {fmt(-tick.start.y, 2)} mm
        </dd>
        <dt>Länge</dt>
        <dd className="text-foreground">
          {fmt(Math.hypot(tick.end.x - tick.start.x, tick.end.y - tick.start.y), 2)} mm · Breite {fmt(tick.width, 2)} mm
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => toggleTickHidden(key)}>
          {tick.hidden ? <Eye /> : <EyeOff />}
          {tick.hidden ? "Strich einblenden" : "Strich ausblenden"}
          {!tick.hidden ? <Kbd className="ml-1">Entf</Kbd> : null}
        </Button>
        {label || labelHidden ? (
          <Button variant="secondary" size="sm" onClick={() => toggleLabelHidden(key)}>
            {labelHidden ? <Eye /> : <EyeOff />}
            {labelHidden ? "Beschriftung einblenden" : "Beschriftung ausblenden"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function ParameterPanel({ def }: { def: ScaleDefinition }) {
  const params = def.params;
  const patch = useEditorStore((s) => s.patch);
  const setType = useEditorStore((s) => s.setType);
  const showAllHidden = useEditorStore((s) => s.showAllHidden);
  const g = params.geometry;
  const linear = params.type === "linear";
  const angles = resolveAngles(params);
  const hiddenCount = params.overrides.hiddenTicks.length + params.overrides.hiddenLabels.length;

  const sideLabels: [string, string] = linear ? (g.orientation === "horizontal" ? ["unten", "oben"] : ["links", "rechts"]) : ["innen", "außen"];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SelectionCard def={def} params={params} />

      <Section title="Skalentyp">
        <ToggleGroup type="single" value={params.type} onValueChange={(v) => v && setType(v as ScaleType)} aria-label="Skalentyp" className="grid grid-cols-4">
          {TYPES.map((t) => (
            <ToggleGroupItem key={t} value={t} className="flex-col gap-1 py-2" aria-label={SCALE_TYPE_LABELS[t]}>
              <ScaleTypeIcon type={t} width={20} height={20} />
              <span>{SCALE_TYPE_LABELS[t]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>

      <Section title="Geometrie">
        {linear ? (
          <>
            <Grid>
              <NumberField id="length" label="Länge" unit="mm" value={g.length} min={1} step={5} onChange={(v) => patch("geometry", { length: v })} />
              <div className="flex flex-col gap-1">
                <Label htmlFor="orientation">Ausrichtung</Label>
                <ToggleGroup id="orientation" type="single" value={g.orientation} onValueChange={(v) => v && patch("geometry", { orientation: v as "horizontal" | "vertical" })}>
                  <ToggleGroupItem value="horizontal">Horizontal</ToggleGroupItem>
                  <ToggleGroupItem value="vertical">Vertikal</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </Grid>
            <SideToggle id="tickSide" label="Teilstriche zeigen nach" value={g.tickSide} onChange={(v) => patch("geometry", { tickSide: v })} labels={sideLabels} />
          </>
        ) : (
          <>
            <Grid>
              <NumberField id="radius" label="Radius" unit="mm" value={g.radius} min={0.1} step={1} onChange={(v) => patch("geometry", { radius: v })} />
              <SideToggle id="tickSide" label="Teilstriche" value={g.tickSide} onChange={(v) => patch("geometry", { tickSide: v })} labels={sideLabels} />
              <NumberField id="startAngle" label="Startwinkel" unit="°" value={g.startAngle} step={5} min={-360} max={360} onChange={(v) => patch("geometry", { startAngle: v })} />
              {params.type === "arc" ? (
                <NumberField id="endAngle" label="Endwinkel" unit="°" value={g.endAngle} step={5} min={-720} max={720} onChange={(v) => patch("geometry", { endAngle: v })} />
              ) : (
                <div className="flex flex-col gap-1">
                  <Label>Endwinkel</Label>
                  <div className="flex h-8 items-center rounded-md border border-dashed border-border px-2.5 font-mono text-sm text-muted-foreground" title={`Beim ${SCALE_TYPE_LABELS[params.type]} ergibt sich der Endwinkel aus dem Startwinkel.`}>
                    {fmt(angles.end, 0)}° <span className="ml-1.5 text-xs">(fest)</span>
                  </div>
                </div>
              )}
              <NumberField id="innerRadius" label="Innenradius" unit="mm" hint="Kontur" value={g.innerRadius} min={0} step={1} onChange={(v) => patch("geometry", { innerRadius: v })} />
              <NumberField id="outerRadius" label="Außenradius" unit="mm" hint="Kontur" value={g.outerRadius} min={0.1} step={1} onChange={(v) => patch("geometry", { outerRadius: v })} />
            </Grid>
          </>
        )}
      </Section>

      <Section title="Wertebereich">
        <Grid>
          <NumberField id="min" label="Minimalwert" value={params.range.min} step={1} onChange={(v) => patch("range", { min: v })} />
          <NumberField id="max" label="Maximalwert" value={params.range.max} step={1} onChange={(v) => patch("range", { max: v })} />
        </Grid>
      </Section>

      <Section title="Hauptteilung">
        <Grid>
          <NumberField id="majorStep" label="Abstand" hint="in Werten" value={params.major.step} min={0} step={1} onChange={(v) => patch("major", { step: v })} />
          <NumberField id="majorLength" label="Länge" unit="mm" value={params.major.length} min={0} step={0.5} onChange={(v) => patch("major", { length: v })} />
          <NumberField id="majorWidth" label="Linienbreite" unit="mm" value={params.major.width} min={0} step={0.1} onChange={(v) => patch("major", { width: v })} />
        </Grid>
      </Section>

      <Section title="Unterteilung">
        <ToggleGroup type="single" value={params.minor.mode} onValueChange={(v) => v && patch("minor", { mode: v as "count" | "step" })} aria-label="Art der Unterteilung">
          <ToggleGroupItem value="count">Anzahl dazwischen</ToggleGroupItem>
          <ToggleGroupItem value="step">Schrittweite</ToggleGroupItem>
        </ToggleGroup>
        <Grid>
          {params.minor.mode === "count" ? (
            <NumberField id="minorCount" label="Anzahl" hint="0 = keine" value={params.minor.count} min={0} max={99} step={1} decimals={0} onChange={(v) => patch("minor", { count: Math.round(v) })} />
          ) : (
            <NumberField id="minorStep" label="Schrittweite" hint="in Werten" value={params.minor.step} min={0} step={0.5} onChange={(v) => patch("minor", { step: v })} />
          )}
          <NumberField id="minorLength" label="Länge" unit="mm" value={params.minor.length} min={0} step={0.5} onChange={(v) => patch("minor", { length: v })} />
          <NumberField id="minorWidth" label="Linienbreite" unit="mm" value={params.minor.width} min={0} step={0.1} onChange={(v) => patch("minor", { width: v })} />
        </Grid>
      </Section>

      <Section
        title="Beschriftung"
        action={<Switch id="labelsEnabled" checked={params.labels.enabled} onCheckedChange={(v) => patch("labels", { enabled: v })} aria-label="Beschriftung ein/aus" />}
      >
        {params.labels.enabled ? (
          <Grid>
            <NumberField id="fontSize" label="Schriftgröße" unit="mm" value={params.labels.fontSize} min={0.5} step={0.5} onChange={(v) => patch("labels", { fontSize: v })} />
            <SideToggle id="labelPosition" label="Position" value={params.labels.position} onChange={(v) => patch("labels", { position: v })} labels={sideLabels} />
            <NumberField id="labelOffset" label="Abstand zur Skala" unit="mm" value={params.labels.offset} min={0} step={0.5} onChange={(v) => patch("labels", { offset: v })} />
            <NumberField id="labelStroke" label="Linienbreite" unit="mm" value={params.labels.strokeWidth} min={0.05} step={0.05} onChange={(v) => patch("labels", { strokeWidth: v })} />
          </Grid>
        ) : (
          <p className="text-xs text-muted-foreground">Keine Beschriftung. Die Skala enthält nur Teilstriche.</p>
        )}
      </Section>

      <Section
        title="Skalenlinie"
        action={<Switch id="baselineEnabled" checked={params.baseline.enabled} onCheckedChange={(v) => patch("baseline", { enabled: v })} aria-label="Skalenlinie ein/aus" />}
      >
        {params.baseline.enabled ? (
          <Grid>
            <NumberField id="baselineWidth" label="Linienbreite" unit="mm" value={params.baseline.width} min={0.05} step={0.1} onChange={(v) => patch("baseline", { width: v })} />
          </Grid>
        ) : (
          <p className="text-xs text-muted-foreground">Keine durchgehende Linie entlang der Skala.</p>
        )}
      </Section>

      {hiddenCount > 0 ? (
        <Section title="Ausgeblendet">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {params.overrides.hiddenTicks.length} Striche, {params.overrides.hiddenLabels.length} Beschriftungen – werden nicht exportiert.
            </p>
            <Button variant="secondary" size="sm" onClick={showAllHidden}>
              <Eye /> Alle einblenden
            </Button>
          </div>
        </Section>
      ) : null}

      <div className="px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-mono">↑↓</span> ändert Werte schrittweise, <Kbd>⇧</Kbd> ×10, <Kbd>⌥</Kbd> ÷10. Alle Maße in Millimetern.
      </div>
    </div>
  );
}
