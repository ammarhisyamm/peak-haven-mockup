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
  environment: EnvironmentPreset;
  lightIntensity: number;
  shadows: boolean;
  shadowOpacity: number;
  autoRotate: boolean;
  exportEdge: number;
  exportFormat: 'png' | 'jpg';
  unit: Unit;
}

export const BACKGROUND_SWATCHES = ['#e5e7eb', '#cfe3fb', '#f5f5f4', '#fde68a', '#0f172a'];

export const DEFAULT_SETTINGS: ViewSettings = {
  transparentBg: true,
  bgColor: BACKGROUND_SWATCHES[0],
  environment: 'city',
  lightIntensity: 1,
  shadows: true,
  shadowOpacity: 0.5,
  autoRotate: false,
  exportEdge: 3840,
  exportFormat: 'png',
  unit: 'mm',
};
