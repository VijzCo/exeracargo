/** Deep merge for config objects. Arrays in `patch` replace arrays in `base`. */
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const SECTION_KEYS = ['hero', 'stats', 'services', 'logistics', 'fleet', 'promotions', 'trust', 'story', 'process', 'insights', 'areas', 'testimonials', 'faq', 'cta'];

/** Repair legacy shapes (e.g. time windows stored as [start,end] tuples — Firestore forbids nested arrays). */
export function normalizeTenant<T extends { booking?: { restrictedWindows?: { windows?: unknown[] } } }>(cfg: T): T {
  // sections added after a config was saved (e.g. 'trust', 'logistics') are appended, visible
  const sec = (cfg as { sections?: { order?: string[] } }).sections;
  if (sec?.order) {
    for (const k of SECTION_KEYS) if (!sec.order.includes(k)) sec.order.splice(Math.max(0, sec.order.length - 1), 0, k);
  }
  const rw = cfg.booking?.restrictedWindows;
  if (rw?.windows?.some((w) => Array.isArray(w))) {
    rw.windows = rw.windows.map((w) =>
      Array.isArray(w) ? { start: String(w[0] ?? ''), end: String(w[1] ?? '') } : w,
    );
  }
  return cfg;
}

export function deepMerge<T>(base: T, patch: DeepPartial<T> | null | undefined): T {
  if (!patch) return base;
  if (!isObj(base) || !isObj(patch)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const cur = out[key];
    out[key] = isObj(cur) && isObj(val) ? deepMerge(cur, val as DeepPartial<typeof cur>) : val;
  }
  return out as T;
}
