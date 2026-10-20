/**
 * Packaging preset catalogue. All dimensions are in millimeters.
 */

export type PackagingCategory = 'box' | 'bottle' | 'set' | 'label';

export type ModelKind = 'tuck-end' | 'mailer' | 'dropper' | 'serum' | 'jar' | 'vial' | 'vial-set' | 'label';

export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface CylinderDimensions {
  diameter: number;
  height: number;
}

interface PresetBase {
  id: string;
  name: string;
  description: string;
}

export interface BoxPreset extends PresetBase {
  category: 'box';
  kind: 'tuck-end' | 'mailer';
  dimensions: BoxDimensions;
}

export interface BottlePreset extends PresetBase {
  category: 'bottle';
  kind: 'dropper' | 'serum' | 'jar' | 'vial';
  dimensions: CylinderDimensions;
}

export interface LabelPreset extends PresetBase {
  category: 'label';
  kind: 'label';
  dimensions: BoxDimensions;
}

/** A carton standing next to the vial it holds (box on the left, vial on the right). */
export interface SetPreset extends PresetBase {
  category: 'set';
  kind: 'vial-set';
  dimensions: { box: BoxDimensions; vial: CylinderDimensions };
}

export type PackagingPreset = BoxPreset | BottlePreset | SetPreset | LabelPreset;

/** Scene scale: 1 Three.js world unit = 50 mm. */
export const MM_PER_UNIT = 50;

export const PRESETS: PackagingPreset[] = [
  // Boxes (folded tuck-end & mailer)
  {
    id: 'B034',
    name: 'B034 (Sample/Essential Oil)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 25, height: 50, depth: 25 },
  },
  {
    id: 'B040',
    name: 'B040 (Serum 30ml)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 35, height: 85, depth: 35 },
  },
  {
    id: 'B060',
    name: 'B060 (Lotion 100ml)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 45, height: 120, depth: 45 },
  },
  {
    id: 'B080',
    name: 'B080 (Cream Jar 50g)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 60, height: 60, depth: 60 },
  },
  {
    id: 'M01',
    name: 'Mailer M01 (E-commerce)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 150, height: 50, depth: 100 },
  },
  {
    id: 'M02',
    name: 'Mailer M02 (Square)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 150, height: 50, depth: 150 },
  },
  {
    id: 'M03',
    name: 'Mailer M03 (Shipping)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 250, height: 100, depth: 180 },
  },
  {
    id: 'P01',
    name: 'Pizza Box P01 (12 inch)',
    description: 'Corrugated pizza box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 310, height: 40, depth: 310 },
  },

  // Bottles & jars (cylinder body + cap)
  {
    id: 'D010',
    name: 'Dropper D010 (Pairs with B034)',
    description: 'Dropper bottle with bulb',
    category: 'bottle',
    kind: 'dropper',
    dimensions: { diameter: 22, height: 48 },
  },
  {
    id: 'D030',
    name: 'Serum Bottle D030 (30ml)',
    description: 'Serum bottle with screw cap',
    category: 'bottle',
    kind: 'serum',
    dimensions: { diameter: 33, height: 80 },
  },
  {
    id: 'J050',
    name: 'Cosmetic Jar J050 (50g)',
    description: 'Wide cosmetic jar with lid',
    category: 'bottle',
    kind: 'jar',
    dimensions: { diameter: 55, height: 40 },
  },
  {
    id: 'V03',
    name: 'Vial V03 (3ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 17, height: 40 },
  },
  {
    id: 'V05',
    name: 'Vial V05 (5ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 22, height: 48 },
  },
  {
    id: 'V10',
    name: 'Vial V10 (10ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 24, height: 58 },
  },

  // Vial + box sets
  {
    id: 'S03',
    name: 'Set S03 (3ml Vial + Box)',
    description: 'Tuck-end carton with its glass vial',
    category: 'set',
    kind: 'vial-set',
    dimensions: { box: { width: 22, height: 58, depth: 22 }, vial: { diameter: 17, height: 40 } },
  },
  {
    id: 'S10',
    name: 'Set S10 (10ml Vial + Box)',
    description: 'Tuck-end carton with its glass vial',
    category: 'set',
    kind: 'vial-set',
    dimensions: { box: { width: 32, height: 80, depth: 32 }, vial: { diameter: 24, height: 58 } },
  },

  // Labels / stickers (thin box mesh)
  {
    id: 'L01',
    name: 'Label L01',
    description: 'Rectangular sticker',
    category: 'label',
    kind: 'label',
    dimensions: { width: 30, height: 15, depth: 0.5 },
  },
  {
    id: 'L02',
    name: 'Label L02',
    description: 'Rectangular sticker',
    category: 'label',
    kind: 'label',
    dimensions: { width: 50, height: 25, depth: 0.5 },
  },
  {
    id: 'L03',
    name: 'Full Wrap L03',
    description: 'Full-wrap label',
    category: 'label',
    kind: 'label',
    dimensions: { width: 70, height: 30, depth: 0.5 },
  },
];

export const DEFAULT_PRESET_ID = 'B034';

/** Default preset for each category, used when switching category tabs. */
export const CATEGORY_DEFAULTS: Record<PackagingCategory, string> = {
  box: 'B034',
  bottle: 'V10',
  set: 'S10',
  label: 'L01',
};

export const CATEGORY_LABELS: Record<PackagingCategory, string> = {
  box: 'Boxes',
  bottle: 'Bottles & Vials',
  set: 'Vial + Box',
  label: 'Labels',
};

export function getPreset(id: string): PackagingPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/* ------------------------------------------------------------------ */
/* Custom sizes & units                                               */
/* ------------------------------------------------------------------ */

/** A user-entered size that replaces a preset's dimensions (mm). Sets only resize the box. */
export type SizeOverride = BoxDimensions | CylinderDimensions;

/** The preset with its dimensions replaced by a custom size, when one is set. */
export function resolvePreset(preset: PackagingPreset, size: SizeOverride | null): PackagingPreset {
  if (!size) return preset;
  if (preset.category === 'bottle' && 'diameter' in size) return { ...preset, dimensions: size };
  if (preset.category === 'set' && 'width' in size) return { ...preset, dimensions: { ...preset.dimensions, box: size } };
  if ((preset.category === 'box' || preset.category === 'label') && 'width' in size) {
    return { ...preset, dimensions: size };
  }
  return preset;
}

/** The editable dimensions of a preset (the box of a set). */
export function editableSize(preset: PackagingPreset): SizeOverride {
  return preset.category === 'set' ? preset.dimensions.box : preset.dimensions;
}

export type Unit = 'mm' | 'in';
export const MM_PER_INCH = 25.4;

export function fromMm(mm: number, unit: Unit): number {
  return unit === 'mm' ? mm : mm / MM_PER_INCH;
}

export function toMm(value: number, unit: Unit): number {
  return unit === 'mm' ? value : value * MM_PER_INCH;
}

function fmt(mm: number, unit: Unit): string {
  const v = fromMm(mm, unit);
  return unit === 'mm' ? `${Math.round(v * 10) / 10}` : `${Math.round(v * 100) / 100}`;
}

/** Human-readable dimension string, e.g. "25 × 50 × 25 mm" or "Ø22 × 48 mm". */
export function formatDimensions(preset: PackagingPreset, unit: Unit = 'mm'): string {
  if (preset.category === 'bottle') {
    const { diameter, height } = preset.dimensions;
    return `Ø${fmt(diameter, unit)} × ${fmt(height, unit)} ${unit}`;
  }
  if (preset.category === 'set') {
    const { box, vial } = preset.dimensions;
    return `Box ${fmt(box.width, unit)} × ${fmt(box.height, unit)} × ${fmt(box.depth, unit)} · Vial Ø${fmt(vial.diameter, unit)} × ${fmt(vial.height, unit)} ${unit}`;
  }
  const { width, height, depth } = preset.dimensions;
  return `${fmt(width, unit)} × ${fmt(height, unit)} × ${fmt(depth, unit)} ${unit}`;
}

/** Whether the model has a lid that can be opened (boxes and the box of a set). */
export function canOpen(preset: PackagingPreset): boolean {
  return preset.category === 'box' || preset.category === 'set';
}

/** Board thickness in mm, used for the opening box panels. */
export function boardThickness(preset: PackagingPreset): number {
  return preset.kind === 'mailer' ? 3 : 0.6;
}

/* ------------------------------------------------------------------ */
/* Artwork faces                                                      */
/* ------------------------------------------------------------------ */

export type BoxFace = 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';

/**
 * Box faces, `label` for the vial in a vial + box set, and `dieline`: one full-net artwork
 * that is split across every face (see lib/dieline.ts). A per-face upload overrides the dieline.
 */
export type FaceKey = BoxFace | 'label' | 'dieline';

/** Three.js BoxGeometry material order: [+X, -X, +Y, -Y, +Z, -Z]. */
export const BOX_FACE_ORDER: BoxFace[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];

/** Order the faces are listed in the inspector UI. */
export const FACE_UI_ORDER: BoxFace[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const FACE_LABELS: Record<FaceKey, string> = {
  right: 'Right (+X)',
  left: 'Left (−X)',
  top: 'Top (+Y)',
  bottom: 'Bottom (−Y)',
  front: 'Front (+Z)',
  back: 'Back (−Z)',
  label: 'Vial label',
  dieline: 'Full dieline',
};

/** Faces that accept a separate per-face upload for a given category (the dieline is handled separately). */
export function facesForCategory(category: PackagingCategory): FaceKey[] {
  if (category === 'box') return FACE_UI_ORDER;
  if (category === 'set') return ['label', ...FACE_UI_ORDER];
  return ['front'];
}

/** Map of face → object URL of the uploaded image (null when empty). */
export type ArtworkMap = Record<FaceKey, string | null>;

export const EMPTY_ARTWORK: ArtworkMap = {
  right: null,
  left: null,
  top: null,
  bottom: null,
  front: null,
  back: null,
  label: null,
  dieline: null,
};

/* ------------------------------------------------------------------ */
/* Material finishes                                                  */
/* ------------------------------------------------------------------ */

export type FinishId = 'matte' | 'glossy' | 'kraft' | 'corrugated' | 'metallic';

export interface FinishPreset {
  id: FinishId;
  label: string;
  roughness: number;
  metalness: number;
  /** When set, overrides the user-picked base color. */
  baseColor?: string;
  /** Procedural paper grain applied as a bump map (and as color when there's no artwork). */
  grain?: 'kraft' | 'corrugated';
  /** Color of the inside of an opened box. */
  interiorColor: string;
}

export const FINISHES: Record<FinishId, FinishPreset> = {
  matte: { id: 'matte', label: 'Matte', roughness: 0.75, metalness: 0.05, interiorColor: '#ece9e2' },
  glossy: { id: 'glossy', label: 'Glossy', roughness: 0.15, metalness: 0.15, interiorColor: '#ece9e2' },
  kraft: {
    id: 'kraft',
    label: 'Kraft Paper',
    roughness: 0.9,
    metalness: 0,
    baseColor: '#c49a6c',
    grain: 'kraft',
    interiorColor: '#b98d5f',
  },
  corrugated: {
    id: 'corrugated',
    label: 'Corrugated Board',
    roughness: 0.95,
    metalness: 0,
    baseColor: '#b8905f',
    grain: 'corrugated',
    interiorColor: '#a8814f',
  },
  metallic: { id: 'metallic', label: 'Metallic Foil', roughness: 0.28, metalness: 0.85, interiorColor: '#d9d9d9' },
};

export const FINISH_ORDER: FinishId[] = ['matte', 'glossy', 'kraft', 'corrugated', 'metallic'];

export const DEFAULT_BASE_COLOR = '#f5f5f4';
