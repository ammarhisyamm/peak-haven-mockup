import * as THREE from 'three';

/**
 * Multi-product scene layouts. Each layout lists instances by where the center of their
 * footprint should be, the height their underside rests at, and their rotation; the actual
 * position is solved from the rotated bounding box, so lying or yawed products sit on the floor.
 */

export type LayoutId = 'single' | 'duo' | 'trio' | 'front-back' | 'stand-lie' | 'stack' | 'fan' | 'grid';

type Vec3 = [number, number, number];

interface InstanceSpec {
  /** Footprint center on the floor (x, z). */
  at: [number, number];
  /** Height of the instance's underside. */
  base?: number;
  /** Lay the product on its back (front facing up). */
  lying?: boolean;
  yaw?: number;
}

export interface LayoutDef {
  id: LayoutId;
  name: string;
  /** Preferred camera direction (from target to camera). */
  view?: Vec3;
  build: (size: Vec3) => InstanceSpec[];
}

export interface PlacedInstance {
  position: Vec3;
  rotation: Vec3;
}

export const LAYOUTS: LayoutDef[] = [
  { id: 'single', name: 'Single', build: () => [{ at: [0, 0] }] },
  {
    id: 'duo',
    name: 'Duo',
    build: ([w, , d]) => {
      const gap = Math.max(w, d) * 0.3;
      const x = (w + gap) / 2;
      return [
        { at: [-x, -d * 0.15], yaw: 0.28 },
        { at: [x, d * 0.15], yaw: -0.22 },
      ];
    },
  },
  {
    id: 'trio',
    name: 'Trio',
    build: ([w, , d]) => {
      const step = w + Math.max(w, d) * 0.3;
      return [
        { at: [-step, -d * 0.25], yaw: 0.35 },
        { at: [0, d * 0.3] },
        { at: [step, -d * 0.25], yaw: -0.35 },
      ];
    },
  },
  {
    id: 'front-back',
    name: 'Front & Back',
    build: ([w, , d]) => {
      const x = (w + Math.max(w, d) * 0.35) / 2;
      return [
        { at: [-x, 0], yaw: 0.3 },
        { at: [x, 0], yaw: Math.PI - 0.3 },
      ];
    },
  },
  {
    id: 'stand-lie',
    name: 'Standing + Lying',
    build: ([w, h, d]) => [
      { at: [-w * 0.45, -d * 0.4], yaw: 0.2 },
      { at: [w * 0.55, h * 0.45], lying: true, yaw: -0.35 },
    ],
  },
  {
    id: 'stack',
    name: 'Stack',
    view: [0.75, 0.9, 1.4],
    build: ([, , d]) => [
      { at: [0, 0], lying: true, yaw: 0.05 },
      { at: [0.02, 0.01], base: d * 1.001, lying: true, yaw: -0.12 },
      { at: [-0.02, 0.02], base: d * 2.002, lying: true, yaw: 0.16 },
    ],
  },
  {
    id: 'fan',
    name: 'Fan',
    view: [0.4, 1.3, 1.2],
    build: ([w, , d]) => [
      { at: [-w * 0.55, 0], lying: true, yaw: 0.4 },
      { at: [0, w * 0.1], base: d * 1.001, lying: true },
      { at: [w * 0.55, 0], base: d * 2.002, lying: true, yaw: -0.4 },
    ],
  },
  {
    id: 'grid',
    name: 'Flat Lay',
    view: [0.25, 1.6, 0.9],
    build: ([w, h]) => {
      const yaw = 0.45;
      const sx = w * 1.35;
      const sz = h * 1.2;
      const out: InstanceSpec[] = [];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const x = i * sx + (j % 2 ? sx / 2 : 0);
          const z = j * sz;
          out.push({
            at: [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)],
            lying: true,
            yaw,
          });
        }
      }
      return out;
    },
  },
];

export function getLayout(id: LayoutId): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/**
 * Solves instance transforms for a model whose local bounds are x/z centered and y from 0 to h.
 * Returns the transforms plus the combined world bounds (used for framing and shadows).
 */
export function placeInstances(layout: LayoutDef, size: Vec3): { instances: PlacedInstance[]; bounds: THREE.Box3 } {
  const [w, h, d] = size;
  const local = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2));
  const bounds = new THREE.Box3();
  const instances = layout.build(size).map((spec) => {
    // 'YXZ': lie down first (X), then yaw (Y).
    const euler = new THREE.Euler(spec.lying ? -Math.PI / 2 : 0, spec.yaw ?? 0, 0, 'YXZ');
    const box = local.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));
    const center = box.getCenter(new THREE.Vector3());
    const position: Vec3 = [spec.at[0] - center.x, (spec.base ?? 0) - box.min.y, spec.at[1] - center.z];
    bounds.union(box.translate(new THREE.Vector3(...position)));
    return { position, rotation: [euler.x, euler.y, euler.z] as Vec3 };
  });
  // Recenter the whole arrangement on the origin (x/z).
  const c = bounds.getCenter(new THREE.Vector3());
  for (const inst of instances) {
    inst.position[0] -= c.x;
    inst.position[2] -= c.z;
  }
  bounds.translate(new THREE.Vector3(-c.x, 0, -c.z));
  return { instances, bounds };
}
