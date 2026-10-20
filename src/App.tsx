import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Download,
  Focus,
  Hand,
  LayoutGrid,
  Loader2,
  Minus,
  MoreHorizontal,
  Package,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Plus,
  Rotate3d,
  Redo2,
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

const TABS: { id: PanelId; label: string; icon: LucideIcon }[] = [
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

export default function App() {
  const viewportRef = useRef<SceneViewportHandle>(null);
  const { doc, update, replace, undo, redo, canUndo, canRedo } = useEditor();
  const [settings, setSettings] = useState<ViewSettings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<PanelId | null>('edit');
  const [panMode, setPanMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dielineUrl, setDielineUrl] = useState<string | null>(null);

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
    <div className="flex h-full w-full flex-col bg-white text-slate-900">
      {/* Top bar */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Package className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold tracking-tight">Peak Haven</p>
            <p className="text-[11px] text-slate-500">Mockup Studio</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
            <span className="truncate font-medium">{preset.name}</span>
            <span className="hidden shrink-0 tabular-nums text-slate-500 md:inline">
              {formatDimensions(preset, settings.unit)}
            </span>
            <span className="hidden shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 lg:inline">
              {CATEGORY_LABELS[preset.category]}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ToolButton label="Undo (Ctrl/⌘ Z)" onClick={undo} disabled={!canUndo} icon={Undo2} />
          <ToolButton label="Redo (Shift Ctrl/⌘ Z)" onClick={redo} disabled={!canRedo} icon={Redo2} />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 md:block" />
          <span className="hidden md:block">
            <ToolButton
              label={panelOpen ? 'Hide panel' : 'Show panel'}
              onClick={() => setPanel((p) => (p ? null : 'edit'))}
              icon={panelOpen ? PanelRightClose : PanelRightOpen}
            />
          </span>
          <button
            type="button"
            onClick={exportImage}
            disabled={isExporting}
            className="ml-1 flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Export {settings.exportFormat.toUpperCase()}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Stage */}
        <main
          className="relative min-h-[50vh] flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,_#ffffff_0%,_#eef1f5_55%,_#dfe4ea_100%)]"
          style={settings.transparentBg ? undefined : { background: settings.bgColor }}
        >
          {/* Subtle dot grid so the stage reads as a canvas. */}
          {settings.transparentBg && (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:22px_22px] opacity-50" />
          )}
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
              viewOffsetPx={0}
            />
          </div>

          {/* Canvas tools, left edge */}
          <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur">
            <ToolButton label="Rotate" active={!panMode} onClick={() => setPanMode(false)} icon={Rotate3d} />
            <ToolButton label="Pan" active={panMode} onClick={() => setPanMode(true)} icon={Hand} />
            <hr className="mx-1.5 my-0.5 border-slate-200" />
            <ToolButton label="Zoom in" onClick={() => viewportRef.current?.zoom(1 / 1.2)} icon={Plus} />
            <ToolButton label="Zoom out" onClick={() => viewportRef.current?.zoom(1.2)} icon={Minus} />
            <ToolButton label="Fit to view" onClick={() => viewportRef.current?.resetView()} icon={Focus} />
            <hr className="mx-1.5 my-0.5 border-slate-200" />
            <ToolButton label="View dieline" onClick={showDieline} icon={Ruler} />
          </div>

          {/* Views + lid, bottom */}
          <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-3">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => viewportRef.current?.setView(v.id)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title={`${v.label} view`}
                >
                  {v.label}
                </button>
              ))}
              {openable && (
                <>
                  <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
                  <label className="flex shrink-0 items-center gap-2 px-2 text-xs font-medium text-slate-600" title="Open or close the lid">
                    Lid
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={doc.open}
                      onChange={(e) => update({ open: Number(e.target.value) }, 'open')}
                      className="w-28 accent-emerald-600 focus:outline-none"
                      aria-label="Open the box"
                    />
                    <span className="w-8 tabular-nums text-slate-400">{Math.round(doc.open * 100)}%</span>
                  </label>
                </>
              )}
            </div>
          </div>
        </main>

        {/* Inspector, right */}
        {panelOpen ? (
          <aside className="z-10 flex max-h-[50vh] min-h-0 flex-col border-t border-slate-200 bg-white md:max-h-none md:w-[380px] md:border-l md:border-t-0">
            <Tabs panel={panel} onSelect={togglePanel} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">{panelContent}</div>
          </aside>
        ) : (
          <aside className="z-10 border-t border-slate-200 bg-white md:w-16 md:border-l md:border-t-0">
            <Tabs panel={null} onSelect={togglePanel} compact />
          </aside>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-[68px] z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {dielineUrl && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={closeDieline}>
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
              className="mt-4 flex items-center justify-center gap-2 self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
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

function Tabs({
  panel,
  onSelect,
  compact,
}: {
  panel: PanelId | null;
  onSelect: (id: PanelId) => void;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Panels"
      className={`flex shrink-0 gap-1 p-2 ${compact ? 'justify-around md:flex-col md:justify-start' : 'border-b border-slate-200'}`}
    >
      {TABS.map((item) => {
        const active = panel === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={active}
            title={item.label}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition ${
              compact ? 'md:flex-none' : ''
            } ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            {item.label}
          </button>
        );
      })}
    </nav>
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
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </button>
  );
}
