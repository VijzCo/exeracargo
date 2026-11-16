import * as THREE from 'three';

/** True when running in a real browser with a DOM. */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Device pixel ratio, capped (lower cap on small screens). */
export function cappedDpr(maxLarge = 1.75, maxSmall = 1.25): number {
  if (!isBrowser()) return 1;
  const dpr = window.devicePixelRatio || 1;
  const small = Math.min(window.innerWidth, window.innerHeight) < 640;
  return Math.min(dpr, small ? maxSmall : maxLarge);
}

export interface RendererOptions {
  shadows?: boolean;
  antialias?: boolean;
}

/**
 * Creates a transparent, ACES tone-mapped, sRGB renderer.
 * Returns null instead of throwing when WebGL is unavailable.
 */
export function createRenderer(canvas: HTMLCanvasElement, opts: RendererOptions = {}): THREE.WebGLRenderer | null {
  if (!isBrowser()) return null;
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: opts.antialias ?? true,
      powerPreference: 'default',
      preserveDrawingBuffer: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (opts.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    return renderer;
  } catch {
    return null;
  }
}

/** Fully release a renderer and its GL context. */
export function destroyRenderer(renderer: THREE.WebGLRenderer): void {
  try {
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  } catch {
    /* context may already be lost */
  }
}

/** Soft radial alpha gradient (white centre → transparent edge) as a texture. */
export function radialFadeTexture(inner = 0.35, outer = 1, size = 128): THREE.CanvasTexture | null {
  if (!isBrowser()) return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, r * inner, r, r, r * outer);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Linear alpha gradient along U: transparent at both ends, opaque in the middle. */
export function linearFadeTexture(edge = 0.3, size = 128): THREE.CanvasTexture | null {
  if (!isBrowser()) return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = 4;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(edge, '#ffffff');
  grad.addColorStop(1 - edge, '#ffffff');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Small deterministic PRNG so scenes look identical on every load. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (v: number): number => 1 - Math.pow(1 - clamp01(v), 3);
export const easeInCubic = (v: number): number => Math.pow(clamp01(v), 3);
