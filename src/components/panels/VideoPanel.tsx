import { useEffect, useState } from 'react';
import { Download, Loader2, Video } from 'lucide-react';
import type { VideoMode } from '../SceneViewport';
import { PanelTitle, SectionLabel, Segmented } from '../ui/controls';
import { Button } from '../ui/button';

const DURATIONS = [4, 6, 8, 12];

export interface VideoResult {
  url: string;
  filename: string;
}

export default function VideoPanel({
  canOpen,
  background,
  onRecord,
}: {
  canOpen: boolean;
  /** The solid background the video will use. */
  background: string;
  onRecord: (mode: VideoMode, seconds: number) => Promise<VideoResult>;
}) {
  const [mode, setMode] = useState<VideoMode>('turntable');
  const [seconds, setSeconds] = useState(6);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canOpen && mode === 'open-close') setMode('turntable');
  }, [canOpen, mode]);
  // Free the previous recording when a new one replaces it or the panel closes.
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const record = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await onRecord(mode, seconds));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PanelTitle>Animated video</PanelTitle>
      <p className="-mt-2 mb-1 text-sm text-slate-500">Record an animation of the current scene from the current camera.</p>

      <SectionLabel>Animation</SectionLabel>
      <Segmented
        value={mode}
        options={[
          { value: 'turntable', label: '360° spin' },
          { value: 'open-close', label: 'Open & close', disabled: !canOpen },
        ]}
        onChange={setMode}
      />

      <SectionLabel>Length</SectionLabel>
      <Segmented
        value={String(seconds)}
        options={DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))}
        onChange={(v) => setSeconds(Number(v))}
      />

      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-4 w-4 rounded-sm border border-slate-300" style={{ background }} />
        Background color comes from More → Background (videos can't be transparent).
      </p>

      <Button size="lg" onClick={record} disabled={busy} className="mt-4 h-11 w-full rounded-xl font-semibold disabled:cursor-wait">
        {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Video data-icon="inline-start" />}
        {busy ? `Recording ${seconds}s…` : 'Record video'}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {result && (
        <div className="mt-4 space-y-2">
          <video src={result.url} controls loop autoPlay muted playsInline className="w-full rounded-xl bg-slate-100" />
          <Button asChild variant="outline" size="lg" className="h-10 w-full rounded-xl">
            <a href={result.url} download={result.filename}>
              <Download data-icon="inline-start" />
              Download {result.filename}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
