import * as THREE from 'three';
import { FULL_WRAP, labelBand } from './shapes';
import type { BoxDimensions, BottlePreset, FaceKey, PackagingPreset } from '../constants/presets';

/**
 * Flat dielines (all values in mm, y pointing down like SVG).
 *
 * The same layout is used twice: to draw the downloadable SVG template, and to cut a single
 * uploaded "full dieline" artwork into per-face textures. Panel orientation matches Three.js
 * BoxGeometry UVs, so artwork drawn upright on the template appears upright on the model:
 *
 *                 [tuck]
 *                 [ top ]
 *   [dust]        |     |        [dust]
 *   [ left ][ front ][ right ][ back ][glue]
 *   [dust]        |     |        [dust]
 *                 [bottom]
 *                 [tuck]
 */

type Point = [number, number];

export interface DielinePanel {
  face: Exclude<FaceKey, 'dieline'>;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shape {
  points: Point[];
  name?: string;
}

export interface Dieline {
  width: number;
  height: number;
  /** Panels that carry artwork onto the model. */
  panels: DielinePanel[];
  /** All shapes (panels + glue/tuck/dust flaps); shared edges are folds, the rest are cuts. */
  shapes: Shape[];
}

const MARGIN = 10;

function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** A flap attached along its `edge` side, narrowing towards the free side. */
function flap(x: number, y: number, w: number, h: number, edge: 'top' | 'bottom' | 'left', inset: number): Point[] {
  if (edge === 'bottom') {
    return [
      [x + inset, y],
      [x + w - inset, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  if (edge === 'top') {
    return [
      [x, y],
      [x + w, y],
      [x + w - inset, y + h],
      [x + inset, y + h],
    ];
  }
  return [
    [x, y],
    [x + w, y + inset],
    [x + w, y + h - inset],
    [x, y + h],
  ];
}

function boxNet(box: BoxDimensions, ox: number, oy: number) {
  const { width: w, height: h, depth: d } = box;
  const tuck = THREE.MathUtils.clamp(d * 0.5, 6, 25);
  const glue = THREE.MathUtils.clamp(w * 0.25, 6, 15);
  const dust = Math.min(d, w) * 0.6;
  const bodyY = oy + tuck + d;
  const xs = { left: ox, front: ox + d, right: ox + d + w, back: ox + 2 * d + w, glue: ox + 2 * d + 2 * w };

  const panels: DielinePanel[] = [
    { face: 'left', x: xs.left, y: bodyY, w: d, h },
    { face: 'front', x: xs.front, y: bodyY, w, h },
    { face: 'right', x: xs.right, y: bodyY, w: d, h },
    { face: 'back', x: xs.back, y: bodyY, w, h },
    { face: 'top', x: xs.front, y: bodyY - d, w, h: d },
    { face: 'bottom', x: xs.front, y: bodyY + h, w, h: d },
  ];
  const shapes: Shape[] = [
    ...panels.map((p) => ({ points: rect(p.x, p.y, p.w, p.h), name: p.face })),
    { points: flap(xs.front, bodyY - d - tuck, w, tuck, 'bottom', tuck * 0.35) },
    { points: flap(xs.front, bodyY + h + d, w, tuck, 'top', tuck * 0.35) },
    { points: flap(xs.left, bodyY - dust, d, dust, 'bottom', dust * 0.45) },
    { points: flap(xs.right, bodyY - dust, d, dust, 'bottom', dust * 0.45) },
    { points: flap(xs.left, bodyY + h, d, dust, 'top', dust * 0.45) },
    { points: flap(xs.right, bodyY + h, d, dust, 'top', dust * 0.45) },
    { points: flap(xs.glue, bodyY, glue, h, 'left', Math.min(glue, h * 0.2)) },
  ];
  return {
    panels,
    shapes,
    width: 2 * d + 2 * w + glue,
    height: 2 * tuck + 2 * d + h,
  };
}

function labelRect(preset: BottlePreset['kind'], diameter: number, height: number, face: DielinePanel['face'], ox: number, oy: number) {
  const r = diameter / 2;
  const band = labelBand(preset, r, height);
  const w = 2 * Math.PI * r * FULL_WRAP;
  const panel: DielinePanel = { face, x: ox, y: oy, w, h: band.height };
  return { panel, shape: { points: rect(ox, oy, w, band.height), name: face === 'label' ? 'vial label' : 'label' } };
}

export function buildDieline(preset: PackagingPreset): Dieline {
  if (preset.category === 'box') {
    const net = boxNet(preset.dimensions, MARGIN, MARGIN);
    return { width: net.width + 2 * MARGIN, height: net.height + 2 * MARGIN, panels: net.panels, shapes: net.shapes };
  }
  if (preset.category === 'set') {
    const net = boxNet(preset.dimensions.box, MARGIN, MARGIN);
    const { diameter, height } = preset.dimensions.vial;
    const label = labelRect('vial', diameter, height, 'label', MARGIN + net.width + 20, MARGIN);
    return {
      width: net.width + 20 + label.panel.w + 2 * MARGIN,
      height: Math.max(net.height, label.panel.h) + 2 * MARGIN,
      panels: [...net.panels, label.panel],
      shapes: [...net.shapes, label.shape],
    };
  }
  if (preset.category === 'bottle') {
    const { diameter, height } = preset.dimensions;
    const label = labelRect(preset.kind, diameter, height, 'front', MARGIN, MARGIN);
    return {
      width: label.panel.w + 2 * MARGIN,
      height: label.panel.h + 2 * MARGIN,
      panels: [label.panel],
      shapes: [label.shape],
    };
  }
  const { width, height } = preset.dimensions;
  const panel: DielinePanel = { face: 'front', x: MARGIN, y: MARGIN, w: width, h: height };
  return {
    width: width + 2 * MARGIN,
    height: height + 2 * MARGIN,
    panels: [panel],
    shapes: [{ points: rect(MARGIN, MARGIN, width, height), name: 'sticker' }],
  };
}

/* ------------------------------------------------------------------ */
/* SVG                                                                */
/* ------------------------------------------------------------------ */

const r2 = (n: number) => Math.round(n * 100) / 100;

function edgeKey(a: Point, b: Point): string {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${r2(p[0])},${r2(p[1])}-${r2(q[0])},${r2(q[1])}`;
}

export function dielineSvg(dieline: Dieline, title: string): string {
  const count = new Map<string, number>();
  const edges: { a: Point; b: Point; key: string }[] = [];
  for (const shape of dieline.shapes) {
    shape.points.forEach((a, i) => {
      const b = shape.points[(i + 1) % shape.points.length];
      const key = edgeKey(a, b);
      edges.push({ a, b, key });
      count.set(key, (count.get(key) ?? 0) + 1);
    });
  }
  const seen = new Set<string>();
  let cut = '';
  let fold = '';
  for (const { a, b, key } of edges) {
    if (seen.has(key)) continue;
    seen.add(key);
    const seg = `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;
    if ((count.get(key) ?? 0) > 1) fold += seg;
    else cut += seg;
  }

  const labels = dieline.panels
    .map((p) => {
      const size = Math.max(Math.min(p.w, p.h) * 0.12, 2.2);
      const cx = r2(p.x + p.w / 2);
      const cy = r2(p.y + p.h / 2);
      return (
        `<text x="${cx}" y="${cy}" font-size="${r2(size)}" text-anchor="middle" dominant-baseline="middle" fill="#64748b">${p.face.toUpperCase()}</text>` +
        `<text x="${cx}" y="${r2(cy + size * 1.3)}" font-size="${r2(size * 0.7)}" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8">${r2(p.w)} × ${r2(p.h)} mm</text>`
      );
    })
    .join('');

  const W = r2(dieline.width);
  const H = r2(dieline.height);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
  <title>${title} dieline</title>
  <desc>Black solid = cut, blue dashed = fold. All units in mm. Artwork exported at this exact size can be uploaded as a full dieline.</desc>
  <g id="artwork"></g>
  <g id="labels">${labels}</g>
  <path id="fold" d="${fold}" fill="none" stroke="#2563eb" stroke-width="0.3" stroke-dasharray="2 1.5"/>
  <path id="cut" d="${cut}" fill="none" stroke="#111827" stroke-width="0.35"/>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Splitting an uploaded dieline into face textures                   */
/* ------------------------------------------------------------------ */

/** Texture views of one dieline image, cropped to each panel. Clones share the image upload. */
export function sliceDielineTexture(texture: THREE.Texture, dieline: Dieline): Partial<Record<FaceKey, THREE.Texture>> {
  const out: Partial<Record<FaceKey, THREE.Texture>> = {};
  for (const p of dieline.panels) {
    const t = texture.clone();
    t.repeat.set(p.w / dieline.width, p.h / dieline.height);
    t.offset.set(p.x / dieline.width, 1 - (p.y + p.h) / dieline.height);
    t.needsUpdate = true;
    out[p.face] = t;
  }
  return out;
}
