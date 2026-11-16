/** Stable random id per install (browser profile / app install) — device doc id = `<uid>__<installId>`. */
export function getInstallId(): string {
  const KEY = 'exera:installId';
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
      const b = new Uint8Array(12);
      crypto.getRandomValues(b);
      id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'volatile' + Math.random().toString(36).slice(2, 10);
  }
}
