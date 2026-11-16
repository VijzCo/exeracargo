/** Calendar date (yyyy-mm-dd) in a given IANA time zone, regardless of the visitor's device timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}


/** Offset (ms) of `timeZone` from UTC at instant `at`. */
function tzOffsetMs(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Epoch ms for a wall-clock date (yyyy-mm-dd) + time (HH:mm) in `timeZone` — independent of the visitor's device zone. */
export function zonedEpoch(dateISO: string, hhmm: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m || !t) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  const off = tzOffsetMs(timeZone, guess);
  return guess - off;
}
