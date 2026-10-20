import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FINISHES, type FinishId } from '../constants/presets';
import { getFabricTexture } from '../lib/paperTexture';
import {
  GARMENT_PRINT,
  GARMENT_SHAPES,
  LATHE_SPECS,
  isGarment,
  isLathe,
  type CompositeKind,
  type GarmentKind,
  type LatheKind,
  type MatName,
  type ObjectKind,
} from '../lib/objectSpecs';
import type { TextureMap } from './PackagingModel';

/**
 * Generic object models: every shape is built by a pure function into a list of meshes
 * that reference named materials, so geometry is rebuilt only when the shape or size changes.
 * Sizes are in world units; models stand on y = 0, centered on x/z, facing +Z.
 */

type Vec3 = [number, number, number];

interface MeshDesc {
  geometry: THREE.BufferGeometry;
  mat: MatName;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  renderOrder?: number;
}

interface BuildContext {
  /** Width / height of the front and back artwork (null when there is none). */
  frontAspect: number | null;
  backAspect: number | null;
}

const EPS = 0.0015;

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  roundedRectPath(s, w, h, r, cx, cy);
  return s;
}

function roundedRectPath(p: THREE.Path, w: number, h: number, r: number, cx = 0, cy = 0) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

/** Sets UVs from x/y positions so the bounding rect maps to [u0..u1] × [v0..v1]. */
function planarUV(g: THREE.BufferGeometry, w: number, h: number, cx = 0, cy = 0, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - (cx - w / 2)) / w;
    const v = (pos.getY(i) - (cy - h / 2)) / h;
    uv[i * 2] = u0 + u * (u1 - u0);
    uv[i * 2 + 1] = v0 + v * (v1 - v0);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A flat artwork panel in the XY plane facing +Z (optionally rounded or with holes). */
function artPlane(w: number, h: number, r = 0, uv: [number, number, number, number] = [0, 1, 0, 1]) {
  const g = r > 0 ? new THREE.ShapeGeometry(roundedRectShape(w, h, r), 10) : new THREE.PlaneGeometry(w, h);
  return planarUV(g, w, h, 0, 0, ...uv);
}

function shapeArt(shape: THREE.Shape, w: number, h: number) {
  return planarUV(new THREE.ShapeGeometry(shape, 16), w, h);
}

/** Rounded slab in the XY plane, centered, `d` thick along Z. */
function slab(w: number, h: number, d: number, r: number, bevel = 0) {
  const b = Math.min(bevel, d * 0.45, w * 0.2, h * 0.2);
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(d - 2 * b, 1e-4),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

/** Shape extruded upward from y = 0 to `height` (shape x → x, shape y → −z). */
function upright(shape: THREE.Shape, height: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function box(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}

/** Box with some faces removed (BoxGeometry order +X, −X, +Y, −Y, +Z, −Z). */
function openBox(w: number, h: number, d: number, remove: number[]) {
  const g = new THREE.BoxGeometry(w, h, d);
  const index = g.index!.array;
  const kept: number[] = [];
  for (const gr of g.groups) {
    if (remove.includes(gr.materialIndex ?? -1)) continue;
    for (let i = gr.start; i < gr.start + gr.count; i++) kept.push(index[i]);
  }
  g.setIndex(kept);
  g.clearGroups();
  return g;
}

function cyl(rTop: number, rBottom: number, h: number, seg = 48, open = false, thetaStart = 0, thetaLen = Math.PI * 2) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open, thetaStart, thetaLen);
}

/** Fits an artwork of `aspect` inside a max area, keeping its proportions. */
function fit(maxW: number, maxH: number, aspect: number | null): [number, number] {
  const a = aspect ?? maxW / maxH;
  return a > maxW / maxH ? [maxW, maxW / a] : [maxH * a, maxH];
}

/** Flat sheet bulged into a pillow along Z by `bulge(u, v)` (0..1). */
function pillow(w: number, h: number, depth: number, bulge: (u: number, v: number) => number, sign: 1 | -1) {
  const g = new THREE.PlaneGeometry(w, h, 32, 40);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5;
    const v = pos.getY(i) / h + 0.5;
    const b = bulge(u, v);
    pos.setX(i, pos.getX(i) * (1 - 0.05 * b));
    pos.setZ(i, sign * (b * depth + depth * 0.012));
  }
  if (sign < 0) {
    // Flip winding so the back side faces −Z.
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    // Mirror u so back artwork reads correctly from behind.
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  g.computeVertexNormals();
  return g;
}

function lathe(pts: [number, number][], r: number, H: number) {
  return new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(Math.max(x * r, 0), y * H)),
    72,
    Math.PI,
    Math.PI * 2,
  );
}

/* ------------------------------------------------------------------ */
/* Builders                                                           */
/* ------------------------------------------------------------------ */

function buildLathe(kind: LatheKind, w: number, h: number, ctx: BuildContext): MeshDesc[] {
  const spec = LATHE_SPECS[kind];
  const r = w / 2;
  const out: MeshDesc[] = spec.parts.map((p) => ({
    geometry: lathe(p.pts, r, h),
    mat: p.mat,
    renderOrder: p.mat === 'liquid' || p.mat === 'wax' ? 1 : ['glass', 'clear', 'glassGreen', 'glassAmber'].includes(p.mat) ? 2 : 0,
  }));

  const label = spec.label;
  if (label && (label.always || ctx.frontAspect !== null)) {
    const bandH = (label.y1 - label.y0) * h;
    const rMid = ((label.r0 + label.r1) / 2) * r;
    const full = Math.PI * 2 * 0.985;
    const arc =
      label.wrap === 'full' || ctx.frontAspect === null
        ? full
        : THREE.MathUtils.clamp((bandH * ctx.frontAspect) / rMid, 0.35, full);
    out.push({
      geometry: cyl(label.r1 * r * 1.006 + 0.0008, label.r0 * r * 1.006 + 0.0008, bandH, 96, true, -arc / 2, arc),
      mat: 'art',
      position: [0, ((label.y0 + label.y1) / 2) * h, 0],
      renderOrder: 3,
    });
  }

  for (const extra of spec.extras ?? []) {
    switch (extra) {
      case 'mug-handle': {
        const g = new THREE.TorusGeometry(h * 0.27, Math.max(r * 0.09, h * 0.045), 16, 40, Math.PI);
        out.push({ geometry: g, mat: 'body', position: [r * 0.97, h * 0.52, 0], rotation: [0, 0, -Math.PI / 2] });
        break;
      }
      case 'trigger': {
        out.push({ geometry: box(r * 0.55, h * 0.08, r * 1.5), mat: 'white', position: [0, h * 0.88, r * 0.35] });
        out.push({ geometry: box(r * 0.5, h * 0.05, r * 0.6), mat: 'white', position: [0, h * 0.94, -r * 0.1] });
        out.push({ geometry: cyl(r * 0.12, r * 0.14, r * 0.25, 20), mat: 'cap', position: [0, h * 0.88, r * 1.2], rotation: [Math.PI / 2, 0, 0] });
        out.push({ geometry: box(r * 0.28, h * 0.14, r * 0.12), mat: 'cap', position: [0, h * 0.79, r * 0.72], rotation: [-0.25, 0, 0] });
        break;
      }
      case 'pump-head': {
        out.push({ geometry: cyl(r * 0.24, r * 0.24, h * 0.06, 32), mat: 'white', position: [0, h * 0.93, 0] });
        out.push({ geometry: box(r * 0.3, h * 0.035, r * 0.9), mat: 'white', position: [0, h * 0.95, r * 0.4] });
        out.push({ geometry: cyl(r * 0.07, r * 0.07, r * 0.12, 16), mat: 'white', position: [0, h * 0.94, r * 0.86], rotation: [Math.PI / 2, 0, 0] });
        break;
      }
      case 'straw': {
        out.push({ geometry: cyl(r * 0.07, r * 0.07, h * 0.42, 16), mat: 'white', position: [r * 0.12, h * 1.0, 0], rotation: [0, 0, -0.12] });
        break;
      }
      case 'bucket-handle': {
        const g = new THREE.TorusGeometry(r * 0.99, Math.max(r * 0.02, 0.004), 8, 48, Math.PI);
        out.push({ geometry: g, mat: 'metal', position: [0, h * 0.94, 0], rotation: [0, 0, 0] });
        break;
      }
      case 'hoops': {
        for (const y of [0.1, 0.9]) {
          const rr = r * (y < 0.5 ? 0.9 : 0.9);
          out.push({ geometry: new THREE.TorusGeometry(rr, r * 0.025, 8, 64), mat: 'dark', position: [0, h * y, 0], rotation: [Math.PI / 2, 0, 0] });
        }
        break;
      }
      case 'wick': {
        out.push({ geometry: cyl(r * 0.02, r * 0.02, h * 0.08, 8), mat: 'dark', position: [0, h * 0.86, 0] });
        break;
      }
    }
  }
  return out;
}

function buildGarment(kind: GarmentKind, w: number, h: number, d: number, ctx: BuildContext): MeshDesc[] {
  const b = Math.min(d * 0.45, w * 0.03);
  const pts = GARMENT_SHAPES[kind];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * (w - 2 * b), b + y * (h - 2 * b))));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(d - 2 * b, 1e-4),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  const out: MeshDesc[] = [{ geometry: g, mat: 'body' }];

  const print = GARMENT_PRINT[kind];
  if (ctx.frontAspect !== null) {
    const [pw, ph] = fit(print.w * w, print.h * h, ctx.frontAspect);
    out.push({ geometry: artPlane(pw, ph), mat: 'art', position: [print.x * w, print.y * h, d / 2 + EPS] });
  }
  if (ctx.backAspect !== null && kind !== 'apron') {
    const [pw, ph] = fit(0.46 * w, 0.4 * h, ctx.backAspect);
    out.push({ geometry: artPlane(pw, ph), mat: 'artBack', position: [0, (kind === 'sweatpants' || kind === 'shorts' ? 0.8 : 0.6) * h, -d / 2 - EPS], rotation: [0, Math.PI, 0] });
  }

  if (kind === 'hoodie') {
    const pocket = new THREE.Shape([
      new THREE.Vector2(-0.2 * w, 0.12 * h),
      new THREE.Vector2(0.2 * w, 0.12 * h),
      new THREE.Vector2(0.15 * w, 0.32 * h),
      new THREE.Vector2(-0.15 * w, 0.32 * h),
    ]);
    const pg = new THREE.ExtrudeGeometry(pocket, { depth: d * 0.08, bevelEnabled: false });
    out.push({ geometry: pg, mat: 'body', position: [0, 0, d / 2 - d * 0.02] });
    for (const x of [-0.05, 0.05]) {
      out.push({ geometry: cyl(w * 0.006, w * 0.006, h * 0.2, 8), mat: 'white', position: [x * w, 0.8 * h, d / 2 + w * 0.006] });
    }
  }
  if (kind === 'polo') {
    for (const s of [-1, 1]) {
      const collar = new THREE.Shape([
        new THREE.Vector2(0, 0.95 * h),
        new THREE.Vector2(s * 0.16 * w, 1.0 * h - b),
        new THREE.Vector2(s * 0.13 * w, 0.88 * h),
      ]);
      out.push({ geometry: new THREE.ExtrudeGeometry(collar, { depth: d * 0.06, bevelEnabled: false }), mat: 'body', position: [0, 0, d / 2] });
    }
    out.push({ geometry: box(w * 0.05, h * 0.16, d * 0.04), mat: 'body', position: [0, 0.86 * h, d / 2 + d * 0.02] });
    for (const y of [0.9, 0.84]) {
      out.push({ geometry: cyl(w * 0.009, w * 0.009, d * 0.06, 12), mat: 'white', position: [0, y * h, d / 2 + d * 0.05], rotation: [Math.PI / 2, 0, 0] });
    }
  }
  if (kind === 'apron') {
    out.push({ geometry: new THREE.TorusGeometry(w * 0.2, w * 0.008, 8, 32, Math.PI), mat: 'body', position: [0, h * 0.99, 0] });
    for (const s of [-1, 1]) {
      out.push({ geometry: box(w * 0.3, h * 0.02, d * 0.3), mat: 'body', position: [s * w * 0.52, h * 0.61, 0], rotation: [0, 0, s * -0.6] });
    }
    out.push({ geometry: box(w * 0.5, h * 0.16, d * 0.2), mat: 'body', position: [0, h * 0.2, d / 2 + d * 0.1] });
  }
  return out;
}

/** Front art covering a face (stretched to it), or nothing when there is no artwork. */
function faceArt(out: MeshDesc[], ctx: BuildContext, w: number, h: number, pos: Vec3, rot: Vec3 = [0, 0, 0], back = false, r = 0) {
  if ((back ? ctx.backAspect : ctx.frontAspect) === null) return;
  out.push({ geometry: artPlane(w, h, r), mat: back ? 'artBack' : 'art', position: pos, rotation: rot });
}

/** Artwork that always shows (base color when empty), e.g. printed packaging faces. */
function printedFace(out: MeshDesc[], w: number, h: number, pos: Vec3, rot: Vec3 = [0, 0, 0], back = false, r = 0, uv?: [number, number, number, number]) {
  out.push({ geometry: artPlane(w, h, r, uv), mat: back ? 'artBack' : 'art', position: pos, rotation: rot });
}

function buildBook(w: number, h: number, d: number, _ctx: BuildContext, kind: 'book' | 'magazine' | 'notebook'): MeshDesc[] {
  const out: MeshDesc[] = [];
  const ct = kind === 'magazine' ? d * 0.12 : Math.min(d * 0.1, w * 0.012);
  const inset = kind === 'magazine' ? 0 : h * 0.012;
  out.push({ geometry: box(w, h, ct), mat: 'body', position: [0, h / 2, d / 2 - ct / 2] });
  out.push({ geometry: box(w, h, ct), mat: 'body', position: [0, h / 2, -d / 2 + ct / 2] });
  if (kind !== 'notebook') out.push({ geometry: box(ct, h, d), mat: 'body', position: [-w / 2 + ct / 2, h / 2, 0] });
  out.push({ geometry: box(w - ct - inset, h - 2 * inset, d - 2 * ct), mat: 'paper', position: [ct / 2 - inset / 2, h / 2, 0] });
  printedFace(out, w, h, [0, h / 2, d / 2 + EPS]);
  printedFace(out, w, h, [0, h / 2, -d / 2 - EPS], [0, Math.PI, 0], true);
  if (kind === 'notebook') {
    const n = Math.max(8, Math.round(h / (w * 0.07)));
    for (let i = 0; i < n; i++) {
      const y = h * (0.05 + (0.9 * i) / (n - 1));
      out.push({ geometry: new THREE.TorusGeometry(d * 0.75, Math.max(d * 0.06, 0.003), 8, 24), mat: 'metal', position: [-w / 2 + d * 0.15, y, 0], rotation: [Math.PI / 2, 0, 0] });
    }
  }
  return out;
}

function buildDevice(kind: 'phone' | 'phone-case' | 'tablet' | 'watch', w: number, h: number, d: number, ctx: BuildContext): MeshDesc[] {
  const out: MeshDesc[] = [];
  const isWatch = kind === 'watch';
  const yc = isWatch ? h * 1.3 : h / 2;
  const radius = w * (kind === 'tablet' ? 0.07 : isWatch ? 0.24 : 0.15);
  const frameMat: MatName = kind === 'phone-case' ? 'body' : 'metal';
  out.push({ geometry: slab(w, h, d, radius, d * 0.25), mat: frameMat, position: [0, yc, 0] });
  const bezel = w * (kind === 'tablet' ? 0.05 : isWatch ? 0.09 : 0.04);
  const sw = w - 2 * bezel;
  const sh = h - 2 * bezel;
  const sr = Math.max(radius - bezel, 0);
  out.push({ geometry: artPlane(w - bezel * 0.6, h - bezel * 0.6, radius * 0.95), mat: 'screen', position: [0, yc, d / 2 + EPS] });
  if (kind !== 'phone-case') faceArt(out, ctx, sw, sh, [0, yc, d / 2 + EPS * 2], [0, 0, 0], false, sr);
  if (kind === 'phone') {
    out.push({ geometry: artPlane(w * 0.3, w * 0.09, w * 0.045), mat: 'screen', position: [0, yc + sh / 2 - w * 0.08, d / 2 + EPS * 3] });
  }
  // Back: color (or back artwork), and a camera block on phones and cases.
  if (!isWatch) {
    const backArt = kind === 'phone-case' ? ctx.frontAspect !== null : ctx.backAspect !== null;
    out.push({
      geometry: artPlane(w - bezel * 0.6, h - bezel * 0.6, radius * 0.95),
      mat: backArt ? (kind === 'phone-case' ? 'art' : 'artBack') : 'body',
      position: [0, yc, -d / 2 - EPS],
      rotation: [0, Math.PI, 0],
    });
    const cam = w * (kind === 'tablet' ? 0.16 : 0.4);
    const cx = w / 2 - bezel - cam / 2;
    const cy = yc + h / 2 - bezel - cam / 2;
    out.push({ geometry: slab(cam, cam, d * 0.25, cam * 0.25, d * 0.05), mat: kind === 'phone-case' ? 'body' : 'metal', position: [cx, cy, -d / 2 - d * 0.1] });
    const lens = kind === 'tablet' ? [[0, 0]] : [[-0.22, 0.22], [-0.22, -0.22], [0.22, 0]];
    for (const [lx, ly] of lens) {
      out.push({ geometry: cyl(cam * 0.17, cam * 0.17, d * 0.3, 32), mat: 'screen', position: [cx + lx * cam, cy + ly * cam, -d / 2 - d * 0.2], rotation: [Math.PI / 2, 0, 0] });
    }
  } else {
    out.push({ geometry: cyl(w * 0.07, w * 0.07, w * 0.08, 24), mat: 'metal', position: [w / 2 + w * 0.03, yc + h * 0.15, 0], rotation: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) {
      out.push({ geometry: slab(w * 0.8, h * 0.85, d * 0.4, w * 0.1, d * 0.1), mat: 'body', position: [0, yc + s * h * 0.88, -d * 0.35], rotation: [s * 0.35, 0, 0] });
    }
  }
  return out;
}

function buildTent(w: number, h: number, d: number, _ctx: BuildContext, rings: boolean): MeshDesc[] {
  const out: MeshDesc[] = [];
  const t = Math.max(d * 0.03, 0.004);
  const L = Math.hypot(h, d / 2);
  const tilt = Math.atan2(d / 2, h);
  for (const s of [1, -1]) {
    const group: MeshDesc[] = [];
    group.push({ geometry: box(w, L, t), mat: 'body', position: [0, L / 2, 0] });
    printedFace(group, w, L, [0, L / 2, t / 2 + EPS], [0, 0, 0], s < 0);
    for (const m of group) {
      // Rotate around the bottom edge, then place at z = ±d/2.
      const g = m.geometry.clone();
      const mtx = new THREE.Matrix4()
        .makeTranslation(0, 0, s * d / 2)
        .multiply(new THREE.Matrix4().makeRotationX(-s * tilt))
        .multiply(new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI))
        .multiply(new THREE.Matrix4().makeTranslation(...(m.position ?? [0, 0, 0])));
      g.applyMatrix4(mtx);
      m.geometry.dispose();
      out.push({ geometry: g, mat: m.mat });
    }
  }
  if (rings) {
    const n = Math.max(8, Math.round(w / (h * 0.06)));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + w * (0.06 + (0.88 * i) / (n - 1));
      out.push({ geometry: new THREE.TorusGeometry(h * 0.035, h * 0.004, 8, 20), mat: 'metal', position: [x, h, 0], rotation: [0, Math.PI / 2, 0] });
    }
  } else {
    out.push({ geometry: box(w * 0.9, h * 0.02, d * 0.5), mat: 'dark', position: [0, h * 0.45, 0] });
  }
  return out;
}

function buildComposite(kind: CompositeKind, w: number, h: number, d: number, ctx: BuildContext): MeshDesc[] {
  const out: MeshDesc[] = [];
  const add = (geometry: THREE.BufferGeometry, mat: MatName, position?: Vec3, rotation?: Vec3, renderOrder?: number) =>
    out.push({ geometry, mat, position, rotation, renderOrder });

  switch (kind) {
    case 'gift-box': {
      const lidH = h * 0.28;
      add(box(w * 0.97, h - lidH * 0.6, d * 0.97), 'body', [0, (h - lidH * 0.6) / 2, 0]);
      add(box(w, lidH, d), 'body', [0, h - lidH / 2, 0]);
      printedFace(out, w * 0.97, h - lidH, [0, (h - lidH) / 2, d * 0.485 + EPS], [0, 0, 0], false, 0, [0, 1, 0, (h - lidH) / h]);
      printedFace(out, w, lidH, [0, h - lidH / 2, d / 2 + EPS], [0, 0, 0], false, 0, [0, 1, (h - lidH) / h, 1]);
      if (ctx.backAspect !== null) {
        const [pw, ph] = fit(w * 0.8, d * 0.8, ctx.backAspect);
        add(artPlane(pw, ph), 'artBack', [0, h + EPS, 0], [-Math.PI / 2, 0, 0]);
      }
      // Ribbon.
      add(box(w * 0.08, EPS * 4 + lidH * 0.02, d * 1.002), 'gold', [0, h + EPS, 0]);
      break;
    }
    case 'window-box': {
      add(openBox(w, h, d, [4]), 'body', [0, h / 2, 0]);
      add(openBox(w * 0.985, h * 0.985, d * 0.985, [4]), 'interior', [0, h / 2, 0]);
      const shape = roundedRectShape(w, h, 0);
      shape.holes.push(roundedRectPath(new THREE.Path(), w * 0.62, h * 0.42, w * 0.06, 0, h * 0.06));
      add(shapeArt(shape, w, h), 'art', [0, h / 2, d / 2 + EPS]);
      add(new THREE.PlaneGeometry(w * 0.64, h * 0.44), 'clear', [0, h / 2 + h * 0.06, d / 2 - EPS], undefined, 2);
      add(box(w * 0.55, h * 0.8, d * 0.45), 'white', [0, h * 0.41, -d * 0.12]);
      break;
    }
    case 'handle-box': {
      add(box(w, h * 0.7, d), 'body', [0, h * 0.35, 0]);
      printedFace(out, w, h * 0.7, [0, h * 0.35, d / 2 + EPS]);
      const handle = roundedRectShape(w * 0.7, h * 0.3, w * 0.04, 0, h * 0.85);
      handle.holes.push(roundedRectPath(new THREE.Path(), w * 0.32, h * 0.08, h * 0.04, 0, h * 0.9));
      const g = new THREE.ExtrudeGeometry(handle, { depth: d * 0.04, bevelEnabled: false });
      g.translate(0, 0, -d * 0.02);
      add(g, 'body');
      break;
    }
    case 'hanging-box': {
      const tabH = h * 0.16;
      const bodyH = h - tabH;
      add(box(w, bodyH, d), 'body', [0, bodyH / 2, 0]);
      printedFace(out, w, bodyH, [0, bodyH / 2, d / 2 + EPS]);
      const tab = roundedRectShape(w * 0.7, tabH, tabH * 0.2, 0, bodyH + tabH / 2);
      const slot = new THREE.Path();
      slot.absellipse(0, bodyH + tabH * 0.55, w * 0.12, tabH * 0.18, 0, Math.PI * 2, false, 0);
      tab.holes.push(slot);
      const g = new THREE.ExtrudeGeometry(tab, { depth: d * 0.04, bevelEnabled: false });
      g.translate(0, 0, -d / 2);
      add(g, 'body');
      break;
    }
    case 'hex-box': {
      const r = Math.min(w, d) / 2;
      const lidH = h * 0.22;
      add(cyl(r, r, h - lidH * 0.5, 6, false, Math.PI / 6), 'body', [0, (h - lidH * 0.5) / 2, 0]);
      add(cyl(r * 1.04, r * 1.04, lidH, 6, false, Math.PI / 6), 'body', [0, h - lidH / 2, 0]);
      // Flat front face (side length = r), apothem r·cos30.
      const apo = r * Math.cos(Math.PI / 6);
      printedFace(out, r * 0.98, h - lidH, [0, (h - lidH) / 2, apo + EPS]);
      break;
    }
    case 'clear-box': {
      add(box(w, h, d), 'clear', [0, h / 2, 0], undefined, 2);
      add(box(w * 0.96, h * 0.04, d * 0.96), 'white', [0, h * 0.02, 0]);
      add(box(w * 0.5, h * 0.7, d * 0.4), 'body', [0, h * 0.39, 0]);
      if (ctx.frontAspect !== null) {
        const [pw, ph] = fit(w * 0.8, h * 0.5, ctx.frontAspect);
        add(artPlane(pw, ph), 'art', [0, h * 0.5, d / 2 + EPS], undefined, 3);
      }
      break;
    }
    case 'sleeve-box': {
      const pull = w * 0.35;
      add(openBox(w * 0.97, h * 0.94, d * 0.96, [2]), 'interior', [pull / 2, h * 0.47, 0]);
      add(openBox(w, h, d, [0, 1]), 'body', [-pull / 2, h / 2, 0]);
      printedFace(out, w, h, [-pull / 2, h / 2, d / 2 + EPS]);
      printedFace(out, w, d, [-pull / 2, h + EPS, 0], [-Math.PI / 2, 0, 0], true);
      break;
    }
    case 'display-box': {
      const t = Math.max(w * 0.01, 0.006);
      const lip = h * 0.22;
      add(box(w, t, d), 'body', [0, t / 2, 0]);
      add(box(w, h, t), 'body', [0, h / 2, -d / 2 + t / 2]);
      add(box(w, lip, t), 'body', [0, lip / 2, d / 2 - t / 2]);
      for (const s of [-1, 1]) {
        const side = new THREE.Shape([
          new THREE.Vector2(-d / 2, 0),
          new THREE.Vector2(d / 2, 0),
          new THREE.Vector2(d / 2, lip),
          new THREE.Vector2(-d / 2, h * 0.62),
        ]);
        const g = new THREE.ExtrudeGeometry(side, { depth: t, bevelEnabled: false });
        g.rotateY(-Math.PI / 2);
        add(g, 'body', [s * (w / 2) - (s > 0 ? 0 : -t), 0, 0]);
      }
      printedFace(out, w, h - h * 0.62, [0, h * 0.81, -d / 2 + t + EPS], [0, 0, 0], false, 0, [0, 1, 0.62, 1]);
      printedFace(out, w, lip, [0, lip / 2, d / 2 + EPS], [0, 0, 0], true);
      // Products inside.
      const cols = 4;
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < cols; c++) {
          const pw = (w * 0.86) / cols;
          add(box(pw * 0.85, h * 0.32, d * 0.3), 'white', [-w * 0.43 + pw * (c + 0.5), t + h * 0.16 + row * h * 0.04, d * 0.18 - row * d * 0.42]);
        }
      }
      break;
    }
    case 'perfume-bottle': {
      const bodyH = h * 0.7;
      add(slab(w * 0.9, bodyH * 0.92, d * 0.84, w * 0.08, d * 0.06), 'liquid', [0, bodyH / 2 + h * 0.01, 0], undefined, 1);
      add(slab(w, bodyH, d, w * 0.1, d * 0.12), 'glass', [0, bodyH / 2, 0], undefined, 2);
      add(cyl(w * 0.1, w * 0.1, h * 0.06, 32), 'gold', [0, bodyH + h * 0.03, 0]);
      add(slab(w * 0.5, h * 0.24, d * 0.6, w * 0.05, d * 0.06), 'cap', [0, bodyH + h * 0.06 + h * 0.12, 0]);
      if (ctx.frontAspect !== null) {
        const [pw, ph] = fit(w * 0.7, bodyH * 0.55, ctx.frontAspect);
        add(artPlane(pw, ph), 'art', [0, bodyH * 0.5, d / 2 + EPS], undefined, 3);
      }
      break;
    }
    case 'jerry-can': {
      const bodyH = h * 0.82;
      add(slab(w, bodyH, d, w * 0.08, d * 0.08), 'body', [0, bodyH / 2, 0]);
      const handle = roundedRectShape(w * 0.62, h * 0.22, h * 0.05, -w * 0.08, bodyH + h * 0.08);
      handle.holes.push(roundedRectPath(new THREE.Path(), w * 0.44, h * 0.1, h * 0.04, -w * 0.08, bodyH + h * 0.11));
      const g = new THREE.ExtrudeGeometry(handle, { depth: d * 0.22, bevelEnabled: true, bevelSize: d * 0.03, bevelThickness: d * 0.03, bevelSegments: 2 });
      g.translate(0, 0, -d * 0.11);
      add(g, 'body');
      add(cyl(w * 0.07, w * 0.08, h * 0.14, 24), 'cap', [w * 0.36, bodyH + h * 0.05, 0]);
      faceArt(out, ctx, ...fit(w * 0.7, bodyH * 0.6, ctx.frontAspect), [0, bodyH * 0.48, d / 2 + EPS]);
      break;
    }
    case 'pouch':
    case 'chip-bag': {
      const bag = kind === 'chip-bag';
      const bulge = (u: number, v: number) => {
        const across = Math.pow(Math.max(Math.sin(Math.PI * u), 0), 0.6);
        if (bag) {
          if (v < 0.06 || v > 0.94) return 0;
          return across * Math.pow(Math.max(Math.sin((Math.PI * (v - 0.06)) / 0.88), 0), 0.45);
        }
        if (v > 0.86) return 0;
        const top = v > 0.7 ? Math.cos(((v - 0.7) / 0.16) * (Math.PI / 2)) : 1;
        return across * top * (0.75 + 0.25 * (1 - v));
      };
      const depth = d / 2;
      add(pillow(w, h, depth, bulge, 1), 'art', [0, h / 2, 0]);
      add(pillow(w, h, depth, bulge, -1), 'artBack', [0, h / 2, 0]);
      if (!bag) {
        // Gusset base.
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          pts.push(new THREE.Vector2((u - 0.5) * w * (1 - 0.05 * bulge(u, 0)), depth * bulge(u, 0)));
        }
        for (let i = 24; i >= 0; i--) {
          const u = i / 24;
          pts.push(new THREE.Vector2((u - 0.5) * w * (1 - 0.05 * bulge(u, 0)), -depth * bulge(u, 0)));
        }
        const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
        add(g, 'body', [0, 0.001, 0], [Math.PI / 2, 0, 0]);
        add(box(w * 0.94, h * 0.006, d * 0.06), 'dark', [0, h * 0.82, 0]);
      }
      break;
    }
    case 'paper-bag': {
      add(openBox(w, h, d, [2]), 'body', [0, h / 2, 0]);
      add(box(w * 0.99, h * 0.005, d * 0.99), 'interior', [0, h * 0.01, 0]);
      printedFace(out, w, h, [0, h / 2, d / 2 + EPS]);
      printedFace(out, w, h, [0, h / 2, -d / 2 - EPS], [0, Math.PI, 0], true);
      for (const s of [1, -1]) {
        add(new THREE.TorusGeometry(w * 0.16, Math.max(w * 0.008, 0.003), 8, 32, Math.PI), 'dark', [0, h * 0.97, s * d * 0.42]);
      }
      break;
    }
    case 'takeout-box': {
      const bodyH = h * 0.8;
      const rt = w / Math.SQRT2;
      const rb = (w * 0.74) / Math.SQRT2;
      add(cyl(rt, rb, bodyH, 4, false, -Math.PI / 4 + Math.PI / 2), 'body', [0, bodyH / 2, 0]);
      add(cyl(rt * 1.004, rb * 1.004, bodyH, 1, true, -Math.PI / 4, Math.PI / 2), 'art', [0, bodyH / 2, 0]);
      add(cyl(rt * 1.004, rb * 1.004, bodyH, 1, true, Math.PI - Math.PI / 4, Math.PI / 2), 'artBack', [0, bodyH / 2, 0]);
      for (const s of [1, -1]) {
        const flapL = d * 0.55;
        add(box(w, flapL, Math.max(w * 0.008, 0.003)), 'body', [0, bodyH + flapL * 0.42, s * d * 0.32], [s * -0.62, 0, 0]);
      }
      add(new THREE.TorusGeometry(w * 0.32, Math.max(w * 0.008, 0.003), 8, 32, Math.PI), 'metal', [0, bodyH, 0], [0, Math.PI / 2, 0]);
      break;
    }
    case 'food-container': {
      const lidH = h * 0.18;
      const bodyH = h - lidH * 0.6;
      add(upright(roundedRectShape(w * 0.97, d * 0.97, w * 0.12), bodyH), 'clear', [0, 0, 0], undefined, 2);
      add(upright(roundedRectShape(w * 0.9, d * 0.9, w * 0.1), bodyH * 0.62), 'interior', [0, 0.002, 0], undefined, 1);
      add(upright(roundedRectShape(w, d, w * 0.13), lidH), 'body', [0, h - lidH, 0]);
      if (ctx.frontAspect !== null) {
        const [pw, ph] = fit(w * 0.7, bodyH * 0.6, ctx.frontAspect);
        add(artPlane(pw, ph), 'art', [0, bodyH * 0.45, d * 0.485 + EPS], undefined, 3);
      }
      break;
    }
    case 'hat': {
      const R = w / 2;
      const crownH = h * 0.95;
      const sy = crownH / R;
      const crown = new THREE.SphereGeometry(R, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      add(crown, 'body', [0, h * 0.05, 0]);
      out[out.length - 1].scale = [1, sy, 1];
      const brimLen = Math.max(d - 2 * R, R * 0.6);
      const brim = new THREE.Shape();
      brim.moveTo(-R * 0.9, 0);
      brim.quadraticCurveTo(-R * 0.95, -R * 0.5 - brimLen, 0, -R * 0.62 - brimLen);
      brim.quadraticCurveTo(R * 0.95, -R * 0.5 - brimLen, R * 0.9, 0);
      brim.quadraticCurveTo(0, -R * 0.7, -R * 0.9, 0);
      const bg = new THREE.ExtrudeGeometry(brim, { depth: h * 0.03, bevelEnabled: true, bevelSize: h * 0.01, bevelThickness: h * 0.01, bevelSegments: 2 });
      bg.rotateX(-Math.PI / 2 - 0.12);
      add(bg, 'body', [0, h * 0.05, 0]);
      add(new THREE.SphereGeometry(R * 0.07, 12, 8), 'body', [0, h * 0.05 + crownH, 0]);
      if (ctx.frontAspect !== null) {
        const patch = new THREE.SphereGeometry(R * 1.006, 24, 12, Math.PI / 2 - 0.55, 1.1, 0.5, 0.75);
        add(patch, 'art', [0, h * 0.05, 0]);
        out[out.length - 1].scale = [1, sy, 1];
      }
      break;
    }
    case 'tote-bag': {
      const bagH = h / 1.35;
      add(slab(w, bagH, d, w * 0.01, d * 0.4), 'body', [0, bagH / 2, 0]);
      for (const s of [1, -1]) {
        add(new THREE.TorusGeometry(w * 0.2, Math.max(w * 0.012, 0.004), 8, 32, Math.PI), 'body', [0, bagH, s * d * 0.25]);
      }
      if (ctx.frontAspect !== null) {
        const [pw, ph] = fit(w * 0.7, bagH * 0.6, ctx.frontAspect);
        add(artPlane(pw, ph), 'art', [0, bagH * 0.48, d / 2 + EPS]);
      }
      if (ctx.backAspect !== null) {
        const [pw, ph] = fit(w * 0.7, bagH * 0.6, ctx.backAspect);
        add(artPlane(pw, ph), 'artBack', [0, bagH * 0.48, -d / 2 - EPS], [0, Math.PI, 0]);
      }
      break;
    }
    case 'phone':
    case 'phone-case':
    case 'tablet':
    case 'watch':
      return buildDevice(kind, w, h, d, ctx);
    case 'laptop': {
      const t = Math.max(d * 0.04, 0.008);
      const lidT = t * 0.6;
      const tilt = 0.26;
      const shiftZ = (h * Math.sin(tilt)) / 2;
      add(upright(roundedRectShape(w, d, w * 0.02), t), 'metal', [0, 0, shiftZ]);
      add(new THREE.PlaneGeometry(w * 0.86, d * 0.42), 'dark', [0, t + EPS, shiftZ - d * 0.12], [-Math.PI / 2, 0, 0]);
      add(new THREE.PlaneGeometry(w * 0.34, d * 0.28), 'white', [0, t + EPS, shiftZ + d * 0.27], [-Math.PI / 2, 0, 0]);
      // Lid hinged at the back edge, leaning back.
      const lid: MeshDesc[] = [];
      lid.push({ geometry: slab(w, h, lidT, w * 0.02), mat: 'metal', position: [0, h / 2, 0] });
      lid.push({ geometry: artPlane(w * 0.985, h * 0.975, w * 0.015), mat: 'screen', position: [0, h / 2, lidT / 2 + EPS] });
      if (ctx.frontAspect !== null) lid.push({ geometry: artPlane(w * 0.94, h * 0.9), mat: 'art', position: [0, h / 2 + h * 0.01, lidT / 2 + EPS * 2] });
      if (ctx.backAspect !== null) {
        const [pw, ph] = fit(w * 0.5, h * 0.5, ctx.backAspect);
        lid.push({ geometry: artPlane(pw, ph), mat: 'artBack', position: [0, h / 2, -lidT / 2 - EPS], rotation: [0, Math.PI, 0] });
      }
      for (const m of lid) {
        const g = m.geometry.clone();
        const mtx = new THREE.Matrix4()
          .makeTranslation(0, t, shiftZ - d / 2 + lidT / 2)
          .multiply(new THREE.Matrix4().makeRotationX(-tilt))
          .multiply(new THREE.Matrix4().makeTranslation(...(m.position ?? [0, 0, 0])))
          .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(m.rotation ?? [0, 0, 0]))));
        g.applyMatrix4(mtx);
        m.geometry.dispose();
        out.push({ geometry: g, mat: m.mat });
      }
      break;
    }
    case 'book':
    case 'magazine':
    case 'notebook':
      return buildBook(w, h, d, ctx, kind);
    case 'brochure': {
      const pw = w / 3;
      const a = 0.42;
      const t = Math.max(d, 0.002);
      const dirs = [a, -a, a];
      let x = 0;
      let z = 0;
      const panels: { cx: number; cz: number; phi: number }[] = [];
      for (const ang of dirs) {
        const dx = Math.cos(ang) * pw;
        const dz = Math.sin(ang) * pw;
        panels.push({ cx: x + dx / 2, cz: z + dz / 2, phi: Math.atan2(-dz, dx) });
        x += dx;
        z += dz;
      }
      const ox = x / 2;
      const oz = (Math.sin(a) * pw) / 2;
      panels.forEach((p, i) => {
        const base: Vec3 = [p.cx - ox, h / 2, p.cz - oz];
        add(box(pw, h, t), 'paper', base, [0, p.phi, 0]);
        const nx = Math.sin(p.phi) * (t / 2 + EPS);
        const nz = Math.cos(p.phi) * (t / 2 + EPS);
        printedFace(out, pw, h, [base[0] + nx, h / 2, base[2] + nz], [0, p.phi, 0], false, 0, [i / 3, (i + 1) / 3, 0, 1]);
        printedFace(out, pw, h, [base[0] - nx, h / 2, base[2] - nz], [0, p.phi + Math.PI, 0], true, 0, [1 - (i + 1) / 3, 1 - i / 3, 0, 1]);
      });
      break;
    }
    case 'calendar':
      return buildTent(w, h, d, ctx, true);
    case 'sign':
      return buildTent(w, h, d, ctx, false);
    case 'poster': {
      const t = Math.max(d, 0.002);
      const sheetH = h;
      add(box(w, sheetH, t), 'paper', [0, sheetH / 2 + h * 0.01, 0]);
      printedFace(out, w, sheetH, [0, sheetH / 2 + h * 0.01, t / 2 + EPS]);
      for (const y of [h * 0.01, sheetH + h * 0.01]) {
        add(box(w * 1.04, h * 0.022, Math.max(h * 0.02, t * 3)), 'wood', [0, y, 0]);
      }
      const top = sheetH + h * 0.01;
      for (const s of [-1, 1]) {
        const len = Math.hypot(w * 0.3, h * 0.1);
        add(cyl(0.002, 0.002, len, 6), 'dark', [s * w * 0.15, top + h * 0.05, 0], [0, 0, s * Math.atan2(w * 0.3, h * 0.1)]);
      }
      break;
    }
    case 'paper':
    case 'envelope': {
      const t = Math.max(d, 0.0015);
      add(box(w, t, h), 'paper', [0, t / 2, 0]);
      printedFace(out, w, h, [0, t + EPS, 0], [-Math.PI / 2, 0, 0]);
      printedFace(out, w, h, [0, -EPS, 0], [Math.PI / 2, 0, Math.PI], true);
      break;
    }
    case 'card': {
      const t = Math.max(d, 0.002);
      // A second card underneath shows the back.
      const back: Vec3 = [w * 0.16, t / 2, -h * 0.18];
      add(box(w, t, h), 'paper', back, [0, 0.35, 0]);
      printedFace(out, w, h, [back[0], t + EPS, back[2]], [-Math.PI / 2, 0, 0.35], true);
      const front: Vec3 = [-w * 0.1, t * 1.5 + t, h * 0.12];
      add(box(w, t, h), 'paper', front, [0, -0.12, 0]);
      printedFace(out, w, h, [front[0], front[1] + t / 2 + EPS, front[2]], [-Math.PI / 2, 0, -0.12]);
      break;
    }
    case 'folder': {
      const t = Math.max(d * 0.3, 0.003);
      add(box(w, h, t), 'body', [0, h / 2, -t]);
      add(box(w * 0.94, h * 0.96, t * 0.3), 'paper', [w * 0.02, h * 0.49, 0]);
      const g = box(w, h, t);
      const art = artPlane(w, h);
      const mtx = new THREE.Matrix4().makeTranslation(-w / 2, 0, t * 1.2).multiply(new THREE.Matrix4().makeRotationY(-0.35));
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(w / 2, h / 2, 0).premultiply(mtx));
      art.applyMatrix4(new THREE.Matrix4().makeTranslation(w / 2, h / 2, t / 2 + EPS).premultiply(mtx));
      add(g, 'body');
      add(art, 'art');
      break;
    }
    case 'lanyard': {
      const t = Math.max(d, 0.002);
      add(slab(w, h, t, w * 0.06), 'white', [0, h / 2, 0]);
      printedFace(out, w * 0.98, h * 0.98, [0, h / 2, t / 2 + EPS], [0, 0, 0], false, w * 0.06);
      printedFace(out, w * 0.98, h * 0.98, [0, h / 2, -t / 2 - EPS], [0, Math.PI, 0], true, w * 0.06);
      add(box(w * 0.18, h * 0.08, t * 3), 'metal', [0, h * 1.04, 0]);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, h * 1.08, 0),
        new THREE.Vector3(w * 0.3, h * 1.6, -w * 0.04),
        new THREE.Vector3(w * 0.5, h * 2.3, -w * 0.15),
        new THREE.Vector3(0, h * 2.85, -w * 0.3),
        new THREE.Vector3(-w * 0.5, h * 2.3, -w * 0.15),
        new THREE.Vector3(-w * 0.3, h * 1.6, -w * 0.04),
        new THREE.Vector3(0, h * 1.08, 0),
      ]);
      add(new THREE.TubeGeometry(curve, 120, w * 0.04, 8, false), 'body');
      break;
    }
    case 'banner': {
      const baseH = h * 0.06;
      const depth = Math.max(d, w * 0.3);
      add(slab(w * 1.04, baseH, depth * 0.3, baseH * 0.4), 'metal', [0, baseH / 2, 0]);
      for (const s of [-1, 1]) add(box(w * 0.04, baseH * 0.2, depth), 'metal', [s * w * 0.42, baseH * 0.1, 0]);
      const panelH = h - baseH * 0.6;
      add(box(w, panelH, 0.002), 'paper', [0, baseH * 0.6 + panelH / 2, depth * 0.05]);
      printedFace(out, w, panelH, [0, baseH * 0.6 + panelH / 2, depth * 0.05 + 0.001 + EPS]);
      add(cyl(w * 0.008, w * 0.008, w * 1.02, 12), 'metal', [0, h, depth * 0.05], [0, 0, Math.PI / 2]);
      add(cyl(w * 0.006, w * 0.006, h, 8), 'metal', [0, h / 2, -depth * 0.05]);
      break;
    }
    case 'flag': {
      const poleH = h * 2.6;
      const poleX = -w / 2 - w * 0.02;
      add(cyl(w * 0.012, w * 0.015, poleH, 16), 'metal', [poleX, poleH / 2, 0]);
      add(new THREE.SphereGeometry(w * 0.025, 16, 12), 'gold', [poleX, poleH + w * 0.02, 0]);
      const g = new THREE.PlaneGeometry(w, h, 40, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / w + 0.5;
        pos.setZ(i, Math.sin(u * Math.PI * 2.2) * w * 0.05 * u);
      }
      g.computeVertexNormals();
      add(g, 'art', [poleX + w / 2 + w * 0.012, poleH - h / 2 - h * 0.04, 0]);
      break;
    }
    case 'frame': {
      const f = Math.min(w, h) * 0.07;
      const depth = Math.max(d, 0.01);
      const outer = roundedRectShape(w, h, 0);
      outer.holes.push(roundedRectPath(new THREE.Path(), w - 2 * f, h - 2 * f, 0));
      const fg = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: f * 0.08, bevelThickness: f * 0.08, bevelSegments: 2 });
      fg.translate(0, h / 2, -depth / 2);
      add(fg, 'body', [0, 0, 0]);
      add(new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), 'paper', [0, h / 2, -depth * 0.1]);
      const m = Math.min(w, h) * 0.06;
      printedFace(out, w - 2 * f - 2 * m, h - 2 * f - 2 * m, [0, h / 2, -depth * 0.1 + EPS]);
      add(new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), 'clear', [0, h / 2, depth * 0.3], undefined, 2);
      break;
    }
    case 'billboard': {
      const panelBottom = h * 0.85;
      const t = Math.max(d, w * 0.03);
      add(box(w * 1.04, h * 1.06, t), 'dark', [0, panelBottom + h / 2, 0]);
      printedFace(out, w, h, [0, panelBottom + h / 2, t / 2 + EPS]);
      add(box(w * 0.06, panelBottom, w * 0.06), 'metal', [0, panelBottom / 2, -t * 0.2]);
      add(box(w * 1.02, h * 0.03, t * 3), 'metal', [0, panelBottom - h * 0.04, t]);
      for (const x of [-0.3, 0, 0.3]) {
        add(box(w * 0.01, w * 0.01, t * 2.5), 'metal', [x * w, panelBottom + h * 1.06, t * 1.2]);
        add(box(w * 0.05, w * 0.02, w * 0.03), 'dark', [x * w, panelBottom + h * 1.05, t * 2.4]);
      }
      break;
    }
    case 'insert': {
      const shape = roundedRectShape(w, d, w * 0.02);
      const n = 3;
      const holeR = Math.min(w / (n * 2.6), d * 0.3);
      for (let i = 0; i < n; i++) {
        const hole = new THREE.Path();
        hole.absarc(-w / 2 + (w * (i + 0.5)) / n, 0, holeR, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      add(upright(shape, h), 'body');
      add(new THREE.PlaneGeometry(w * 0.98, d * 0.98), 'interior', [0, 0.002, 0], [-Math.PI / 2, 0, 0]);
      const top = shapeArt(shape, w, d);
      add(top, 'art', [0, h + EPS, 0], [-Math.PI / 2, 0, 0]);
      break;
    }
  }
  return out;
}

export function buildObject(kind: ObjectKind, w: number, h: number, d: number, ctx: BuildContext): MeshDesc[] {
  if (isLathe(kind)) return buildLathe(kind, w, h, ctx);
  if (isGarment(kind)) return buildGarment(kind, w, h, d, ctx);
  return buildComposite(kind, w, h, d, ctx);
}

/* ------------------------------------------------------------------ */
/* Materials                                                          */
/* ------------------------------------------------------------------ */

type Materials = Record<MatName, THREE.MeshStandardMaterial>;

function makeMaterials(): Materials {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const glass = (color: string, opacity: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.6,
    });
  return {
    body: std({ side: THREE.DoubleSide }),
    art: std({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    artBack: std({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    interior: std({ color: '#ece9e2', roughness: 0.9, side: THREE.DoubleSide }),
    glass: glass('#ffffff', 0.16),
    glassGreen: glass('#1f4d2c', 0.82),
    glassAmber: glass('#6b3410', 0.85),
    clear: glass('#f1f8ff', 0.12),
    liquid: new THREE.MeshPhysicalMaterial({ roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
    cap: std({ color: '#1f2937', roughness: 0.35, metalness: 0.1 }),
    white: std({ color: '#f8fafc', roughness: 0.4 }),
    metal: std({ color: '#c9ced6', roughness: 0.28, metalness: 0.75 }),
    gold: std({ color: '#c8a96a', roughness: 0.25, metalness: 0.85 }),
    cork: std({ color: '#b08654', roughness: 0.9 }),
    wax: std({ roughness: 0.7 }),
    paper: std({ color: '#fbfaf7', roughness: 0.85 }),
    dark: std({ color: '#111827', roughness: 0.5 }),
    screen: std({ color: '#05070b', roughness: 0.15, metalness: 0.2 }),
    wood: std({ color: '#9a6b3f', roughness: 0.7 }),
  };
}

function setSurface(m: THREE.MeshStandardMaterial, map: THREE.Texture | null, baseColor: string, finish: FinishId, fabric: boolean) {
  const f = FINISHES[finish];
  const before = `${!!m.map}|${!!m.bumpMap}`;
  m.map = map;
  m.bumpMap = fabric ? getFabricTexture() : null;
  m.bumpScale = 1.2;
  m.color.set(map ? '#ffffff' : (f.baseColor ?? baseColor));
  m.roughness = fabric ? Math.max(f.roughness, 0.85) : f.roughness;
  m.metalness = fabric ? 0 : f.metalness;
  if (before !== `${!!m.map}|${!!m.bumpMap}`) m.needsUpdate = true;
}

function aspectOf(tex: THREE.Texture | undefined): number | null {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  if (!tex || !img?.width || !img?.height) return null;
  return img.width / img.height;
}

export function ObjectMesh({
  kind,
  size,
  textures,
  baseColor,
  finish,
}: {
  kind: ObjectKind;
  size: [number, number, number];
  textures: TextureMap;
  baseColor: string;
  finish: FinishId;
}) {
  const [w, h, d] = size;
  const front = textures.front;
  const back = textures.back;
  const frontAspect = aspectOf(front);
  const backAspect = aspectOf(back);
  const fabric = isGarment(kind) || kind === 'hat' || kind === 'tote-bag';

  const meshes = useMemo(
    () => buildObject(kind, w, h, d, { frontAspect, backAspect }),
    [kind, w, h, d, frontAspect, backAspect],
  );
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  const materials = useMemo(makeMaterials, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useEffect(() => {
    setSurface(materials.body, null, baseColor, finish, fabric);
    setSurface(materials.art, front ?? null, baseColor, finish, fabric);
    setSurface(materials.artBack, back ?? null, baseColor, finish, fabric);
    materials.liquid.color.set(baseColor);
    materials.wax.color.set(baseColor);
  }, [materials, front, back, baseColor, finish, fabric]);

  // The scene sizes objects by their bounds; wide-bodied lathe shapes are scaled to depth.
  const zScale = isLathe(kind) && w > 0 ? d / w : 1;

  return (
    // A phone case is about its back, so it faces the camera back-first.
    <group scale={[1, 1, zScale]} rotation={[0, kind === 'phone-case' ? Math.PI : 0, 0]}>
      {meshes.map((m, i) => (
        <mesh
          key={i}
          geometry={m.geometry}
          material={materials[m.mat]}
          position={m.position}
          rotation={m.rotation}
          scale={m.scale}
          renderOrder={m.renderOrder ?? 0}
        />
      ))}
    </group>
  );
}
