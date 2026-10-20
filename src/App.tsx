import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Download,
  Hand,
  LayoutGrid,
  Loader2,
  Minus,
  MousePointer2,
  MoreHorizontal,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Undo2,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import SceneViewport, { type SceneViewportHandle, type ViewName, type VideoMode } from './components/SceneViewport';
import EditPanel from './components/panels/EditPanel';
import ModelsPanel from './components/panels/ModelsPanel';
import LayoutPanel from './components/panels/LayoutPanel';
import VideoPanel, { type VideoResult } from './components/panels/VideoPanel';
import MorePanel from './components/panels/MorePanel';
import {
  CATEGORY_LABELS,
  canOpen,
  formatDimensions,
  getPreset,
  resolvePreset,
  type FaceKey,
} from './constants/presets';
import { buildDieline, dielineSvg } from './lib/dieline';
import { saveProject, toStoredProject, type StoredProject } from './lib/projects';
import { useEditor, type EditorDoc } from './state/editor';
import { DEFAULT_SETTINGS, type ViewSettings } from './state/settings';

type PanelId = 'edit' | 'models' | 'layout' | 'video' | 'more';

const RAIL: { id: PanelId; label: string; icon: LucideIcon }[] = [
  { id: 'edit', label: 'Edit', icon: PenTool },
  { id: 'models', label: 'Models', icon: Box },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'angle', label: '3/4' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
];

/* Floating layout geometry (px), also used to center the model beside the panels. */
const MARGIN = 16;
const RAIL_W = 84;
const PANEL_W = 360;
const GAP = 12;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Draws a transparent PNG onto a solid color and re-encodes it. */
async function flattenOnColor(dataUrl: string, color: string, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the export canvas.');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed.'))), type, 0.95),
  );
}

function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export default function App() {
  const viewportRef = useRef<SceneViewportHandle>(null);
  const { doc, update, replace, undo, redo, canUndo, canRedo } = useEditor();
  const [settings, setSettings] = useState<ViewSettings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<PanelId | null>('edit');
  const [panMode, setPanMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dielineUrl, setDielineUrl] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const basePreset = useMemo(() => getPreset(doc.presetId), [doc.presetId]);
  const preset = useMemo(() => resolvePreset(basePreset, doc.size), [basePreset, doc.size]);
  const openable = canOpen(preset);
  const patchSettings = useCallback((patch: Partial<ViewSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------------- Artwork object URLs ---------------- */

  // Kept for the whole session (undo can bring back any earlier upload) and revoked on unmount.
  const urlsRef = useRef(new Set<string>());
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const makeUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);

  const docRef = useRef(doc);
  docRef.current = doc;

  const setArtwork = useCallback(
    (face: FaceKey, file: File | null) => {
      if (file && !file.type.startsWith('image/')) {
        setToast(`"${file.name}" is not an image file.`);
        return;
      }
      update({ artwork: { ...docRef.current.artwork, [face]: file ? makeUrl(file) : null } });
    },
    [update, makeUrl],
  );

  /* ---------------- Export ---------------- */

  const exportImage = useCallback(async () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setIsExporting(true);
    // Let the button paint its busy state before the (synchronous) high-res render.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      const dataUrl = viewport.capturePNG(settings.exportEdge);
      if (!dataUrl) throw new Error('The 3D viewport is not ready yet.');
      const jpg = settings.exportFormat === 'jpg';
      const blob =
        settings.transparentBg && !jpg
          ? await (await fetch(dataUrl)).blob()
          : await flattenOnColor(
              dataUrl,
              settings.transparentBg ? '#ffffff' : settings.bgColor,
              jpg ? 'image/jpeg' : 'image/png',
            );
      downloadBlob(blob, `${preset.id}-mockup.${jpg ? 'jpg' : 'png'}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }, [preset.id, settings]);

  const videoBackground = settings.transparentBg ? '#eef0f3' : settings.bgColor;
  const recordVideo = useCallback(
    async (mode: VideoMode, seconds: number): Promise<VideoResult> => {
      const viewport = viewportRef.current;
      if (!viewport) throw new Error('The 3D viewport is not ready yet.');
      const { blob, extension } = await viewport.recordVideo({
        mode,
        durationMs: seconds * 1000,
        background: videoBackground,
      });
      return { url: URL.createObjectURL(blob), filename: `${preset.id}-${mode}.${extension}` };
    },
    [preset.id, videoBackground],
  );

  /* ---------------- Dieline ---------------- */

  const dielineBlob = useCallback(
    () =>
      new Blob([dielineSvg(buildDieline(preset), `${preset.name} (${formatDimensions(preset)})`)], {
        type: 'image/svg+xml',
      }),
    [preset],
  );
  const downloadDieline = useCallback(() => downloadBlob(dielineBlob(), `${preset.id}-dieline.svg`), [dielineBlob, preset.id]);
  const showDieline = () => setDielineUrl(URL.createObjectURL(dielineBlob()));
  const closeDieline = () => {
    if (dielineUrl) URL.revokeObjectURL(dielineUrl);
    setDielineUrl(null);
  };

  /* ---------------- Projects ---------------- */

  const saveCurrentProject = useCallback(async (name: string) => {
    const thumbnail = viewportRef.current?.capturePNG(320) ?? '';
    await saveProject(await toStoredProject(docRef.current, name, thumbnail));
    setToast(`Saved "${name}".`);
  }, []);

  const openProject = useCallback(
    (project: StoredProject) => {
      const artwork = { ...docRef.current.artwork };
      (Object.keys(artwork) as FaceKey[]).forEach((face) => {
        const blob = project.artwork[face];
        artwork[face] = blob ? makeUrl(blob) : null;
      });
      const next: EditorDoc = { ...project.doc, artwork };
      replace(next);
      setToast(`Opened "${project.name}".`);
    },
    [replace, makeUrl],
  );

  /* ---------------- Layout ---------------- */

  const panelOpen = panel !== null;
  const viewOffsetPx = isDesktop ? (panelOpen ? (MARGIN + RAIL_W + GAP + PANEL_W) / 2 : (MARGIN + RAIL_W) / 2) : 0;
  const togglePanel = (id: PanelId) => setPanel((p) => (p === id ? null : id));

  let panelContent: ReactNode = null;
  switch (panel) {
    case 'edit':
      panelContent = (
        <EditPanel
          preset={preset}
          basePreset={basePreset}
          isCustom={doc.size !== null}
          artwork={doc.artwork}
          finish={doc.finish}
          baseColor={doc.baseColor}
          unit={settings.unit}
          onUnitChange={(unit) => patchSettings({ unit })}
          onUpload={setArtwork}
          onFinish={(finish) => update({ finish })}
          onBaseColor={(baseColor) => update({ baseColor }, 'baseColor')}
          onSize={(size) => update({ size })}
          onDownloadDieline={downloadDieline}
        />
      );
      break;
    case 'models':
      panelContent = (
        <ModelsPanel
          preset={preset}
          basePreset={basePreset}
          unit={settings.unit}
          onUnitChange={(unit) => patchSettings({ unit })}
          onSelect={(presetId) => presetId !== doc.presetId && update({ presetId, size: null, open: 0 })}
          onSize={(size) => update({ size })}
          onSaveProject={saveCurrentProject}
          onOpenProject={openProject}
        />
      );
      break;
    case 'layout':
      panelContent = <LayoutPanel layoutId={doc.layoutId} onSelect={(layoutId) => update({ layoutId })} />;
      break;
    case 'video':
      panelContent = <VideoPanel canOpen={openable} background={videoBackground} onRecord={recordVideo} />;
      break;
    case 'more':
      panelContent = <MorePanel settings={settings} onChange={patchSettings} />;
      break;
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gradient-to-b from-slate-300 via-slate-200 to-slate-100"
      style={settings.transparentBg ? undefined : { background: settings.bgColor }}
    >
      {/* The viewport fills the screen; panels float over it. */}
      <div className="absolute inset-0">
        <SceneViewport
          ref={viewportRef}
          preset={preset}
          artwork={doc.artwork}
          finish={doc.finish}
          baseColor={doc.baseColor}
          layoutId={doc.layoutId}
          open={doc.open}
          settings={settings}
          panMode={panMode}
          viewOffsetPx={viewOffsetPx}
        />
      </div>

      {/* Model name + size */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-4 flex justify-center pl-4 pr-20 ${
          panelOpen ? 'md:pl-[472px]' : 'md:pl-[100px]'
        }`}
      >
        <div className="pointer-events-auto max-w-full truncate rounded-full border border-white/70 bg-white/85 px-4 py-1.5 text-center text-sm shadow-sm backdrop-blur">
          <span className="font-semibold text-slate-900">{preset.name}</span>
          <span className="ml-2 tabular-nums text-slate-500">{formatDimensions(preset, settings.unit)}</span>
          <span className="ml-2 hidden text-slate-400 lg:inline">· {CATEGORY_LABELS[preset.category]}</span>
        </div>
      </div>

      {/* Left rail */}
      <nav
        className="absolute inset-x-2 bottom-2 z-20 flex justify-around rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:w-[84px] md:flex-col md:justify-start md:gap-1 md:py-3"
        aria-label="Tools"
      >
        {RAIL.map((item) => {
          const active = panel === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => togglePanel(item.id)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition md:py-3 ${
                active ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Floating panel */}
      {panelContent && (
        <aside className="absolute inset-x-2 bottom-[84px] z-20 max-h-[55vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl shadow-slate-900/10 md:inset-x-auto md:bottom-4 md:left-[112px] md:top-4 md:max-h-none md:w-[360px]">
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
          {panelContent}
        </aside>
      )}

      {/* Right toolbar */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-1 rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur">
        <ToolButton label="Rotate" active={!panMode} onClick={() => setPanMode(false)} icon={MousePointer2} />
        <ToolButton label="Pan" active={panMode} onClick={() => setPanMode(true)} icon={Hand} />
        <hr className="mx-2 my-1 border-slate-200" />
        <ToolButton label="Undo (Ctrl/⌘ Z)" onClick={undo} disabled={!canUndo} icon={Undo2} />
        <ToolButton label="Redo (Shift Ctrl/⌘ Z)" onClick={redo} disabled={!canRedo} icon={Redo2} />
        <hr className="mx-2 my-1 border-slate-200" />
        <ToolButton label="Reset view" onClick={() => viewportRef.current?.resetView()} icon={RotateCcw} />
        <ToolButton label="Export" onClick={exportImage} disabled={isExporting} icon={isExporting ? Loader2 : Download} />
      </div>

      {/* Bottom toolbar */}
      <div
        className="absolute bottom-4 z-10 hidden -translate-x-1/2 items-center gap-2 md:flex"
        style={{ left: `calc(50% + ${viewOffsetPx}px)` }}
      >
        <div className="flex items-center gap-1 rounded-2xl bg-white/95 px-2 py-1.5 shadow-lg shadow-slate-900/10 backdrop-blur">
          <ToolButton label="Zoom out" onClick={() => viewportRef.current?.zoom(1.2)} icon={Minus} />
          <ToolButton label="Zoom in" onClick={() => viewportRef.current?.zoom(1 / 1.2)} icon={Plus} />
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <label
            className={`flex items-center gap-2 px-1 text-sm ${openable ? 'text-slate-700' : 'text-slate-300'}`}
            title={openable ? 'Open or close the lid' : 'Only boxes can open'}
          >
            Open
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              disabled={!openable}
              value={1 - doc.open}
              onChange={(e) => update({ open: 1 - Number(e.target.value) }, 'open')}
              className="w-28 accent-violet-600 disabled:opacity-40"
              aria-label="Open or close the box"
            />
            Close
          </label>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => viewportRef.current?.setView(v.id)}
              className="rounded-lg px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              title={`${v.label} view`}
            >
              {v.label}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <ToolButton label="View dieline" onClick={showDieline} icon={Ruler} />
        </div>
        <button
          type="button"
          onClick={exportImage}
          disabled={isExporting}
          className="flex items-center gap-2 whitespace-nowrap rounded-2xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 disabled:cursor-wait disabled:opacity-70"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export {settings.exportFormat.toUpperCase()}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {dielineUrl && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={closeDieline}>
          <div
            className="flex max-h-full w-full max-w-4xl flex-col rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Dieline · {preset.id}</h2>
                <p className="text-xs text-slate-500">
                  Black = cut, blue dashed = fold, sizes in mm. Design on this template at the same size, then upload it
                  in Edit.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDieline}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-4">
              <img src={dielineUrl} alt={`${preset.id} dieline`} className="mx-auto max-h-[60vh] w-full object-contain" />
            </div>
            <button
              type="button"
              onClick={downloadDieline}
              className="mt-4 flex items-center justify-center gap-2 self-end rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'bg-violet-100 text-violet-700' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
