import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { Layers, Upload, X } from 'lucide-react';
import {
  editableSize,
  fromMm,
  toMm,
  type FaceKey,
  type PackagingPreset,
  type SizeOverride,
  type Unit,
} from '../../constants/presets';

/* ------------------------------------------------------------------ */
/* Layout primitives                                                  */
/* ------------------------------------------------------------------ */

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{children}</h2>
      {aside}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>
      {aside}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5 text-sm text-slate-700">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Uploads                                                            */
/* ------------------------------------------------------------------ */

function firstImage(files: FileList | null | undefined): File | null {
  const file = files?.[0];
  return file ?? null;
}

/** Large drop zone, used for the main design upload. */
export function DropZone({
  url,
  title,
  hint,
  onFile,
  onClear,
}: {
  url: string | null;
  title: string;
  hint: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = firstImage(e.dataTransfer.files);
    if (file) onFile(file);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`relative flex min-h-[180px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition ${
        over ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-300 bg-emerald-50'
      }`}
    >
      {url ? (
        <>
          <img src={url} alt="" className="max-h-28 max-w-full rounded-lg object-contain shadow-sm" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-emerald-500" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            <Upload className="h-4 w-4" />
            {title}
          </button>
          <p className="text-xs text-slate-500">{hint}</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = firstImage(e.target.files);
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function FaceUploadRow({
  face,
  label,
  url,
  inherited,
  onChange,
}: {
  face: FaceKey;
  label: string;
  url: string | null;
  /** True when this face currently shows a slice of the full dieline. */
  inherited?: boolean;
  onChange: (face: FaceKey, file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <li
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = firstImage(e.dataTransfer.files);
        if (file) onChange(face, file);
      }}
      className={`flex items-center gap-3 rounded-xl border p-2 transition ${
        dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:text-emerald-500"
        aria-label={`Upload ${label}`}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Layers className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{url ? 'Own artwork' : inherited ? 'From full dieline' : 'Empty'}</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {url ? 'Replace' : 'Upload'}
      </button>
      {url && (
        <button
          type="button"
          onClick={() => onChange(face, null)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Remove ${label}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = firstImage(e.target.files);
          if (file) onChange(face, file);
          e.target.value = '';
        }}
      />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Size editor                                                        */
/* ------------------------------------------------------------------ */

const LIMITS = { min: 5, max: 800 };

/** Edits a preset's dimensions in mm or inches; applies on submit. */
export function SizeEditor({
  preset,
  basePreset,
  unit,
  onUnitChange,
  onApply,
}: {
  /** The preset as currently shown (custom size applied). */
  preset: PackagingPreset;
  /** The library preset, for "Reset". */
  basePreset: PackagingPreset;
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  onApply: (size: SizeOverride | null) => void;
}) {
  const current = editableSize(preset);
  const fields: { key: string; label: string }[] =
    'diameter' in current
      ? [
          { key: 'diameter', label: 'Diameter' },
          { key: 'height', label: 'Height' },
        ]
      : [
          { key: 'width', label: 'Width' },
          { key: 'height', label: 'Height' },
          { key: 'depth', label: preset.category === 'label' ? 'Thickness' : 'Depth' },
        ];

  const toDraft = () =>
    Object.fromEntries(
      fields.map((f) => [f.key, String(+fromMm((current as unknown as Record<string, number>)[f.key], unit).toFixed(unit === 'mm' ? 1 : 3))]),
    );
  const [draft, setDraft] = useState<Record<string, string>>(toDraft);
  const sizeKey = JSON.stringify(current);
  useEffect(() => setDraft(toDraft()), [sizeKey, unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = fields.map((f) => toMm(parseFloat(draft[f.key]), unit));
  const minFor = (key: string) => (key === 'depth' && preset.category === 'label' ? 0.1 : LIMITS.min);
  const valid = values.every((v, i) => Number.isFinite(v) && v >= minFor(fields[i].key) && v <= LIMITS.max);

  const apply = () => {
    if (!valid) return;
    const size = Object.fromEntries(fields.map((f, i) => [f.key, Math.round(values[i] * 100) / 100]));
    onApply(size as unknown as SizeOverride);
  };

  return (
    <div className="space-y-3">
      <Segmented
        value={unit}
        options={[
          { value: 'mm', label: 'mm' },
          { value: 'in', label: 'inch' },
        ]}
        onChange={onUnitChange}
      />
      <div className={`grid gap-2 ${fields.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-slate-500">{f.label}</span>
            <input
              type="number"
              inputMode="decimal"
              step={unit === 'mm' ? 1 : 0.01}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        ))}
      </div>
      {!valid && (
        <p className="text-xs text-rose-600">
          Each size must be between {fromMm(LIMITS.min, unit).toFixed(unit === 'mm' ? 0 : 2)} and{' '}
          {fromMm(LIMITS.max, unit).toFixed(unit === 'mm' ? 0 : 1)} {unit}.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!valid}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Apply size
        </button>
        <button
          type="button"
          onClick={() => onApply(null)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          title={`Back to ${basePreset.id} size`}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
