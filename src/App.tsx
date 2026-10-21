import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Download,
  Focus,
  Hand,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Minus,
  Moon,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Plus,
  Rotate3d,
  Sun,
  Redo2,
  Ruler,
  Undo2,
  Video,
  type LucideIcon,
} from 'lucide-react';
import SceneViewport, { type SceneViewportHandle, type ViewName, type VideoMode } from './components/SceneViewport';
import EditPanel from './components/panels/EditPanel';
import ModelsPanel from './components/panels/ModelsPanel';
import LayoutPanel from './components/panels/LayoutPanel';
import VideoPanel, { type VideoResult } from './components/panels/VideoPanel';
import MorePanel from './components/panels/MorePanel';
import BackgroundPanel from './components/panels/BackgroundPanel';
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
import { useTheme } from './state/theme';
import { Badge } from './components/reui/badge';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Separator } from './components/ui/separator';
import { Slider } from './components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';

type PanelId = 'edit' | 'models' | 'layout' | 'background' | 'video' | 'more';

const TABS: { id: PanelId; label: string; icon: LucideIcon }[] = [
  { id: 'edit', label: 'Edit', icon: PenTool },
  { id: 'models', label: 'Models', icon: Box },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'background', label: 'Scene', icon: ImageIcon },
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
  const { theme, toggle: toggleTheme } = useTheme();
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

  const videoBackground = settings.transparentBg ? (theme === 'dark' ? '#151529' : '#f5f3ee') : settings.bgColor;
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
          labelShift={doc.labelShift ?? 0}
          onLabelShift={(labelShift) => update({ labelShift }, 'labelShift')}
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
          onSelect={(presetId) => {
            if (presetId === doc.presetId) return;
            const color = getPreset(presetId).defaultColor;
            update({ presetId, size: null, open: 0, ...(color ? { baseColor: color } : {}) });
          }}
          onSize={(size) => update({ size })}
          onSaveProject={saveCurrentProject}
          onOpenProject={openProject}
        />
      );
      break;
    case 'layout':
      panelContent = <LayoutPanel layoutId={doc.layoutId} onSelect={(layoutId) => update({ layoutId })} />;
      break;
    case 'background':
      panelContent = <BackgroundPanel settings={settings} onChange={patchSettings} />;
      break;
    case 'video':
      panelContent = <VideoPanel canOpen={openable} background={videoBackground} onRecord={recordVideo} />;
      break;
    case 'more':
      panelContent = <MorePanel settings={settings} onChange={patchSettings} />;
      break;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        {/* Top bar */}
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:px-4">
          <div className="flex min-w-0 items-center">
            <div className="hidden leading-tight sm:block">
              <p className="font-display text-[19px] font-bold tracking-tight text-brand-text">
                MOQZUNO<sup className="ml-0.5 text-[8px]">®</sup>
              </p>
              <p className="text-[11px] text-muted-foreground">Make it look unreal.</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 justify-center">
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm shadow-xs">
              <span className="truncate font-medium">{preset.name}</span>
              <span className="hidden shrink-0 tabular-nums text-muted-foreground md:inline">
                {formatDimensions(preset, settings.unit)}
              </span>
              <Badge variant="primary-light" radius="full" className="hidden lg:inline-flex">
                {CATEGORY_LABELS[preset.category]}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ToolButton label="Undo (Ctrl/⌘ Z)" onClick={undo} disabled={!canUndo} icon={Undo2} />
            <ToolButton label="Redo (Shift Ctrl/⌘ Z)" onClick={redo} disabled={!canRedo} icon={Redo2} />
            <ToolButton
              label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggleTheme}
              icon={theme === 'dark' ? Sun : Moon}
            />
            <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />
            <span className="hidden md:block">
              <ToolButton
                label={panelOpen ? 'Hide panel' : 'Show panel'}
                onClick={() => setPanel((p) => (p ? null : 'edit'))}
                icon={panelOpen ? PanelRightClose : PanelRightOpen}
              />
            </span>
            <Button
              onClick={exportImage}
              disabled={isExporting}
              className="ml-1 h-9 rounded-full px-4 font-display font-bold shadow-[0_0_24px_rgba(202,255,92,0.25)] disabled:cursor-wait"
            >
              {isExporting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
              <span className="hidden sm:inline">Export {settings.exportFormat.toUpperCase()}</span>
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Stage */}
          <main
            className="relative min-h-[50vh] flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,var(--stage-a)_0%,var(--stage-b)_55%,var(--stage-c)_100%)]"
            style={settings.transparentBg ? undefined : { background: settings.bgColor }}
          >
            {/* Subtle dot grid so the stage reads as a canvas. */}
            {settings.transparentBg && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--stage-dot)_1px,transparent_1px)] bg-size-[24px_24px] opacity-[0.12]" />
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
                labelShift={doc.labelShift ?? 0}
                settings={settings}
                panMode={panMode}
                viewOffsetPx={0}
              />
            </div>

            {/* Canvas tools, left edge */}
            <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-xs backdrop-blur-sm">
              <ToggleGroup
                type="single"
                orientation="vertical"
                spacing={1}
                value={panMode ? 'pan' : 'rotate'}
                onValueChange={(v) => v && setPanMode(v === 'pan')}
              >
                <ToolToggle value="rotate" label="Rotate" icon={Rotate3d} />
                <ToolToggle value="pan" label="Pan" icon={Hand} />
              </ToggleGroup>
              <Separator className="my-0.5 w-6" />
              <ToolButton label="Zoom in" onClick={() => viewportRef.current?.zoom(1 / 1.2)} icon={Plus} side="right" />
              <ToolButton label="Zoom out" onClick={() => viewportRef.current?.zoom(1.2)} icon={Minus} side="right" />
              <ToolButton label="Fit to view" onClick={() => viewportRef.current?.resetView()} icon={Focus} side="right" />
              <Separator className="my-0.5 w-6" />
              <ToolButton label="View dieline" onClick={showDieline} icon={Ruler} side="right" />
            </div>

            {/* Views + lid, bottom */}
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-3">
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/90 p-1 shadow-xs backdrop-blur-sm">
                {VIEWS.map((v) => (
                  <Button
                    key={v.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => viewportRef.current?.setView(v.id)}
                    className="px-2 text-muted-foreground sm:px-2.5"
                    title={`${v.label} view`}
                  >
                    {v.label}
                  </Button>
                ))}
                {openable && (
                  <>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <div className="flex shrink-0 items-center gap-3 px-2 text-xs font-medium text-muted-foreground" title="Open or close the lid">
                      Lid
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[doc.open]}
                        onValueChange={([open]) => update({ open }, 'open')}
                        className="w-20 shrink-0 sm:w-28"
                        aria-label="Open the box"
                      />
                      <span className="w-8 tabular-nums text-foreground/60">{Math.round(doc.open * 100)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>

          {/* Inspector, right */}
          {panelOpen ? (
            <aside className="z-10 flex max-h-[50vh] min-h-0 flex-col border-t border-border bg-background md:max-h-none md:w-[380px] md:border-l md:border-t-0">
              <PanelTabs panel={panel} onSelect={setPanel} />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">{panelContent}</div>
            </aside>
          ) : (
            <aside className="z-10 border-t border-border bg-background md:w-16 md:border-l md:border-t-0">
              <PanelTabs panel={null} onSelect={setPanel} compact />
            </aside>
          )}
        </div>

        {toast && (
          <div
            role="status"
            className="fixed left-1/2 top-[68px] z-30 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
          >
            {toast}
          </div>
        )}

        <Dialog open={dielineUrl !== null} onOpenChange={(open) => !open && closeDieline()}>
          <DialogContent className="flex max-h-[calc(100%-2rem)] flex-col gap-3 p-5 sm:max-w-4xl">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg font-semibold">Dieline · {preset.id}</DialogTitle>
              <DialogDescription className="text-xs">
                Black = cut, blue dashed = fold, sizes in mm. Design on this template at the same size, then upload it in
                Edit.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-brand-canvas p-4">
              {dielineUrl && (
                <img src={dielineUrl} alt={`${preset.id} dieline`} className="mx-auto max-h-[60vh] w-full object-contain" />
              )}
            </div>
            <DialogFooter>
              <Button onClick={downloadDieline} className="h-9 rounded-full px-4 font-display font-bold">
                <Download data-icon="inline-start" />
                Download SVG
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function PanelTabs({
  panel,
  onSelect,
  compact,
}: {
  panel: PanelId | null;
  onSelect: (id: PanelId) => void;
  compact?: boolean;
}) {
  return (
    <Tabs
      value={panel ?? ''}
      onValueChange={(v) => onSelect(v as PanelId)}
      activationMode="manual"
      orientation={compact ? 'vertical' : 'horizontal'}
      className={compact ? 'p-2' : 'shrink-0 border-b border-border p-2'}
    >
      <TabsList
        aria-label="Panels"
        className={`h-auto! w-full gap-1 bg-transparent p-0 ${compact ? 'flex-row justify-around md:flex-col md:justify-start' : ''}`}
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.id}
              value={item.id}
              title={item.label}
              className={`h-auto flex-1 flex-col gap-1 rounded-lg px-1 py-2 text-[11px] text-muted-foreground hover:bg-muted data-active:border-primary/25! data-active:bg-primary/10! data-active:text-primary! data-active:shadow-none ${
                compact ? 'md:w-full md:flex-none' : ''
              }`}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function ToolButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  side = 'bottom',
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  side?: 'bottom' | 'right';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="size-9 text-foreground/70 hover:text-foreground disabled:opacity-30"
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolToggle({ value, label, icon: Icon }: { value: string; label: string; icon: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          value={value}
          aria-label={label}
          className="size-9 text-foreground/70 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
