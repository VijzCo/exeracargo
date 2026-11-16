import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CROSS_BORDER_NAMES, findPlace, searchPlaces, type CountryCode, type CrossBorderCode, type Place } from '../geo';
import { Icon } from './Icon';
import '../styles/picker.css';

const KIND_TAG: Partial<Record<Place['kind'], string>> = {
  port: 'Port',
  industrial: 'Industrial',
  mining: 'Mining',
  border: 'Border town',
  metro: 'Metro',
};

export interface PlacePickerProps {
  id: string;
  label: string;
  country: CountryCode;
  value: string; // placeId
  onChange: (place: Place | undefined) => void;
  regions?: string[];
  crossBorder?: CrossBorderCode[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

/** Accessible town combobox (WAI-ARIA 1.2 combobox + listbox). Type to search; aliases supported. */
export default function PlacePicker({ id, label, country, value, onChange, regions, crossBorder, placeholder, error, hint }: PlacePickerProps) {
  const selected = findPlace(value);
  const [text, setText] = useState(selected ? selected.name : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // keep text in sync when a new place is committed from outside (not when the user clears by typing)
  useEffect(() => {
    if (selected) setText(selected.name);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const r = searchPlaces(country, open && selected && text === selected.name ? '' : text, { regions, crossBorder, limit: 40 });
    // home-country towns first, then each cross-border country as its own group (stable within groups)
    const rank = (p: Place) => (p.country === country ? '' : p.country);
    return r.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p).localeCompare(rank(b.p)) || a.i - b.i).map((x) => x.p);
  }, [country, text, regions, crossBorder, open, selected]);

  useEffect(() => setActive(0), [text]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  });

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    // revert free text to the committed value
    setText(selected ? selected.name : '');
  };

  const pick = (p: Place) => {
    onChange(p);
    setText(p.name);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === 'Tab') {
      if (open && results[active] && text && (!selected || text !== selected.name)) pick(results[active]);
      else setOpen(false);
    }
  };

  // group: home country first, then each cross-border country
  let lastGroup = '';
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;

  return (
    <div className="field pp" ref={wrapRef}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className={`pp-box${open ? ' open' : ''}`}>
        <Icon name="pin" size={16} className="pp-pin" />
        <input
          id={id}
          className="input pp-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-invalid={!!error}
          aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? 'Search town or city…'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (selected && e.target.value !== selected.name) onChange(undefined);
          }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onKeyDown={onKey}
          onBlur={() => open && close()}
        />
        {selected && (
          <span className="pp-region" aria-hidden="true">
            {selected.region}
          </span>
        )}
        {text && (
          <button
            type="button"
            className="pp-clear"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setText('');
              onChange(undefined);
              setOpen(true);
            }}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      {open && (
        <ul className="pp-list" id={listId} role="listbox" ref={listRef} aria-label={`${label} suggestions`}>
          {results.length === 0 && <li className="pp-empty">No town found — try another spelling.</li>}
          {results.map((p, i) => {
            const foreign = p.country !== country;
            const group = foreign ? `${CROSS_BORDER_NAMES[p.country as CrossBorderCode]} · cross-border` : '';
            const header = group && group !== lastGroup ? group : '';
            lastGroup = group;
            return (
              <li key={p.id} role="presentation">
                {header && (
                  <div className="pp-group" role="presentation">
                    <Icon name="globe" size={13} /> {header}
                  </div>
                )}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-i={i}
                  className={`pp-opt${i === active ? ' active' : ''}${p.id === value ? ' chosen' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                >
                  <span className="pp-name">{p.name}</span>
                  <span className="pp-meta">
                    {p.region}
                    {KIND_TAG[p.kind] && <span className="pp-tag">{KIND_TAG[p.kind]}</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hint && !error && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
