import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { floorCanvas, getBackdrop, renderBackdrop, type Backdrop } from '../lib/backdrops';

/** Seamless studio paper: a floor that curves up into a wall behind the model (local −Z). */
function sweepGeometry(width: number, front: number, radius: number, back: number, height: number) {
  const profile: [number, number][] = []; // [y, z]
  profile.push([0, front]);
  profile.push([0, -back]);
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    profile.push([radius - Math.cos(a) * radius, -back - Math.sin(a) * radius]);
  }
  profile.push([height, -back - radius]);
  const positions: number[] = [];
  const indices: number[] = [];
  profile.forEach(([y, z]) => positions.push(-width / 2, y, z, width / 2, y, z));
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function useBackgroundTexture(backdrop: Backdrop | null) {
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  // Redraw at the viewport's aspect (rounded so small resizes don't redraw).
  const aspect = Math.round((size.width / Math.max(size.height, 1)) * 20) / 20;
  const texture = useMemo(() => {
    if (!backdrop) return null;
    const h = 1400;
    const t = new THREE.CanvasTexture(renderBackdrop(backdrop, h * aspect, h));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [backdrop, aspect]);

  useEffect(() => {
    if (!texture) return;
    scene.background = texture;
    return () => {
      if (scene.background === texture) scene.background = null;
      texture.dispose();
    };
  }, [scene, texture]);
}

export default function SceneBackdrop({ backdropId, bounds }: { backdropId: string | null; bounds: THREE.Box3 }) {
  const backdrop = getBackdrop(backdropId);
  useBackgroundTexture(backdrop);

  const scene = useThree((s) => s.scene);
  const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.5);
  const footprint = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);

  useEffect(() => {
    if (!backdrop?.fog) return;
    scene.fog = new THREE.Fog(backdrop.fog, radius * 6, radius * 16);
    return () => {
      scene.fog = null;
    };
  }, [scene, backdrop, radius]);

  const floorTexture = useMemo(() => {
    if (!backdrop?.floor) return null;
    const t = new THREE.CanvasTexture(floorCanvas(backdrop.floor.id, backdrop.floor.color));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }, [backdrop]);
  useEffect(() => () => floorTexture?.dispose(), [floorTexture]);

  const floorSize = radius * 40;
  if (floorTexture && backdrop?.floor) floorTexture.repeat.set(floorSize / backdrop.floor.tile, floorSize / backdrop.floor.tile);

  const podiumH = radius * 0.32;
  const podiumR = Math.max(footprint * 0.62, radius * 0.75);
  const floorY = (backdrop?.podium ? -podiumH : 0) - 0.004;

  // The sweep turns with the camera so the wall always sits behind the model.
  const sweepRef = useRef<THREE.Group>(null);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  useFrame(({ camera }) => {
    const g = sweepRef.current;
    if (!g) return;
    const t = controls?.target ?? new THREE.Vector3();
    g.rotation.y = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
  });
  const sweep = useMemo(
    () => (backdrop?.sweep ? sweepGeometry(radius * 30, radius * 14, radius * 2.2, radius * 2.2, radius * 14) : null),
    [backdrop, radius],
  );
  useEffect(() => () => sweep?.dispose(), [sweep]);

  if (!backdrop || backdrop.kind !== 'scene') return null;

  return (
    <group>
      {backdrop.floor && floorTexture && (
        <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[floorSize, floorSize]} />
          <meshStandardMaterial map={floorTexture} roughness={backdrop.floor.roughness} metalness={0} />
        </mesh>
      )}
      {backdrop.podium && (
        <>
          <mesh position={[0, -podiumH / 2, 0]}>
            <cylinderGeometry args={[podiumR, podiumR, podiumH, 96]} />
            <meshStandardMaterial color={backdrop.podium.colors[0]} roughness={0.85} />
          </mesh>
          <mesh position={[-podiumR * 1.25, floorY + podiumH * 1.6, -podiumR * 1.3]}>
            <cylinderGeometry args={[podiumR * 0.55, podiumR * 0.55, podiumH * 3.2, 64]} />
            <meshStandardMaterial color={backdrop.podium.colors[1]} roughness={0.85} />
          </mesh>
          <mesh position={[podiumR * 1.25, floorY + podiumR * 0.32, -podiumR * 0.4]}>
            <sphereGeometry args={[podiumR * 0.32, 48, 32]} />
            <meshStandardMaterial color={backdrop.podium.colors[1]} roughness={0.6} />
          </mesh>
        </>
      )}
      {sweep && (
        <group ref={sweepRef}>
          <mesh geometry={sweep} position={[0, -0.004, 0]}>
            <meshStandardMaterial color={backdrop.sweep} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}
