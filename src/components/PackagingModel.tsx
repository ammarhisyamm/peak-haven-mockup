import { useEffect, useMemo, useRef, useState, type DependencyList, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BOX_FACE_ORDER,
  FINISHES,
  MM_PER_UNIT,
  boardThickness,
  facesForCategory,
  presetBoundsMm,
  type ArtworkMap,
  type BottlePreset,
  type BoxFace,
  type FaceKey,
  type FinishId,
  type PackagingPreset,
  type SetPreset,
} from '../constants/presets';
import { buildDieline, sliceDielineTexture } from '../lib/dieline';
import { getGrainTextures } from '../lib/paperTexture';
import { FULL_WRAP, bottleParts, labelBand } from '../lib/shapes';
import { ObjectMesh } from './ObjectModels';

/* ------------------------------------------------------------------ */
/* Layout / scaling                                                   */
/* ------------------------------------------------------------------ */

/** Largest model dimension (world units) is kept inside this range so tiny labels and big mailers both frame well. */
const MIN_FIT_SIZE = 1.6;
const MAX_FIT_SIZE = 3.0;

/** Gap between the carton and the vial in a set, as a fraction of the vial diameter. */
const SET_GAP_RATIO = 0.35;

/** Lid angle when fully open. */
const LID_OPEN_ANGLE = Math.PI * 0.62;

export interface ModelLayout {
  /** World units per millimeter (1 unit = 50 mm, adjusted by the fit factor). */
  unitsPerMm: number;
  /** World-space bounding size [width, height, depth]; x/z centered, y from 0. */
  size: [number, number, number];
}

export function getModelLayout(preset: PackagingPreset): ModelLayout {
  const sizeMm = presetBoundsMm(preset);
  const baseUnitsPerMm = 1 / MM_PER_UNIT;
  const maxDim = Math.max(...sizeMm) * baseUnitsPerMm;
  const fit = THREE.MathUtils.clamp(maxDim, MIN_FIT_SIZE, MAX_FIT_SIZE) / maxDim;
  const unitsPerMm = baseUnitsPerMm * fit;
  return {
    unitsPerMm,
    size: [sizeMm[0] * unitsPerMm, sizeMm[1] * unitsPerMm, sizeMm[2] * unitsPerMm],
  };
}

/* ------------------------------------------------------------------ */
/* Resource helpers (explicit disposal to avoid WebGL leaks)          */
/* ------------------------------------------------------------------ */

/** Memoizes a disposable Three.js resource and disposes it when deps change or on unmount. */
function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

/** Creates `count` standard materials that live as long as the component (or until count changes). */
function useMaterials(count: number): THREE.MeshStandardMaterial[] {
  const materials = useMemo(
    () => Array.from({ length: count }, () => new THREE.MeshStandardMaterial()),
    [count],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return materials;
}

interface SurfaceOptions {
  map: THREE.Texture | null;
  baseColor: string;
  finish: FinishId;
}

/**
 * Applies finish, color, artwork and paper grain to a material. The shader is recompiled
 * only when a map is added or removed.
 */
function applySurface(material: THREE.MeshStandardMaterial, { map, baseColor, finish }: SurfaceOptions) {
  const preset = FINISHES[finish];
  const grain = preset.grain ? getGrainTextures(preset.grain) : null;
  const before = `${!!material.map}|${!!material.bumpMap}`;
  // Artwork shows its true colors; plain surfaces use the finish tone or the picked base color.
  material.map = map ?? grain?.color ?? null;
  material.bumpMap = grain?.bump ?? null;
  material.bumpScale = 0.6;
  material.color.set(map ? '#ffffff' : (preset.baseColor ?? baseColor));
  material.roughness = preset.roughness;
  material.metalness = preset.metalness;
  if (before !== `${!!material.map}|${!!material.bumpMap}`) material.needsUpdate = true;
}

/** Inside of an opened box: plain board in the finish's interior tone. */
function applyInterior(material: THREE.MeshStandardMaterial, finish: FinishId) {
  const preset = FINISHES[finish];
  const grain = preset.grain ? getGrainTextures(preset.grain) : null;
  const before = `${!!material.map}|${!!material.bumpMap}`;
  material.map = grain?.color ?? null;
  material.bumpMap = grain?.bump ?? null;
  material.bumpScale = 0.6;
  material.color.set(preset.interiorColor);
  material.roughness = 0.9;
  material.metalness = 0;
  if (before !== `${!!material.map}|${!!material.bumpMap}`) material.needsUpdate = true;
}

export type TextureMap = Partial<Record<FaceKey, THREE.Texture>>;

/**
 * Loads artwork object URLs into textures with THREE.TextureLoader.
 * Textures are cached by URL, and any texture that is no longer referenced is disposed
 * only after React has committed the new maps, so the renderer never draws a disposed texture.
 */
function useArtworkTextures(artwork: ArtworkMap, faces: FaceKey[]): TextureMap {
  const gl = useThree((s) => s.gl);
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  const cacheRef = useRef(new Map<string, THREE.Texture>());
  const pendingDisposeRef = useRef<THREE.Texture[]>([]);
  const [textures, setTextures] = useState<TextureMap>({});

  const facesKey = faces.join(',');

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const wanted = new Set<string>();
    for (const face of faces) {
      const url = artwork[face];
      if (url) wanted.add(url);
    }

    // Retire textures whose artwork was removed or replaced.
    for (const [url, tex] of cache) {
      if (!wanted.has(url)) {
        pendingDisposeRef.current.push(tex);
        cache.delete(url);
      }
    }

    const commit = () => {
      if (cancelled) return;
      const next: TextureMap = {};
      for (const face of faces) {
        const url = artwork[face];
        const tex = url ? cache.get(url) : undefined;
        if (tex) next[face] = tex;
      }
      setTextures(next);
    };

    commit();

    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    for (const url of wanted) {
      if (cache.has(url)) continue;
      loader.load(
        url,
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAnisotropy;
          tex.needsUpdate = true;
          cache.set(url, tex);
          commit();
        },
        undefined,
        (err) => console.error('Failed to load artwork texture', err),
      );
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork, facesKey, gl, loader]);

  // Dispose retired textures once the materials referencing them have been updated.
  useEffect(() => {
    const retired = pendingDisposeRef.current;
    pendingDisposeRef.current = [];
    retired.forEach((t) => t.dispose());
  }, [textures]);

  // Dispose everything on unmount.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.forEach((t) => t.dispose());
      cache.clear();
      pendingDisposeRef.current.forEach((t) => t.dispose());
      pendingDisposeRef.current = [];
    };
  }, []);

  return textures;
}

/**
 * Per-face textures for a preset: a full-dieline upload is sliced into every face, and any
 * per-face upload takes precedence over its slice. Call once per scene and share the result
 * between layout instances.
 */
export function useSceneTextures(artwork: ArtworkMap, preset: PackagingPreset): TextureMap {
  const faces = useMemo<FaceKey[]>(() => [...facesForCategory(preset.category), 'dieline'], [preset.category]);
  const loaded = useArtworkTextures(artwork, faces);
  const dieline = useMemo(() => buildDieline(preset), [preset]);
  const dielineTexture = loaded.dieline ?? null;
  const slices = useMemo(
    () => (dielineTexture ? sliceDielineTexture(dielineTexture, dieline) : {}),
    [dielineTexture, dieline],
  );
  useEffect(() => () => Object.values(slices).forEach((t) => t?.dispose()), [slices]);

  return useMemo(() => {
    const merged: TextureMap = { ...slices };
    for (const face of faces) {
      if (face !== 'dieline' && loaded[face]) merged[face] = loaded[face];
    }
    return merged;
  }, [slices, loaded, faces]);
}

/** Width / height of the part of the image a texture shows (1 when unknown). */
function textureAspect(texture: THREE.Texture | null): number {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  if (!texture || !image?.width || !image?.height) return 1;
  return (image.width * texture.repeat.x) / (image.height * texture.repeat.y);
}

/* ------------------------------------------------------------------ */
/* Model components                                                   */
/* ------------------------------------------------------------------ */

interface SurfaceProps {
  textures: TextureMap;
  baseColor: string;
  finish: FinishId;
}

/** Eases a displayed value towards the shared open target each frame. */
function useEasedOpen(openRef: MutableRefObject<number>, apply: (open: number) => void) {
  const current = useRef(openRef.current);
  useFrame((_, delta) => {
    const target = openRef.current;
    current.current += (target - current.current) * Math.min(1, delta * 8);
    if (Math.abs(target - current.current) < 1e-4) current.current = target;
    apply(current.current);
  });
}

/**
 * Openable carton built from separate board panels: walls, bottom, a lid hinged at the back
 * edge and a tuck flap hinged at the lid's front edge. Outer faces carry the artwork in
 * Three.js BoxGeometry face order; edges and insides use the finish's interior board.
 */
function PanelBox({
  size,
  thickness,
  textures,
  baseColor,
  finish,
  openRef,
}: SurfaceProps & { size: [number, number, number]; thickness: number; openRef: MutableRefObject<number> }) {
  const [w, h, d] = size;
  const t = thickness;
  const flapH = Math.min(d * 0.35, h * 0.4);

  const geometries = useDisposable(() => {
    const g = {
      front: new THREE.BoxGeometry(w, h - 2 * t, t),
      back: new THREE.BoxGeometry(w, h - 2 * t, t),
      right: new THREE.BoxGeometry(t, h - 2 * t, d - 2 * t),
      left: new THREE.BoxGeometry(t, h - 2 * t, d - 2 * t),
      bottom: new THREE.BoxGeometry(w, t, d),
      lid: new THREE.BoxGeometry(w, t, d),
      flap: new THREE.BoxGeometry(Math.max(w - 2.2 * t, t), flapH, t),
    };
    return { ...g, dispose: () => Object.values(g).forEach((x) => x.dispose()) };
  }, [w, h, d, t, flapH]);

  const faceMaterials = useMaterials(BOX_FACE_ORDER.length);
  const [interior] = useMaterials(1);
  const face = (f: BoxFace) => faceMaterials[BOX_FACE_ORDER.indexOf(f)];

  const panelMaterials = useMemo(() => {
    const I = interior;
    return {
      front: [I, I, I, I, face('front'), I],
      back: [I, I, I, I, I, face('back')],
      right: [face('right'), I, I, I, I, I],
      left: [I, face('left'), I, I, I, I],
      bottom: [I, I, I, face('bottom'), I, I],
      lid: [I, I, face('top'), I, I, I],
      flap: I,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceMaterials, interior]);

  useEffect(() => {
    BOX_FACE_ORDER.forEach((f, i) => {
      applySurface(faceMaterials[i], { map: textures[f] ?? null, baseColor, finish });
    });
    applyInterior(interior, finish);
  }, [faceMaterials, interior, textures, baseColor, finish]);

  const lidRef = useRef<THREE.Group>(null);
  const flapRef = useRef<THREE.Group>(null);
  useEasedOpen(openRef, (open) => {
    if (lidRef.current) lidRef.current.rotation.x = -open * LID_OPEN_ANGLE;
    if (flapRef.current) flapRef.current.rotation.x = -open * Math.PI * 0.42;
  });

  return (
    <group>
      <mesh geometry={geometries.bottom} material={panelMaterials.bottom} position={[0, t / 2, 0]} />
      <mesh geometry={geometries.front} material={panelMaterials.front} position={[0, h / 2, d / 2 - t / 2]} />
      <mesh geometry={geometries.back} material={panelMaterials.back} position={[0, h / 2, -d / 2 + t / 2]} />
      <mesh geometry={geometries.right} material={panelMaterials.right} position={[w / 2 - t / 2, h / 2, 0]} />
      <mesh geometry={geometries.left} material={panelMaterials.left} position={[-w / 2 + t / 2, h / 2, 0]} />
      {/* Lid hinged on the back top edge. */}
      <group ref={lidRef} position={[0, h - t, -d / 2]}>
        <mesh geometry={geometries.lid} material={panelMaterials.lid} position={[0, t / 2, d / 2]} />
        {/* Tuck flap: hangs inside the front wall when closed, swings forward as the lid opens. */}
        <group ref={flapRef} position={[0, 0, d - t]}>
          <mesh geometry={geometries.flap} material={panelMaterials.flap} position={[0, -flapH / 2, -t / 2]} />
        </group>
      </group>
    </group>
  );
}

/** Stickers: a thin BoxGeometry with artwork on the front face. */
function LabelMesh({ size, textures, baseColor, finish }: SurfaceProps & { size: [number, number, number] }) {
  const [w, h, d] = size;
  const geometry = useDisposable(() => new THREE.BoxGeometry(w, h, d), [w, h, d]);
  const materials = useMaterials(BOX_FACE_ORDER.length);

  useEffect(() => {
    BOX_FACE_ORDER.forEach((face, i) => {
      applySurface(materials[i], { map: face === 'front' ? (textures.front ?? null) : null, baseColor, finish });
    });
  }, [materials, textures, baseColor, finish]);

  return <mesh geometry={geometry} material={materials} position={[0, h / 2, 0]} />;
}

/** Revolved body profile with a rounded base and an optional shoulder narrowing to the neck. */
function createBodyGeometry(radius: number, height: number, neckRadius: number, shoulder: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const fillet = Math.min(radius * 0.12, height * 0.1);
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - fillet + Math.cos(a) * fillet, fillet + Math.sin(a) * fillet));
  }
  const shoulderStart = height - shoulder;
  for (let i = 0; i <= steps * 2; i++) {
    const a = (i / (steps * 2)) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(
        neckRadius + Math.cos(a) * (radius - neckRadius),
        shoulderStart + Math.sin(a) * shoulder,
      ),
    );
  }
  pts.push(new THREE.Vector2(0, height));
  // phiStart = PI puts the lathe seam at the back, away from the label.
  return new THREE.LatheGeometry(pts, 96, Math.PI, Math.PI * 2);
}

type CapAccent = 'cap' | 'collar' | 'glass' | 'metal';

/**
 * Bottles, jars and vials: lathe body + cap, with artwork wrapped around the front of the body.
 * Vials are clear glass with liquid inside, and always show a label band (base color until artwork is added).
 */
function BottleMesh({
  preset,
  unitsPerMm,
  textures,
  baseColor,
  finish,
  labelFace = 'front',
}: SurfaceProps & { preset: BottlePreset; unitsPerMm: number; labelFace?: FaceKey }) {
  const r = (preset.dimensions.diameter / 2) * unitsPerMm;
  const H = preset.dimensions.height * unitsPerMm;
  const { kind } = preset;
  const { bodyHeight, neckRadius, shoulder } = bottleParts(kind, r, H);
  const capHeight = H - bodyHeight;

  const bodyGeometry = useDisposable(
    () => createBodyGeometry(r, bodyHeight, neckRadius, shoulder),
    [r, bodyHeight, neckRadius, shoulder],
  );

  const isVial = kind === 'vial';
  const labelTexture = textures[labelFace] ?? null;
  const showLabel = isVial || labelTexture !== null;

  // Label band on the straight part of the body, centered on +Z (theta 0). Its arc follows the
  // artwork's aspect ratio so images aren't stretched; wide artwork wraps further round the bottle.
  const band = labelBand(kind, r, H);
  const fullWrap = Math.PI * 2 * FULL_WRAP;
  const labelArc = labelTexture
    ? THREE.MathUtils.clamp((band.height * textureAspect(labelTexture)) / r, 0.35, fullWrap)
    : fullWrap;
  const labelGeometry = useDisposable(
    () => new THREE.CylinderGeometry(r * 1.004, r * 1.004, band.height, 128, 1, true, -labelArc / 2, labelArc),
    [r, band.height, labelArc],
  );

  // Cap pieces.
  const capGeometries = useDisposable(() => {
    const parts: { geometry: THREE.BufferGeometry; y: number; accent: CapAccent }[] = [];
    if (kind === 'dropper') {
      const collarH = capHeight * 0.4;
      const bulbR = r * 0.4;
      const bulbLen = Math.max(capHeight - collarH - bulbR, 0.001);
      parts.push({
        geometry: new THREE.CylinderGeometry(neckRadius * 1.08, neckRadius * 1.08, collarH, 64),
        y: bodyHeight + collarH / 2,
        accent: 'collar',
      });
      parts.push({
        geometry: new THREE.CapsuleGeometry(bulbR, bulbLen, 12, 48),
        y: bodyHeight + collarH + bulbLen / 2,
        accent: 'cap',
      });
    } else if (kind === 'serum') {
      const neckH = capHeight * 0.15;
      const capR = r * 0.58;
      parts.push({
        geometry: new THREE.CylinderGeometry(neckRadius, neckRadius, neckH, 48),
        y: bodyHeight + neckH / 2,
        accent: 'collar',
      });
      parts.push({
        geometry: new THREE.CylinderGeometry(capR, capR, capHeight - neckH, 64),
        y: bodyHeight + neckH + (capHeight - neckH) / 2,
        accent: 'cap',
      });
    } else if (kind === 'vial') {
      // Short glass neck, then an aluminium crimp cap with a slightly recessed top.
      const neckH = capHeight * 0.3;
      const crimpH = capHeight - neckH;
      const capR = r * 0.78;
      parts.push({
        geometry: new THREE.CylinderGeometry(neckRadius, neckRadius, neckH, 64),
        y: bodyHeight + neckH / 2,
        accent: 'glass',
      });
      parts.push({
        geometry: new THREE.CylinderGeometry(capR, capR, crimpH * 0.97, 96),
        y: bodyHeight + neckH + (crimpH * 0.97) / 2,
        accent: 'metal',
      });
      parts.push({
        geometry: new THREE.CylinderGeometry(capR * 0.9, capR * 0.9, crimpH * 0.03, 96),
        y: bodyHeight + neckH + crimpH * 0.97 + (crimpH * 0.03) / 2,
        accent: 'metal',
      });
    } else {
      const lidR = r * 1.03;
      parts.push({
        geometry: new THREE.CylinderGeometry(lidR, lidR, capHeight, 96),
        y: bodyHeight + capHeight / 2,
        accent: 'cap',
      });
    }
    return {
      parts,
      dispose: () => parts.forEach((p) => p.geometry.dispose()),
    };
  }, [kind, r, capHeight, bodyHeight, neckRadius]);

  const [bodyMaterial] = useMaterials(1);
  const labelMaterial = useDisposable(
    () =>
      new THREE.MeshStandardMaterial({
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [],
  );
  const capMaterial = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.35, metalness: 0.1 }),
    [],
  );
  const collarMaterial = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: '#c8a96a', roughness: 0.25, metalness: 0.85 }),
    [],
  );
  const aluminiumMaterial = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: '#d5d9de', roughness: 0.3, metalness: 0.65 }),
    [],
  );
  // Clear glass: transparent rather than transmissive, so exports keep a transparent background.
  const glassMaterial = useDisposable(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
        envMapIntensity: 1.6,
      }),
    [],
  );
  const liquidMaterial = useDisposable(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#eaf4ff',
        roughness: 0.02,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    [],
  );
  const liquidHeight = bodyHeight * 0.62;
  const liquidGeometry = useDisposable(
    () => new THREE.CylinderGeometry(r * 0.9, r * 0.9, liquidHeight, 64),
    [r, liquidHeight],
  );
  const accentMaterials: Record<CapAccent, THREE.Material> = {
    cap: capMaterial,
    collar: collarMaterial,
    glass: glassMaterial,
    metal: aluminiumMaterial,
  };

  useEffect(() => {
    applySurface(bodyMaterial, { map: null, baseColor, finish });
  }, [bodyMaterial, baseColor, finish]);

  useEffect(() => {
    applySurface(labelMaterial, { map: labelTexture, baseColor, finish });
  }, [labelMaterial, labelTexture, baseColor, finish]);

  return (
    <group>
      {isVial && (
        <mesh
          geometry={liquidGeometry}
          material={liquidMaterial}
          position={[0, band.straightBottom + liquidHeight / 2, 0]}
          renderOrder={1}
        />
      )}
      <mesh geometry={bodyGeometry} material={isVial ? glassMaterial : bodyMaterial} renderOrder={2} />
      {showLabel && <mesh geometry={labelGeometry} material={labelMaterial} position={[0, band.centerY, 0]} />}
      {capGeometries.parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={accentMaterials[part.accent]}
          position={[0, part.y, 0]}
          renderOrder={part.accent === 'glass' ? 2 : 0}
        />
      ))}
    </group>
  );
}

/** Vial + box set: the carton on the left and its vial on the right, both facing +Z. */
function VialSetMesh({
  preset,
  unitsPerMm,
  textures,
  baseColor,
  finish,
  openRef,
}: SurfaceProps & { preset: SetPreset; unitsPerMm: number; openRef: MutableRefObject<number> }) {
  const { box, vial } = preset.dimensions;
  const totalWidth = box.width + vial.diameter * SET_GAP_RATIO + vial.diameter;
  const boxX = (-totalWidth / 2 + box.width / 2) * unitsPerMm;
  const vialX = (totalWidth / 2 - vial.diameter / 2) * unitsPerMm;

  const vialPreset = useMemo<BottlePreset>(
    () => ({
      id: `${preset.id}-vial`,
      name: preset.name,
      description: preset.description,
      group: preset.group,
      type: preset.type,
      category: 'bottle',
      kind: 'vial',
      dimensions: vial,
    }),
    [preset, vial],
  );

  return (
    <group>
      <group position={[boxX, 0, 0]}>
        <PanelBox
          size={[box.width * unitsPerMm, box.height * unitsPerMm, box.depth * unitsPerMm]}
          thickness={boardThickness(preset) * unitsPerMm}
          textures={textures}
          baseColor={baseColor}
          finish={finish}
          openRef={openRef}
        />
      </group>
      <group position={[vialX, 0, 0]}>
        <BottleMesh
          preset={vialPreset}
          unitsPerMm={unitsPerMm}
          textures={textures}
          baseColor={baseColor}
          finish={finish}
          labelFace="label"
        />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Public component                                                   */
/* ------------------------------------------------------------------ */

export interface PackagingModelProps {
  preset: PackagingPreset;
  textures: TextureMap;
  finish: FinishId;
  baseColor: string;
  /** Shared lid opening target (0..1), read every frame so animations don't re-render React. */
  openRef: MutableRefObject<number>;
}

/** One packaging model for the active preset, resting on the floor (y = 0) and centered on the origin. */
export default function PackagingModel({ preset, textures, finish, baseColor, openRef }: PackagingModelProps) {
  const layout = useMemo(() => getModelLayout(preset), [preset]);
  const surface = { textures, baseColor, finish };

  // `key` remounts on preset change so all per-shape resources are released together.
  switch (preset.category) {
    case 'bottle':
      return <BottleMesh key={preset.id} preset={preset} unitsPerMm={layout.unitsPerMm} {...surface} />;
    case 'set':
      return (
        <VialSetMesh key={preset.id} preset={preset} unitsPerMm={layout.unitsPerMm} openRef={openRef} {...surface} />
      );
    case 'label':
      return <LabelMesh key={preset.id} size={layout.size} {...surface} />;
    case 'object': {
      const { width, height, depth } = preset.dimensions;
      const k = layout.unitsPerMm;
      return <ObjectMesh key={preset.id} kind={preset.kind} size={[width * k, height * k, depth * k]} {...surface} />;
    }
    case 'box':
      return (
        <PanelBox
          key={preset.id}
          size={layout.size}
          thickness={Math.max(boardThickness(preset) * layout.unitsPerMm, 0.004)}
          openRef={openRef}
          {...surface}
        />
      );
  }
}
