import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { BACKDROPS, floorCanvas, renderBackdrop, type Backdrop, type BackdropKind } from '../../lib/backdrops';
import { BACKGROUND_SWATCHES, type ViewSettings } from '../../state/settings';
import { PanelTitle, SectionLabel } from '../ui/controls';

const SECTIONS: { kind: BackdropKind; label: string; hint: string }[] = [
  { kind: 'scene', label: 'Realistic scenes', hint: 'A surface, podium or studio paper under your product.' },
  { kind: 'gradient', label: 'Gradients', hint: '' },
  { kind: 'pattern', label: 'Patterns', hint: '' },
];

/** Small preview image of a backdrop (sky, plus a hint of its floor or podium). */
function useThumbnail(backdrop: Backdrop): string {
  return useMemo(() => {
    const w = 240;
    const h = 160;
    const canvas = renderBackdrop(backdrop, w, h);
    const ctx = canvas.getContext('2d')!;
    const horizon = h * 0.58;
    if (backdrop.floor) {
      ctx.drawImage(floorCanvas(backdrop.floor.id, backdrop.floor.color), 0, 0, 512, 200, 0, horizon, w, h - horizon);
      const fade = ctx.createLinearGradient(0, horizon, 0, horizon + 24);
      fade.addColorStop(0, backdrop.fog ?? '#ffffff');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizon, w, 24);
    }
    if (backdrop.sweep) {
      const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, backdrop.sweep);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (backdrop.podium) {
      ctx.fillStyle = backdrop.podium.colors[1];
      ctx.fillRect(w * 0.12, h * 0.36, w * 0.18, h * 0.5);
      ctx.fillStyle = backdrop.podium.colors[0];
      ctx.fillRect(w * 0.3, h * 0.66, w * 0.4, h * 0.22);
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.66, w * 0.2, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas.toDataURL('image/png');
  }, [backdrop]);
}

function BackdropTile({ backdrop, active, onSelect }: { backdrop: Backdrop; active: boolean; onSelect: () => void }) {
  const src = useThumbnail(backdrop);
  return (
    <button type="button" onClick={onSelect} className="group text-left" aria-pressed={active}>
      <div
        className={`relative aspect-3/2 overflow-hidden rounded-lg border transition ${
          active ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-200 group-hover:border-slate-300'
        }`}
      >
        <img src={src} alt="" className="h-full w-full object-cover" />
        {active && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[11px] font-medium text-slate-700">{backdrop.label}</p>
    </button>
  );
}

export default function BackgroundPanel({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const plain = settings.backdrop === null;
  return (
    <div>
      <PanelTitle>Background</PanelTitle>
      <p className="-mt-2 mb-1 text-sm text-slate-500">Backgrounds are included in PNG/JPG exports and videos.</p>

      <SectionLabel>Plain</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ transparentBg: true, backdrop: null })}
          aria-pressed={plain && settings.transparentBg}
          className={`h-8 rounded-lg border px-3 text-xs font-medium transition bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-position-[0_0,5px_5px] bg-size-[10px_10px] ${
            plain && settings.transparentBg ? 'border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/30' : 'border-slate-200 text-slate-600'
          }`}
        >
          Transparent
        </button>
        {BACKGROUND_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ bgColor: color, transparentBg: false, backdrop: null })}
            aria-label={`Background ${color}`}
            className={`h-8 w-8 rounded-lg border border-slate-300 ${
              plain && !settings.transparentBg && settings.bgColor === color ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
            }`}
            style={{ background: color }}
          />
        ))}
        <input
          type="color"
          value={settings.bgColor}
          onChange={(e) => onChange({ bgColor: e.target.value, transparentBg: false, backdrop: null })}
          className="h-8 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
          aria-label="Custom background color"
        />
      </div>

      {SECTIONS.map((section) => (
        <div key={section.kind}>
          <SectionLabel>{section.label}</SectionLabel>
          {section.hint && <p className="-mt-1 mb-2 text-[11px] text-slate-500">{section.hint}</p>}
          <div className="grid grid-cols-3 gap-2">
            {BACKDROPS.filter((b) => b.kind === section.kind).map((b) => (
              <BackdropTile
                key={b.id}
                backdrop={b}
                active={settings.backdrop === b.id}
                onSelect={() => onChange({ backdrop: b.id, transparentBg: false })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
