// Click-wrap acceptance records: tenants/{t}/acceptances/{uid}_{docId}_{version} (append-only).
// Accepted versions are cached on the device so the gate costs no read on every start;
// the cache is re-checked against the server once per session in the background.
import { doc, getDoc, serverTimestamp, setDoc, collection, getDocs, orderBy, query, limit } from 'firebase/firestore/lite';
import { firebaseEnabled, getDb } from '../lib/firebase';
import type { LegalDoc } from './docs';

export type AcceptRole = 'ops' | 'driver' | 'hired' | 'customer';

export interface Acceptance {
  id: string;
  uid: string;
  role: AcceptRole;
  name: string;
  docId: string;
  version: string;
  acceptedAt: number; // ms (server time in Firebase mode)
  userAgent: string;
  appVersion: string;
  method: 'clickwrap';
}

const demo = !firebaseEnabled;
const cacheKey = (t: string, uid: string) => `hp:legal:${t}:${uid}`;
const demoKey = (t: string) => `hp:demo:acceptances:${t}`;
const idOf = (uid: string, d: Pick<LegalDoc, 'id' | 'version'>) => `${uid}_${d.id}_${d.version}`;
const verified = new Set<string>();

function readCache(t: string, uid: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(t, uid)) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function writeCache(t: string, uid: string, c: Record<string, string>) {
  try {
    localStorage.setItem(cacheKey(t, uid), JSON.stringify(c));
  } catch {
    /* private mode */
  }
}
function demoList(t: string): Acceptance[] {
  try {
    return JSON.parse(localStorage.getItem(demoKey(t)) || '[]') as Acceptance[];
  } catch {
    return [];
  }
}

/** Documents (of `docs`) this user still has to accept. */
export async function pendingDocs(t: string, uid: string, docs: LegalDoc[]): Promise<LegalDoc[]> {
  const cache = readCache(t, uid);
  const missing = docs.filter((d) => cache[d.id] !== d.version);
  if (!missing.length) {
    if (!demo && !verified.has(`${t}/${uid}`)) {
      verified.add(`${t}/${uid}`);
      // background check: a cleared/forged cache must not skip the gate on the next start
      void Promise.all(
        docs.map((d) =>
          getDoc(doc(getDb(), 'tenants', t, 'acceptances', idOf(uid, d)))
            .then((s) => (s.exists() ? null : d.id))
            .catch(() => null), // offline / unknown → keep the cache
        ),
      )
        .then((gone) => {
          const c = readCache(t, uid);
          gone.forEach((id) => id && delete c[id]);
          writeCache(t, uid, c);
        })
        .catch(() => undefined);
    }
    return [];
  }
  if (demo) {
    const have = new Set(demoList(t).filter((a) => a.uid === uid).map((a) => `${a.docId}_${a.version}`));
    const out = missing.filter((d) => !have.has(`${d.id}_${d.version}`));
    missing.filter((d) => !out.includes(d)).forEach((d) => (cache[d.id] = d.version));
    writeCache(t, uid, cache);
    return out;
  }
  const res = await Promise.all(
    missing.map((d) =>
      getDoc(doc(getDb(), 'tenants', t, 'acceptances', idOf(uid, d)))
        .then((s) => (s.exists() ? null : d))
        .catch(() => d),
    ),
  );
  missing.filter((d) => !res.includes(d)).forEach((d) => (cache[d.id] = d.version));
  writeCache(t, uid, cache);
  return res.filter((d): d is LegalDoc => !!d);
}

/** Record acceptance of each document (one append-only record per document version). */
export async function acceptDocs(t: string, who: { uid: string; name: string; role: AcceptRole }, docs: LegalDoc[]): Promise<void> {
  const base = {
    uid: who.uid,
    role: who.role,
    name: (who.name || '').slice(0, 120),
    userAgent: navigator.userAgent.slice(0, 300),
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) || 'web',
    method: 'clickwrap' as const,
  };
  if (demo) {
    const list = demoList(t);
    for (const d of docs) {
      const id = idOf(who.uid, d);
      if (!list.some((a) => a.id === id)) list.unshift({ ...base, id, docId: d.id, version: d.version, acceptedAt: Date.now() });
    }
    localStorage.setItem(demoKey(t), JSON.stringify(list.slice(0, 2000)));
  } else {
    await Promise.all(
      docs.map((d) =>
        setDoc(doc(getDb(), 'tenants', t, 'acceptances', idOf(who.uid, d)), { ...base, docId: d.id, version: d.version, acceptedAt: serverTimestamp() }).catch(
          async (e: { code?: string }) => {
            // records are append-only: a second accept is denied as an update — fine if the record exists
            const exists = e?.code === 'permission-denied' && (await getDoc(doc(getDb(), 'tenants', t, 'acceptances', idOf(who.uid, d))).then((x) => x.exists()).catch(() => false));
            if (!exists) throw e;
          },
        ),
      ),
    );
  }
  const c = readCache(t, who.uid);
  docs.forEach((d) => (c[d.id] = d.version));
  writeCache(t, who.uid, c);
}

/** Console: latest acceptance records. */
export async function listAcceptances(t: string, max = 1000): Promise<Acceptance[]> {
  if (demo) return demoList(t).slice(0, max);
  const snap = await getDocs(query(collection(getDb(), 'tenants', t, 'acceptances'), orderBy('acceptedAt', 'desc'), limit(max)));
  return snap.docs.map((s) => {
    const d = s.data() as Omit<Acceptance, 'id' | 'acceptedAt'> & { acceptedAt?: { toMillis?: () => number } };
    return { ...d, id: s.id, acceptedAt: d.acceptedAt?.toMillis?.() ?? 0 } as Acceptance;
  });
}
