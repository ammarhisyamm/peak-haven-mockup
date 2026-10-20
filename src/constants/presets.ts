/**
 * Packaging preset catalogue. All dimensions are in millimeters.
 */

export type PackagingCategory = 'box' | 'bottle' | 'label';

export type ModelKind = 'tuck-end' | 'mailer' | 'dropper' | 'serum' | 'jar' | 'label';

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
  kind: 'dropper' | 'serum' | 'jar';
  dimensions: CylinderDimensions;
}

export interface LabelPreset extends PresetBase {
  category: 'label';
  kind: 'label';
  dimensions: BoxDimensions;
}

export type PackagingPreset = BoxPreset | BottlePreset | LabelPreset;

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
    id: 'M01',
    name: 'Mailer M01 (E-commerce)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 150, height: 50, depth: 100 },
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
  bottle: 'D010',
  label: 'L01',
};

export const CATEGORY_LABELS: Record<PackagingCategory, string> = {
  box: 'Boxes',
  bottle: 'Bottles & Jars',
  label: 'Labels',
};

export function getPreset(id: string): PackagingPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Human-readable dimension string, e.g. "25 × 50 × 25 mm" or "Ø22 × 48 mm". */
export function formatDimensions(preset: PackagingPreset): string {
  if (preset.category === 'bottle') {
    const { diameter, height } = preset.dimensions;
    return `Ø${diameter} × ${height} mm`;
  }
  const { width, height, depth } = preset.dimensions;
  return `${width} × ${height} × ${depth} mm`;
}

/* ------------------------------------------------------------------ */
/* Artwork faces                                                      */
/* ------------------------------------------------------------------ */

export type FaceKey = 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';

/** Three.js BoxGeometry material order: [+X, -X, +Y, -Y, +Z, -Z]. */
export const BOX_FACE_ORDER: FaceKey[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];

/** Order the faces are listed in the inspector UI. */
export const FACE_UI_ORDER: FaceKey[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const FACE_LABELS: Record<FaceKey, string> = {
  right: 'Right (+X)',
  left: 'Left (−X)',
  top: 'Top (+Y)',
  bottom: 'Bottom (−Y)',
  front: 'Front (+Z)',
  back: 'Back (−Z)',
};

/** Faces that accept artwork for a given category. */
export function facesForCategory(category: PackagingCategory): FaceKey[] {
  return category === 'box' ? FACE_UI_ORDER : ['front'];
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
};

/* ------------------------------------------------------------------ */
/* Material finishes                                                  */
/* ------------------------------------------------------------------ */

export type FinishId = 'matte' | 'glossy' | 'kraft';

export interface FinishPreset {
  id: FinishId;
  label: string;
  roughness: number;
  metalness: number;
  /** When set, overrides the user-picked base color. */
  baseColor?: string;
}

export const FINISHES: Record<FinishId, FinishPreset> = {
  matte: { id: 'matte', label: 'Matte', roughness: 0.75, metalness: 0.05 },
  glossy: { id: 'glossy', label: 'Glossy', roughness: 0.15, metalness: 0.15 },
  kraft: { id: 'kraft', label: 'Kraft Paper', roughness: 0.9, metalness: 0, baseColor: '#c49a6c' },
};

export const DEFAULT_BASE_COLOR = '#f5f5f4';
