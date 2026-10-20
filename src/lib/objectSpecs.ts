/**
 * Shape data for the generic object models (bottles, cups, apparel, devices, prints...).
 * Pure data so the 3D builders and the SVG library thumbnails draw from the same source.
 */

export type LatheKind =
  | 'water-bottle'
  | 'drink-bottle'
  | 'wine-bottle'
  | 'beer-bottle'
  | 'shampoo-bottle'
  | 'cosmetic-bottle'
  | 'oil-bottle'
  | 'supplement-bottle'
  | 'sauce-bottle'
  | 'spray-bottle'
  | 'amber-dropper'
  | 'pump-bottle'
  | 'glass-bottle'
  | 'plastic-bottle'
  | 'soda-can'
  | 'food-tin'
  | 'honey-jar'
  | 'yogurt-cup'
  | 'mug'
  | 'tumbler'
  | 'paper-cup'
  | 'bowl'
  | 'bucket'
  | 'barrel'
  | 'candle';

export type GarmentKind = 't-shirt' | 'hoodie' | 'polo' | 'tank-top' | 'sweatpants' | 'shorts' | 'apron';

export type CompositeKind =
  | 'gift-box'
  | 'window-box'
  | 'handle-box'
  | 'hanging-box'
  | 'hex-box'
  | 'clear-box'
  | 'sleeve-box'
  | 'display-box'
  | 'perfume-bottle'
  | 'jerry-can'
  | 'pouch'
  | 'chip-bag'
  | 'paper-bag'
  | 'takeout-box'
  | 'food-container'
  | 'hat'
  | 'tote-bag'
  | 'phone'
  | 'phone-case'
  | 'tablet'
  | 'laptop'
  | 'watch'
  | 'book'
  | 'magazine'
  | 'notebook'
  | 'brochure'
  | 'calendar'
  | 'poster'
  | 'paper'
  | 'card'
  | 'envelope'
  | 'folder'
  | 'lanyard'
  | 'banner'
  | 'flag'
  | 'frame'
  | 'billboard'
  | 'sign'
  | 'insert';

export type ObjectKind = LatheKind | GarmentKind | CompositeKind;

/** Named materials the builders can use. */
export type MatName =
  | 'body'
  | 'art'
  | 'artBack'
  | 'interior'
  | 'glass'
  | 'glassGreen'
  | 'glassAmber'
  | 'clear'
  | 'liquid'
  | 'cap'
  | 'white'
  | 'metal'
  | 'gold'
  | 'cork'
  | 'wax'
  | 'paper'
  | 'dark'
  | 'screen'
  | 'wood';

type V2 = [number, number];

export interface LathePart {
  /** Outline from the axis at the bottom to the axis at the top, as [radius fraction, height fraction]. */
  pts: V2[];
  mat: MatName;
}

export interface LatheSpec {
  parts: LathePart[];
  /** Label band (height fractions y0..y1, radius fractions r0 at y0 and r1 at y1). */
  label?: { y0: number; y1: number; r0: number; r1: number; wrap: 'aspect' | 'full'; always?: boolean };
  extras?: ('mug-handle' | 'trigger' | 'pump-head' | 'straw' | 'bucket-handle' | 'hoops' | 'wick')[];
}

const cap = (y0: number, y1: number, r: number, mat: MatName = 'cap'): LathePart => ({
  pts: [
    [0, y0],
    [r, y0],
    [r, y1 - 0.008],
    [r * 0.94, y1],
    [0, y1],
  ],
  mat,
});

export const LATHE_SPECS: Record<LatheKind, LatheSpec> = {
  'water-bottle': {
    parts: [
      { pts: [[0, 0.01], [0.84, 0.01], [0.88, 0.04], [0.88, 0.56], [0.8, 0.6], [0.88, 0.64], [0.86, 0.7], [0.5, 0.82], [0.36, 0.86], [0, 0.86]], mat: 'liquid' },
      { pts: [[0, 0], [0.92, 0], [1, 0.03], [1, 0.56], [0.92, 0.6], [1, 0.64], [1, 0.7], [0.6, 0.84], [0.38, 0.89], [0.38, 0.92], [0, 0.92]], mat: 'clear' },
      cap(0.91, 1, 0.42, 'white'),
    ],
    label: { y0: 0.3, y1: 0.54, r0: 1, r1: 1, wrap: 'full', always: true },
  },
  'drink-bottle': {
    parts: [
      { pts: [[0, 0], [0.9, 0], [1, 0.04], [1, 0.66], [0.62, 0.82], [0.46, 0.87], [0.46, 0.9], [0, 0.9]], mat: 'body' },
      cap(0.89, 1, 0.5),
    ],
    label: { y0: 0.12, y1: 0.6, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'wine-bottle': {
    parts: [
      { pts: [[0, 0], [0.97, 0], [1, 0.02], [1, 0.6], [0.9, 0.68], [0.45, 0.76], [0.32, 0.8], [0.3, 0.9], [0, 0.9]], mat: 'glassGreen' },
      { pts: [[0, 0.84], [0.33, 0.84], [0.33, 0.99], [0.3, 1], [0, 1]], mat: 'cap' },
    ],
    label: { y0: 0.14, y1: 0.48, r0: 1, r1: 1, wrap: 'aspect', always: true },
  },
  'beer-bottle': {
    parts: [
      { pts: [[0, 0], [0.96, 0], [1, 0.02], [1, 0.55], [0.85, 0.64], [0.4, 0.76], [0.3, 0.82], [0.3, 0.95], [0, 0.95]], mat: 'glassAmber' },
      cap(0.94, 1, 0.34, 'gold'),
    ],
    label: { y0: 0.12, y1: 0.44, r0: 1, r1: 1, wrap: 'aspect', always: true },
  },
  'shampoo-bottle': {
    parts: [
      { pts: [[0, 0], [0.92, 0], [1, 0.04], [1, 0.78], [0.82, 0.86], [0.52, 0.88], [0, 0.88]], mat: 'body' },
      { pts: [[0, 0.87], [0.56, 0.87], [0.56, 0.97], [0.46, 1], [0, 1]], mat: 'white' },
    ],
    label: { y0: 0.1, y1: 0.72, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'cosmetic-bottle': {
    parts: [
      { pts: [[0, 0], [0.9, 0], [1, 0.04], [1, 0.72], [0.55, 0.79], [0.4, 0.8], [0, 0.8]], mat: 'body' },
      cap(0.79, 1, 0.62, 'gold'),
    ],
    label: { y0: 0.1, y1: 0.66, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'oil-bottle': {
    parts: [
      { pts: [[0, 0], [0.96, 0], [1, 0.02], [1, 0.7], [0.42, 0.82], [0.3, 0.86], [0.3, 0.92], [0, 0.92]], mat: 'glassGreen' },
      cap(0.9, 1, 0.34, 'metal'),
    ],
    label: { y0: 0.14, y1: 0.58, r0: 1, r1: 1, wrap: 'aspect', always: true },
  },
  'supplement-bottle': {
    parts: [
      { pts: [[0, 0], [0.94, 0], [1, 0.04], [1, 0.74], [0.85, 0.8], [0.78, 0.8], [0, 0.8]], mat: 'body' },
      cap(0.79, 1, 0.84),
    ],
    label: { y0: 0.1, y1: 0.7, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'sauce-bottle': {
    parts: [
      { pts: [[0, 0], [0.85, 0], [0.95, 0.05], [1, 0.3], [1, 0.68], [0.8, 0.8], [0.42, 0.86], [0, 0.86]], mat: 'body' },
      { pts: [[0, 0.85], [0.46, 0.85], [0.46, 0.93], [0.16, 0.96], [0.1, 1], [0, 1]], mat: 'white' },
    ],
    label: { y0: 0.18, y1: 0.62, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'spray-bottle': {
    parts: [
      { pts: [[0, 0], [0.92, 0], [1, 0.04], [1, 0.62], [0.55, 0.7], [0.38, 0.72], [0, 0.72]], mat: 'body' },
      { pts: [[0, 0.71], [0.42, 0.71], [0.42, 0.78], [0.3, 0.8], [0.3, 0.84], [0, 0.84]], mat: 'white' },
    ],
    label: { y0: 0.1, y1: 0.56, r0: 1, r1: 1, wrap: 'aspect' },
    extras: ['trigger'],
  },
  'amber-dropper': {
    parts: [
      { pts: [[0, 0], [0.95, 0], [1, 0.03], [1, 0.55], [0.7, 0.62], [0.45, 0.64], [0, 0.64]], mat: 'glassAmber' },
      cap(0.63, 0.72, 0.52, 'gold'),
      { pts: [[0, 0.72], [0.38, 0.72], [0.4, 0.8], [0.34, 0.92], [0.22, 0.99], [0, 1]], mat: 'cap' },
    ],
    label: { y0: 0.1, y1: 0.48, r0: 1, r1: 1, wrap: 'aspect', always: true },
  },
  'pump-bottle': {
    parts: [
      { pts: [[0, 0], [0.92, 0], [1, 0.04], [1, 0.66], [0.7, 0.72], [0.35, 0.74], [0, 0.74]], mat: 'body' },
      { pts: [[0, 0.73], [0.44, 0.73], [0.44, 0.8], [0.18, 0.82], [0.18, 0.9], [0, 0.9]], mat: 'white' },
    ],
    label: { y0: 0.1, y1: 0.6, r0: 1, r1: 1, wrap: 'aspect' },
    extras: ['pump-head'],
  },
  'glass-bottle': {
    parts: [
      { pts: [[0, 0.02], [0.9, 0.02], [0.92, 0.5], [0.5, 0.68], [0, 0.68]], mat: 'liquid' },
      { pts: [[0, 0], [0.96, 0], [1, 0.02], [1, 0.6], [0.6, 0.75], [0.36, 0.8], [0.34, 0.92], [0, 0.92]], mat: 'glass' },
      cap(0.9, 1, 0.33, 'cork'),
    ],
    label: { y0: 0.16, y1: 0.5, r0: 1, r1: 1, wrap: 'aspect' },
  },
  'plastic-bottle': {
    parts: [
      { pts: [[0, 0.02], [0.86, 0.02], [0.92, 0.1], [0.92, 0.62], [0.6, 0.76], [0, 0.76]], mat: 'liquid' },
      { pts: [[0, 0], [0.7, 0], [0.86, 0.02], [1, 0.08], [1, 0.62], [0.68, 0.78], [0.38, 0.86], [0.36, 0.9], [0, 0.9]], mat: 'clear' },
      cap(0.89, 1, 0.42),
    ],
    label: { y0: 0.24, y1: 0.5, r0: 1, r1: 1, wrap: 'full', always: true },
  },
  'soda-can': {
    parts: [
      { pts: [[0, 0.01], [0.78, 0], [0.92, 0.02], [1, 0.08], [1, 0.88], [0.86, 0.97], [0.84, 1], [0, 1]], mat: 'metal' },
    ],
    label: { y0: 0.08, y1: 0.88, r0: 1, r1: 1, wrap: 'full', always: true },
  },
  'food-tin': {
    parts: [
      { pts: [[0, 0], [0.98, 0], [1, 0.02], [1, 0.98], [0.98, 1], [0, 1]], mat: 'metal' },
    ],
    label: { y0: 0.05, y1: 0.95, r0: 1, r1: 1, wrap: 'full', always: true },
  },
  'honey-jar': {
    parts: [
      { pts: [[0, 0.02], [0.92, 0.02], [0.92, 0.7], [0, 0.7]], mat: 'liquid' },
      { pts: [[0, 0], [0.96, 0], [1, 0.03], [1, 0.74], [0.86, 0.8], [0, 0.8]], mat: 'glass' },
      cap(0.79, 1, 0.92, 'gold'),
    ],
    label: { y0: 0.14, y1: 0.62, r0: 1, r1: 1, wrap: 'aspect', always: true },
  },
  'yogurt-cup': {
    parts: [
      { pts: [[0, 0], [0.74, 0], [0.76, 0.02], [0.98, 0.95], [1, 0.95], [1, 1], [0, 1]], mat: 'body' },
    ],
    label: { y0: 0.08, y1: 0.9, r0: 0.78, r1: 0.97, wrap: 'full', always: true },
  },
  mug: {
    parts: [
      { pts: [[0, 0], [0.92, 0], [1, 0.03], [1, 1], [0.9, 1], [0.9, 0.06], [0, 0.06]], mat: 'body' },
    ],
    label: { y0: 0.14, y1: 0.86, r0: 1, r1: 1, wrap: 'aspect' },
    extras: ['mug-handle'],
  },
  tumbler: {
    parts: [
      { pts: [[0, 0], [0.76, 0], [0.8, 0.02], [0.98, 0.82], [0, 0.82]], mat: 'body' },
      { pts: [[0, 0.82], [1.02, 0.82], [1.02, 0.88], [0.92, 0.92], [0, 0.93]], mat: 'white' },
    ],
    label: { y0: 0.14, y1: 0.72, r0: 0.83, r1: 0.96, wrap: 'aspect' },
    extras: ['straw'],
  },
  'paper-cup': {
    parts: [
      { pts: [[0, 0], [0.72, 0], [0.74, 0.01], [1, 0.95], [1.03, 0.97], [1.03, 1], [0.96, 1], [0.94, 0.98], [0.7, 0.04], [0, 0.04]], mat: 'body' },
    ],
    label: { y0: 0.05, y1: 0.92, r0: 0.75, r1: 0.98, wrap: 'full', always: true },
  },
  bowl: {
    parts: [
      { pts: [[0, 0], [0.6, 0], [0.62, 0.03], [0.85, 0.25], [0.97, 0.6], [1, 1], [0.94, 1], [0.91, 0.6], [0.8, 0.3], [0.58, 0.08], [0, 0.08]], mat: 'body' },
    ],
    label: { y0: 0.5, y1: 0.9, r0: 0.955, r1: 1.0, wrap: 'aspect' },
  },
  bucket: {
    parts: [
      { pts: [[0, 0], [0.8, 0], [0.82, 0.02], [1, 0.96], [1.02, 1], [0.95, 1], [0.94, 0.97], [0.77, 0.05], [0, 0.05]], mat: 'body' },
    ],
    label: { y0: 0.12, y1: 0.86, r0: 0.84, r1: 0.98, wrap: 'aspect' },
    extras: ['bucket-handle'],
  },
  barrel: {
    parts: [
      { pts: [[0, 0], [0.84, 0], [0.88, 0.04], [0.97, 0.3], [1, 0.5], [0.97, 0.7], [0.88, 0.96], [0.84, 1], [0, 1]], mat: 'body' },
    ],
    label: { y0: 0.34, y1: 0.66, r0: 0.995, r1: 0.995, wrap: 'aspect' },
    extras: ['hoops'],
  },
  candle: {
    parts: [
      { pts: [[0, 0.04], [0.92, 0.04], [0.92, 0.82], [0, 0.82]], mat: 'wax' },
      { pts: [[0, 0], [0.95, 0], [1, 0.03], [1, 1], [0.95, 1], [0.95, 0.04], [0, 0.04]], mat: 'glass' },
    ],
    label: { y0: 0.24, y1: 0.7, r0: 1, r1: 1, wrap: 'aspect' },
    extras: ['wick'],
  },
};

/** Garment silhouettes, x centered in -0.5..0.5 of the width, y 0..1 of the height. */
export const GARMENT_SHAPES: Record<GarmentKind, V2[]> = {
  't-shirt': [
    [-0.33, 0], [0.33, 0], [0.33, 0.66], [0.4, 0.6], [0.5, 0.76], [0.36, 0.93], [0.17, 1], [0.09, 0.95], [0, 0.93],
    [-0.09, 0.95], [-0.17, 1], [-0.36, 0.93], [-0.5, 0.76], [-0.4, 0.6], [-0.33, 0.66],
  ],
  polo: [
    [-0.33, 0], [0.33, 0], [0.33, 0.66], [0.4, 0.6], [0.5, 0.76], [0.36, 0.93], [0.15, 1], [0.06, 0.97], [0, 0.95],
    [-0.06, 0.97], [-0.15, 1], [-0.36, 0.93], [-0.5, 0.76], [-0.4, 0.6], [-0.33, 0.66],
  ],
  hoodie: [
    [-0.34, 0], [0.34, 0], [0.34, 0.55], [0.4, 0.12], [0.5, 0.12], [0.48, 0.66], [0.36, 0.84], [0.2, 0.88], [0.18, 0.97],
    [0.08, 1], [-0.08, 1], [-0.18, 0.97], [-0.2, 0.88], [-0.36, 0.84], [-0.48, 0.66], [-0.5, 0.12], [-0.4, 0.12], [-0.34, 0.55],
  ],
  'tank-top': [
    [-0.36, 0], [0.36, 0], [0.38, 0.6], [0.3, 0.8], [0.27, 1], [0.18, 1], [0.12, 0.88], [0, 0.84], [-0.12, 0.88],
    [-0.18, 1], [-0.27, 1], [-0.3, 0.8], [-0.38, 0.6],
  ],
  sweatpants: [
    [-0.36, 0.42], [-0.34, 0], [-0.06, 0], [0, 0.66], [0.06, 0], [0.34, 0], [0.36, 0.42], [0.32, 1], [-0.32, 1],
  ],
  shorts: [[-0.42, 0.08], [-0.05, 0], [0, 0.48], [0.05, 0], [0.42, 0.08], [0.36, 1], [-0.36, 1]],
  apron: [[-0.38, 0], [0.38, 0], [0.4, 0.62], [0.22, 0.78], [0.2, 1], [-0.2, 1], [-0.22, 0.78], [-0.4, 0.62]],
};

/** Print area of a garment (center and size as fractions of the garment). */
export const GARMENT_PRINT: Record<GarmentKind, { x: number; y: number; w: number; h: number }> = {
  't-shirt': { x: 0, y: 0.62, w: 0.4, h: 0.36 },
  polo: { x: 0.16, y: 0.74, w: 0.14, h: 0.12 },
  hoodie: { x: 0, y: 0.64, w: 0.36, h: 0.22 },
  'tank-top': { x: 0, y: 0.56, w: 0.4, h: 0.34 },
  sweatpants: { x: -0.18, y: 0.8, w: 0.14, h: 0.12 },
  shorts: { x: -0.2, y: 0.62, w: 0.18, h: 0.16 },
  apron: { x: 0, y: 0.52, w: 0.42, h: 0.3 },
};

export function isLathe(kind: ObjectKind): kind is LatheKind {
  return kind in LATHE_SPECS;
}

export function isGarment(kind: ObjectKind): kind is GarmentKind {
  return kind in GARMENT_SHAPES;
}

/** Lying flat on the floor: the preset's height runs along the floor (−Z). */
export const FLAT_KINDS: ObjectKind[] = ['paper', 'card', 'envelope'];

/**
 * World bounding size [x, y, z] (mm) an object occupies, from its preset dimensions.
 * Most objects simply fill width × height × depth; a few add stands, straps or poles.
 */
export function objectBoundsMm(kind: ObjectKind, w: number, h: number, d: number): [number, number, number] {
  if (FLAT_KINDS.includes(kind)) return kind === 'card' ? [w * 1.3, d * 2, h * 1.35] : [w, d, h];
  switch (kind) {
    case 'sleeve-box':
      return [w * 1.35, h, d];
    case 'watch':
      return [w, h * 2.6, d * 2];
    case 'laptop':
      return [w, h * Math.cos(0.26) + d * 0.04, d + h * Math.sin(0.26)];
    case 'lanyard':
      return [w * 1.1, h * 2.9, w * 0.5];
    case 'flag':
      return [w * 1.08, h * 2.6, w * 0.14];
    case 'billboard':
      return [w * 1.04, h * 1.9, Math.max(d, w * 0.06)];
    case 'banner':
      return [w * 1.04, h * 1.02, Math.max(d, w * 0.35)];
    case 'hat':
      return [w, h, d];
    case 'brochure':
      return [w * Math.cos(0.42), h, w / 3 * Math.sin(0.42) + d];
    case 'calendar':
    case 'sign':
      return [w, h, d];
    case 'frame':
    case 'poster':
      return [w, h * (kind === 'poster' ? 1.12 : 1), Math.max(d, h * 0.2)];
    case 'paper-bag':
      return [w, h * 1.12, d];
    case 'takeout-box':
      return [w, h * 1.1, d];
    case 'mug':
      return [w * 1.45, h, d];
    default:
      return [w, h, d];
  }
}
