// Shared admin UI primitives: toast, confirm, modal/drawer, form fields,
// Toggle, TagInput, ColorField and the generic ListEditor.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../components/Icon';

// ── helpers ──────────────────────────────────────────────────

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const dtf = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' });
export const fmtDateTime = (ts?: number) => (ts ? dtf.format(new Date(ts)) : '—');
export const fmtDate = (ts?: number) => (ts ? df.format(new Date(ts)) : '—');

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Minimal async loader with reload + loading/error state. */
export function useLoader<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await run();
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, setData, loading, error, reload: load };
}

// ── toast + confirm context ──────────────────────────────────

export type ToastKind = 'ok' | 'err' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
export interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
interface UiCtx {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}
const Ui = createContext<UiCtx | null>(null);

export function useUi(): UiCtx {
  const c = useContext(Ui);
  if (!c) throw new Error('useUi outside UiProvider');
  return c;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (text: string, kind: ToastKind = 'ok') => {
      const id = nextId.current++;
      setToasts((l) => [...l.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'err' ? 6000 : 3500);
    },
    [dismiss],
  );
  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ui.Provider value={value}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast adm-toast-${t.kind}`}>
            <Icon name={t.kind === 'err' ? 'x' : t.kind === 'ok' ? 'check' : 'bolt'} size={18} />
            <span>{t.text}</span>
            <button type="button" className="adm-toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title ?? ''}
        role="alertdialog"
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm ${pending?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              data-autofocus
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        {pending?.body ? <div className="muted">{pending.body}</div> : null}
      </Modal>
    </Ui.Provider>
  );
}

// ── modal / drawer ───────────────────────────────────────────

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'modal',
  role = 'dialog',
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: 'modal' | 'drawer';
  role?: 'dialog' | 'alertdialog';
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first =
      el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el;
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <div className={`adm-overlay adm-overlay-${variant}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`adm-dialog adm-${variant}${wide ? ' adm-dialog-wide' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <div className="adm-dialog-head">
          <h2 id={titleId} className="adm-dialog-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="adm-dialog-body">{children}</div>
        {footer ? <div className="adm-dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

// ── layout bits ──────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1 className="adm-h1">{title}</h1>
        {subtitle ? <p className="muted small">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = 'layers', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="h3">{title}</h3>
      {children ? <div className="muted small">{children}</div> : null}
    </div>
  );
}

export function Section({ title, desc, children, actions }: { title: string; desc?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card adm-section">
      <div className="spread adm-section-head">
        <div>
          <h2 className="adm-h2">{title}</h2>
          {desc ? <p className="muted small">{desc}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ── form fields ──────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
  span,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={`field${span ? ' span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  span,
  placeholder,
  type = 'text',
  maxLength,
  counter,
  inputMode,
}: {
  label: ReactNode;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: string | null;
  span?: boolean;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'date' | 'time';
  maxLength?: number;
  counter?: number;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
}) {
  const v = value ?? '';
  const h = counter ? (
    <>
      {hint ? <>{hint} · </> : null}
      <span className={v.length > counter ? 'adm-over' : ''}>
        {v.length}/{counter}
      </span>
    </>
  ) : (
    hint
  );
  return (
    <Field label={label} hint={h} error={error} span={span}>
      <input
        className="input"
        type={type}
        value={v}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  hint,
  span = true,
  rows = 4,
  counter,
  placeholder,
}: {
  label: ReactNode;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  span?: boolean;
  rows?: number;
  counter?: number;
  placeholder?: string;
}) {
  const v = value ?? '';
  return (
    <Field
      label={label}
      span={span}
      hint={
        counter ? (
          <>
            {hint ? <>{hint} · </> : null}
            <span className={v.length > counter ? 'adm-over' : ''}>
              {v.length}/{counter}
            </span>
          </>
        ) : (
          hint
        )
      }
    >
      <textarea
        className="textarea"
        rows={rows}
        value={v}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function NumField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
  optional,
  span,
  suffix,
}: {
  label: ReactNode;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
  span?: boolean;
  suffix?: string;
}) {
  return (
    <Field label={label} hint={hint} span={span}>
      <div className="adm-affix">
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(optional ? undefined : 0);
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
        {suffix ? <span className="adm-affix-s">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  span,
}: {
  label: ReactNode;
  value: V;
  onChange: (v: V) => void;
  options: readonly (V | { value: V; label: string })[];
  hint?: ReactNode;
  span?: boolean;
}) {
  return (
    <Field label={label} hint={hint} span={span}>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  desc?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="adm-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className="adm-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="adm-switch-knob" />
      </button>
      <div className="adm-toggle-text" onClick={() => onChange(!checked)}>
        <span id={id} className="adm-toggle-label">
          {label}
        </span>
        {desc ? <span className="hint">{desc}</span> : null}
      </div>
    </div>
  );
}

// ── TagInput ─────────────────────────────────────────────────

export function TagInput({
  label,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  suggestions,
  normalize,
  validate,
  hint,
  span = true,
}: {
  label: ReactNode;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  normalize?: (s: string) => string;
  validate?: (s: string) => string | null;
  hint?: ReactNode;
  span?: boolean;
}) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const listId = useId();
  const inputId = useId();

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => (normalize ? normalize(s.trim()) : s.trim()))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      const problem = validate?.(p) ?? null;
      if (problem) {
        setErr(problem);
        return;
      }
      if (!next.includes(p)) next.push(p);
    }
    setErr(null);
    onChange(next);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={`field${span ? ' span-2' : ''}`}>
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <div className="adm-tags" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
        {value.map((t, i) => (
          <span key={`${t}-${i}`} className="adm-tag">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="adm-tags-input"
          value={text}
          list={suggestions?.length ? listId : undefined}
          placeholder={value.length ? '' : placeholder}
          aria-invalid={err ? true : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (err) setErr(null);
          }}
          onKeyDown={onKey}
          onBlur={() => text.trim() && add(text)}
        />
        {suggestions?.length ? (
          <datalist id={listId}>
            {suggestions
              .filter((s) => !value.includes(s))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        ) : null}
      </div>
      {err ? <span className="field-error">{err}</span> : <span className="hint">{hint ?? 'Enter or comma to add · Backspace removes last'}</span>}
    </div>
  );
}

// ── ColorField ───────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = HEX.test(text);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="adm-color">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          className="input mono"
          aria-label={`${label} hex value`}
          value={text}
          maxLength={7}
          aria-invalid={!valid || undefined}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = `#${v}`;
            setText(v);
            if (HEX.test(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => !valid && setText(value)}
        />
      </div>
    </div>
  );
}

// ── ListEditor ───────────────────────────────────────────────

export function ListEditor<T>({
  items,
  onChange,
  create,
  duplicate,
  title,
  subtitle,
  render,
  itemLabel = 'item',
  emptyText,
  max,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  duplicate?: (item: T) => T;
  title: (item: T, i: number) => ReactNode;
  subtitle?: (item: T) => ReactNode;
  render: (item: T, update: (patch: Partial<T>) => void, i: number) => ReactNode;
  itemLabel?: string;
  emptyText?: string;
  max?: number;
}) {
  const { confirm } = useUi();
  const [open, setOpen] = useState<number | null>(null);

  const setAt = (i: number, next: T) => onChange(items.map((it, j) => (j === i ? next : it)));
  const update = (i: number) => (patch: Partial<T>) => {
    const cur = items[i];
    setAt(i, typeof cur === 'object' && cur !== null ? ({ ...cur, ...patch } as T) : (patch as unknown as T));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (open === i) setOpen(j);
    else if (open === j) setOpen(i);
  };
  const dup = (i: number) => {
    const src = items[i];
    const copy = duplicate ? duplicate(src) : (JSON.parse(JSON.stringify(src)) as T);
    const next = [...items];
    next.splice(i + 1, 0, copy);
    onChange(next);
    setOpen(i + 1);
  };
  const remove = async (i: number) => {
    const ok = await confirm({
      title: `Delete this ${itemLabel}?`,
      body: <>“{title(items[i], i)}” will be removed from the draft. You can still Discard before publishing.</>,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    onChange(items.filter((_, j) => j !== i));
    setOpen(null);
  };
  const add = () => {
    onChange([...items, create()]);
    setOpen(items.length);
  };
  const canAdd = max === undefined || items.length < max;

  return (
    <div className="adm-list">
      {items.length === 0 ? (
        <div className="adm-list-empty muted small">{emptyText ?? `No ${itemLabel}s yet.`}</div>
      ) : null}
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`adm-list-item${isOpen ? ' open' : ''}`}>
            <div className="adm-list-head">
              <button
                type="button"
                className="adm-list-toggle"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="adm-list-chev" aria-hidden>
                  <Icon name="arrow" size={14} />
                </span>
                <span className="adm-list-title">
                  <strong>{title(it, i) || <span className="muted">Untitled {itemLabel}</span>}</strong>
                  {subtitle ? <span className="muted small">{subtitle(it)}</span> : null}
                </span>
              </button>
              <div className="adm-list-actions">
                <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <span className="adm-rot-up" aria-hidden>
                    <Icon name="arrow" size={14} />
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <span className="adm-rot-down" aria-hidden>
                    <Icon name="arrow" size={14} />
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label="Duplicate" disabled={!canAdd} onClick={() => dup(i)}>
                  <Icon name="copy" size={16} />
                </button>
                <button type="button" className="icon-btn adm-danger-btn" aria-label="Delete" onClick={() => void remove(i)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
            {isOpen ? <div className="adm-list-body form-grid">{render(it, update(i), i)}</div> : null}
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost btn-sm adm-list-add" onClick={add} disabled={!canAdd}>
        <Icon name="plus" size={16} /> Add {itemLabel}
      </button>
    </div>
  );
}

/** Simple list of strings (one textarea/input per row). */
export function StringListEditor({
  items,
  onChange,
  itemLabel = 'item',
  placeholder,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  itemLabel?: string;
  placeholder?: string;
}) {
  const { confirm } = useUi();
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
      {items.map((s, i) => (
        <div key={i} className="adm-strrow">
          <input
            className="input"
            value={s}
            placeholder={placeholder}
            aria-label={`${itemLabel} ${i + 1}`}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
            <span className="adm-rot-up" aria-hidden>
              <Icon name="arrow" size={14} />
            </span>
          </button>
          <button type="button" className="icon-btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
            <span className="adm-rot-down" aria-hidden>
              <Icon name="arrow" size={14} />
            </span>
          </button>
          <button
            type="button"
            className="icon-btn adm-danger-btn"
            aria-label={`Delete ${itemLabel}`}
            onClick={async () => {
              if (!s.trim() || (await confirm({ title: `Delete this ${itemLabel}?`, confirmLabel: 'Delete', danger: true })))
                onChange(items.filter((_, j) => j !== i));
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...items, ''])}>
          <Icon name="plus" size={16} /> Add {itemLabel}
        </button>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="boot-spinner adm-spinner" role="status" aria-label={label} />;
}
