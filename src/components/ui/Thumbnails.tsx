import { useMemo } from 'react';
import * as THREE from 'three';
import { placeInstances, type LayoutDef } from '../../constants/layouts';
import type { PackagingPreset } from '../../constants/presets';

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

const PALETTE = { body: '#cbd5e1', front: '#38bdf8' };

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
      <rect x={x - w / 2 + 0.5} y={92 - bodyH * 0.78} width={w - 1} height={bodyH * 0.5} fill="#38bdf8" opacity={0.85} />
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

export function ModelThumb({ preset }: { preset: PackagingPreset }) {
  const content = useMemo(() => {
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
          <rect x={50 - (width * s) / 2} y={50 - (height * s) / 2} width={width * s} height={height * s} rx={2} fill="#38bdf8" />
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
