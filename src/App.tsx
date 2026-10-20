import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Box,
  Download,
  FlaskConical,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Palette,
  RotateCcw,
  Sparkles,
  Tag,
  X,
  type LucideIcon,
} from 'lucide-react';
import SceneViewport, { type SceneViewportHandle } from './components/SceneViewport';
import {
  CATEGORY_DEFAULTS,
  CATEGORY_LABELS,
  DEFAULT_BASE_COLOR,
  DEFAULT_PRESET_ID,
  EMPTY_ARTWORK,
  FACE_LABELS,
  FINISHES,
  PRESETS,
  facesForCategory,
  formatDimensions,
  getPreset,
  type ArtworkMap,
  type FaceKey,
  type FinishId,
  type PackagingCategory,
} from './constants/presets';

const CATEGORY_ICONS: Record<PackagingCategory, LucideIcon> = {
  box: Package,
  bottle: FlaskConical,
  label: Tag,
};

const CATEGORIES: PackagingCategory[] = ['box', 'bottle', 'label'];
const FINISH_ORDER: FinishId[] = ['matte', 'glossy', 'kraft'];
const EXPORT_LONG_EDGE = 3840;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export default function App() {
  const viewportRef = useRef<SceneViewportHandle>(null);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [artwork, setArtwork] = useState<ArtworkMap>(EMPTY_ARTWORK);
  const [finish, setFinish] = useState<FinishId>('matte');
  const [baseColor, setBaseColor] = useState(DEFAULT_BASE_COLOR);
  const [hexDraft, setHexDraft] = useState(DEFAULT_BASE_COLOR);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = useMemo(() => getPreset(presetId), [presetId]);
  const faces = facesForCategory(preset.category);
  const isKraft = finish === 'kraft';

  /* ---------------- Artwork object URL lifecycle ---------------- */

  // Every object URL we've created; revoked when replaced/removed and on unmount.
  const artworkRef = useRef(artwork);
  artworkRef.current = artwork;
  useEffect(
    () => () => {
      Object.values(artworkRef.current).forEach((url) => url && URL.revokeObjectURL(url));
    },
    [],
  );

  const setFaceArtwork = useCallback((face: FaceKey, file: File | null) => {
    if (file && !file.type.startsWith('image/')) {
      setError(`"${file.name}" is not an image file.`);
      return;
    }
    setError(null);
    // Side effects stay outside the state updater (StrictMode may call updaters twice).
    const previousUrl = artworkRef.current[face];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const next = { ...artworkRef.current, [face]: file ? URL.createObjectURL(file) : null };
    artworkRef.current = next;
    setArtwork(next);
  }, []);

  const clearAllArtwork = useCallback(() => {
    Object.values(artworkRef.current).forEach((url) => url && URL.revokeObjectURL(url));
    artworkRef.current = EMPTY_ARTWORK;
    setArtwork(EMPTY_ARTWORK);
  }, []);

  /* ---------------- Preset / material handlers ---------------- */

  const selectCategory = (category: PackagingCategory) => {
    if (category !== preset.category) setPresetId(CATEGORY_DEFAULTS[category]);
  };

  const updateBaseColor = (value: string) => {
    setHexDraft(value);
    if (HEX_COLOR.test(value)) setBaseColor(value.toLowerCase());
  };

  /* ---------------- Export ---------------- */

  const exportPNG = useCallback(async () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setIsExporting(true);
    setError(null);
    // Let the button paint its busy state before the (synchronous) high-res render.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      const dataUrl = viewport.capturePNG(EXPORT_LONG_EDGE);
      if (!dataUrl) throw new Error('The 3D viewport is not ready yet.');
      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${preset.id}-mockup.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }, [preset.id]);

  const uploadedCount = faces.filter((f) => artwork[f]).length;
  const CategoryIcon = CATEGORY_ICONS[preset.category];

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ---------------- Viewport (70%) ---------------- */}
      <main className="relative h-[60vh] shrink-0 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 lg:h-full lg:w-[70%]">
        <SceneViewport
          ref={viewportRef}
          preset={preset}
          artwork={artwork}
          finish={finish}
          baseColor={baseColor}
        />

        {/* Floating header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <CategoryIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{preset.name}</p>
              <p className="text-xs font-medium tabular-nums text-slate-500">
                {formatDimensions(preset)} · {FINISHES[finish].label}
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              onClick={() => viewportRef.current?.resetView()}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur transition hover:bg-white"
              title="Reset camera"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset view</span>
            </button>
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-slate-500">
          Drag to rotate · Scroll to zoom · Right-drag to pan
        </p>
      </main>

      {/* ---------------- Inspector sidebar (30%) ---------------- */}
      <aside className="flex min-h-0 flex-1 flex-col border-t border-slate-200 bg-white lg:w-[30%] lg:flex-none lg:border-l lg:border-t-0">
        <header className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Box className="h-5 w-5 text-indigo-600" />
          <h1 className="text-base font-semibold tracking-tight">Peak Haven Mockup Studio</h1>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Category + preset */}
          <Section icon={Package} title="Packaging">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category];
                const active = preset.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectCategory(category)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Preset</span>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {CATEGORIES.map((category) => (
                  <optgroup key={category} label={CATEGORY_LABELS[category]}>
                    {PRESETS.filter((p) => p.category === category).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatDimensions(p)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="mt-1.5 text-xs text-slate-500">{preset.description}</p>
          </Section>

          {/* Artwork */}
          <Section
            icon={ImagePlus}
            title="Artwork"
            aside={
              uploadedCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllArtwork}
                  className="text-xs font-medium text-slate-500 hover:text-rose-600"
                >
                  Clear all
                </button>
              )
            }
          >
            <p className="mb-2 text-xs text-slate-500">
              {preset.category === 'box'
                ? 'Upload artwork for each face of the box.'
                : preset.category === 'bottle'
                  ? 'Artwork wraps around the front of the bottle body.'
                  : 'Artwork is printed on the front of the sticker.'}
            </p>
            <ul className="space-y-2">
              {faces.map((face) => (
                <FaceUploadRow
                  key={face}
                  face={face}
                  label={preset.category === 'box' ? FACE_LABELS[face] : 'Front artwork'}
                  url={artwork[face]}
                  onChange={setFaceArtwork}
                />
              ))}
            </ul>
          </Section>

          {/* Material finish */}
          <Section icon={Sparkles} title="Material finish">
            <div className="grid grid-cols-3 gap-2">
              {FINISH_ORDER.map((id) => {
                const f = FINISHES[id];
                const active = finish === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFinish(id)}
                    aria-pressed={active}
                    className={`rounded-xl border px-2 py-2.5 text-left transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-medium text-slate-900">{f.label}</span>
                    <span className="block text-[11px] tabular-nums text-slate-500">
                      R {f.roughness.toFixed(2)} · M {f.metalness.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Base color */}
          <Section icon={Palette} title="Base color">
            <div className={`flex items-center gap-3 ${isKraft ? 'opacity-50' : ''}`}>
              <input
                type="color"
                value={isKraft ? FINISHES.kraft.baseColor : baseColor}
                onChange={(e) => updateBaseColor(e.target.value)}
                disabled={isKraft}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 disabled:cursor-not-allowed"
                aria-label="Base color"
              />
              <input
                type="text"
                value={isKraft ? FINISHES.kraft.baseColor : hexDraft}
                onChange={(e) => updateBaseColor(e.target.value)}
                onBlur={() => setHexDraft(baseColor)}
                disabled={isKraft}
                maxLength={7}
                spellCheck={false}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {isKraft
                ? 'Kraft paper uses its natural tone (#c49a6c).'
                : 'Applied to surfaces without uploaded artwork.'}
            </p>
          </Section>
        </div>

        {/* Export */}
        <footer className="space-y-2 border-t border-slate-200 px-5 py-4">
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={exportPNG}
            disabled={isExporting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Rendering…' : 'Export PNG'}
          </button>
          <p className="text-center text-[11px] text-slate-500">
            Transparent background · {EXPORT_LONG_EDGE}px long edge · {preset.id}-mockup.png
          </p>
        </footer>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar building blocks                                            */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function FaceUploadRow({
  face,
  label,
  url,
  onChange,
}: {
  face: FaceKey;
  label: string;
  url: string | null;
  onChange: (face: FaceKey, file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(face, file);
    // Allow re-selecting the same file later.
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onChange(face, file);
  };

  return (
    <li
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex items-center gap-3 rounded-xl border p-2 transition ${
        dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
        aria-label={`Upload ${label}`}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Layers className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{url ? 'Artwork applied' : 'PNG, JPG, SVG or WebP'}</p>
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
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </li>
  );
}
