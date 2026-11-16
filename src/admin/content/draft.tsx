// Draft state for the Site content editor. Lives above the routes so the
// draft survives navigating between admin pages, and drives the live preview.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTenant } from '../../tenant/TenantProvider';
import type { TenantConfig } from '../../tenant/types';
import { saveTenant } from '../../lib/data';
import { errMsg, useUi } from '../ui';

export type Updater = (fn: (d: TenantConfig) => TenantConfig) => void;

interface DraftCtx {
  draft: TenantConfig;
  saved: TenantConfig;
  dirty: boolean;
  saving: boolean;
  update: Updater;
  replace: (next: TenantConfig) => void;
  discard: () => void;
  save: () => Promise<boolean>;
  /** Patch both saved + draft after an out-of-band save (e.g. domains from Sites). */
  syncSaved: (patch: Partial<TenantConfig>) => void;
}

const Ctx = createContext<DraftCtx | null>(null);

export function useDraft(): DraftCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDraft outside DraftProvider');
  return c;
}

const PREVIEW_DEBOUNCE = 250;

export function DraftProvider({ children }: { children: ReactNode }) {
  const { tenant, setTenant } = useTenant();
  const { toast } = useUi();
  const [saved, setSaved] = useState<TenantConfig>(tenant);
  const [draft, setDraft] = useState<TenantConfig>(tenant);
  const [saving, setSaving] = useState(false);

  const tenantRef = useRef(tenant);
  tenantRef.current = tenant;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  // Tenant switched (Sites → Manage → reload): reset baseline.
  useEffect(() => {
    if (tenant.id !== saved.id) {
      setSaved(tenant);
      setDraft(tenant);
    }
  }, [tenant, saved.id]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Live preview: push draft into the running site (debounced).
  useEffect(() => {
    if (draft === tenantRef.current) return;
    const h = setTimeout(() => {
      if (draft.id === tenantRef.current.id) setTenant(draft);
    }, PREVIEW_DEBOUNCE);
    return () => clearTimeout(h);
  }, [draft, setTenant]);

  // Leaving the admin with unsaved edits: restore the published config.
  useEffect(
    () => () => {
      if (dirtyRef.current && savedRef.current.id === tenantRef.current.id) setTenant(savedRef.current);
    },
    [setTenant],
  );

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = useCallback<Updater>((fn) => {
    setDraft((d) => {
      const next = fn(d);
      return next.id === d.id ? next : { ...next, id: d.id };
    });
  }, []);

  const replace = useCallback((next: TenantConfig) => {
    setDraft({ ...next, id: savedRef.current.id });
  }, []);

  const discard = useCallback(() => {
    setDraft(savedRef.current);
    setTenant(savedRef.current);
  }, [setTenant]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const next: TenantConfig = { ...draft, id: savedRef.current.id, updatedAt: Date.now() };
      await saveTenant(next);
      setSaved(next);
      setDraft(next);
      setTenant(next);
      toast('Saved & published');
      return true;
    } catch (e) {
      toast(`Save failed: ${errMsg(e)}`, 'err');
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, setTenant, toast]);

  const syncSaved = useCallback(
    (patch: Partial<TenantConfig>) => {
      const nextSaved = { ...savedRef.current, ...patch, id: savedRef.current.id };
      setSaved(nextSaved);
      setDraft((d) => ({ ...d, ...patch, id: d.id }));
      if (!dirtyRef.current) setTenant(nextSaved);
    },
    [setTenant],
  );

  const value = useMemo<DraftCtx>(
    () => ({ draft, saved, dirty, saving, update, replace, discard, save, syncSaved }),
    [draft, saved, dirty, saving, update, replace, discard, save, syncSaved],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface TabProps {
  draft: TenantConfig;
  update: Updater;
}
