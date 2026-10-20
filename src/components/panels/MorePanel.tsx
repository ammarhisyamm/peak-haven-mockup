import { ENVIRONMENTS, type ViewSettings } from '../../state/settings';
import { PanelTitle, SectionLabel, Segmented, Toggle } from '../ui/controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';

const EXPORT_SIZES: { value: number; label: string }[] = [
  { value: 1080, label: '1080' },
  { value: 2048, label: '2K' },
  { value: 3840, label: '4K' },
  { value: 6000, label: '6K' },
];

export default function MorePanel({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  return (
    <div>
      <PanelTitle>Scene &amp; export</PanelTitle>

      <SectionLabel>Lighting</SectionLabel>
      <Select
        value={settings.environment}
        onValueChange={(v) => onChange({ environment: v as ViewSettings['environment'] })}
      >
        <SelectTrigger aria-label="Lighting" className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {ENVIRONMENTS.map((env) => (
            <SelectItem key={env.id} value={env.id}>
              {env.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <RangeField
        label="Brightness"
        value={settings.lightIntensity}
        min={0.3}
        max={2}
        onChange={(lightIntensity) => onChange({ lightIntensity })}
      />

      <SectionLabel>Scene</SectionLabel>
      <Toggle label="Ground shadow" checked={settings.shadows} onChange={(v) => onChange({ shadows: v })} />
      {settings.shadows && (
        <RangeField
          label="Shadow strength"
          value={settings.shadowOpacity}
          min={0.1}
          max={1}
          onChange={(shadowOpacity) => onChange({ shadowOpacity })}
        />
      )}
      <Toggle label="Auto-rotate camera" checked={settings.autoRotate} onChange={(v) => onChange({ autoRotate: v })} />

      <SectionLabel>Export</SectionLabel>
      <Segmented
        value={String(settings.exportEdge)}
        options={EXPORT_SIZES.map((s) => ({ value: String(s.value), label: s.label }))}
        onChange={(v) => onChange({ exportEdge: Number(v) })}
      />
      <p className="mt-1 text-[11px] text-slate-500">Long edge in pixels (capped by your graphics card).</p>
      <div className="mt-2">
        <Segmented
          value={settings.exportFormat}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
          ]}
          onChange={(v) => onChange({ exportFormat: v })}
        />
      </div>

      <SectionLabel>Units</SectionLabel>
      <Segmented
        value={settings.unit}
        options={[
          { value: 'mm', label: 'Millimeters' },
          { value: 'in', label: 'Inches' },
        ]}
        onChange={(v) => onChange({ unit: v })}
      />

      <SectionLabel>Shortcuts</SectionLabel>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
        <dt className="font-mono">⌘/Ctrl Z</dt>
        <dd>Undo</dd>
        <dt className="font-mono">⇧ ⌘/Ctrl Z</dt>
        <dd>Redo</dd>
        <dt className="font-mono">Drag</dt>
        <dd>Rotate (or pan in hand mode)</dd>
        <dt className="font-mono">Right-drag</dt>
        <dd>Pan</dd>
        <dt className="font-mono">Scroll</dt>
        <dd>Zoom</dd>
      </dl>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3 mb-2 text-sm text-foreground/85">
      <p className="mb-2.5 flex justify-between">
        {label} <span className="tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
      </p>
      <Slider min={min} max={max} step={0.05} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}
