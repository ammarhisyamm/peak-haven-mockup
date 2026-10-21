import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, Info } from 'lucide-react';
import {
  FACE_LABELS,
  FINISHES,
  FINISH_ORDER,
  facesForCategory,
  formatDimensions,
  type ArtworkMap,
  type FaceKey,
  type FinishId,
  type PackagingPreset,
  type SizeOverride,
  type Unit,
} from '../../constants/presets';
import { Button } from '../ui/button';
import { DropZone, FaceUploadRow, Field, PanelTitle, SectionLabel, SizeEditor } from '../ui/controls';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function faceLabel(category: PackagingPreset['category'], face: FaceKey): string {
  if (category === 'set') return face === 'label' ? 'Vial label' : `Box ${FACE_LABELS[face]}`;
  return FACE_LABELS[face];
}

export default function EditPanel({
  preset,
  basePreset,
  isCustom,
  artwork,
  finish,
  baseColor,
  unit,
  onUnitChange,
  onUpload,
  onFinish,
  onBaseColor,
  onSize,
  onDownloadDieline,
  labelShift,
  onLabelShift,
}: {
  preset: PackagingPreset;
  basePreset: PackagingPreset;
  isCustom: boolean;
  artwork: ArtworkMap;
  finish: FinishId;
  baseColor: string;
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  onUpload: (face: FaceKey, file: File | null) => void;
  onFinish: (f: FinishId) => void;
  onBaseColor: (c: string) => void;
  onSize: (s: SizeOverride | null) => void;
  onDownloadDieline: () => void;
  labelShift: number;
  onLabelShift: (degrees: number) => void;
}) {
  const [sizeOpen, setSizeOpen] = useState(false);
  const [facesOpen, setFacesOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const multiFace = preset.category === 'box' || preset.category === 'set';
  // Boxes take a full dieline; bottles and stickers take the label artwork directly.
  const mainFace: FaceKey = multiFace ? 'dieline' : 'front';
  const fixedColor = FINISHES[finish].baseColor;

  return (
    <div>
      <PanelTitle>Artwork</PanelTitle>
      <DropZone
        url={artwork[mainFace]}
        title="Upload"
        hint={
          multiFace
            ? 'Full dieline artwork. Use the template below so every panel lines up.'
            : preset.category === 'bottle'
              ? 'Label artwork. It wraps around the front of the body.'
              : preset.category === 'object'
                ? 'Front artwork (label, print or screen). Add a back design below.'
              : 'Sticker artwork, printed on the front.'
        }
        onFile={(f) => onUpload(mainFace, f)}
        onClear={() => onUpload(mainFace, null)}
      />
      <Button variant="ghost" onClick={onDownloadDieline} className="mx-auto mt-3 flex text-foreground/80 hover:text-primary">
        <Download data-icon="inline-start" />
        Download dieline (SVG)
      </Button>

      {(preset.category === 'bottle' || preset.category === 'set') && (
        <Field label="Label position" hint="Turn the artwork around the bottle to bring the front design into view.">
          <div className="flex items-center gap-3 pt-1">
            <Slider
              min={-180}
              max={180}
              step={1}
              value={[labelShift]}
              onValueChange={([v]) => onLabelShift(v)}
              aria-label="Label position"
              className="flex-1"
            />
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{Math.round(labelShift)}°</span>
            <Button size="sm" variant="outline" disabled={labelShift === 0} onClick={() => onLabelShift(0)}>
              Center
            </Button>
          </div>
        </Field>
      )}

      {preset.category === 'object' && (
        <ul className="mt-4 space-y-2">
          <FaceUploadRow face="back" label="Back design" url={artwork.back} onChange={onUpload} />
        </ul>
      )}

      {multiFace && (
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setFacesOpen((v) => !v)}
            className="mt-4 h-10 w-full justify-between rounded-xl px-3.5"
          >
            Upload per face instead
            {facesOpen ? <ChevronDown /> : <ChevronRight />}
          </Button>
          {facesOpen && (
            <ul className="mt-2 space-y-2">
              {facesForCategory(preset.category).map((face) => (
                <FaceUploadRow
                  key={face}
                  face={face}
                  label={faceLabel(preset.category, face)}
                  url={artwork[face]}
                  inherited={!!artwork.dieline}
                  onChange={onUpload}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Separator className="my-5" />

      <div className="space-y-2.5">
        <Field label="Material">
          <Select value={finish} onValueChange={(v) => onFinish(v as FinishId)}>
            <SelectTrigger aria-label="Material" className="-ml-2.5 h-8 w-[calc(100%+1.25rem)] border-0 bg-transparent! text-base shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {FINISH_ORDER.map((id) => (
                <SelectItem key={id} value={id}>
                  {FINISHES[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <button
          type="button"
          onClick={() => setSizeOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left shadow-xs hover:bg-muted"
        >
          <span>
            <span className="block text-xs text-muted-foreground">{isCustom ? 'Custom size' : 'Size'}</span>
            <span className="block text-base text-foreground">{formatDimensions(preset, unit)}</span>
          </span>
          {sizeOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {sizeOpen && (
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <SizeEditor preset={preset} basePreset={basePreset} unit={unit} onUnitChange={onUnitChange} onApply={onSize} />
          </div>
        )}

        <Field
          label="Base color"
          hint={fixedColor ? `${FINISHES[finish].label} uses its natural tone.` : 'Used where there is no artwork.'}
        >
          <div className={`flex items-center gap-2 ${fixedColor ? 'opacity-50' : ''}`}>
            <input
              type="color"
              value={fixedColor ?? baseColor}
              disabled={!!fixedColor}
              onChange={(e) => onBaseColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5 disabled:cursor-not-allowed"
              aria-label="Base color"
            />
            <Input
              type="text"
              value={fixedColor ?? hexDraft ?? baseColor}
              disabled={!!fixedColor}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                setHexDraft(e.target.value);
                if (HEX_COLOR.test(e.target.value)) onBaseColor(e.target.value.toLowerCase());
              }}
              onBlur={() => setHexDraft(null)}
              className="w-24 font-mono uppercase"
            />
          </div>
        </Field>
      </div>

      <SectionLabel>Model</SectionLabel>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Info className="h-4 w-4" />
        Model ID: <span className="font-medium text-foreground/80">{preset.id}</span> · {preset.description}
      </p>
    </div>
  );
}
