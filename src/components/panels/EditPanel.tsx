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
import { DropZone, FaceUploadRow, Field, PanelTitle, SectionLabel, SizeEditor } from '../ui/controls';

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
      <PanelTitle>Upload images</PanelTitle>
      <DropZone
        url={artwork[mainFace]}
        title="Upload"
        hint={
          multiFace
            ? 'Full dieline artwork. Use the template below so every panel lines up.'
            : preset.category === 'bottle'
              ? 'Label artwork. It wraps around the front of the body.'
              : 'Sticker artwork, printed on the front.'
        }
        onFile={(f) => onUpload(mainFace, f)}
        onClear={() => onUpload(mainFace, null)}
      />
      <button
        type="button"
        onClick={onDownloadDieline}
        className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-violet-700"
      >
        <Download className="h-4 w-4" />
        Download dieline (SVG)
      </button>

      {multiFace && (
        <>
          <button
            type="button"
            onClick={() => setFacesOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Upload per face instead
            {facesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
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

      <hr className="my-5 border-slate-200" />

      <div className="space-y-2.5">
        <Field label="Material">
          <select
            value={finish}
            onChange={(e) => onFinish(e.target.value as FinishId)}
            className="-ml-1 w-full bg-transparent text-base text-slate-900 focus:outline-none"
          >
            {FINISH_ORDER.map((id) => (
              <option key={id} value={id}>
                {FINISHES[id].label}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="button"
          onClick={() => setSizeOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left hover:bg-slate-100"
        >
          <span>
            <span className="block text-xs text-slate-500">{isCustom ? 'Custom size' : 'Size'}</span>
            <span className="block text-base text-slate-900">{formatDimensions(preset, unit)}</span>
          </span>
          {sizeOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>
        {sizeOpen && (
          <div className="rounded-xl border border-slate-200 p-3">
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
              className="h-8 w-10 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed"
              aria-label="Base color"
            />
            <input
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
              className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-sm uppercase focus:border-violet-500 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      <SectionLabel>Model</SectionLabel>
      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        <Info className="h-4 w-4" />
        Model ID: <span className="font-medium text-slate-700">{preset.id}</span> · {preset.description}
      </p>
    </div>
  );
}
