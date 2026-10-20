/**
 * Scene backdrops: gradients and patterns drawn behind the model, and realistic scenes that add
 * a textured floor (wood, marble, concrete...) or a podium. Everything is procedural (canvas),
 * so backdrops work offline and export at any resolution.
 */

export type BackdropKind = 'gradient' | 'pattern' | 'scene';
export type FloorId = 'wood' | 'marble' | 'concrete' | 'linen' | 'sand' | 'terrazzo' | 'plain';

export interface Backdrop {
  id: string;
  label: string;
  kind: BackdropKind;
  /** Draws the background (sky) for a canvas of the given size. */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Realistic scenes: textured floor, its tile size in world units, and the haze color it fades into. */
  floor?: { id: FloorId; color: string; tile: number; roughness: number };
  fog?: string;
  podium?: { colors: [string, string] };
  /** Seamless studio paper that curves up into a wall behind the model. */
  sweep?: string;
}

/* ------------------------------------------------------------------ */
/* Noise                                                              */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Tileable value noise on a `cells` grid. */
function makeNoise(cells: number, seed: number) {
  const r = rng(seed);
  const grid = Array.from({ length: cells * cells }, () => r());
  const at = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
  return (u: number, v: number) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function fbm(noises: ((u: number, v: number) => number)[], u: number, v: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (const n of noises) {
    sum += n(u, v) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ------------------------------------------------------------------ */
/* 2D backgrounds                                                     */
/* ------------------------------------------------------------------ */

function linear(stops: string[], angle = 90) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const a = (angle * Math.PI) / 180;
    const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createLinearGradient(
      cx - (Math.cos(a) * len) / 2,
      cy - (Math.sin(a) * len) / 2,
      cx + (Math.cos(a) * len) / 2,
      cy + (Math.sin(a) * len) / 2,
    );
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
}

function radial(inner: string, outer: string, cy = 0.42) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const g = ctx.createRadialGradient(w / 2, h * cy, 0, w / 2, h * cy, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
}

/** Soft light falloff on top of a pattern so the product stays the focus. */
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.18) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.45, Math.hypot(w, h) * 0.65);
  g.addColorStop(0, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function pattern(bg: string, paint: (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => void) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    paint(ctx, w, h, h / 1000);
    ctx.restore();
    vignette(ctx, w, h);
  };
}

const PATTERNS = {
  dots: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      ctx.fillStyle = ink;
      const step = 46 * u;
      for (let y = 0, row = 0; y < h + step; y += step, row++) {
        for (let x = (row % 2) * (step / 2); x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, 6 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  grid: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2 * u;
      const step = 60 * u;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
  stripes: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      ctx.fillStyle = ink;
      const step = 70 * u;
      ctx.rotate(-Math.PI / 4);
      for (let x = -h * 2; x < w * 2; x += step) ctx.fillRect(x, -h * 2, step / 2, h * 5);
    },
  checker: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      ctx.fillStyle = ink;
      const step = 90 * u;
      for (let y = 0, r = 0; y < h; y += step, r++) {
        for (let x = (r % 2) * step; x < w; x += step * 2) ctx.fillRect(x, y, step, step);
      }
    },
  waves: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6 * u;
      ctx.lineCap = 'round';
      const step = 54 * u;
      for (let y = -step; y < h + step; y += step) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6 * u) {
          const yy = y + Math.sin((x / (120 * u)) * Math.PI * 2) * 14 * u;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    },
  confetti: (inks: string[]) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      const r = rng(5);
      const count = Math.round((w * h) / (5200 * u * u));
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.translate(r() * w, r() * h);
        ctx.rotate(r() * Math.PI);
        ctx.fillStyle = inks[i % inks.length];
        const t = r();
        if (t < 0.4) ctx.fillRect(-12 * u, -4 * u, 24 * u, 8 * u);
        else if (t < 0.7) {
          ctx.beginPath();
          ctx.arc(0, 0, 7 * u, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -10 * u);
          ctx.lineTo(9 * u, 7 * u);
          ctx.lineTo(-9 * u, 7 * u);
          ctx.fill();
        }
        ctx.restore();
      }
    },
  terrazzo: (inks: string[]) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      const r = rng(17);
      const count = Math.round((w * h) / (2600 * u * u));
      for (let i = 0; i < count; i++) {
        const x = r() * w;
        const y = r() * h;
        const size = (4 + r() * 16) * u;
        ctx.fillStyle = inks[i % inks.length];
        ctx.beginPath();
        const sides = 4 + Math.floor(r() * 3);
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * Math.PI * 2 + r();
          const rr = size * (0.6 + r() * 0.5);
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
      }
    },
  sunburst: (ink: string) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = ink;
      const cx = w / 2;
      const cy = h * 0.45;
      const rays = 28;
      const R = Math.hypot(w, h);
      for (let i = 0; i < rays; i += 2) {
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = ((i + 1) / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        ctx.fill();
      }
    },
  memphis: (inks: string[]) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number, u: number) => {
      const r = rng(41);
      const count = Math.round((w * h) / (14000 * u * u));
      ctx.lineWidth = 5 * u;
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        const x = r() * w;
        const y = r() * h;
        const c = inks[i % inks.length];
        const t = r();
        ctx.strokeStyle = c;
        ctx.fillStyle = c;
        if (t < 0.35) {
          ctx.beginPath();
          for (let k = 0; k <= 4; k++) ctx.lineTo(x + k * 10 * u, y + (k % 2 ? -8 : 8) * u);
          ctx.stroke();
        } else if (t < 0.65) {
          ctx.beginPath();
          ctx.arc(x, y, 9 * u, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(r() * Math.PI);
          ctx.fillRect(-3 * u, -14 * u, 6 * u, 28 * u);
          ctx.restore();
        }
      }
    },
};

/* ------------------------------------------------------------------ */
/* Catalogue                                                          */
/* ------------------------------------------------------------------ */

/** MOQZUNO signature backgrounds: ink with violet and lime glows, and the brand's graphic patterns. */
function brandGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0d0d1d';
  ctx.fillRect(0, 0, w, h);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(13,13,29,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.22, h * 0.25, h * 0.75, 'rgba(118,87,255,0.55)');
  glow(w * 0.82, h * 0.78, h * 0.6, 'rgba(202,255,92,0.28)');
  glow(w * 0.5, h * 0.45, h * 0.5, 'rgba(37,37,72,0.6)');
}

function brandSquiggle(bg: string, ink: string, width: number) {
  return pattern(bg, (ctx, w, h, u) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width * u;
    ctx.lineCap = 'round';
    const step = 120 * u;
    for (let y = -step; y < h + step; y += step) {
      ctx.beginPath();
      for (let x = -20 * u; x <= w + 20 * u; x += 6 * u) {
        const yy = y + Math.sin((x / (180 * u)) * Math.PI * 2) * 34 * u + Math.sin(x / (61 * u)) * 8 * u;
        if (x <= -20 * u) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  });
}

function sparkles(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0d0d1d';
  ctx.fillRect(0, 0, w, h);
  const u = h / 1000;
  const step = 110 * u;
  ctx.strokeStyle = 'rgba(202,255,92,0.08)';
  ctx.lineWidth = 1.5 * u;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#caff5c';
  for (let y = step; y < h; y += step * 2) {
    for (let x = step; x < w; x += step * 2) {
      const s = 12 * u;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.fill();
    }
  }
  vignette(ctx, w, h, 0.35);
}

export const BACKDROPS: Backdrop[] = [
  // MOQZUNO signature
  { id: 'g-moqzuno', label: 'Moqzuno glow', kind: 'gradient', draw: brandGlow },
  { id: 'p-moqzuno-lime', label: 'Lime squiggle', kind: 'pattern', draw: brandSquiggle('#151529', '#caff5c', 34) },
  { id: 'p-moqzuno-violet', label: 'Violet flow', kind: 'pattern', draw: brandSquiggle('#0d0d1d', '#7657ff', 52) },
  { id: 'p-moqzuno-spark', label: 'Sparkle grid', kind: 'pattern', draw: sparkles },
  {
    id: 's-moqzuno',
    label: 'Moqzuno stage',
    kind: 'scene',
    draw: brandGlow,
    floor: { id: 'plain', color: '#1d1d38', tile: 4, roughness: 0.35 },
    fog: '#121226',
    podium: { colors: ['#2a2a4d', '#7657ff'] },
  },

  // Gradients
  { id: 'g-studio', label: 'Soft studio', kind: 'gradient', draw: radial('#ffffff', '#cfd6df') },
  { id: 'g-peach', label: 'Peach', kind: 'gradient', draw: linear(['#ffe8d6', '#ffb4a2'], 70) },
  { id: 'g-mint', label: 'Mint', kind: 'gradient', draw: linear(['#e6fff4', '#9ee6c4'], 70) },
  { id: 'g-sky', label: 'Sky', kind: 'gradient', draw: linear(['#eef6ff', '#9cc6fb'], 90) },
  { id: 'g-lavender', label: 'Lavender', kind: 'gradient', draw: linear(['#f5f0ff', '#c7b6fb'], 60) },
  { id: 'g-sunset', label: 'Sunset', kind: 'gradient', draw: linear(['#fde68a', '#fb923c', '#ec4899'], 75) },
  { id: 'g-aurora', label: 'Aurora', kind: 'gradient', draw: linear(['#0f172a', '#134e4a', '#22d3ee'], 120) },
  { id: 'g-midnight', label: 'Midnight', kind: 'gradient', draw: radial('#334155', '#020617') },

  // Patterns
  { id: 'p-dots', label: 'Polka dots', kind: 'pattern', draw: pattern('#fef3c7', PATTERNS.dots('#fcd34d')) },
  { id: 'p-grid', label: 'Blueprint', kind: 'pattern', draw: pattern('#1e3a8a', PATTERNS.grid('rgba(255,255,255,0.18)')) },
  { id: 'p-stripes', label: 'Candy stripes', kind: 'pattern', draw: pattern('#fce7f3', PATTERNS.stripes('#fbcfe8')) },
  { id: 'p-checker', label: 'Checker', kind: 'pattern', draw: pattern('#ecfccb', PATTERNS.checker('#d9f99d')) },
  { id: 'p-waves', label: 'Waves', kind: 'pattern', draw: pattern('#e0f2fe', PATTERNS.waves('#bae6fd')) },
  { id: 'p-confetti', label: 'Confetti', kind: 'pattern', draw: pattern('#fff7ed', PATTERNS.confetti(['#f472b6', '#38bdf8', '#facc15', '#34d399'])) },
  { id: 'p-terrazzo', label: 'Terrazzo', kind: 'pattern', draw: pattern('#f5f0e8', PATTERNS.terrazzo(['#e07a5f', '#81b29a', '#3d405b', '#f2cc8f'])) },
  { id: 'p-sunburst', label: 'Sunburst', kind: 'pattern', draw: pattern('#fdba74', PATTERNS.sunburst('#fed7aa')) },
  { id: 'p-memphis', label: 'Memphis', kind: 'pattern', draw: pattern('#f8fafc', PATTERNS.memphis(['#0ea5e9', '#f43f5e', '#facc15', '#111827'])) },

  // Realistic scenes
  {
    id: 's-wood',
    label: 'Wooden table',
    kind: 'scene',
    draw: linear(['#f6efe6', '#e8dccb', '#e8dccb'], 90),
    floor: { id: 'wood', color: '#b07a4a', tile: 6, roughness: 0.6 },
    fog: '#e8dccb',
  },
  {
    id: 's-marble',
    label: 'Marble',
    kind: 'scene',
    draw: linear(['#fbfcfd', '#eceef1', '#eceef1'], 90),
    floor: { id: 'marble', color: '#ffffff', tile: 7, roughness: 0.25 },
    fog: '#eceef1',
  },
  {
    id: 's-concrete',
    label: 'Concrete',
    kind: 'scene',
    draw: linear(['#ecebea', '#d5d2ce', '#d5d2ce'], 90),
    floor: { id: 'concrete', color: '#bdb9b4', tile: 5, roughness: 0.95 },
    fog: '#d5d2ce',
  },
  {
    id: 's-linen',
    label: 'Linen',
    kind: 'scene',
    draw: linear(['#fbf8f2', '#f1eadf', '#f1eadf'], 90),
    floor: { id: 'linen', color: '#efe6d6', tile: 2, roughness: 1 },
    fog: '#f1eadf',
  },
  {
    id: 's-sand',
    label: 'Beach',
    kind: 'scene',
    draw: linear(['#60a5fa', '#bfdbfe', '#f5ead2', '#f5ead2'], 90),
    floor: { id: 'sand', color: '#e9d3a8', tile: 4, roughness: 1 },
    fog: '#f5ead2',
  },
  {
    id: 's-terrazzo',
    label: 'Terrazzo floor',
    kind: 'scene',
    draw: linear(['#f9f6f2', '#eee6dc', '#eee6dc'], 90),
    floor: { id: 'terrazzo', color: '#f1ebe3', tile: 4, roughness: 0.4 },
    fog: '#eee6dc',
  },
  {
    id: 's-podium-pink',
    label: 'Pink podium',
    kind: 'scene',
    draw: linear(['#fdecef', '#f9cdd8', '#f9cdd8'], 90),
    floor: { id: 'plain', color: '#f8c8d4', tile: 4, roughness: 0.9 },
    fog: '#f9cdd8',
    podium: { colors: ['#fbe4ea', '#f4b6c6'] },
  },
  {
    id: 's-podium-sage',
    label: 'Sage podium',
    kind: 'scene',
    draw: linear(['#eef3ed', '#cbdac7', '#cbdac7'], 90),
    floor: { id: 'plain', color: '#c5d5c0', tile: 4, roughness: 0.9 },
    fog: '#cbdac7',
    podium: { colors: ['#e7efe5', '#a9c0a4'] },
  },
  {
    id: 's-sweep',
    label: 'Studio sweep',
    kind: 'scene',
    draw: linear(['#f1f3f6', '#e3e7ec', '#e3e7ec'], 90),
    sweep: '#e6e9ee',
    fog: '#e3e7ec',
  },
  {
    id: 's-dark',
    label: 'Dark studio',
    kind: 'scene',
    draw: radial('#3b4352', '#0b0f17', 0.35),
    sweep: '#262c36',
    fog: '#151a22',
  },
];

export function getBackdrop(id: string | null): Backdrop | null {
  return (id && BACKDROPS.find((b) => b.id === id)) || null;
}

/** Renders a backdrop to a canvas of the given pixel size. */
export function renderBackdrop(backdrop: Backdrop, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  backdrop.draw(canvas.getContext('2d')!, canvas.width, canvas.height);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Floor textures                                                     */
/* ------------------------------------------------------------------ */

const floorCache = new Map<string, HTMLCanvasElement>();

/** Tileable floor texture (sRGB color), cached for the app's lifetime. */
export function floorCanvas(id: FloorId, base: string): HTMLCanvasElement {
  const key = `${id}:${base}`;
  const hit = floorCache.get(key);
  if (hit) return hit;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const [br, bg, bb] = hexToRgb(base);
  const n1 = makeNoise(4, 1);
  const n2 = makeNoise(8, 2);
  const n3 = makeNoise(16, 3);
  const n4 = makeNoise(64, 4);
  const r = rng(9);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let k = 1;
      let tint: [number, number, number] | null = null;
      switch (id) {
        case 'wood': {
          // Planks along u, with grain rings bent by noise and a dark seam between boards.
          const planks = 4;
          const pv = v * planks;
          const plank = Math.floor(pv);
          const pu = (u + plank * 0.37) % 1;
          const seam = Math.min(pv - plank, 1 - (pv - plank)) < 0.012 ? 0.55 : 1;
          const warp = fbm([n1, n2], pu, v) * 6;
          const grain = 0.5 + 0.5 * Math.sin((v * planks * 18 + warp) * Math.PI * 2);
          k = (0.78 + grain * 0.18 + n4(u, v) * 0.08) * seam * (0.92 + ((plank * 0.137) % 0.16));
          break;
        }
        case 'marble': {
          const t = fbm([n1, n2, n3, n4], u, v);
          const vein = Math.abs(Math.sin((u * 3 + v * 2 + t * 5) * Math.PI));
          const dark = Math.pow(1 - vein, 14);
          k = 0.97 - dark * 0.35 + (n3(u, v) - 0.5) * 0.04;
          tint = [k * 248, k * 248, k * 250];
          break;
        }
        case 'concrete': {
          k = 0.86 + (fbm([n2, n3, n4], u, v) - 0.5) * 0.3 + (r() - 0.5) * 0.06;
          if (r() < 0.002) k *= 0.7;
          break;
        }
        case 'linen': {
          const weave = Math.sin(u * Math.PI * 2 * 90) * Math.sin(v * Math.PI * 2 * 90);
          k = 0.95 + weave * 0.03 + (n3(u, v) - 0.5) * 0.08 + (r() - 0.5) * 0.04;
          break;
        }
        case 'sand': {
          const ripple = Math.sin((v * 22 + fbm([n1, n2], u, v) * 3) * Math.PI * 2) * 0.03;
          k = 0.95 + ripple + (r() - 0.5) * 0.12 + (n3(u, v) - 0.5) * 0.08;
          break;
        }
        case 'terrazzo': {
          k = 0.97 + (n4(u, v) - 0.5) * 0.04;
          break;
        }
        case 'plain':
          k = 0.97 + (n3(u, v) - 0.5) * 0.04;
          break;
      }
      const i = (y * size + x) * 4;
      const c = tint ?? [br * k, bg * k, bb * k];
      img.data[i] = Math.min(255, c[0]);
      img.data[i + 1] = Math.min(255, c[1]);
      img.data[i + 2] = Math.min(255, c[2]);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (id === 'terrazzo') {
    const chips = ['#c0756a', '#7f9f8a', '#3f4258', '#d9b77c', '#ffffff'];
    for (let i = 0; i < 900; i++) {
      const x = r() * size;
      const y = r() * size;
      const s = 2 + r() * 7;
      ctx.fillStyle = chips[i % chips.length];
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r();
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s * (0.6 + r() * 0.6));
      }
      ctx.fill();
    }
  }
  floorCache.set(key, canvas);
  return canvas;
}
