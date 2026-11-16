import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../components/Icon';

/** Full-screen bottom sheet (dialog). Esc / close button dismisses unless `locked`. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  locked,
  step,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  locked?: boolean;
  step?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('drv-noscroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('drv-noscroll');
      prev?.focus?.();
    };
  }, [onClose, locked]);
  return (
    <div className="drv-sheet-wrap">
      <div className="drv-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="drv-sheet-head">
          <div>
            {step && <span className="drv-eyebrow">{step}</span>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="drv-iconbtn" onClick={onClose} aria-label="Close" disabled={locked}>
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="drv-sheet-body">{children}</div>
        {footer && <footer className="drv-sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);
  return (
    <div className="drv-sheet-wrap drv-confirm-wrap" onClick={() => !busy && onCancel()}>
      <div className="drv-confirm" role="alertdialog" aria-modal="true" aria-labelledby="drv-confirm-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="drv-confirm-t">{title}</h2>
        {body && <div className="drv-confirm-body">{body}</div>}
        <div className="drv-row2">
          <button type="button" className="btn btn-ghost drv-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" ref={okRef} className={`btn drv-btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="drv-empty">
      <span className="drv-empty-ic">
        <Icon name={icon} size={30} />
      </span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}
