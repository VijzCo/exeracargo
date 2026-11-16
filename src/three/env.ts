import * as THREE from 'three';
import { linearFadeTexture, radialFadeTexture, seededRandom } from './runtime';

// Scenery builders for the hero scenes (low-poly, flat-shaded, Sri Lankan palette).

export interface EnvPalette {
  fog: string;
  ground: string;
  groundEdge: string;
  road: string;
  roadLine: string;
  shoulder: string;
  hill: string;
  hillFar: string;
  leaf: string;
  leafDark: string;
  trunk: string;
  sand: string;
  gravel: string;
  rock: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sun: string;
  sunIntensity: number;
  rimIntensity: number;
}

export function envPalette(mode: 'dark' | 'light'): EnvPalette {
  return mode === 'dark'
    ? {
        fog: '#0b121b',
        ground: '#1a2a24',
        groundEdge: '#0f1a17',
        road: '#262a30',
        roadLine: '#d7dbe0',
        shoulder: '#5b3426',
        hill: '#1d3b2c',
        hillFar: '#16282a',
        leaf: '#2f6a40',
        leafDark: '#24523a',
        trunk: '#5b4836',
        sand: '#c9a26b',
        gravel: '#666b72',
        rock: '#4c535b',
        hemiSky: '#9bb8e8',
        hemiGround: '#2a2017',
        hemiIntensity: 1.0,
        sun: '#ffe1bf',
        sunIntensity: 2.4,
        rimIntensity: 1.4,
      }
    : {
        fog: '#e8eef1',
        ground: '#9ec28e',
        groundEdge: '#b7d0a6',
        road: '#4f555c',
        roadLine: '#f4f5f2',
        shoulder: '#c46a42',
        hill: '#78ad66',
        hillFar: '#a8c79a',
        leaf: '#3e8a49',
        leafDark: '#2f733d',
        trunk: '#7a6048',
        sand: '#d9b57c',
        gravel: '#9aa0a6',
        rock: '#8a9097',
        hemiSky: '#ffffff',
        hemiGround: '#a08a66',
        hemiIntensity: 1.25,
        sun: '#fff1dc',
        sunIntensity: 2.7,
        rimIntensity: 0.6,
      };
}

function flat(color: string, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function jitter(geo: THREE.BufferGeometry, amount: number, rnd: () => number, keepBase = false, keepIndex = false): THREE.BufferGeometry {
  const g = geo.index && !keepIndex ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const pos = g.attributes.position as THREE.BufferAttribute;
  // jitter identical vertices identically so faces stay closed
  const map = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let d = map.get(key);
    if (!d) {
      d = [(rnd() - 0.5) * amount, keepBase && y <= 0.001 ? 0 : (rnd() - 0.5) * amount, (rnd() - 0.5) * amount];
      map.set(key, d);
    }
    pos.setXYZ(i, x + d[0], y + d[1], z + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

/** Large ground disc fading to transparent at its rim. */
export function groundDisc(p: EnvPalette, radius = 46): THREE.Mesh {
  const alpha = radialFadeTexture(0.25, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: p.ground,
    roughness: 1,
    metalness: 0,
    transparent: true,
    alphaMap: alpha ?? null,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.renderOrder = -2;
  return m;
}

/** Straight road along X with shoulders and solid edge lines; length fades at both ends. */
export function straightRoad(p: EnvPalette, length = 120, width = 7.6): THREE.Group {
  const g = new THREE.Group();
  const fade = linearFadeTexture(0.28);
  const mk = (color: string, w: number, y: number, order: number, rough = 0.95) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, transparent: true, alphaMap: fade ?? null, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(length, w), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    m.renderOrder = order;
    g.add(m);
    return m;
  };
  mk(p.shoulder, width + 3.2, 0.005, -1, 1);
  mk(p.road, width, 0.012, 0, 0.85);
  for (const s of [1, -1]) {
    const e = mk(p.roadLine, 0.14, 0.018, 1, 0.6);
    e.position.z = s * (width / 2 - 0.3);
  }
  return g;
}

/** Instanced lane dashes along X; call update(offset) to scroll. */
export function laneDashes(p: EnvPalette, count = 34, spacing = 4, z = 0): { mesh: THREE.InstancedMesh; update: (offset: number) => void } {
  const mat = new THREE.MeshStandardMaterial({ color: p.roadLine, roughness: 0.6, transparent: true });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 0.16), mat, count);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const s = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  const span = count * spacing;
  const update = (offset: number) => {
    for (let i = 0; i < count; i++) {
      let x = i * spacing - (offset % spacing) - span / 2;
      if (x < -span / 2) x += span;
      // shrink dashes towards the faded ends
      const k = 1 - Math.min(1, Math.max(0, (Math.abs(x) - span * 0.25) / (span * 0.25)));
      s.set(Math.max(0.001, k), 1, 1);
      v.set(x, 0.02, z);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}

/** Ribbon road following a curve on the ground. */
export function curvedRoad(p: EnvPalette, curve: THREE.Curve<THREE.Vector3>, width = 7.6, samples = 220): THREE.Group {
  const g = new THREE.Group();
  const fade = linearFadeTexture(0.22);
  const ribbon = (w: number, y: number, color: string, order: number, offset = 0, rough = 0.95) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const pt = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const n = new THREE.Vector3().crossVectors(up, t).normalize();
      const a = pt.clone().addScaledVector(n, offset - w / 2);
      const b = pt.clone().addScaledVector(n, offset + w / 2);
      pos.push(a.x, y, a.z, b.x, y, b.z);
      uv.push(u, 0, u, 1);
      if (i < samples) {
        const j = i * 2;
        idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // make sure the faces point up (winding depends on curve direction)
    if ((geo.attributes.normal as THREE.BufferAttribute).getY(0) < 0) {
      for (let i = 0; i < idx.length; i += 3) {
        const tmp = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = tmp;
      }
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, transparent: true, alphaMap: fade ?? null, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.renderOrder = order;
    g.add(m);
  };
  ribbon(width + 3.2, 0.005, p.shoulder, -1, 0, 1);
  ribbon(width, 0.012, p.road, 0, 0, 0.85);
  ribbon(0.14, 0.018, p.roadLine, 1, width / 2 - 0.3, 0.6);
  ribbon(0.14, 0.018, p.roadLine, 1, -(width / 2 - 0.3), 0.6);
  // centre dashes
  const dashMat = new THREE.MeshStandardMaterial({ color: p.roadLine, roughness: 0.6 });
  const count = Math.floor(curve.getLength() / 4);
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 0.16), dashMat, count);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const pt = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const yaw = Math.atan2(-t.z, t.x);
    const edge = Math.min(u, 1 - u);
    const sc = Math.max(0.001, Math.min(1, edge / 0.18));
    m4.compose(
      new THREE.Vector3(pt.x, 0.02, pt.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, yaw, 'YXZ')),
      new THREE.Vector3(sc, 1, 1),
    );
    dashes.setMatrixAt(i, m4);
  }
  dashes.receiveShadow = true;
  dashes.renderOrder = 1;
  g.add(dashes);
  return g;
}

/** Shared geometry/material bundle for scattering many palms cheaply. */
export function palmFactory(p: EnvPalette) {
  const trunkMat = flat(p.trunk, 0.95);
  const leafMat = new THREE.MeshStandardMaterial({ color: p.leaf, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: p.leafDark, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const nutMat = flat('#6b5a2a', 0.8);
  const segGeo = new THREE.CylinderGeometry(0.13, 0.17, 1.2, 6);
  const nutGeo = new THREE.IcosahedronGeometry(0.16, 0);
  // frond: tapered, drooping strip
  const frond = (() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const n = 6;
    const L = 2.6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = t * L;
      const y = 0.5 * t - 1.25 * t * t;
      const w = 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) + 0.02;
      pos.push(x, y, -w, x, y + 0.08, 0, x, y, w);
      if (i < n) {
        const j = i * 3;
        idx.push(j, j + 3, j + 1, j + 1, j + 3, j + 4, j + 1, j + 4, j + 2, j + 2, j + 4, j + 5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();

  const make = (seed: number, height = 6): THREE.Group => {
    const rnd = seededRandom(seed);
    const palm = new THREE.Group();
    const segs = Math.max(3, Math.round(height / 1.1));
    const lean = (rnd() - 0.5) * 0.5;
    const leanDir = rnd() * Math.PI * 2;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const bend = lean * t * t * 1.6;
      const s = new THREE.Mesh(segGeo, trunkMat);
      const sc = 1 - t * 0.35;
      s.scale.set(sc, 1, sc);
      s.position.set(x, y + 0.55, z);
      s.rotation.set(Math.sin(leanDir) * bend, 0, Math.cos(leanDir) * bend);
      s.castShadow = true;
      palm.add(s);
      x -= Math.sin(Math.cos(leanDir) * bend) * 1.1;
      z += Math.sin(Math.sin(leanDir) * bend) * 1.1;
      y += 1.08;
    }
    const crown = new THREE.Group();
    crown.position.set(x, y, z);
    palm.add(crown);
    const fronds = 8 + Math.floor(rnd() * 3);
    for (let i = 0; i < fronds; i++) {
      const f = new THREE.Mesh(frond, i % 2 ? leafMat : leafMat2);
      f.rotation.y = (i / fronds) * Math.PI * 2 + rnd() * 0.3;
      f.rotation.z = (rnd() - 0.4) * 0.35;
      const sc = 0.85 + rnd() * 0.35;
      f.scale.setScalar(sc);
      f.castShadow = true;
      crown.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const nut = new THREE.Mesh(nutGeo, nutMat);
      const a = (i / 4) * Math.PI * 2;
      nut.position.set(Math.cos(a) * 0.18, -0.2, Math.sin(a) * 0.18);
      crown.add(nut);
    }
    return palm;
  };
  return { make };
}

export function hill(color: string, seed: number, radius: number, heightScale = 0.45): THREE.Mesh {
  const rnd = seededRandom(seed);
  const geo = jitter(new THREE.IcosahedronGeometry(radius, 1), radius * 0.28, rnd);
  const m = new THREE.Mesh(geo, flat(color, 1));
  m.scale.set(1, heightScale, 0.8 + rnd() * 0.4);
  m.position.y = -radius * heightScale * 0.25;
  m.receiveShadow = true;
  return m;
}

export function bush(color: string, seed: number, size = 0.8): THREE.Mesh {
  const rnd = seededRandom(seed);
  const geo = jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.3, rnd);
  const m = new THREE.Mesh(geo, flat(color, 0.95));
  m.scale.y = 0.7;
  m.position.y = size * 0.35;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function rock(color: string, seed: number, size = 0.5): THREE.Mesh {
  const rnd = seededRandom(seed);
  const geo = jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.35, rnd);
  const m = new THREE.Mesh(geo, flat(color, 0.9));
  m.scale.y = 0.6;
  m.position.y = size * 0.2;
  m.rotation.y = rnd() * 6;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Aggregate pile (low-poly cone). Height function is exposed for particle landing. */
export function aggregatePile(color: string, seed: number, radius: number, height: number): { mesh: THREE.Mesh; heightAt: (dx: number, dz: number) => number } {
  const rnd = seededRandom(seed);
  // CylinderGeometry with a tiny top: ConeGeometry drops quads when heightSegments > 1
  const base = new THREE.CylinderGeometry(radius * 0.06, radius, height, 16, 5, true);
  base.translate(0, height / 2, 0);
  const geo = jitter(base, radius * 0.06, rnd, true, true);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  const heightAt = (dx: number, dz: number) => {
    const d = Math.hypot(dx, dz);
    return Math.max(0, height * (1 - d / radius));
  };
  return { mesh: m, heightAt };
}

export function trafficCone(): THREE.Group {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.4 });
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 10), orange);
  c.position.y = 0.42;
  c.castShadow = true;
  g.add(c);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.14, 0.12, 10), white);
  band.position.y = 0.5;
  g.add(band);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), orange);
  b.position.y = 0.025;
  b.castShadow = true;
  g.add(b);
  return g;
}

/** Soft dark blob texture-plane used as a fake contact shadow. */
export function contactShadow(width: number, depth: number, opacity = 0.45): THREE.Mesh | null {
  const tex = radialFadeTexture(0, 1);
  if (!tex) return null;
  const mat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity, alphaMap: tex, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.renderOrder = 2;
  return m;
}
