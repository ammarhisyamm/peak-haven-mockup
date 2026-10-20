/**
 * Packaging preset catalogue. All dimensions are in millimeters.
 */

import { LATHE_SPECS, objectBoundsMm, type ObjectKind } from '../lib/objectSpecs';

export type PackagingCategory = 'box' | 'bottle' | 'set' | 'label' | 'object';

/** Library groups and their sub-types, in the order the model library lists them. */
export const LIBRARY_GROUPS = [
  'Boxes',
  'Bottles',
  'Food Packaging',
  'Containers & Cups & Bowls',
  'Apparel',
  'Devices',
  'Prints',
  'Others',
  'Vial + Box',
  'Labels',
] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

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
  group: LibraryGroup;
  /** Sub-type shown as a filter chip inside its group, e.g. "Mailer Box". */
  type: string;
  /** Base color applied when this model is picked (e.g. a black T-shirt). */
  defaultColor?: string;
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

/** Any other model, built from shape data in lib/objectSpecs.ts. Dimensions are width × height × depth. */
export interface ObjectPreset extends PresetBase {
  category: 'object';
  kind: ObjectKind;
  dimensions: BoxDimensions;
}

export type PackagingPreset = BoxPreset | BottlePreset | SetPreset | LabelPreset | ObjectPreset;

function tuck(id: string, name: string, type: string, width: number, height: number, depth: number, kind: 'tuck-end' | 'mailer' = 'tuck-end'): BoxPreset {
  return {
    id,
    name,
    description: kind === 'mailer' ? 'Corrugated mailer box' : 'Folded tuck-end carton',
    group: type === 'Food Box' ? 'Food Packaging' : 'Boxes',
    type,
    category: 'box',
    kind,
    dimensions: { width, height, depth },
  };
}

function obj(
  id: string,
  name: string,
  group: LibraryGroup,
  type: string,
  kind: ObjectKind,
  [width, height, depth]: [number, number, number],
  description = type,
  defaultColor?: string,
): ObjectPreset {
  return { id, name, description, group, type, category: 'object', kind, dimensions: { width, height, depth }, defaultColor };
}

/** Lathe objects are round: depth defaults to the width (a different depth makes them oval). */
const round = (d: number, h: number, depth = d): [number, number, number] => [d, h, depth];

const OBJECT_PRESETS: ObjectPreset[] = [
  // Boxes
  obj('GB01', 'Gift Box with Lid', 'Boxes', 'Gift Box', 'gift-box', [200, 90, 200], 'Rigid box with telescoping lid', '#7f1d1d'),
  obj('LB01', 'Two-piece Lid Box', 'Boxes', 'Boxes with Lid', 'gift-box', [120, 60, 120], 'Base and lid box', '#f5f5f4'),
  obj('WB01', 'Window Box', 'Boxes', 'Boxes with Window', 'window-box', [80, 160, 50], 'Carton with a clear front window'),
  obj('HB01', 'Handle Box', 'Boxes', 'Boxes with Handle', 'handle-box', [160, 170, 90], 'Carry box with a built-in handle'),
  obj('HG01', 'Hanging Box', 'Boxes', 'Hanging Box', 'hanging-box', [60, 130, 25], 'Retail box with a euro hang tab'),
  obj('PG01', 'Hexagon Box', 'Boxes', 'Polygonal Box', 'hex-box', [100, 120, 100], 'Six-sided box with lid'),
  obj('PL01', 'Clear PET Box', 'Boxes', 'Plastic Box', 'clear-box', [60, 100, 60], 'Clear plastic box'),
  obj('ST01', 'Sleeve & Tray Box', 'Boxes', 'Sleeve & Tray Box', 'sleeve-box', [160, 50, 110], 'Drawer tray with printed sleeve'),
  obj('DB01', 'Counter Display Box', 'Boxes', 'Display Box', 'display-box', [220, 200, 160], 'Countertop display with header'),

  // Bottles
  obj('BW01', 'Water Bottle 500ml', 'Bottles', 'Water Bottle', 'water-bottle', round(65, 210), 'PET water bottle', '#dbeafe'),
  obj('BD01', 'Juice Bottle 350ml', 'Bottles', 'Drink Bottle', 'drink-bottle', round(62, 190), 'Opaque drink bottle', '#fb923c'),
  obj('BN01', 'Wine Bottle 750ml', 'Bottles', 'Wine Bottle', 'wine-bottle', round(76, 300), 'Bordeaux wine bottle', '#f5f5f4'),
  obj('BB01', 'Beer Bottle 330ml', 'Bottles', 'Beer Bottle', 'beer-bottle', round(60, 235), 'Amber beer bottle', '#f5f5f4'),
  obj('BP01', 'Perfume Bottle 50ml', 'Bottles', 'Perfume Bottle', 'perfume-bottle', [60, 100, 36], 'Glass perfume bottle', '#fbcfe8'),
  obj('BS01', 'Shampoo Bottle 250ml', 'Bottles', 'Shampoo Bottle', 'shampoo-bottle', round(70, 200, 46), 'Oval bottle with flip cap', '#a7f3d0'),
  obj('BC01', 'Lotion Bottle 150ml', 'Bottles', 'Cosmetic Bottle', 'cosmetic-bottle', round(50, 150), 'Cosmetic bottle with disc cap', '#fce7f3'),
  obj('BO01', 'Olive Oil Bottle 500ml', 'Bottles', 'Oil Bottle', 'oil-bottle', round(60, 270), 'Tall glass oil bottle', '#f5f5f4'),
  obj('BU01', 'Supplement Bottle', 'Bottles', 'Supplement Bottle', 'supplement-bottle', round(65, 120), 'Wide-mouth capsule bottle', '#ffffff'),
  obj('BK01', 'Sauce Bottle', 'Bottles', 'Sauce Bottle', 'sauce-bottle', round(60, 190), 'Squeeze sauce bottle', '#dc2626'),
  obj('BR01', 'Trigger Spray Bottle', 'Bottles', 'Spray Bottle', 'spray-bottle', round(65, 230), 'Bottle with trigger sprayer', '#e0f2fe'),
  obj('BA01', 'Amber Dropper 30ml', 'Bottles', 'Dropper Bottle', 'amber-dropper', round(36, 110), 'Amber glass dropper bottle', '#f5f5f4'),
  obj('BM01', 'Pump Bottle 200ml', 'Bottles', 'Pump Bottle', 'pump-bottle', round(60, 190), 'Lotion pump bottle', '#f5f5f4'),
  obj('BG01', 'Swing Glass Bottle', 'Bottles', 'Glass Bottle', 'glass-bottle', round(70, 230), 'Clear glass bottle with cork', '#fde68a'),
  obj('BL01', 'PET Bottle 1L', 'Bottles', 'Plastic Bottle', 'plastic-bottle', round(80, 280), 'Clear plastic soda bottle', '#fca5a5'),
  obj('BJ01', 'Jerry Can 5L', 'Bottles', 'Jerry Can', 'jerry-can', [200, 300, 120], 'Plastic jerry can', '#facc15'),

  // Food packaging
  obj('FP01', 'Stand-up Pouch', 'Food Packaging', 'Pouch', 'pouch', [140, 210, 50], 'Stand-up pouch with zipper'),
  obj('FC01', 'Chip Bag', 'Food Packaging', 'Snack Bag', 'chip-bag', [180, 260, 60], 'Pillow snack bag'),
  obj('FS01', 'Soda Can 330ml', 'Food Packaging', 'Can', 'soda-can', round(66, 122), 'Aluminium beverage can', '#e5e7eb'),
  obj('FT01', 'Food Tin', 'Food Packaging', 'Can', 'food-tin', round(73, 110), 'Food tin can', '#e5e7eb'),
  obj('FH01', 'Honey Jar', 'Food Packaging', 'Jar', 'honey-jar', round(70, 95), 'Glass honey jar', '#f59e0b'),
  obj('FY01', 'Yogurt Cup', 'Food Packaging', 'Cup', 'yogurt-cup', round(75, 90), 'Printed yogurt cup'),
  obj('FK01', 'Takeout Box', 'Food Packaging', 'Takeout Box', 'takeout-box', [100, 110, 100], 'Noodle takeout box'),
  obj('FB01', 'Paper Bag', 'Food Packaging', 'Paper Bag', 'paper-bag', [250, 320, 120], 'Shopping paper bag', '#c49a6c'),

  // Containers, cups & bowls
  obj('CM01', 'Ceramic Mug 11oz', 'Containers & Cups & Bowls', 'Mug', 'mug', round(82, 95), 'Classic ceramic mug', '#ffffff'),
  obj('CT01', 'Tumbler with Straw', 'Containers & Cups & Bowls', 'Tumbler', 'tumbler', round(90, 210), 'Insulated tumbler', '#a5b4fc'),
  obj('CF01', 'Food Container', 'Containers & Cups & Bowls', 'Food Container', 'food-container', [180, 70, 130], 'Clear food container with lid', '#16a34a'),
  obj('CP01', 'Paper Cup 12oz', 'Containers & Cups & Bowls', 'Cup', 'paper-cup', round(90, 110), 'Paper coffee cup', '#ffffff'),
  obj('CB01', 'Bowl', 'Containers & Cups & Bowls', 'Bowl', 'bowl', round(160, 75), 'Ceramic bowl', '#ffffff'),

  // Apparel
  obj('AT01', 'T-shirt', 'Apparel', 'T-shirt', 't-shirt', [600, 720, 40], 'Crew neck T-shirt', '#ffffff'),
  obj('AT02', 'Black T-shirt', 'Apparel', 'Black T-shirt', 't-shirt', [600, 720, 40], 'Crew neck T-shirt', '#18181b'),
  obj('AH01', 'Hoodie', 'Apparel', 'Hoodie', 'hoodie', [700, 760, 60], 'Pullover hoodie', '#9ca3af'),
  obj('AP01', 'Polo Shirt', 'Apparel', 'Polo Shirt', 'polo', [600, 720, 40], 'Polo shirt', '#1e3a8a'),
  obj('AC01', 'Baseball Cap', 'Apparel', 'Hat', 'hat', [190, 120, 270], 'Six-panel baseball cap', '#111827'),
  obj('AS01', 'Sweatpants', 'Apparel', 'Sweatpants', 'sweatpants', [500, 1000, 40], 'Jogger sweatpants', '#4b5563'),
  obj('AS02', 'Shorts', 'Apparel', 'Shorts', 'shorts', [520, 520, 40], 'Sport shorts', '#1f2937'),
  obj('AK01', 'Tank Top', 'Apparel', 'Tank Top', 'tank-top', [520, 700, 30], 'Tank top', '#ffffff'),
  obj('AA01', 'Apron', 'Apparel', 'Apron', 'apron', [600, 850, 20], 'Bib apron', '#78350f'),
  obj('AB01', 'Tote Bag', 'Apparel', 'Accessories', 'tote-bag', [380, 560, 20], 'Canvas tote bag', '#f5f0e6'),

  // Devices
  obj('DP01', 'Smartphone', 'Devices', 'iPhone', 'phone', [71.5, 147, 7.8], 'Smartphone, screen shows your artwork', '#e5e7eb'),
  obj('DL01', 'Laptop 13"', 'Devices', 'Laptop', 'laptop', [304, 205, 215], 'Laptop, screen shows your artwork', '#e5e7eb'),
  obj('DT01', 'Tablet 11"', 'Devices', 'iPad', 'tablet', [178, 247, 6], 'Tablet, screen shows your artwork', '#e5e7eb'),
  obj('DW01', 'Smart Watch', 'Devices', 'Apple Watch', 'watch', [40, 46, 11], 'Smart watch, screen shows your artwork', '#f97316'),
  obj('DC01', 'Phone Case', 'Devices', 'Device Accessories', 'phone-case', [76, 152, 10], 'Printed phone case', '#ffffff'),

  // Prints
  obj('PB01', 'Hardcover Book', 'Prints', 'Book', 'book', [150, 230, 28], 'Hardcover book', '#1e293b'),
  obj('PM01', 'Magazine A4', 'Prints', 'Magazine', 'magazine', [210, 280, 5], 'Perfect-bound magazine'),
  obj('PR01', 'Tri-fold Brochure', 'Prints', 'Brochure', 'brochure', [297, 210, 0.3], 'Tri-fold brochure (A4)'),
  obj('PN01', 'Spiral Notebook A5', 'Prints', 'Notebook', 'notebook', [148, 210, 14], 'Spiral notebook'),
  obj('PC01', 'Desk Calendar', 'Prints', 'Calendar', 'calendar', [210, 150, 90], 'Tent desk calendar'),
  obj('PP01', 'Poster A2', 'Prints', 'Poster', 'poster', [420, 594, 1], 'Hanging poster'),
  obj('PA01', 'A4 Paper', 'Prints', 'Paper', 'paper', [210, 297, 0.3], 'Letterhead / flyer sheet, lying flat'),
  obj('PK01', 'Business Card', 'Prints', 'Card', 'card', [90, 54, 0.6], 'Business cards, front and back'),
  obj('PE01', 'Envelope DL', 'Prints', 'Envelope', 'envelope', [220, 110, 1.5], 'DL envelope, lying flat'),
  obj('PF01', 'Presentation Folder', 'Prints', 'Folder', 'folder', [230, 310, 4], 'Pocket folder', '#0f766e'),

  // Others
  obj('OL01', 'ID Card Lanyard', 'Others', 'Lanyard', 'lanyard', [54, 86, 1], 'ID card with lanyard strap', '#2563eb'),
  obj('OB01', 'Roll-up Banner', 'Others', 'Banner', 'banner', [850, 2000, 300], 'Roll-up banner stand'),
  obj('OF01', 'Flag', 'Others', 'Flag', 'flag', [900, 600, 1], 'Flag on a pole'),
  obj('OR01', 'Picture Frame', 'Others', 'Frame', 'frame', [300, 400, 25], 'Picture frame with mat', '#1f2937'),
  obj('OK01', 'Bucket', 'Others', 'Barrel & Bucket', 'bucket', round(170, 190), 'Plastic bucket with handle', '#f5f5f4'),
  obj('OK02', 'Barrel', 'Others', 'Barrel & Bucket', 'barrel', round(400, 600), 'Barrel with metal hoops', '#a16207'),
  obj('OV01', 'Billboard', 'Others', 'Billboard', 'billboard', [4800, 2400, 120], 'Roadside billboard'),
  obj('OS01', 'A-frame Sign', 'Others', 'Sign', 'sign', [600, 900, 450], 'Sidewalk A-frame sign', '#111827'),
  obj('OI01', 'Box Insert', 'Others', 'Insert', 'insert', [200, 30, 150], 'Tray insert with cavities'),
  obj('OC01', 'Candle Jar', 'Others', 'Candle', 'candle', round(80, 100), 'Candle in a glass jar', '#fef3c7'),
];

/** Scene scale: 1 Three.js world unit = 50 mm. */
export const MM_PER_UNIT = 50;

export const PRESETS: PackagingPreset[] = [
  // Boxes (folded tuck-end & mailer)
  {
    id: 'B034',
    group: 'Boxes',
    type: 'Tuck End Box',
    name: 'B034 (Sample/Essential Oil)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 25, height: 50, depth: 25 },
  },
  {
    id: 'B040',
    group: 'Boxes',
    type: 'Product Box',
    name: 'B040 (Serum 30ml)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 35, height: 85, depth: 35 },
  },
  {
    id: 'B060',
    group: 'Boxes',
    type: 'Product Box',
    name: 'B060 (Lotion 100ml)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 45, height: 120, depth: 45 },
  },
  {
    id: 'B080',
    group: 'Boxes',
    type: 'Square Box',
    name: 'B080 (Cream Jar 50g)',
    description: 'Folded tuck-end carton',
    category: 'box',
    kind: 'tuck-end',
    dimensions: { width: 60, height: 60, depth: 60 },
  },
  {
    id: 'M01',
    group: 'Boxes',
    type: 'Mailer Box',
    name: 'Mailer M01 (E-commerce)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 150, height: 50, depth: 100 },
  },
  {
    id: 'M02',
    group: 'Boxes',
    type: 'Mailer Box',
    name: 'Mailer M02 (Square)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 150, height: 50, depth: 150 },
  },
  {
    id: 'M03',
    group: 'Boxes',
    type: 'Shipping Box',
    name: 'Mailer M03 (Shipping)',
    description: 'Corrugated mailer box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 250, height: 100, depth: 180 },
  },
  {
    id: 'P01',
    group: 'Food Packaging',
    type: 'Pizza Box',
    name: 'Pizza Box P01 (12 inch)',
    description: 'Corrugated pizza box',
    category: 'box',
    kind: 'mailer',
    dimensions: { width: 310, height: 40, depth: 310 },
  },

  // Bottles & jars (cylinder body + cap)
  {
    id: 'D010',
    group: 'Bottles',
    type: 'Dropper Bottle',
    name: 'Dropper D010 (Pairs with B034)',
    description: 'Dropper bottle with bulb',
    category: 'bottle',
    kind: 'dropper',
    dimensions: { diameter: 22, height: 48 },
  },
  {
    id: 'D030',
    group: 'Bottles',
    type: 'Cosmetic Bottle',
    name: 'Serum Bottle D030 (30ml)',
    description: 'Serum bottle with screw cap',
    category: 'bottle',
    kind: 'serum',
    dimensions: { diameter: 33, height: 80 },
  },
  {
    id: 'J050',
    group: 'Containers & Cups & Bowls',
    type: 'Jar',
    name: 'Cosmetic Jar J050 (50g)',
    description: 'Wide cosmetic jar with lid',
    category: 'bottle',
    kind: 'jar',
    dimensions: { diameter: 55, height: 40 },
  },
  {
    id: 'V03',
    group: 'Bottles',
    type: 'Vial',
    name: 'Vial V03 (3ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 17, height: 40 },
  },
  {
    id: 'V05',
    group: 'Bottles',
    type: 'Vial',
    name: 'Vial V05 (5ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 22, height: 48 },
  },
  {
    id: 'V10',
    group: 'Bottles',
    type: 'Vial',
    name: 'Vial V10 (10ml)',
    description: 'Clear glass vial with aluminium crimp cap',
    category: 'bottle',
    kind: 'vial',
    dimensions: { diameter: 24, height: 58 },
  },

  // Vial + box sets
  {
    id: 'S03',
    group: 'Vial + Box',
    type: 'Vial Set',
    name: 'Set S03 (3ml Vial + Box)',
    description: 'Tuck-end carton with its glass vial',
    category: 'set',
    kind: 'vial-set',
    dimensions: { box: { width: 22, height: 58, depth: 22 }, vial: { diameter: 17, height: 40 } },
  },
  {
    id: 'S10',
    group: 'Vial + Box',
    type: 'Vial Set',
    name: 'Set S10 (10ml Vial + Box)',
    description: 'Tuck-end carton with its glass vial',
    category: 'set',
    kind: 'vial-set',
    dimensions: { box: { width: 32, height: 80, depth: 32 }, vial: { diameter: 24, height: 58 } },
  },

  // Labels / stickers (thin box mesh)
  {
    id: 'L01',
    group: 'Labels',
    type: 'Sticker',
    name: 'Label L01',
    description: 'Rectangular sticker',
    category: 'label',
    kind: 'label',
    dimensions: { width: 30, height: 15, depth: 0.5 },
  },
  {
    id: 'L02',
    group: 'Labels',
    type: 'Sticker',
    name: 'Label L02',
    description: 'Rectangular sticker',
    category: 'label',
    kind: 'label',
    dimensions: { width: 50, height: 25, depth: 0.5 },
  },
  {
    id: 'L03',
    group: 'Labels',
    type: 'Full Wrap Label',
    name: 'Full Wrap L03',
    description: 'Full-wrap label',
    category: 'label',
    kind: 'label',
    dimensions: { width: 70, height: 30, depth: 0.5 },
  },

  // More folding cartons
  tuck('SQ01', 'Square Box', 'Square Box', 80, 80, 80),
  tuck('PF02', 'Perfume Box 50ml', 'Perfume Box', 55, 115, 40),
  tuck('PR02', 'Product Box (Cosmetics)', 'Product Box', 90, 150, 50),
  tuck('FD01', 'Burger Box', 'Food Box', 110, 80, 110, 'mailer'),
  tuck('FD02', 'Cereal Box', 'Food Box', 190, 280, 60),
  tuck('FL01', 'Folding Box (Flat)', 'Folding Box', 120, 40, 90),
  tuck('TE01', 'Tall Tuck End Box', 'Tuck End Box', 70, 140, 30),
  tuck('SH01', 'Shipping Box (Large)', 'Shipping Box', 400, 300, 300, 'mailer'),

  ...OBJECT_PRESETS,
];

export const DEFAULT_PRESET_ID = 'B034';

/** Default preset for each category, used when switching category tabs. */
export const CATEGORY_DEFAULTS: Record<PackagingCategory, string> = {
  box: 'B034',
  bottle: 'V10',
  set: 'S10',
  label: 'L01',
  object: 'AT01',
};

export const CATEGORY_LABELS: Record<PackagingCategory, string> = {
  box: 'Boxes',
  bottle: 'Bottles & Vials',
  set: 'Vial + Box',
  label: 'Labels',
  object: 'Objects',
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
  if ((preset.category === 'box' || preset.category === 'label' || preset.category === 'object') && 'width' in size) {
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
  if (preset.category === 'object' && preset.kind in LATHE_SPECS && width === depth) {
    return `Ø${fmt(width, unit)} × ${fmt(height, unit)} ${unit}`;
  }
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
  if (category === 'object') return ['front', 'back'];
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

/** World bounding size of a preset in mm (x, y, z), including stands, straps, handles and so on. */
export function presetBoundsMm(preset: PackagingPreset): [number, number, number] {
  if (preset.category === 'object') {
    const { width, height, depth } = preset.dimensions;
    return objectBoundsMm(preset.kind, width, height, depth);
  }
  if (preset.category === 'bottle') {
    const { diameter, height } = preset.dimensions;
    return [diameter, height, diameter];
  }
  if (preset.category === 'set') {
    const { box, vial } = preset.dimensions;
    return [box.width + vial.diameter * 0.35 + vial.diameter, Math.max(box.height, vial.height), Math.max(box.depth, vial.diameter)];
  }
  const { width, height, depth } = preset.dimensions;
  return [width, height, depth];
}
