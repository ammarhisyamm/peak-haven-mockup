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
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Switch } from './switch';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

/* ------------------------------------------------------------------ */
/* Layout primitives                                                  */
/* ------------------------------------------------------------------ */

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{children}</h2>
      {aside}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      spacing={1}
      className="w-full rounded-xl bg-muted p-1"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="flex-1 text-muted-foreground hover:bg-accent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Label className="flex cursor-pointer items-center justify-between py-1.5 text-sm font-normal text-foreground/85">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
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
        over ? 'border-primary bg-primary/15' : 'border-primary/40 bg-primary/5'
      }`}
    >
      {url ? (
        <>
          <img src={url} alt="" className="max-h-28 max-w-full rounded-lg object-contain shadow-xs" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button size="sm" variant="outline" onClick={onClear}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-primary" />
          <Button size="lg" className="px-5 font-semibold" onClick={() => inputRef.current?.click()}>
            <Upload data-icon="inline-start" />
            {title}
          </Button>
          <p className="text-xs text-muted-foreground">{hint}</p>
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
        dragOver ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted text-muted-foreground hover:border-primary hover:text-primary"
        aria-label={`Upload ${label}`}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Layers className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{url ? 'Own artwork' : inherited ? 'From full dieline' : 'Empty'}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        {url ? 'Replace' : 'Upload'}
      </Button>
      {url && (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onChange(face, null)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${label}`}
        >
          <X />
        </Button>
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
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={`size-${f.key}`} className="text-xs font-normal text-muted-foreground">
              {f.label}
            </Label>
            <Input
              id={`size-${f.key}`}
              type="number"
              inputMode="decimal"
              step={unit === 'mm' ? 1 : 0.01}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              className="tabular-nums"
            />
          </div>
        ))}
      </div>
      {!valid && (
        <p className="text-xs text-destructive">
          Each size must be between {fromMm(LIMITS.min, unit).toFixed(unit === 'mm' ? 0 : 2)} and{' '}
          {fromMm(LIMITS.max, unit).toFixed(unit === 'mm' ? 0 : 1)} {unit}.
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={apply} disabled={!valid} className="flex-1 font-semibold">
          Apply size
        </Button>
        <Button variant="outline" onClick={() => onApply(null)} title={`Back to ${basePreset.id} size`}>
          Reset
        </Button>
      </div>
    </div>
  );
}
