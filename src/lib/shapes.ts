import type { BottlePreset } from '../constants/presets';

/**
 * Bottle/vial proportions shared by the 3D model and the dieline, so a label designed on the
 * dieline lands exactly on the label band. Works in any length unit (mm or world units).
 */
export interface BottleParts {
  bodyHeight: number;
  neckRadius: number;
  shoulder: number;
}

export function bottleParts(kind: BottlePreset['kind'], r: number, H: number): BottleParts {
  switch (kind) {
    case 'dropper':
      return { bodyHeight: H * 0.62, neckRadius: r * 0.55, shoulder: Math.min(r * 0.45, H * 0.12) };
    case 'serum':
      return { bodyHeight: H * 0.76, neckRadius: r * 0.45, shoulder: Math.min(r * 0.4, H * 0.1) };
    case 'jar':
      return { bodyHeight: H * 0.68, neckRadius: r * 0.94, shoulder: Math.min(r * 0.06, H * 0.05) };
    case 'vial':
      return { bodyHeight: H * 0.72, neckRadius: r * 0.62, shoulder: Math.min(r * 0.3, H * 0.08) };
  }
}

/** Fraction of the circumference a full-wrap label covers (leaves a small seam gap). */
export const FULL_WRAP = 0.985;

/** The straight part of the body the label sits on: its height and center height. */
export function labelBand(kind: BottlePreset['kind'], r: number, H: number) {
  const { bodyHeight, shoulder } = bottleParts(kind, r, H);
  const straightBottom = Math.min(r * 0.12, bodyHeight * 0.1);
  const straightTop = bodyHeight - shoulder;
  return {
    height: (straightTop - straightBottom) * 0.82,
    centerY: (straightTop + straightBottom) / 2,
    straightBottom,
  };
}
