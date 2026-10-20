import type { Unit } from '../constants/presets';

/** drei environment presets offered as lighting moods. */
export type EnvironmentPreset = 'city' | 'studio' | 'apartment' | 'lobby' | 'sunset' | 'warehouse' | 'dawn';

export const ENVIRONMENTS: { id: EnvironmentPreset; label: string }[] = [
  { id: 'city', label: 'City' },
  { id: 'studio', label: 'Studio' },
  { id: 'apartment', label: 'Soft room' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'dawn', label: 'Dawn' },
];

/** Viewer and export preferences. Not part of undo history. */
export interface ViewSettings {
  transparentBg: boolean;
  bgColor: string;
  /** Gradient, pattern or realistic scene behind the model (lib/backdrops.ts); null for a plain background. */
  backdrop: string | null;
  environment: EnvironmentPreset;
  lightIntensity: number;
  shadows: boolean;
  shadowOpacity: number;
  autoRotate: boolean;
  exportEdge: number;
  exportFormat: 'png' | 'jpg';
  unit: Unit;
}

/** MOQZUNO palette: Midnight Ink, Electric Lime, Hyper Violet, Soft Canvas, Pop Coral, Pure White. */
export const BACKGROUND_SWATCHES = ['#151529', '#caff5c', '#7657ff', '#f5f3ee', '#ff7868', '#ffffff'];

export const DEFAULT_SETTINGS: ViewSettings = {
  transparentBg: true,
  bgColor: BACKGROUND_SWATCHES[0],
  backdrop: null,
  environment: 'city',
  lightIntensity: 1,
  shadows: true,
  shadowOpacity: 0.5,
  autoRotate: false,
  exportEdge: 3840,
  exportFormat: 'png',
  unit: 'mm',
};
