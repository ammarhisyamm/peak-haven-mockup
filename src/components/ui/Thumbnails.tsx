import { useMemo } from 'react';
import * as THREE from 'three';
import { placeInstances, type LayoutDef } from '../../constants/layouts';
import { presetBoundsMm, type ObjectPreset, type PackagingPreset } from '../../constants/presets';
import { GARMENT_PRINT, GARMENT_SHAPES, LATHE_SPECS, isGarment, isLathe, type MatName } from '../../lib/objectSpecs';

/**
 * Lightweight SVG previews for the model library and layout picker. Boxes are projected
 * with a real camera transform and painter-sorted faces, so layouts preview exactly as solved.
 */

type Vec3 = [number, number, number];

const FACE_DEFS: { normal: Vec3; corners: number[]; front?: boolean }[] = [
  { normal: [1, 0, 0], corners: [1, 3, 7, 5] },
  { normal: [-1, 0, 0], corners: [0, 4, 6, 2] },
  { normal: [0, 1, 0], corners: [2, 6, 7, 3] },
  { normal: [0, -1, 0], corners: [0, 1, 5, 4] },
  { normal: [0, 0, 1], corners: [4, 5, 7, 6], front: true },
  { normal: [0, 0, -1], corners: [0, 2, 3, 1] },
];

interface Poly {
  points: string;
  depth: number;
  fill: string;
}

function shade(base: THREE.Color, n: THREE.Vector3): string {
  const light = new THREE.Vector3(0.4, 0.9, 0.6).normalize();
  const k = 0.55 + 0.45 * Math.max(0, n.dot(light));
  return `#${base.clone().multiplyScalar(k).getHexString()}`;
}

/** Projects boxes (local x/z centered, y from 0) seen from `direction` into SVG polygons. */
function projectBoxes(
  boxes: { size: Vec3; position: Vec3; rotation: Vec3 }[],
  direction: Vec3,
  colors: { body: string; front: string },
  viewSize = 100,
): Poly[] {
  const camera = new THREE.OrthographicCamera();
  const dir = new THREE.Vector3(...direction).normalize();
  const all = new THREE.Box3();
  const faces: { pts: THREE.Vector3[]; normal: THREE.Vector3; front: boolean }[] = [];

  for (const b of boxes) {
    const [w, h, d] = b.size;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...b.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.rotation, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      new THREE.Vector3(i & 1 ? w / 2 : -w / 2, i & 2 ? h : 0, i & 4 ? d / 2 : -d / 2).applyMatrix4(m),
    );
    corners.forEach((c) => all.expandByPoint(c));
    for (const f of FACE_DEFS) {
      const normal = new THREE.Vector3(...f.normal).transformDirection(m);
      if (normal.dot(dir) <= 0) continue;
      faces.push({ pts: f.corners.map((i) => corners[i]), normal, front: !!f.front });
    }
  }

  const center = all.getCenter(new THREE.Vector3());
  camera.position.copy(center).addScaledVector(dir, 50);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse;

  const projected = faces.map((f) => f.pts.map((p) => p.clone().applyMatrix4(view)));
  const bounds = new THREE.Box2();
  projected.flat().forEach((p) => bounds.expandByPoint(new THREE.Vector2(p.x, p.y)));
  const size = bounds.getSize(new THREE.Vector2());
  const scale = (viewSize * 0.8) / Math.max(size.x, size.y, 1e-6);
  const mid = bounds.getCenter(new THREE.Vector2());
  const body = new THREE.Color(colors.body);
  const front = new THREE.Color(colors.front);

  return projected
    .map((pts, i) => ({
      points: pts
        .map((p) => `${(viewSize / 2 + (p.x - mid.x) * scale).toFixed(1)},${(viewSize / 2 - (p.y - mid.y) * scale).toFixed(1)}`)
        .join(' '),
      depth: pts.reduce((s, p) => s + p.z, 0) / pts.length,
      fill: shade(faces[i].front ? front : body, faces[i].normal),
    }))
    .sort((a, b) => a.depth - b.depth);
}

function Polys({ polys }: { polys: Poly[] }) {
  return (
    <>
      {polys.map((p, i) => (
        <polygon key={i} points={p.points} fill={p.fill} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.4} />
      ))}
    </>
  );
}

const PALETTE = { body: '#b9b9d6', front: '#7657ff' };

export function LayoutThumb({ layout }: { layout: LayoutDef }) {
  const polys = useMemo(() => {
    const size: Vec3 = [1, 1.5, 0.7];
    const { instances } = placeInstances(layout, size);
    return projectBoxes(
      instances.map((i) => ({ size, position: i.position, rotation: i.rotation })),
      layout.view ?? [0.75, 0.5, 1.6],
      PALETTE,
    );
  }, [layout]);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <Polys polys={polys} />
    </svg>
  );
}

function BottleShape({ kind, x, w, h }: { kind: string; x: number; w: number; h: number }) {
  // Proportional silhouette: body, shoulder, cap; plus a label band.
  const bodyH = kind === 'jar' ? h * 0.68 : kind === 'dropper' ? h * 0.62 : kind === 'vial' ? h * 0.72 : h * 0.76;
  const capW = kind === 'jar' ? w * 1.03 : kind === 'vial' ? w * 0.78 : kind === 'dropper' ? w * 0.5 : w * 0.58;
  const top = 92 - h;
  const capColor = kind === 'vial' ? '#cbd5e1' : '#1f2937';
  return (
    <g>
      <rect x={x - w / 2} y={92 - bodyH} width={w} height={bodyH} rx={Math.min(w * 0.18, 6)} fill={kind === 'vial' ? '#e0f2fe' : '#f1f5f9'} stroke="#cbd5e1" strokeWidth={0.8} />
      <rect x={x - w / 2 + 0.5} y={92 - bodyH * 0.78} width={w - 1} height={bodyH * 0.5} fill="#caff5c" opacity={0.9} />
      {kind === 'dropper' ? (
        <>
          <rect x={x - capW / 2} y={92 - bodyH - (h - bodyH) * 0.4} width={capW} height={(h - bodyH) * 0.4} fill="#c8a96a" />
          <rect x={x - capW * 0.38} y={top} width={capW * 0.76} height={(h - bodyH) * 0.62} rx={capW * 0.38} fill={capColor} />
        </>
      ) : (
        <rect x={x - capW / 2} y={top} width={capW} height={h - bodyH} rx={1.5} fill={capColor} />
      )}
    </g>
  );
}

const ACCENT = '#caff5c';

function matFill(mat: MatName, color: string): string {
  switch (mat) {
    case 'glass':
    case 'clear':
      return '#e0f2fe';
    case 'glassGreen':
      return '#2f6b44';
    case 'glassAmber':
      return '#92501d';
    case 'cap':
    case 'dark':
    case 'screen':
      return '#1f2937';
    case 'white':
    case 'paper':
      return '#f8fafc';
    case 'metal':
      return '#cbd5e1';
    case 'gold':
      return '#c8a96a';
    case 'cork':
    case 'wood':
      return '#b08654';
    default:
      return color;
  }
}

/** Library preview for generic objects, drawn from the same shape data as the 3D model. */
function ObjectThumb({ preset }: { preset: ObjectPreset }) {
  const color = preset.defaultColor ?? '#cbd5e1';
  const { kind } = preset;
  const { width, height } = preset.dimensions;
  const stroke = { stroke: '#94a3b8', strokeWidth: 0.6 };

  if (isLathe(kind)) {
    const spec = LATHE_SPECS[kind];
    const extraW = spec.extras?.includes('mug-handle') ? 1.45 : 1;
    const s = 76 / Math.max(height, width * extraW);
    const r = (width / 2) * s;
    const H = height * s;
    const cx = 50 - (extraW - 1) * r * 0.5;
    const base = 50 + H / 2;
    const poly = (pts: [number, number][]) =>
      [...pts.map(([x, y]) => `${cx + x * r},${base - y * H}`), ...[...pts].reverse().map(([x, y]) => `${cx - x * r},${base - y * H}`)].join(' ');
    return (
      <>
        {spec.extras?.includes('mug-handle') && (
          <path d={`M ${cx + r} ${base - H * 0.78} a ${H * 0.27} ${H * 0.27} 0 0 1 0 ${H * 0.54}`} fill="none" stroke={color} strokeWidth={H * 0.09} />
        )}
        {spec.parts.map((p, i) => (
          <polygon key={i} points={poly(p.pts)} fill={p.mat === 'liquid' || p.mat === 'wax' ? color : matFill(p.mat, color)} opacity={p.mat === 'glass' || p.mat === 'clear' ? 0.7 : 1} {...stroke} />
        ))}
        {spec.label && (
          <polygon
            points={`${cx - spec.label.r0 * r},${base - spec.label.y0 * H} ${cx + spec.label.r0 * r},${base - spec.label.y0 * H} ${cx + spec.label.r1 * r},${base - spec.label.y1 * H} ${cx - spec.label.r1 * r},${base - spec.label.y1 * H}`}
            fill={ACCENT}
            opacity={0.9}
          />
        )}
      </>
    );
  }

  if (isGarment(kind)) {
    const s = 80 / Math.max(width, height);
    const w = width * s;
    const h = height * s;
    const pts = GARMENT_SHAPES[kind].map(([x, y]) => `${50 + x * w},${50 + h / 2 - y * h}`).join(' ');
    const pr = GARMENT_PRINT[kind];
    return (
      <>
        <polygon points={pts} fill={color} {...stroke} strokeLinejoin="round" />
        <rect x={50 + pr.x * w - (pr.w * w) / 2} y={50 + h / 2 - pr.y * h - (pr.h * h) / 2} width={pr.w * w} height={pr.h * h} rx={1} fill={ACCENT} />
      </>
    );
  }

  switch (kind) {
    case 'phone':
    case 'phone-case':
    case 'tablet':
    case 'watch': {
      const s = 70 / Math.max(width, height);
      const w = width * s;
      const h = height * s;
      return (
        <>
          {kind === 'watch' && <rect x={50 - w * 0.4} y={50 - h * 1.1} width={w * 0.8} height={h * 2.2} rx={w * 0.1} fill={color} />}
          <rect x={50 - w / 2} y={50 - h / 2} width={w} height={h} rx={w * 0.16} fill={kind === 'phone-case' ? color : '#1f2937'} />
          <rect x={50 - w / 2 + w * 0.06} y={50 - h / 2 + w * 0.06} width={w * 0.88} height={h - w * 0.12} rx={w * 0.12} fill={ACCENT} />
        </>
      );
    }
    case 'hat':
      return (
        <>
          <path d="M 18 66 Q 20 26 52 24 Q 82 26 84 62 Z" fill={color} />
          <path d="M 14 64 Q 6 76 40 74 L 86 64 Z" fill={color} opacity={0.85} />
          <rect x={40} y={38} width={20} height={12} rx={2} fill={ACCENT} />
        </>
      );
    case 'flag':
      return (
        <>
          <rect x={20} y={10} width={2.5} height={82} fill="#94a3b8" />
          <path d="M 22 14 Q 45 8 58 16 T 88 16 L 88 50 Q 72 44 58 52 T 22 48 Z" fill={ACCENT} />
        </>
      );
    case 'pouch':
    case 'chip-bag':
      return (
        <>
          <path d="M 26 14 L 74 14 L 74 20 Q 80 50 76 86 L 24 86 Q 20 50 26 20 Z" fill={color === '#cbd5e1' ? '#e2e8f0' : color} {...stroke} />
          <rect x={34} y={36} width={32} height={30} rx={3} fill={ACCENT} />
        </>
      );
    case 'lanyard':
      return (
        <>
          <path d="M 50 50 L 34 10 M 50 50 L 66 10" stroke={color} strokeWidth={4} fill="none" />
          <rect x={38} y={50} width={24} height={38} rx={3} fill="#f8fafc" {...stroke} />
          <rect x={41} y={56} width={18} height={18} rx={2} fill={ACCENT} />
        </>
      );
    case 'frame':
    case 'poster':
    case 'banner':
    case 'billboard': {
      const s = 72 / Math.max(width, height * (kind === 'billboard' ? 1.9 : 1));
      const w = width * s;
      const h = height * s;
      const top = kind === 'billboard' ? 12 : 50 - h / 2;
      return (
        <>
          {kind === 'billboard' && <rect x={48} y={top + h} width={4} height={86 - top - h} fill="#94a3b8" />}
          {kind === 'banner' && <rect x={50 - w * 0.55} y={top + h - 2} width={w * 1.1} height={4} rx={1} fill="#94a3b8" />}
          <rect x={50 - w / 2} y={top} width={w} height={h} fill={kind === 'frame' ? color : '#1f2937'} />
          <rect x={50 - w / 2 + w * 0.08} y={top + w * 0.08} width={w * 0.84} height={h - w * 0.16} fill={ACCENT} />
        </>
      );
    }
    default: {
      const [bx, by, bz] = presetBoundsMm(preset);
      const flat = by < Math.min(bx, bz) * 0.2;
      const polys = projectBoxes(
        [{ size: [bx, Math.max(by, 0.02 * Math.max(bx, bz)), bz], position: [0, 0, 0], rotation: [0, 0, 0] }],
        flat ? [0.4, 1.4, 1] : [0.75, 0.6, 1.6],
        { body: color, front: ACCENT },
      );
      return <Polys polys={polys} />;
    }
  }
}

export function ModelThumb({ preset }: { preset: PackagingPreset }) {
  const content = useMemo(() => {
    if (preset.category === 'object') return <ObjectThumb preset={preset} />;
    if (preset.category === 'box') {
      const { width, height, depth } = preset.dimensions;
      const polys = projectBoxes(
        [{ size: [width, height, depth], position: [0, 0, 0], rotation: [0, 0, 0] }],
        [0.75, 0.6, 1.6],
        preset.kind === 'mailer' ? { body: '#c9a273', front: '#d6b386' } : PALETTE,
      );
      return <Polys polys={polys} />;
    }
    if (preset.category === 'label') {
      const { width, height } = preset.dimensions;
      const s = 70 / Math.max(width, height);
      return (
        <g transform="rotate(-8 50 50)">
          <rect x={50 - (width * s) / 2} y={50 - (height * s) / 2} width={width * s} height={height * s} rx={2} fill="#caff5c" />
          <rect x={50 - (width * s) / 2 + 4} y={50 - 3} width={width * s * 0.5} height={3} rx={1} fill="#ffffff" opacity={0.8} />
        </g>
      );
    }
    if (preset.category === 'set') {
      const { box, vial } = preset.dimensions;
      const s = 76 / Math.max(box.height, box.width + vial.diameter * 1.35);
      const polys = projectBoxes(
        [{ size: [box.width, box.height, box.depth], position: [0, 0, 0], rotation: [0, 0, 0] }],
        [0.3, 0.25, 1.6],
        PALETTE,
        100,
      );
      return (
        <>
          <g transform="translate(-14 4) scale(0.82)">
            <Polys polys={polys} />
          </g>
          <BottleShape kind="vial" x={74} w={vial.diameter * s} h={vial.height * s} />
        </>
      );
    }
    const { diameter, height } = preset.dimensions;
    const s = 78 / Math.max(height, diameter * 1.2);
    return <BottleShape kind={preset.kind} x={50} w={diameter * s} h={height * s} />;
  }, [preset]);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {content}
    </svg>
  );
}
