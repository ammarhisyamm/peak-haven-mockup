import * as THREE from 'three';

/**
 * Procedural paper grain for kraft and corrugated finishes, drawn once on a canvas.
 * Textures are app-lifetime singletons shared by every material, so they are never disposed.
 */

type Grain = 'kraft' | 'corrugated';

interface GrainTextures {
  /** Near-white grayscale that tints the base color with fibers (sRGB). */
  color: THREE.CanvasTexture;
  /** Same pattern used as a bump map (linear). */
  bump: THREE.CanvasTexture;
}

const cache = new Map<Grain, GrainTextures>();

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawGrain(grain: Grain): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(grain === 'kraft' ? 7 : 11);

  // Mottled base.
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    let v = 232 + (rand() - 0.5) * 26;
    if (grain === 'corrugated') v += Math.sin((x / size) * Math.PI * 2 * 48) * 7;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Fibers.
  ctx.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 3 + rand() * 12;
    const a = rand() * Math.PI * 2;
    const shade = rand() < 0.5 ? 190 + rand() * 30 : 245 + rand() * 10;
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.35 + rand() * 0.35})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return canvas;
}

export function getGrainTextures(grain: Grain): GrainTextures {
  const hit = cache.get(grain);
  if (hit) return hit;
  const canvas = drawGrain(grain);
  const make = (srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  const textures = { color: make(true), bump: make(false) };
  cache.set(grain, textures);
  return textures;
}
