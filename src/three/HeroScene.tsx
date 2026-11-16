import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Hero3D } from '../tenant/types';
import { buildVehicle, disposeObject, setTipperTilt, spinWheels, tipperLipWorld, TIPPER_TILT_MAX } from './models';
import {
  aggregatePile,
  bush,
  curvedRoad,
  envPalette,
  groundDisc,
  hill,
  laneDashes,
  palmFactory,
  rock,
  straightRoad,
  trafficCone,
  type EnvPalette,
} from './env';
import {
  cappedDpr,
  createRenderer,
  destroyRenderer,
  easeInCubic,
  easeOutCubic,
  isBrowser,
  prefersReducedMotion,
  seededRandom,
  smooth,
  clamp01,
} from './runtime';

export interface HeroSceneProps {
  variant: Hero3D;
  primary: string;
  accent: string;
  mode: 'dark' | 'light';
  className?: string;
}

interface World {
  root: THREE.Group;
  update: (t: number, dt: number) => void;
  target: THREE.Vector3;
  radius: number;
  height: number;
  azimuth: number;
  shadowSize: number;
  fog: [number, number];
  /** time (s) of a representative frame for reduced-motion users */
  staticTime: number;
}

interface Opts {
  variant: Exclude<Hero3D, 'none'>;
  primary: string;
  accent: string;
  mode: 'dark' | 'light';
}

// ── worlds ──

function scatterBackdrop(root: THREE.Group, p: EnvPalette, seed: number, avoid: (x: number, z: number) => boolean): void {
  const rnd = seededRandom(seed);
  const palms = palmFactory(p);
  let placed = 0;
  for (let i = 0; i < 80 && placed < 16; i++) {
    const x = (rnd() - 0.5) * 70;
    const z = -6 - rnd() * 22;
    if (avoid(x, z)) continue;
    const palm = palms.make(seed + i, 5 + rnd() * 3.5);
    palm.position.set(x, 0, z);
    palm.rotation.y = rnd() * Math.PI * 2;
    root.add(palm);
    placed++;
  }
  for (let i = 0; i < 9; i++) {
    const h = hill(i % 2 ? p.hill : p.hillFar, seed * 3 + i, 9 + rnd() * 8, 0.35 + rnd() * 0.25);
    h.position.x = -55 + i * 13 + rnd() * 6;
    h.position.z = -34 - rnd() * 12;
    root.add(h);
  }
  for (let i = 0; i < 18; i++) {
    const x = (rnd() - 0.5) * 60;
    const z = (rnd() - 0.5) * 40;
    if (avoid(x, z)) continue;
    const b = bush(rnd() > 0.5 ? p.leaf : p.leafDark, seed + 100 + i, 0.5 + rnd() * 0.6);
    b.position.x = x;
    b.position.z = z;
    root.add(b);
  }
}

function tipperWorld(o: Opts, p: EnvPalette): World {
  const root = new THREE.Group();
  root.add(groundDisc(p));
  // dirt yard + access road
  const yardGeo = new THREE.CircleGeometry(8, 18);
  {
    const yr = seededRandom(12);
    const pos = yardGeo.attributes.position as THREE.BufferAttribute;
    const ph = yr() * 6;
    for (let i = 1; i < pos.count; i++) {
      const a = Math.atan2(pos.getY(i), pos.getX(i));
      const k = 0.92 + 0.12 * Math.sin(3 * a + ph) + 0.05 * Math.sin(7 * a + ph * 2);
      pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k);
    }
  }
  const yard = new THREE.Mesh(yardGeo, new THREE.MeshStandardMaterial({ color: p.shoulder, roughness: 1 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(-6.5, 0.004, -0.5);
  yard.scale.set(1.3, 0.8, 1);
  yard.receiveShadow = true;
  root.add(yard);
  const road = straightRoad(p, 64, 6);
  road.position.x = 26;
  root.add(road);

  const truck = buildVehicle('tipper', { body: o.primary, accent: o.accent, dark: o.mode === 'dark' });
  root.add(truck);
  const bed = truck.userData.bed as THREE.Object3D;
  // load in the bed
  const load = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.9, 2.25, 6, 1, 3),
    new THREE.MeshStandardMaterial({ color: p.sand, roughness: 1, flatShading: true }),
  );
  {
    const pos = load.geometry.attributes.position as THREE.BufferAttribute;
    const rnd = seededRandom(7);
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + rnd() * 0.25);
    load.geometry.computeVertexNormals();
  }
  load.geometry.translate(0, 0.45, 0);
  load.position.set(2.45, 0.12, 0);
  load.castShadow = true;
  bed.add(load);

  const pileX = -6.5;
  const pileZ = 0;
  const pile = aggregatePile(p.sand, 11, 2.7, 1.75);
  pile.mesh.position.set(pileX, 0, pileZ);
  root.add(pile.mesh);
  const pile2 = aggregatePile(p.gravel, 23, 3.4, 2.1);
  pile2.mesh.position.set(-11, 0, -5.5);
  root.add(pile2.mesh);
  const rnd = seededRandom(3);
  for (let i = 0; i < 7; i++) {
    const r = rock(p.rock, 40 + i, 0.18 + rnd() * 0.3);
    r.position.x = -15 + rnd() * 10;
    r.position.z = 3.5 + rnd() * 3;
    root.add(r);
  }
  for (let i = 0; i < 3; i++) {
    const c = trafficCone();
    c.position.set(-2 + i * 2.2, 0, 3.4);
    root.add(c);
  }
  scatterBackdrop(root, p, 5, (x, z) => z > -9 || (x < -4 && x > -17 && z > -11));

  // spill particles
  const N = 260;
  const pGeo = new THREE.DodecahedronGeometry(0.1, 0);
  const pMat = new THREE.MeshStandardMaterial({ color: p.sand, roughness: 1, flatShading: true });
  const particles = new THREE.InstancedMesh(pGeo, pMat, N);
  particles.castShadow = true;
  particles.frustumCulled = false;
  root.add(particles);
  const P = new Float32Array(N * 3);
  const V = new Float32Array(N * 3);
  const T0 = new Float32Array(N);
  const S = new Float32Array(N);
  const state = new Uint8Array(N); // 0 idle, 1 flying, 2 landed
  const LT = new Float32Array(N);
  const R = new Float32Array(N * 4);
  const prnd = seededRandom(99);
  for (let i = 0; i < N; i++) {
    T0[i] = 4.1 + 2.5 * Math.pow(i / N, 1.35) + prnd() * 0.05;
    S[i] = 0.7 + prnd() * 0.9;
    for (let j = 0; j < 4; j++) R[i * 4 + j] = prnd();
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const lip = new THREE.Vector3();

  const CYCLE = 10;
  let lastX = 26;
  let lastCycle = -1;

  const update = (t: number, dt: number) => {
    const ct = t % CYCLE;
    const cycle = Math.floor(t / CYCLE);
    if (cycle !== lastCycle) {
      lastCycle = cycle;
      state.fill(0);
      load.scale.y = 1;
    }
    // truck position: reverse in, tip, drive off
    let x: number;
    if (ct < 2.8) x = 26 * (1 - easeOutCubic(ct / 2.8));
    else if (ct < 8.1) x = 0;
    else x = 30 * easeInCubic((ct - 8.1) / 1.9);
    // tiny settle bob when braking
    const bob = ct > 2.8 && ct < 3.4 ? Math.sin((ct - 2.8) * 16) * 0.015 * (1 - (ct - 2.8) / 0.6) : 0;
    truck.position.set(x, bob, 0);
    if (Math.abs(x - lastX) < 20) spinWheels(truck, x - lastX);
    lastX = x;
    let tilt = 0;
    if (ct >= 3.2 && ct < 5.1) tilt = smooth((ct - 3.2) / 1.9);
    else if (ct >= 5.1 && ct < 6.7) tilt = 1;
    else if (ct >= 6.7 && ct < 8.0) tilt = 1 - smooth((ct - 6.7) / 1.3);
    setTipperTilt(truck, tilt * TIPPER_TILT_MAX);
    load.scale.y = Math.max(0.04, 1 - clamp01((ct - 4.1) / 2.6));
    load.visible = load.scale.y > 0.05;
    load.position.x = 2.45 - (1 - load.scale.y) * 1.6;
    load.scale.x = 0.55 + 0.45 * load.scale.y;

    truck.updateMatrixWorld(true);
    tipperLipWorld(truck, lip);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (state[i] === 0 && ct >= T0[i] && ct < 7.2) {
        state[i] = 1;
        P[i3] = lip.x - 0.1 - R[i * 4] * 0.2;
        P[i3 + 1] = lip.y + R[i * 4 + 1] * 0.35;
        P[i3 + 2] = (R[i * 4 + 2] - 0.5) * 2.0;
        V[i3] = -0.9 - R[i * 4 + 3] * 1.7;
        V[i3 + 1] = 0.2 - R[i * 4 + 1] * 0.6;
        V[i3 + 2] = (R[i * 4 + 2] - 0.5) * 0.8;
      }
      let s = 0;
      if (state[i] === 1) {
        V[i3 + 1] -= 9.8 * dt;
        P[i3] += V[i3] * dt;
        P[i3 + 1] += V[i3 + 1] * dt;
        P[i3 + 2] += V[i3 + 2] * dt;
        const h = pile.heightAt(P[i3] - pileX, P[i3 + 2] - pileZ) + 0.06;
        if (P[i3 + 1] <= h) {
          P[i3 + 1] = h;
          state[i] = 2;
          LT[i] = ct;
        }
        s = S[i];
      } else if (state[i] === 2) {
        s = S[i] * (1 - clamp01((ct - LT[i] - 0.5) / 1.2));
      }
      e.set(R[i * 4] * 6 + ct * 3, R[i * 4 + 1] * 6, R[i * 4 + 2] * 6);
      q.setFromEuler(e);
      v3.set(P[i3], P[i3 + 1], P[i3 + 2]);
      sc.setScalar(Math.max(0.0001, s));
      m4.compose(v3, q, sc);
      particles.setMatrixAt(i, m4);
    }
    particles.instanceMatrix.needsUpdate = true;
  };

  return {
    root,
    update,
    target: new THREE.Vector3(-4.2, 1.6, 0),
    radius: 25,
    height: 5.6,
    azimuth: 0.42,
    shadowSize: 15,
    fog: [26, 70],
    staticTime: 5.9,
  };
}

function utilityPole(p: EnvPalette): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: p.gravel, roughness: 0.9, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 7.5, 6), mat);
  pole.position.y = 3.75;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), mat);
  arm.position.y = 7;
  g.add(arm);
  return g;
}

function truckWorld(o: Opts, p: EnvPalette): World {
  const root = new THREE.Group();
  root.add(groundDisc(p, 55));
  const road = straightRoad(p, 130, 8);
  root.add(road);
  const dashes = laneDashes(p, 32, 4, 0);
  root.add(dashes.mesh);

  const dark = o.mode === 'dark';
  const pm = buildVehicle('prime-mover', { body: o.primary, accent: o.accent, dark });
  pm.position.z = -2;
  root.add(pm);
  const lorry = buildVehicle('lorry', { body: o.primary, accent: o.accent, dark });
  lorry.position.z = 2;
  root.add(lorry);

  // scrolling props
  const rnd = seededRandom(17);
  const palms = palmFactory(p);
  const props: THREE.Object3D[] = [];
  const SPAN = 120;
  for (let i = 0; i < 18; i++) {
    const palm = palms.make(200 + i, 5 + rnd() * 4);
    palm.position.set(-SPAN / 2 + (i / 18) * SPAN + rnd() * 3, 0, -(8 + rnd() * 12));
    palm.rotation.y = rnd() * 6;
    root.add(palm);
    props.push(palm);
  }
  for (let i = 0; i < 26; i++) {
    const side = rnd() > 0.4 ? -1 : 1;
    const b = bush(rnd() > 0.5 ? p.leaf : p.leafDark, 300 + i, side > 0 ? 0.35 + rnd() * 0.3 : 0.5 + rnd() * 0.7);
    b.position.set(-SPAN / 2 + rnd() * SPAN, b.position.y, side * (6.5 + rnd() * (side > 0 ? 4 : 10)));
    root.add(b);
    props.push(b);
  }
  for (let i = 0; i < 9; i++) {
    const pole = utilityPole(p);
    pole.position.set(-SPAN / 2 + i * (SPAN / 9), 0, -6.2);
    root.add(pole);
    props.push(pole);
  }
  for (let i = 0; i < 12; i++) {
    const h = hill(i % 2 ? p.hill : p.hillFar, 500 + i, 9 + rnd() * 9, 0.35 + rnd() * 0.3);
    h.position.x = -SPAN / 2 + i * (SPAN / 12);
    h.position.z = -30 - rnd() * 14;
    root.add(h);
    props.push(h);
  }
  const SPEED = 11;
  let travelled = 0;
  let lastPm = 0;
  let lastLorry = 0;
  const update = (t: number, dt: number) => {
    travelled += SPEED * dt;
    dashes.update(travelled);
    for (const pr of props) {
      pr.position.x -= SPEED * dt;
      if (pr.position.x < -SPAN / 2) pr.position.x += SPAN;
    }
    const pmX = 2.5 + Math.sin(t * 0.21) * 1.5;
    const lX = -6.5 + Math.sin(t * 0.17 + 1.2) * 3.2;
    pm.position.x = pmX;
    lorry.position.x = lX;
    pm.position.y = Math.sin(t * 9.1) * 0.008;
    lorry.position.y = Math.sin(t * 8.3 + 1) * 0.01;
    spinWheels(pm, SPEED * dt + (pmX - lastPm));
    spinWheels(lorry, SPEED * dt + (lX - lastLorry));
    lastPm = pmX;
    lastLorry = lX;
  };
  return {
    root,
    update,
    target: new THREE.Vector3(-1.5, 1.4, -0.5),
    radius: 27,
    height: 6.5,
    azimuth: 0.55,
    shadowSize: 16,
    fog: [28, 78],
    staticTime: 1,
  };
}

function convoyWorld(o: Opts, p: EnvPalette): World {
  const root = new THREE.Group();
  root.add(groundDisc(p, 60));
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-62, 0, 16),
      new THREE.Vector3(-34, 0, 9),
      new THREE.Vector3(-14, 0, -1),
      new THREE.Vector3(4, 0, 1.5),
      new THREE.Vector3(20, 0, -5),
      new THREE.Vector3(38, 0, -14),
      new THREE.Vector3(62, 0, -18),
    ],
    false,
    'centripetal',
  );
  root.add(curvedRoad(p, curve, 7.4));
  const L = curve.getLength();
  const samples = curve.getSpacedPoints(160);
  const nearRoad = (x: number, z: number, d = 7) => samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < d * d);

  const rnd = seededRandom(31);
  const palms = palmFactory(p);
  let n = 0;
  for (let i = 0; i < 200 && n < 26; i++) {
    const x = (rnd() - 0.5) * 100;
    const z = -32 + rnd() * 40;
    if (nearRoad(x, z) || (z > -2 && Math.abs(x) < 30)) continue;
    const palm = palms.make(700 + i, 5 + rnd() * 4);
    palm.position.set(x, 0, z);
    palm.rotation.y = rnd() * 6;
    root.add(palm);
    n++;
  }
  for (let i = 0; i < 30; i++) {
    const x = (rnd() - 0.5) * 80;
    const z = -25 + rnd() * 40;
    if (nearRoad(x, z, 5.5) || z > 6) continue;
    const b = bush(rnd() > 0.5 ? p.leaf : p.leafDark, 800 + i, 0.5 + rnd() * 0.7);
    b.position.x = x;
    b.position.z = z;
    root.add(b);
  }
  for (let i = 0; i < 10; i++) {
    const h = hill(i % 2 ? p.hill : p.hillFar, 900 + i, 10 + rnd() * 9, 0.35 + rnd() * 0.3);
    h.position.set(-60 + i * 13, h.position.y, -40 - rnd() * 10);
    root.add(h);
  }

  const dark = o.mode === 'dark';
  const types = ['tipper', 'lorry', 'prime-mover', 'flatbed'] as const;
  const vehicles = types.map((type) => {
    const v = buildVehicle(type, { body: o.primary, accent: o.accent, dark });
    root.add(v);
    return v;
  });
  const lengths = vehicles.map((v) => (v.userData.length as number) || 8);
  const SPEED = 7;
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const update = (t: number, dt: number) => {
    let s = (t * SPEED + L * 0.62) % L;
    vehicles.forEach((v, i) => {
      if (i > 0) s -= lengths[i - 1] / 2 + lengths[i] / 2 + 3.6;
      const ss = ((s % L) + L) % L;
      const u = ss / L;
      const pt = curve.getPointAt(u);
      curve.getTangentAt(u, tan);
      nrm.crossVectors(up, tan).normalize();
      // offset into the left lane (Sri Lanka drives on the left)
      v.position.copy(pt).addScaledVector(nrm, 1.9);
      v.rotation.y = Math.atan2(-tan.z, tan.x);
      spinWheels(v, SPEED * dt);
    });
  };
  return {
    root,
    update,
    target: new THREE.Vector3(0, 1.2, 0),
    radius: 30,
    height: 10,
    azimuth: 0.32,
    shadowSize: 20,
    fog: [32, 85],
    staticTime: 0,
  };
}

// ── app ──

interface HeroApp {
  dispose: () => void;
}

function createHeroApp(host: HTMLElement, o: Opts): HeroApp | null {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  const renderer = createRenderer(canvas, { shadows: true });
  if (!renderer) return null;
  host.appendChild(canvas);

  const reduced = prefersReducedMotion();
  const p = envPalette(o.mode);
  const scene = new THREE.Scene();
  const world = o.variant === 'tipper' ? tipperWorld(o, p) : o.variant === 'truck' ? truckWorld(o, p) : convoyWorld(o, p);
  scene.add(world.root);
  scene.fog = new THREE.Fog(p.fog, world.fog[0], world.fog[1]);

  const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(p.sun, p.sunIntensity);
  sun.position.copy(world.target).add(new THREE.Vector3(14, 22, 10));
  sun.target.position.copy(world.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sh = sun.shadow.camera;
  sh.left = -world.shadowSize;
  sh.right = world.shadowSize;
  sh.top = world.shadowSize;
  sh.bottom = -world.shadowSize;
  sh.near = 1;
  sh.far = 70;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(new THREE.Color(o.accent).lerp(new THREE.Color('#ffffff'), 0.4), p.rimIntensity);
  rim.position.copy(world.target).add(new THREE.Vector3(-14, 8, -16));
  rim.target.position.copy(world.target);
  scene.add(rim, rim.target);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);
  let width = 1;
  let height = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(cappedDpr());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // On wide layouts push the subject right so it doesn't sit under the headline.
    const aspect = width / height;
    if (aspect > 1.25) camera.setViewOffset(width, height, -width * Math.min(0.22, (aspect - 1.25) * 0.3), 0, width, height);
    // portrait: drop the subject into the lower part of the frame, below stacked copy
    else if (aspect < 0.9) camera.setViewOffset(width, height, 0, -height * 0.2, width, height);
    else camera.clearViewOffset();
    // narrow screens: pull back so the vehicle fits
    camera.fov = aspect < 0.9 ? 46 : 34;
    camera.updateProjectionMatrix();
  };

  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (ev: PointerEvent) => {
    parallax.tx = (ev.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    parallax.ty = (ev.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  };
  const lookTarget = new THREE.Vector3();
  const placeCamera = (t: number, dt: number) => {
    const k = 1 - Math.exp(-dt * 3);
    parallax.x += (parallax.tx - parallax.x) * k;
    parallax.y += (parallax.ty - parallax.y) * k;
    const scroll = reduced ? 0 : clamp01(window.scrollY / Math.max(1, window.innerHeight));
    const az = world.azimuth + Math.sin(t * 0.06) * 0.22 + parallax.x * 0.1;
    const radius = world.radius * (1 + scroll * 0.28) * (camera.aspect < 0.9 ? 1.3 : 1);
    const h = world.height + parallax.y * -0.7 + scroll * 2.5;
    camera.position.set(world.target.x + Math.sin(az) * radius, h, world.target.z + Math.cos(az) * radius);
    lookTarget.copy(world.target);
    lookTarget.y += scroll * -0.6;
    camera.lookAt(lookTarget);
  };

  let visible = true;
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    world.update(time, dt);
    placeCamera(time, dt);
    renderer.render(scene, camera);
  };
  const renderStatic = () => {
    placeCamera(0, 1);
    renderer.render(scene, camera);
  };
  const sync = () => {
    const should = !reduced && visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  resize();
  if (reduced) {
    // step the simulation to a representative moment
    const step = 1 / 30;
    let t = 0;
    world.update(0, 0);
    while (t < world.staticTime) {
      t += step;
      world.update(t, step);
    }
    renderStatic();
  } else {
    world.update(0, 0);
    placeCamera(0, 1);
    renderer.render(scene, camera);
  }

  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          resize();
          if (!running) renderStatic();
        })
      : null;
  ro?.observe(host);
  const onWinResize = () => {
    resize();
    if (!running) renderStatic();
  };
  if (!ro) window.addEventListener('resize', onWinResize);
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          for (const en of entries) visible = en.isIntersecting;
          sync();
        })
      : null;
  io?.observe(host);
  document.addEventListener('visibilitychange', sync);
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
  sync();

  return {
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', sync);
      sun.dispose();
      rim.dispose();
      hemi.dispose();
      disposeObject(world.root);
      scene.clear();
      destroyRenderer(renderer);
      canvas.remove();
    },
  };
}

/**
 * Full-bleed decorative 3D hero background. Parent must be position:relative.
 * Renders nothing for variant 'none', when WebGL is unavailable, or outside a browser.
 */
export default function HeroScene({ variant, primary, accent, mode, className }: HeroSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (variant === 'none' || !isBrowser()) return;
    const host = hostRef.current;
    if (!host) return;
    let app: HeroApp | null = null;
    try {
      app = createHeroApp(host, { variant, primary, accent, mode });
    } catch {
      app = null;
    }
    if (!app) {
      setFailed(true);
      return;
    }
    setFailed(false);
    const a = app;
    return () => {
      try {
        a.dispose();
      } catch {
        /* ignore */
      }
    };
  }, [variant, primary, accent, mode]);

  if (variant === 'none' || failed) return null;
  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    />
  );
}
