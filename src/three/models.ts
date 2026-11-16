import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VehicleType } from '../tenant/types';

// ─────────────────────────────────────────────────────────────
// Procedural low-poly vehicles. Units ≈ metres.
// Conventions: forward = +X, ground at y = 0, centred on z = 0.
// group.userData.wheels: THREE.Object3D[] (spin about local Z; userData.r = radius)
// group.userData.bed (tipper): pivot at rear-bottom of the bed; rotate about Z.
// ─────────────────────────────────────────────────────────────

export interface VehicleColors {
  body: string;
  accent: string;
  /** Darker trims for dark-mode pages. */
  dark?: boolean;
}

export interface VehicleUserData {
  type: VehicleType;
  wheels: THREE.Object3D[];
  bed?: THREE.Object3D;
  length: number;
}

const TIPPER_MAX_TILT = 0.88;

// ── materials (one kit per vehicle; nothing shared globally) ──

type Kit = ReturnType<typeof createKit>;

function createKit(colors: VehicleColors) {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const get = (key: string, p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    let m = cache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial(p);
      cache.set(key, m);
    }
    return m;
  };
  const body = new THREE.Color(colors.body);
  const accent = new THREE.Color(colors.accent);
  const trim = new THREE.Color(colors.dark ? '#24282e' : '#30353c');
  const geoCache = new Map<string, THREE.BufferGeometry>();

  return {
    geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
      let g = geoCache.get(key);
      if (!g) {
        g = make();
        geoCache.set(key, g);
      }
      return g as T;
    },
    body: () => get('body', { color: body, roughness: 0.38, metalness: 0.28 }),
    bodyShade: () => get('bodyShade', { color: body.clone().multiplyScalar(0.72), roughness: 0.5, metalness: 0.25 }),
    accent: () => get('accent', { color: accent, roughness: 0.4, metalness: 0.2 }),
    trim: () => get('trim', { color: trim, roughness: 0.7, metalness: 0.2 }),
    fender: () => get('fender', { color: trim, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
    chassis: () => get('chassis', { color: '#1d2026', roughness: 0.75, metalness: 0.35 }),
    rubber: () => get('rubber', { color: '#15171a', roughness: 0.92, metalness: 0 }),
    rim: () => get('rim', { color: '#c4c9cf', roughness: 0.32, metalness: 0.75 }),
    chrome: () => get('chrome', { color: '#dde2e7', roughness: 0.18, metalness: 0.95 }),
    glass: () => get('glass', { color: '#2a3d52', roughness: 0.12, metalness: 0.35 }),
    head: () => get('head', { color: '#fff7e0', emissive: '#fff1c8', emissiveIntensity: 1.6, roughness: 0.2 }),
    amber: () => get('amber', { color: '#ffb02e', emissive: '#ff9a00', emissiveIntensity: 1.2, roughness: 0.3 }),
    tail: () => get('tail', { color: '#d0242b', emissive: '#c4141c', emissiveIntensity: 1.1, roughness: 0.3 }),
    white: () => get('white', { color: '#eef1f4', roughness: 0.45, metalness: 0.1 }),
    color: (hex: string, roughness = 0.6, metalness = 0.1) =>
      get(`c:${hex}:${roughness}:${metalness}`, { color: hex, roughness, metalness }),
    shade: (c: THREE.Color, k: number, roughness = 0.5) =>
      get(`s:${c.getHexString()}:${k}`, { color: c.clone().multiplyScalar(k), roughness, metalness: 0.2 }),
    bodyColor: body,
    accentColor: accent,
  };
}

// ── primitives ──

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  parent?: THREE.Object3D,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
}

function rbox(
  w: number,
  h: number,
  d: number,
  r: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent?: THREE.Object3D,
): THREE.Mesh {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, rr)), mat, x, y, z, parent);
}

/** Polygon with rounded corners as a Shape (points CCW in XY). */
function roundedShape(pts: [number, number][], radii: number | number[]): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const r = Array.isArray(radii) ? radii[i] ?? 0 : radii;
    const v1x = prev[0] - p[0];
    const v1y = prev[1] - p[1];
    const v2x = next[0] - p[0];
    const v2y = next[1] - p[1];
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(r, l1 * 0.45, l2 * 0.45);
    const ax = p[0] + (v1x / l1) * rr;
    const ay = p[1] + (v1y / l1) * rr;
    const bx = p[0] + (v2x / l2) * rr;
    const by = p[1] + (v2y / l2) * rr;
    if (i === 0) s.moveTo(ax, ay);
    else s.lineTo(ax, ay);
    s.quadraticCurveTo(p[0], p[1], bx, by);
  }
  s.closePath();
  return s;
}

/** Extrudes a side profile (XY) across the vehicle width (Z), centred, with soft bevel. */
function extrudeProfile(pts: [number, number][], radii: number | number[], width: number, bevel = 0.06): THREE.ExtrudeGeometry {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(roundedShape(pts, radii), {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Thin flat panel in a side plane (for windows / decals). */
function sidePanel(pts: [number, number][], radius: number, mat: THREE.Material, z: number, parent: THREE.Object3D): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(roundedShape(pts, radius), { depth: 0.02, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.01);
  const m = mesh(g, mat, 0, 0, z, parent);
  m.castShadow = false;
  return m;
}

/** Cylinder between two points. */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Object3D, seg = 8): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat, 0, 0, 0, parent);
  m.scale.set(1, Math.max(0.001, len), 1);
  m.position.copy(a).addScaledVector(dir, 0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// ── wheels ──

function makeWheel(k: Kit, r: number, w: number, dual: boolean, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.userData.r = r;
  const tw = dual ? w * 1.85 : w;
  const tire = k.geo(`tire:${r}:${tw}`, () => new THREE.CylinderGeometry(r, r, tw, 20, 1));
  const shoulder = k.geo(`tsh:${r}:${tw}`, () => new THREE.TorusGeometry(r * 0.93, r * 0.09, 6, 20));
  const rim = k.geo(`rim:${r}`, () => new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.04, 14));
  const hub = k.geo(`hub:${r}`, () => new THREE.CylinderGeometry(r * 0.2, r * 0.26, 0.1, 8));
  const nut = k.geo(`nut:${r}`, () => new THREE.BoxGeometry(r * 0.08, 0.06, r * 0.08));
  const spin = new THREE.Group();
  g.add(spin);
  const t = mesh(tire, k.rubber(), 0, 0, 0, spin);
  t.rotation.x = Math.PI / 2;
  const sh = mesh(shoulder, k.rubber(), 0, 0, side * (tw / 2 - r * 0.05), spin);
  sh.castShadow = false;
  const face = side * (tw / 2 + 0.005);
  const rm = mesh(rim, k.rim(), 0, 0, face, spin);
  rm.rotation.x = Math.PI / 2;
  const hb = mesh(hub, k.chassis(), 0, 0, face + side * 0.04, spin);
  hb.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const n = mesh(nut, k.chrome(), Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, face + side * 0.02, spin);
    n.rotation.x = Math.PI / 2;
    n.castShadow = false;
  }
  // The outer group is what callers spin; keep a reference so rotation is applied to it.
  return g;
}

function addAxle(
  k: Kit,
  root: THREE.Group,
  wheels: THREE.Object3D[],
  x: number,
  r: number,
  trackHalf: number,
  dual = false,
  w = 0.36,
): void {
  for (const side of [1, -1] as const) {
    const wh = makeWheel(k, r, w, dual, side);
    const tw = dual ? w * 1.85 : w;
    wh.position.set(x, r, side * (trackHalf - tw / 2));
    root.add(wh);
    wheels.push(wh);
  }
  const ax = mesh(new THREE.CylinderGeometry(0.07, 0.07, trackHalf * 2 - 0.4, 6), k.chassis(), x, r, 0, root);
  ax.rotation.x = Math.PI / 2;
  ax.castShadow = false;
}

/** Curved mudguard shell over a wheel (half cylinder). */
function fender(k: Kit, root: THREE.Object3D, x: number, r: number, z: number, width: number): void {
  const g = new THREE.CylinderGeometry(r + 0.1, r + 0.1, width, 14, 1, true, Math.PI * 0.5, Math.PI);
  const m = mesh(g, k.fender(), x, r, z, root);
  m.rotation.x = Math.PI / 2;
}

// ── cab (cab-over, typical of Tata / Ashok Leyland / Isuzu units in Sri Lanka) ──

interface CabOpts {
  length: number;
  height: number;
  width: number;
  sleeper?: boolean;
}

function buildCab(k: Kit, o: CabOpts): THREE.Group {
  const g = new THREE.Group();
  const { length: cl, height: h, width: w } = o;
  const rake = 0.24;
  const fy = h * 0.5;
  // shell
  const shell = extrudeProfile(
    [
      [-cl, 0],
      [0, 0],
      [0, fy],
      [-rake, h],
      [-cl, h],
    ],
    [0.06, 0.1, 0.14, 0.2, 0.16],
    w,
    0.07,
  );
  mesh(shell, k.body(), 0, 0, 0, g);

  // windscreen (follows the raked face)
  const segLen = Math.hypot(rake, h - fy);
  const ang = Math.atan2(rake, h - fy);
  const nx = (h - fy) / segLen;
  const ny = rake / segLen;
  const ws = box(0.03, segLen * 0.76, w - 0.34, k.glass(), -rake * 0.5 + nx * 0.075, fy + (h - fy) * 0.5 + ny * 0.075, 0, g);
  ws.rotation.z = ang;
  ws.castShadow = false;
  // centre pillar & wipers
  const wp = box(0.02, segLen * 0.3, 0.04, k.chassis(), -rake * 0.12 + nx * 0.1, fy + 0.18, w * 0.18, g);
  wp.rotation.z = ang + 0.9;
  const wp2 = wp.clone();
  wp2.position.z = -w * 0.18;
  g.add(wp2);

  // side windows (door glass + quarter)
  const sz = w / 2 + 0.005;
  for (const s of [1, -1]) {
    sidePanel(
      [
        [-cl * 0.56, h * 0.55],
        [-0.16, h * 0.55],
        [-0.16 - rake * 0.82, h * 0.9],
        [-cl * 0.56, h * 0.9],
      ],
      0.05,
      k.glass(),
      s * sz,
      g,
    );
    // door seam + handle
    const seam = box(0.02, h * 0.82, 0.012, k.bodyShade(), -cl * 0.6, h * 0.48, s * (sz + 0.002), g);
    seam.castShadow = false;
    box(0.16, 0.04, 0.03, k.chrome(), -cl * 0.5, h * 0.5, s * (sz + 0.01), g);
    // accent stripe
    box(cl * 0.9, 0.09, 0.012, k.accent(), -cl * 0.5, h * 0.42, s * (sz + 0.004), g).castShadow = false;
    // step
    box(0.42, 0.06, 0.22, k.trim(), -cl * 0.45, -0.12, s * (w / 2 - 0.08), g);
    // mirror: arm + head
    const arm = box(0.04, 0.04, 0.3, k.chassis(), -0.2, h * 0.72, s * (w / 2 + 0.14), g);
    arm.castShadow = false;
    rbox(0.1, 0.46, 0.16, 0.03, k.trim(), -0.18, h * 0.62, s * (w / 2 + 0.3), g);
    // front corner turn lamp
    box(0.05, 0.08, 0.14, k.amber(), 0.01, fy * 0.62, s * (w / 2 - 0.08), g).castShadow = false;
  }

  // grille
  rbox(0.06, fy * 0.5, w * 0.5, 0.02, k.chassis(), 0.03, fy * 0.5, 0, g);
  for (let i = 0; i < 4; i++) {
    box(0.03, 0.035, w * 0.48, k.chrome(), 0.065, fy * 0.32 + i * fy * 0.12, 0, g).castShadow = false;
  }
  box(0.035, 0.1, 0.42, k.accent(), 0.075, fy * 0.82, 0, g).castShadow = false; // badge bar
  // headlights
  for (const s of [1, -1]) {
    rbox(0.07, 0.18, 0.42, 0.03, k.trim(), 0.03, fy * 0.42, s * (w / 2 - 0.36), g);
    box(0.03, 0.12, 0.34, k.head(), 0.065, fy * 0.42, s * (w / 2 - 0.36), g).castShadow = false;
  }
  // bumper
  rbox(0.26, 0.34, w + 0.06, 0.06, k.trim(), 0.08, -0.06, 0, g);
  for (const s of [1, -1]) {
    box(0.03, 0.08, 0.2, k.head(), 0.22, -0.06, s * (w / 2 - 0.3), g).castShadow = false;
  }
  // sun visor + roof marker lamps
  const vis = rbox(0.42, 0.06, w - 0.06, 0.02, k.accent(), -rake - 0.06, h + 0.02, 0, g);
  vis.rotation.z = -0.12;
  for (let i = -2; i <= 2; i++) {
    box(0.06, 0.05, 0.1, k.amber(), -rake - 0.1, h + 0.08, i * 0.34, g).castShadow = false;
  }
  if (o.sleeper) {
    // aero roof fairing
    const fair = extrudeProfile(
      [
        [-cl * 0.92, 0],
        [-rake - 0.15, 0],
        [-cl * 0.55, 0.62],
        [-cl * 0.92, 0.62],
      ],
      [0.04, 0.04, 0.18, 0.08],
      w - 0.16,
      0.05,
    );
    mesh(fair, k.bodyShade(), 0, h, 0, g);
    // exhaust stacks
    for (const s of [1, -1]) {
      const ex = mesh(new THREE.CylinderGeometry(0.07, 0.07, h * 0.95, 10), k.chrome(), -cl - 0.12, h * 0.62, s * (w / 2 - 0.12), g);
      ex.castShadow = true;
    }
  }
  return g;
}

/** Ladder chassis rails + fuel tank etc. */
function buildChassis(k: Kit, root: THREE.Group, x0: number, x1: number, y: number, width: number): void {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  for (const s of [1, -1]) box(len, 0.26, 0.11, k.chassis(), cx, y, s * 0.5, root);
  for (let i = 0; i <= 3; i++) box(0.1, 0.18, 1.0, k.chassis(), x0 + (len * i) / 3, y, 0, root).castShadow = false;
  // rear lamps + underride bar
  rbox(0.1, 0.14, width - 0.1, 0.03, k.trim(), x0 - 0.02, y - 0.24, 0, root);
  for (const s of [1, -1]) {
    box(0.04, 0.12, 0.3, k.tail(), x0 - 0.08, y - 0.24, s * (width / 2 - 0.3), root).castShadow = false;
  }
}

function fuelTank(k: Kit, root: THREE.Group, x: number, y: number, z: number, len = 0.95): void {
  const t = mesh(new THREE.CylinderGeometry(0.27, 0.27, len, 14), k.rim(), x, y, z, root);
  t.rotation.z = Math.PI / 2;
  for (const dx of [-len * 0.35, len * 0.35]) {
    const st = mesh(new THREE.TorusGeometry(0.275, 0.025, 4, 14), k.chassis(), x + dx, y, z, root);
    st.rotation.y = Math.PI / 2;
    st.castShadow = false;
  }
}

function mudflap(k: Kit, root: THREE.Group, x: number, z: number): void {
  box(0.03, 0.5, 0.56, k.rubber(), x, 0.42, z, root);
}

// ── tipper bed ──

interface BedParts {
  bed: THREE.Group;
  tailgate: THREE.Group;
  ram: THREE.Mesh[];
  ramBase: THREE.Vector3;
  ramTipLocal: THREE.Vector3;
}

function buildTipperBed(k: Kit, root: THREE.Group, pivotX: number, pivotY: number, bedL: number, bw: number, bh: number): BedParts {
  const bed = new THREE.Group();
  bed.position.set(pivotX, pivotY, 0);
  root.add(bed);
  const body = k.body();
  const shade = k.bodyShade();
  // floor + sills
  box(bedL, 0.12, bw, shade, bedL / 2, 0.06, 0, bed);
  for (const s of [1, -1]) box(bedL, 0.16, 0.14, k.chassis(), bedL / 2, -0.06, s * 0.5, bed);
  // sides
  for (const s of [1, -1]) {
    rbox(bedL, bh, 0.08, 0.02, body, bedL / 2, bh / 2 + 0.06, s * (bw / 2 - 0.04), bed);
    // vertical ribs
    for (let i = 0; i < 6; i++) {
      box(0.09, bh * 0.92, 0.05, shade, 0.35 + (i * (bedL - 0.7)) / 5, bh / 2 + 0.04, s * (bw / 2 + 0.02), bed);
    }
    // top rail + bottom rail
    rbox(bedL + 0.04, 0.1, 0.14, 0.03, k.accent(), bedL / 2, bh + 0.08, s * (bw / 2 - 0.03), bed);
    box(bedL, 0.08, 0.06, shade, bedL / 2, 0.08, s * (bw / 2 + 0.02), bed);
    // reflective tape strip (Sri Lankan RDA style)
    box(bedL * 0.9, 0.05, 0.01, k.color('#f5f5f0', 0.3, 0.1), bedL / 2, bh * 0.3, s * (bw / 2 + 0.05), bed).castShadow = false;
  }
  // headboard + cab protector canopy
  rbox(0.12, bh + 0.32, bw, 0.03, body, bedL - 0.06, (bh + 0.32) / 2 + 0.06, 0, bed);
  for (let i = 0; i < 3; i++) box(0.05, 0.08, bw + 0.02, shade, bedL - 0.12, 0.35 + i * 0.35, 0, bed);
  rbox(0.62, 0.07, bw - 0.08, 0.02, shade, bedL + 0.22, bh + 0.38, 0, bed);
  // tailgate, hinged at top-rear
  const tailgate = new THREE.Group();
  tailgate.position.set(-0.03, bh + 0.08, 0);
  bed.add(tailgate);
  rbox(0.09, bh, bw - 0.02, 0.02, body, 0, -bh / 2, 0, tailgate);
  for (let i = 0; i < 3; i++) box(0.05, 0.07, bw - 0.1, shade, -0.06, -0.18 - i * (bh / 3), 0, tailgate);
  for (const s of [1, -1]) box(0.05, 0.14, 0.3, k.tail(), -0.07, -bh + 0.12, s * (bw / 2 - 0.3), tailgate).castShadow = false;

  // telescopic ram: base on chassis behind cab, tip under bed front
  const ramBase = new THREE.Vector3(pivotX + bedL - 0.15, 0.8, 0);
  const ramTipLocal = new THREE.Vector3(bedL - 0.3, -0.1, 0);
  const ram: THREE.Mesh[] = [];
  const radii = [0.12, 0.095, 0.07];
  radii.forEach((r, i) => {
    const m = mesh(new THREE.CylinderGeometry(r, r, 1, 10), i === 0 ? k.chassis() : k.chrome(), 0, 0, 0, root);
    m.castShadow = false;
    ram.push(m);
  });
  return { bed, tailgate, ram, ramBase, ramTipLocal };
}

/** Sets tipper bed tilt in radians (0 = down). Moves tailgate and hydraulic ram accordingly. */
export function setTipperTilt(vehicle: THREE.Object3D, angle: number): void {
  const parts = vehicle.userData.bedParts as BedParts | undefined;
  if (!parts) return;
  const a = Math.max(0, Math.min(TIPPER_MAX_TILT, angle));
  parts.bed.rotation.z = a;
  parts.tailgate.rotation.z = -a * 1.12;
  const tip = parts.ramTipLocal.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), a).add(parts.bed.position);
  const dir = new THREE.Vector3().subVectors(tip, parts.ramBase);
  const len = Math.max(0.05, dir.length());
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const n = parts.ram.length;
  parts.ram.forEach((m, i) => {
    const segLen = Math.max(0.05, len / n + 0.12);
    const start = (len - segLen) * (i / Math.max(1, n - 1));
    m.scale.set(1, segLen, 1);
    m.quaternion.copy(q);
    m.position.copy(parts.ramBase).addScaledVector(dir, start + segLen / 2);
    m.visible = len > 0.25;
  });
}

export const TIPPER_TILT_MAX = TIPPER_MAX_TILT;

/** Rolls all wheels for a travelled distance (negative = reversing). */
export function spinWheels(vehicle: THREE.Object3D, distance: number): void {
  const wheels = (vehicle.userData.wheels as THREE.Object3D[] | undefined) ?? [];
  for (const w of wheels) {
    const r = (w.userData.r as number) || 0.5;
    w.rotation.z -= distance / r;
  }
}

/** World-space point at the rear lip of a tipper bed (for spawning spill particles). */
export function tipperLipWorld(vehicle: THREE.Object3D, target = new THREE.Vector3()): THREE.Vector3 {
  const parts = vehicle.userData.bedParts as BedParts | undefined;
  if (!parts) return vehicle.getWorldPosition(target);
  target.set(0.05, 0.15, 0);
  return parts.bed.localToWorld(target);
}

// ── vehicle bodies ──

const W = 2.45; // overall width
const WR = 0.52; // heavy wheel radius

function buildTipper(k: Kit, root: THREE.Group, wheels: THREE.Object3D[]): number {
  const front = 3.85;
  const cab = buildCab(k, { length: 2.0, height: 1.95, width: W });
  cab.position.set(front - 0.22, 1.0, 0);
  root.add(cab);
  buildChassis(k, root, -3.65, front - 0.3, 0.86, W);
  addAxle(k, root, wheels, 2.6, WR, W / 2);
  addAxle(k, root, wheels, -1.55, WR, W / 2, true);
  addAxle(k, root, wheels, -2.72, WR, W / 2, true);
  for (const s of [1, -1]) {
    fender(k, root, 2.6, WR, s * (W / 2 - 0.2), 0.42);
    mudflap(k, root, -3.4, s * (W / 2 - 0.34));
    mudflap(k, root, 0.92, s * (W / 2 - 0.34));
  }
  fuelTank(k, root, 0.1, 0.72, W / 2 - 0.42);
  box(0.6, 0.45, 0.45, k.trim(), 0.15, 0.72, -(W / 2 - 0.4), root); // battery box
  const bedL = 4.85;
  const parts = buildTipperBed(k, root, -3.6, 1.06, bedL, W, 1.1);
  root.userData.bedParts = parts;
  root.userData.bed = parts.bed;
  setTipperTilt(root, 0);
  return front + 0.2 - -3.7;
}

function buildLorry(k: Kit, root: THREE.Group, wheels: THREE.Object3D[]): number {
  const front = 3.55;
  const cab = buildCab(k, { length: 1.95, height: 1.95, width: W });
  cab.position.set(front - 0.22, 1.0, 0);
  root.add(cab);
  buildChassis(k, root, -3.55, front - 0.3, 0.86, W);
  addAxle(k, root, wheels, 2.35, WR, W / 2);
  addAxle(k, root, wheels, -2.0, WR, W / 2, true);
  for (const s of [1, -1]) {
    fender(k, root, 2.35, WR, s * (W / 2 - 0.2), 0.42);
    mudflap(k, root, -2.8, s * (W / 2 - 0.34));
  }
  fuelTank(k, root, -0.1, 0.72, W / 2 - 0.42);
  // box body
  const bx0 = -3.6;
  const bx1 = front - 2.3;
  const bl = bx1 - bx0;
  const bh = 2.45;
  const by = 1.06;
  const bodyCx = (bx0 + bx1) / 2;
  box(bl, 0.16, W - 0.1, k.chassis(), bodyCx, by - 0.04, 0, root);
  rbox(bl, bh, W + 0.04, 0.07, k.white(), bodyCx, by + bh / 2 + 0.04, 0, root);
  for (const s of [1, -1]) {
    const z = s * (W / 2 + 0.025);
    box(bl - 0.1, 0.42, 0.012, k.body(), bodyCx, by + 0.38, z, root).castShadow = false;
    box(bl - 0.1, 0.07, 0.012, k.accent(), bodyCx, by + 0.68, z, root).castShadow = false;
    box(bl * 0.32, 0.5, 0.012, k.accent(), bodyCx + bl * 0.18, by + 1.55, z, root).castShadow = false;
    box(bl * 0.2, 0.08, 0.012, k.body(), bodyCx + bl * 0.18, by + 1.15, z, root).castShadow = false;
    for (let i = 0; i < 3; i++) box(0.08, 0.06, 0.03, k.amber(), bx0 + 0.6 + i * (bl - 1.2) / 2, by + 0.12, z, root).castShadow = false;
  }
  // rear doors
  const rx = bx0 - 0.025;
  box(0.012, bh - 0.12, 0.03, k.trim(), rx, by + bh / 2 + 0.04, 0, root).castShadow = false;
  for (const s of [1, -1]) {
    for (let i = 0; i < 2; i++) box(0.04, bh - 0.3, 0.035, k.chrome(), rx - 0.02, by + bh / 2 + 0.04, s * (0.25 + i * 0.55), root).castShadow = false;
  }
  rbox(0.08, 0.18, W - 0.1, 0.03, k.body(), rx - 0.02, by + 0.2, 0, root);
  return front + 0.2 - -3.65;
}

function buildFlatbed(k: Kit, root: THREE.Group, wheels: THREE.Object3D[]): number {
  const front = 3.85;
  const cab = buildCab(k, { length: 2.0, height: 1.95, width: W });
  cab.position.set(front - 0.22, 1.0, 0);
  root.add(cab);
  buildChassis(k, root, -3.65, front - 0.3, 0.86, W);
  addAxle(k, root, wheels, 2.6, WR, W / 2);
  addAxle(k, root, wheels, -1.6, WR, W / 2, true);
  addAxle(k, root, wheels, -2.75, WR, W / 2, true);
  for (const s of [1, -1]) {
    fender(k, root, 2.6, WR, s * (W / 2 - 0.2), 0.42);
    mudflap(k, root, -3.45, s * (W / 2 - 0.34));
  }
  fuelTank(k, root, 0.4, 0.72, W / 2 - 0.42);
  const dx0 = -3.7;
  const dx1 = front - 2.35;
  const dl = dx1 - dx0;
  const dcx = (dx0 + dx1) / 2;
  const dy = 1.12;
  box(dl, 0.12, W, k.color('#6b5440', 0.85, 0), dcx, dy, 0, root);
  for (const s of [1, -1]) {
    rbox(dl, 0.2, 0.08, 0.02, k.body(), dcx, dy - 0.02, s * (W / 2), root);
    for (let i = 0; i < 6; i++) box(0.07, 0.42, 0.07, k.bodyShade(), dx0 + 0.25 + (i * (dl - 0.5)) / 5, dy + 0.27, s * (W / 2 - 0.02), root);
  }
  // headboard rack
  const hx = dx1 - 0.05;
  for (const s of [1, -1]) box(0.08, 1.5, 0.08, k.bodyShade(), hx, dy + 0.75, s * (W / 2 - 0.06), root);
  box(0.08, 0.08, W, k.accent(), hx, dy + 1.5, 0, root);
  for (let i = 1; i < 4; i++) box(0.05, 0.05, W - 0.1, k.bodyShade(), hx, dy + i * 0.36, 0, root);
  // cargo: bundled steel beams + crates
  const steel = k.color('#7f8a94', 0.45, 0.7);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const p = mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.6, 10), steel, dcx + 0.9, dy + 0.24 + row * 0.3, (i - (3 - row) / 2) * 0.36, root);
      p.rotation.z = Math.PI / 2;
    }
  }
  for (const s of [1, -1]) box(0.08, 0.04, W + 0.02, k.accent(), dcx + 0.9 + s * 0.8, dy + 0.98, 0, root).castShadow = false;
  const wood = k.color('#c9a46a', 0.8, 0);
  rbox(1.15, 0.95, 1.1, 0.04, wood, dx0 + 0.75, dy + 0.54, 0.6, root);
  rbox(1.15, 0.8, 1.05, 0.04, wood, dx0 + 0.75, dy + 0.46, -0.6, root);
  return front + 0.2 - -3.75;
}

function buildExcavator(k: Kit): THREE.Group {
  const g = new THREE.Group();
  const yellow = k.color('#e9a81c', 0.45, 0.15);
  const dark = k.chassis();
  // tracks
  for (const s of [1, -1]) {
    rbox(2.6, 0.55, 0.5, 0.2, k.rubber(), 0, 0.28, s * 0.78, g);
    for (let i = 0; i < 4; i++) {
      const rl = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.52, 10), k.rim(), -0.9 + i * 0.6, 0.18, s * 0.78, g);
      rl.rotation.x = Math.PI / 2;
      rl.castShadow = false;
    }
  }
  box(1.6, 0.25, 1.2, dark, 0, 0.45, 0, g);
  // upper structure
  const up = new THREE.Group();
  up.position.set(0, 0.62, 0);
  g.add(up);
  mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.15, 14), dark, 0, 0.05, 0, up);
  rbox(1.95, 0.7, 1.85, 0.12, yellow, -0.15, 0.48, 0, up);
  rbox(0.45, 0.62, 1.8, 0.14, k.chassis(), -1.12, 0.48, 0, up); // counterweight
  const cab = new THREE.Group();
  cab.position.set(0.3, 0.83, 0.45);
  up.add(cab);
  rbox(0.85, 0.95, 0.8, 0.08, yellow, 0, 0.47, 0, cab);
  box(0.02, 0.62, 0.66, k.glass(), 0.43, 0.55, 0, cab).castShadow = false;
  box(0.6, 0.55, 0.02, k.glass(), 0, 0.55, 0.41, cab).castShadow = false;
  rbox(0.9, 0.05, 0.85, 0.02, k.trim(), 0, 0.97, 0, cab);
  // exhaust
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), k.trim(), -0.7, 1.0, -0.6, up);
  // boom (stowed forward), arm folded down, bucket resting
  const boomRoot = new THREE.Vector3(0.75, 0.75, -0.25);
  const boomTip = new THREE.Vector3(2.1, 1.7, -0.25);
  const armTip = new THREE.Vector3(2.55, 0.25, -0.25);
  const bm = rbox(boomTip.distanceTo(boomRoot), 0.32, 0.28, 0.06, yellow, 0, 0, 0, up);
  bm.position.copy(boomRoot).lerp(boomTip, 0.5);
  bm.rotation.z = Math.atan2(boomTip.y - boomRoot.y, boomTip.x - boomRoot.x);
  const am = rbox(boomTip.distanceTo(armTip), 0.26, 0.24, 0.05, yellow, 0, 0, 0, up);
  am.position.copy(boomTip).lerp(armTip, 0.5);
  am.rotation.z = Math.atan2(armTip.y - boomTip.y, armTip.x - boomTip.x);
  strut(new THREE.Vector3(0.8, 0.4, -0.25), new THREE.Vector3(1.55, 1.35, -0.25), 0.06, k.chrome(), up);
  const bucket = extrudeProfile(
    [
      [-0.3, -0.2],
      [0.25, -0.25],
      [0.35, 0.25],
      [-0.2, 0.3],
    ],
    [0.02, 0.15, 0.05, 0.05],
    0.6,
    0.03,
  );
  const bk = mesh(bucket, dark, armTip.x - 0.05, armTip.y, armTip.z, up);
  bk.rotation.z = -0.3;
  return g;
}

function buildLowbed(k: Kit, root: THREE.Group, wheels: THREE.Object3D[]): number {
  const front = 4.3;
  const cab = buildCab(k, { length: 2.0, height: 2.0, width: W });
  cab.position.set(front - 0.22, 1.0, 0);
  root.add(cab);
  buildChassis(k, root, -0.35, front - 0.3, 0.86, W - 0.3);
  addAxle(k, root, wheels, 3.1, WR, W / 2);
  addAxle(k, root, wheels, 1.0, WR, W / 2, true);
  addAxle(k, root, wheels, -0.1, WR, W / 2, true);
  for (const s of [1, -1]) fender(k, root, 3.1, WR, s * (W / 2 - 0.2), 0.42);
  fuelTank(k, root, 1.6, 0.72, W / 2 - 0.42, 0.7);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16), k.chassis(), 0.5, 1.07, 0, root);
  // trailer: gooseneck + low well + rear bogie section
  const dk = k.bodyShade();
  const deckTop = 0.74;
  const plate = k.color('#3b4148', 0.6, 0.5);
  rbox(1.7, 0.4, W - 0.1, 0.05, dk, 0.45, 1.33, 0, root); // gooseneck
  const slope = box(0.95, 0.24, W - 0.1, dk, -0.62, 0.98, 0, root);
  slope.rotation.z = 0.58;
  box(3.15, 0.2, W, dk, -2.45, deckTop - 0.1, 0, root); // well
  box(3.1, 0.03, W - 0.1, plate, -2.45, deckTop + 0.015, 0, root);
  const rearTop = 1.02;
  box(1.75, 0.2, W, dk, -4.9, rearTop - 0.1, 0, root);
  addAxle(k, root, wheels, -4.45, 0.4, W / 2, true, 0.3);
  addAxle(k, root, wheels, -5.3, 0.4, W / 2, true, 0.3);
  for (const s of [1, -1]) {
    box(1.9, 0.04, 0.6, k.rubber(), -4.88, 0.86, s * (W / 2 - 0.32), root);
    box(0.06, 0.3, 0.08, k.accent(), -1.2, deckTop + 0.15, s * (W / 2 - 0.05), root);
    box(6.0, 0.06, 0.02, k.accent(), -2.9, deckTop - 0.12, s * (W / 2 + 0.01), root).castShadow = false;
    // loading ramps (raised)
    const ramp = box(0.08, 1.15, 0.55, plate, -5.82, 1.5, s * 0.75, root);
    ramp.rotation.z = -0.25;
  }
  box(0.08, 0.14, W - 0.1, k.trim(), -5.78, 0.72, 0, root);
  for (const s of [1, -1]) box(0.04, 0.12, 0.3, k.tail(), -5.84, 0.72, s * (W / 2 - 0.3), root).castShadow = false;
  // payload
  const ex = buildExcavator(k);
  ex.position.set(-2.55, deckTop + 0.03, 0);
  ex.scale.setScalar(0.92);
  root.add(ex);
  // chains
  for (const s of [1, -1]) {
    strut(new THREE.Vector3(-3.6, 0.9, s * 0.95), new THREE.Vector3(-3.95, deckTop, s * 1.15), 0.02, k.chrome(), root, 4);
    strut(new THREE.Vector3(-1.5, 0.9, s * 0.95), new THREE.Vector3(-1.15, deckTop, s * 1.15), 0.02, k.chrome(), root, 4);
  }
  return front + 0.2 - -5.9;
}

function buildPrimeMover(k: Kit, root: THREE.Group, wheels: THREE.Object3D[], containerColor: THREE.Color): number {
  const front = 4.3;
  const cab = buildCab(k, { length: 2.35, height: 2.15, width: W, sleeper: true });
  cab.position.set(front - 0.22, 0.98, 0);
  root.add(cab);
  buildChassis(k, root, -0.2, front - 0.3, 0.86, W - 0.3);
  addAxle(k, root, wheels, 3.1, WR, W / 2);
  addAxle(k, root, wheels, 0.95, WR, W / 2, true);
  addAxle(k, root, wheels, -0.15, WR, W / 2, true);
  for (const s of [1, -1]) {
    fender(k, root, 3.1, WR, s * (W / 2 - 0.2), 0.42);
    box(2.0, 0.05, 0.62, k.rubber(), 0.4, 1.12, s * (W / 2 - 0.32), root);
  }
  fuelTank(k, root, 1.6, 0.72, W / 2 - 0.42, 0.75);
  fuelTank(k, root, 1.6, 0.72, -(W / 2 - 0.42), 0.75);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16), k.chassis(), 0.4, 1.06, 0, root);
  // skeletal trailer
  const cl = 6.35;
  const cx1 = front - 2.75;
  const cx0 = cx1 - cl;
  const ccx = (cx0 + cx1) / 2;
  for (const s of [1, -1]) box(cl, 0.22, 0.14, k.chassis(), ccx, 1.15, s * 0.55, root);
  for (let i = 0; i <= 4; i++) box(0.1, 0.12, W, k.chassis(), cx0 + 0.1 + (i * (cl - 0.2)) / 4, 1.2, 0, root).castShadow = false;
  addAxle(k, root, wheels, cx0 + 1.75, WR, W / 2, true);
  addAxle(k, root, wheels, cx0 + 0.65, WR, W / 2, true);
  for (const s of [1, -1]) {
    box(0.1, 0.75, 0.1, k.trim(), cx0 + 3.4, 0.7, s * 0.6, root); // landing legs
    box(2.0, 0.05, 0.62, k.rubber(), cx0 + 1.2, 1.12, s * (W / 2 - 0.32), root);
  }
  box(0.08, 0.14, W - 0.1, k.trim(), cx0 - 0.02, 0.72, 0, root);
  for (const s of [1, -1]) box(0.04, 0.12, 0.3, k.tail(), cx0 - 0.08, 0.72, s * (W / 2 - 0.3), root).castShadow = false;

  // 40ft container (scaled) with corrugation
  const ch = 2.55;
  const cy = 1.27;
  const cmat = new THREE.MeshStandardMaterial({ color: containerColor, roughness: 0.55, metalness: 0.35 });
  const cdark = new THREE.MeshStandardMaterial({ color: containerColor.clone().multiplyScalar(0.62), roughness: 0.6, metalness: 0.35 });
  box(cl, ch, W - 0.04, cmat, ccx, cy + ch / 2, 0, root);
  const ribGeo = new THREE.BoxGeometry(0.075, ch - 0.22, 0.05);
  const pitch = 0.2;
  const perSide = Math.floor((cl - 0.4) / pitch);
  const ribs = new THREE.InstancedMesh(ribGeo, cmat, perSide * 2);
  const mtx = new THREE.Matrix4();
  let idx = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < perSide; i++) {
      mtx.makeTranslation(cx0 + 0.3 + i * pitch, cy + ch / 2, s * (W / 2 - 0.01));
      ribs.setMatrixAt(idx++, mtx);
    }
  }
  ribs.instanceMatrix.needsUpdate = true;
  ribs.castShadow = true;
  ribs.receiveShadow = true;
  root.add(ribs);
  // roof corrugation (fewer, flatter)
  const roofRibs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.03, W - 0.2), cmat, Math.floor(cl / 0.5));
  for (let i = 0; i < roofRibs.count; i++) {
    mtx.makeTranslation(cx0 + 0.3 + i * 0.5, cy + ch + 0.01, 0);
    roofRibs.setMatrixAt(i, mtx);
  }
  roofRibs.instanceMatrix.needsUpdate = true;
  root.add(roofRibs);
  // frame rails + corner posts
  for (const y of [cy + 0.06, cy + ch - 0.05]) {
    for (const s of [1, -1]) box(cl + 0.02, 0.12, 0.08, cdark, ccx, y, s * (W / 2 - 0.02), root);
  }
  for (const x of [cx0 + 0.06, cx1 - 0.06]) {
    for (const s of [1, -1]) {
      box(0.14, ch, 0.14, cdark, x, cy + ch / 2, s * (W / 2 - 0.05), root);
      for (const y of [cy + 0.08, cy + ch - 0.08]) box(0.18, 0.16, 0.18, k.chassis(), x, y, s * (W / 2 - 0.06), root).castShadow = false;
    }
  }
  // door end: lock bars + handles
  const dx = cx0 - 0.025;
  box(0.02, ch - 0.25, 0.03, cdark, dx, cy + ch / 2, 0, root).castShadow = false;
  for (const zz of [-0.85, -0.35, 0.35, 0.85]) {
    const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, ch - 0.2, 6), k.rim(), dx - 0.03, cy + ch / 2, zz, root);
    bar.castShadow = false;
    box(0.04, 0.05, 0.16, k.rim(), dx - 0.05, cy + ch * 0.45, zz + 0.08, root).castShadow = false;
  }
  // side placard
  for (const s of [1, -1]) {
    box(1.2, 0.35, 0.01, k.color('#f2f2ee', 0.5, 0), ccx + 1.6, cy + ch - 0.45, s * (W / 2 + 0.03), root).castShadow = false;
  }
  return front + 0.2 - (cx0 - 0.1);
}

function buildVan(k: Kit, root: THREE.Group, wheels: THREE.Object3D[]): number {
  const vw = 2.05;
  const r = 0.37;
  const shell = extrudeProfile(
    [
      [-2.65, 0.42],
      [2.5, 0.42],
      [2.68, 0.95],
      [2.42, 1.22],
      [1.5, 1.42],
      [0.72, 2.28],
      [-2.65, 2.28],
    ],
    [0.12, 0.14, 0.18, 0.2, 0.25, 0.28, 0.14],
    vw,
    0.08,
  );
  mesh(shell, k.body(), 0, 0, 0, root);
  // windscreen
  const a0 = new THREE.Vector2(1.5, 1.42);
  const a1 = new THREE.Vector2(0.72, 2.28);
  const len = a0.distanceTo(a1);
  const ang = Math.atan2(a0.x - a1.x, a1.y - a0.y);
  const ws = box(0.03, len * 0.8, vw - 0.3, k.glass(), (a0.x + a1.x) / 2 + 0.07, (a0.y + a1.y) / 2 + 0.06, 0, root);
  ws.rotation.z = ang;
  ws.castShadow = false;
  const sz = vw / 2 + 0.085;
  for (const s of [1, -1]) {
    sidePanel(
      [
        [0.3, 1.5],
        [1.32, 1.5],
        [0.76, 2.12],
        [0.3, 2.12],
      ],
      0.06,
      k.glass(),
      s * sz,
      root,
    );
    sidePanel(
      [
        [-0.75, 1.5],
        [0.12, 1.5],
        [0.12, 2.12],
        [-0.75, 2.12],
      ],
      0.06,
      k.glass(),
      s * sz,
      root,
    );
    box(4.9, 0.1, 0.012, k.accent(), -0.1, 1.05, s * (sz + 0.004), root).castShadow = false;
    box(0.02, 1.6, 0.012, k.bodyShade(), 0.22, 1.32, s * (sz + 0.004), root).castShadow = false;
    box(0.02, 1.6, 0.012, k.bodyShade(), -0.85, 1.32, s * (sz + 0.004), root).castShadow = false;
    box(0.14, 0.035, 0.03, k.chrome(), 0.05, 1.3, s * (sz + 0.012), root).castShadow = false;
    rbox(0.08, 0.2, 0.14, 0.03, k.trim(), 1.25, 1.62, s * (sz + 0.12), root);
    // wheel arches
    for (const x of [1.72, -1.72]) {
      const arc = mesh(new THREE.TorusGeometry(r + 0.08, 0.05, 4, 12, Math.PI), k.trim(), x, r + 0.04, s * (sz - 0.01), root);
      arc.castShadow = false;
    }
    // headlight + tail
    rbox(0.18, 0.14, 0.42, 0.04, k.head(), 2.52, 1.05, s * (vw / 2 - 0.3), root).castShadow = false;
    box(0.04, 0.42, 0.14, k.tail(), -2.74, 1.3, s * (vw / 2 - 0.05), root).castShadow = false;
  }
  rbox(0.08, 0.2, vw * 0.5, 0.03, k.chassis(), 2.7, 0.78, 0, root);
  rbox(0.22, 0.26, vw + 0.14, 0.08, k.trim(), 2.7, 0.48, 0, root);
  rbox(0.18, 0.24, vw + 0.14, 0.08, k.trim(), -2.72, 0.5, 0, root);
  box(0.02, 1.6, 0.02, k.bodyShade(), -2.74, 1.35, 0, root).castShadow = false;
  // underbody
  box(4.6, 0.2, vw - 0.3, k.chassis(), 0, 0.38, 0, root);
  addAxle(k, root, wheels, 1.72, r, vw / 2 + 0.06, false, 0.28);
  addAxle(k, root, wheels, -1.72, r, vw / 2 + 0.06, false, 0.28);
  return 5.6;
}

/**
 * Builds a procedural vehicle. Returns a Group with userData:
 *  - wheels: Object3D[] (spin via `spinWheels` or rotation.z)
 *  - bed (tipper only): pivot Object3D, use `setTipperTilt` to animate
 *  - length: overall length in units
 */
export function buildVehicle(type: VehicleType, colors: VehicleColors): THREE.Group {
  const k = createKit(colors);
  const root = new THREE.Group();
  root.name = `vehicle:${type}`;
  const wheels: THREE.Object3D[] = [];
  let length: number;
  switch (type) {
    case 'tipper':
      length = buildTipper(k, root, wheels);
      break;
    case 'lorry':
      length = buildLorry(k, root, wheels);
      break;
    case 'flatbed':
      length = buildFlatbed(k, root, wheels);
      break;
    case 'lowbed':
      length = buildLowbed(k, root, wheels);
      break;
    case 'prime-mover':
      length = buildPrimeMover(k, root, wheels, k.accentColor.clone());
      break;
    case 'container':
      // container-haulage variant: classic box colour derived from the brand body colour
      length = buildPrimeMover(k, root, wheels, k.bodyColor.clone().lerp(new THREE.Color('#8a3b2a'), 0.55));
      break;
    case 'van':
    case 'bakkie':
      length = buildVan(k, root, wheels);
      break;
    case 'superlink':
      length = buildPrimeMover(k, root, wheels, k.accentColor.clone());
      break;
    case 'tautliner':
      // curtain-side trailer: light grey box
      length = buildPrimeMover(k, root, wheels, new THREE.Color('#c9ced4'));
      break;
    case 'reefer':
      // refrigerated trailer: white box
      length = buildPrimeMover(k, root, wheels, new THREE.Color('#f1f3f5'));
      break;
    default: {
      const never: never = type;
      void never;
      length = buildLorry(k, root, wheels);
    }
  }
  root.userData.type = type;
  root.userData.wheels = wheels;
  root.userData.length = length;
  return root;
}

/** Recursively disposes geometries, materials and textures under obj (and detaches it). */
export function disposeObject(obj: THREE.Object3D | null | undefined): void {
  if (!obj) return;
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
    else if (mat) mats.add(mat);
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((mat) => {
    const rec = mat as unknown as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const v = rec[key];
      if (v && typeof v === 'object' && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
    }
    mat.dispose();
  });
  obj.removeFromParent();
}
