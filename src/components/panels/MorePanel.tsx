import { ENVIRONMENTS, type ViewSettings } from '../../state/settings';
import { PanelTitle, SectionLabel, Segmented, Toggle } from '../ui/controls';

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
      <select
        value={settings.environment}
        onChange={(e) => onChange({ environment: e.target.value as ViewSettings['environment'] })}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      >
        {ENVIRONMENTS.map((env) => (
          <option key={env.id} value={env.id}>
            {env.label}
          </option>
        ))}
      </select>
      <label className="mt-3 block text-sm text-slate-700">
        <span className="flex justify-between">
          Brightness <span className="tabular-nums text-slate-500">{Math.round(settings.lightIntensity * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.3}
          max={2}
          step={0.05}
          value={settings.lightIntensity}
          onChange={(e) => onChange({ lightIntensity: Number(e.target.value) })}
          className="w-full accent-emerald-600"
        />
      </label>

      <SectionLabel>Scene</SectionLabel>
      <Toggle label="Ground shadow" checked={settings.shadows} onChange={(v) => onChange({ shadows: v })} />
      {settings.shadows && (
        <label className="block text-sm text-slate-700">
          <span className="flex justify-between">
            Shadow strength <span className="tabular-nums text-slate-500">{Math.round(settings.shadowOpacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.shadowOpacity}
            onChange={(e) => onChange({ shadowOpacity: Number(e.target.value) })}
            className="w-full accent-emerald-600"
          />
        </label>
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
