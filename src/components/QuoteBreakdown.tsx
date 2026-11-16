import type { Quote } from '../tenant/types';
import { useTenant } from '../tenant/TenantProvider';
import '../styles/picker.css';

/** Itemised quote: every line the customer pays for, then discount, VAT and total. */
export default function QuoteBreakdown({ quote, rfq, compact }: { quote: Quote; rfq?: boolean; compact?: boolean }) {
  const { fmtMoney } = useTenant();
  const charges = quote.lines.filter((l) => !/^(VAT|Promo)/.test(l.label));
  const adjust = quote.lines.filter((l) => /^(VAT|Promo)/.test(l.label));
  return (
    <div className={`qb${compact ? ' qb-compact' : ''}`}>
      <dl className="qb-lines">
        {charges.map((l, i) => (
          <div key={i} className="qb-row">
            <dt>{l.label}</dt>
            <dd>{fmtMoney(l.amount)}</dd>
          </div>
        ))}
        <div className="qb-row qb-sub">
          <dt>Subtotal</dt>
          <dd>{fmtMoney(quote.subtotal)}</dd>
        </div>
        {adjust.map((l, i) => (
          <div key={`a${i}`} className={`qb-row${l.amount < 0 ? ' qb-neg' : ''}`}>
            <dt>{l.label}</dt>
            <dd>{l.amount < 0 ? `−${fmtMoney(-l.amount)}` : fmtMoney(l.amount)}</dd>
          </div>
        ))}
      </dl>
      <div className="qb-total">
        <span>
          {rfq ? 'Indicative total' : 'Estimated total'}
          {quote.tax > 0 ? ' incl. VAT' : quote.border > 0 ? ' (VAT zero-rated export)' : ''}
        </span>
        <strong aria-live="polite">{fmtMoney(quote.total)}</strong>
      </div>
      {rfq && <p className="tiny muted qb-note">Firm quote requested — our freight desk confirms the final price before dispatch.</p>}
    </div>
  );
}
