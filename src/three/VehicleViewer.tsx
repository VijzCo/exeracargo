import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { VehicleType } from '../tenant/types';
import { buildVehicle, disposeObject, setTipperTilt, TIPPER_TILT_MAX } from './models';
import { contactShadow } from './env';
import { cappedDpr, createRenderer, destroyRenderer, isBrowser, prefersReducedMotion } from './runtime';

export interface VehicleViewerProps {
  type: VehicleType;
  primary: string;
  accent: string;
  mode: 'dark' | 'light';
  autoRotate?: boolean;
  height?: number;
  interactive?: boolean;
  className?: string;
}

interface ViewerOpts {
  type: VehicleType;
  primary: string;
  accent: string;
  mode: 'dark' | 'light';
  autoRotate: boolean;
  interactive: boolean;
}

interface ViewerApp {
  snapshot: () => string | null;
  dispose: () => void;
}

function rgba(color: string, a: number): string {
  try {
    const c = new THREE.Color(color);
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
  } catch {
    return `rgba(128,128,128,${a})`;
  }
}

function createViewerApp(el: HTMLElement, o: ViewerOpts, angleRef: MutableRefObject<number>): ViewerApp | null {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', zIndex: '1' });
  const renderer = createRenderer(canvas, { shadows: false });
  if (!renderer) return null;
  el.appendChild(canvas);
  const reduced = prefersReducedMotion();
  const dark = o.mode === 'dark';

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(dark ? '#a9c2ee' : '#ffffff', dark ? '#2a2420' : '#9c8f7c', dark ? 1.15 : 1.3);
  const key = new THREE.DirectionalLight('#fff1de', dark ? 2.4 : 2.6);
  key.position.set(6, 10, 7);
  const rim = new THREE.DirectionalLight(new THREE.Color(o.accent).lerp(new THREE.Color('#ffffff'), 0.5), dark ? 1.3 : 0.7);
  rim.position.set(-7, 5, -8);
  scene.add(hemi, key, rim);

  const spinner = new THREE.Group();
  scene.add(spinner);
  const vehicle = buildVehicle(o.type, { body: o.primary, accent: o.accent, dark });
  vehicle.traverse((m) => {
    m.castShadow = false;
    m.receiveShadow = false;
  });
  const bb = new THREE.Box3().setFromObject(vehicle);
  const size = bb.getSize(new THREE.Vector3());
  const centre = bb.getCenter(new THREE.Vector3());
  vehicle.position.set(-centre.x, 0.16, -centre.z);
  spinner.add(vehicle);

  const R = Math.max(size.x, size.z) / 2 + 0.55;
  const discMat = new THREE.MeshStandardMaterial({ color: dark ? '#1b222c' : '#f1f3f5', roughness: 0.6, metalness: 0.25 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.02, 0.16, 48), discMat);
  disc.position.y = 0.08;
  spinner.add(disc);
  const ringMat = new THREE.MeshStandardMaterial({ color: o.accent, emissive: o.accent, emissiveIntensity: dark ? 0.6 : 0.25, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.035, 4, 72), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.165;
  spinner.add(ring);
  const shadow = contactShadow(size.x * 1.15, size.z * 1.5, dark ? 0.6 : 0.32);
  if (shadow) {
    shadow.position.y = 0.17;
    spinner.add(shadow);
  }

  const camera = new THREE.PerspectiveCamera(26, 1, 0.3, 100);
  // tipper needs head-room for the raised bed on hover
  const fitHeight = o.type === 'tipper' ? Math.max(size.y, 3.6) : size.y;
  const target = new THREE.Vector3(0, Math.min(1.7, fitHeight * 0.42), 0);
  const fit = () => {
    const r = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(cappedDpr(1.5, 1.25));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    // fit the turntable horizontally and the vehicle height vertically
    const needH = (R * 1.22) / Math.tan(hf / 2);
    const needV = (Math.max(fitHeight, R * 0.75) * 0.95) / Math.tan(vf / 2);
    const dist = Math.max(needH, needV);
    const elev = THREE.MathUtils.degToRad(19);
    camera.position.set(0, target.y + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  fit();

  // interaction state
  let dragging = false;
  let hover = false;
  let lastX = 0;
  let lastT = 0;
  let vel = 0;
  let tilt = 0;
  const isTipper = o.type === 'tipper';

  let running = false;
  let raf = 0;
  let last = 0;
  const render = () => {
    spinner.rotation.y = angleRef.current;
    if (isTipper) setTipperTilt(vehicle, tilt);
    renderer.render(scene, camera);
  };
  const frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const tiltTarget = hover && isTipper ? TIPPER_TILT_MAX * 0.45 : 0;
    if (reduced) {
      tilt = tiltTarget;
      vel = 0;
    } else {
      tilt += (tiltTarget - tilt) * (1 - Math.exp(-dt * 4));
      if (!dragging) {
        angleRef.current += vel * dt;
        vel *= Math.exp(-dt * 3);
        if (o.autoRotate && Math.abs(vel) < 0.35) angleRef.current += dt * (hover ? 0.18 : 0.35);
      }
    }
    render();
    const animating =
      !document.hidden && (!reduced || dragging || Math.abs(tilt - tiltTarget) > 1e-3);
    if (animating) raf = requestAnimationFrame(frame);
    else running = false;
  };
  const wake = () => {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastT = performance.now();
    vel = 0;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    el.style.cursor = 'grabbing';
    wake();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const d = dx * 0.012;
    angleRef.current += d;
    const dt = Math.max(0.008, (now - lastT) / 1000);
    vel = vel * 0.6 + (d / dt) * 0.4;
    lastX = e.clientX;
    lastT = now;
    if (reduced) render();
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    el.style.cursor = 'grab';
    if (performance.now() - lastT > 80) vel = 0;
  };
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      hover = true;
      wake();
    }
  };
  const onLeave = () => {
    hover = false;
    wake();
  };
  if (o.interactive) {
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointerleave', onLeave);
  const onVis = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', onVis);
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          fit();
          if (!running) render();
        })
      : null;
  ro?.observe(el);

  render();
  wake();

  return {
    snapshot: () => {
      try {
        render();
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      key.dispose();
      rim.dispose();
      hemi.dispose();
      disposeObject(spinner);
      scene.clear();
      destroyRenderer(renderer);
      canvas.remove();
    },
  };
}

/**
 * Small turntable preview of one vehicle. The WebGL context only exists while the card is
 * near the viewport; off-screen it is released and a snapshot image is shown instead.
 */
export default function VehicleViewer({
  type,
  primary,
  accent,
  mode,
  autoRotate = true,
  height = 220,
  interactive = true,
  className,
}: VehicleViewerProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(-0.6);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !isBrowser()) return;
    setSnapshot(null);
    const opts: ViewerOpts = { type, primary, accent, mode, autoRotate, interactive };
    let app: ViewerApp | null = null;
    let failed = false;
    const enter = () => {
      if (app || failed) return;
      try {
        app = createViewerApp(el, opts, angleRef);
      } catch {
        app = null;
      }
      if (!app) failed = true;
      else setLive(true);
    };
    const leave = (snap: boolean) => {
      if (!app) return;
      const a = app;
      app = null;
      setLive(false);
      if (snap) {
        const url = a.snapshot();
        if (url) setSnapshot(url);
      }
      try {
        a.dispose();
      } catch {
        /* ignore */
      }
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (en.isIntersecting) enter();
            else leave(true);
          }
        },
        { rootMargin: '120px 0px' },
      );
      io.observe(el);
    } else {
      enter();
    }
    return () => {
      io?.disconnect();
      leave(false);
    };
  }, [type, primary, accent, mode, autoRotate, interactive]);

  const placeholder = useMemo(
    () => `radial-gradient(ellipse 60% 38% at 50% 72%, ${rgba(primary, mode === 'dark' ? 0.22 : 0.16)}, transparent 70%)`,
    [primary, mode],
  );

  return (
    <div
      ref={boxRef}
      className={className}
      role="img"
      aria-label={`3D preview of ${type.replace('-', ' ')}`}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        touchAction: interactive ? 'pan-y' : 'auto',
        cursor: interactive ? 'grab' : 'default',
        background: live || snapshot ? undefined : placeholder,
        userSelect: 'none',
      }}
    >
      {snapshot && !live && (
        <img
          src={snapshot}
          alt=""
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
