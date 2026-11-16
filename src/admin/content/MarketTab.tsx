import { COUNTRIES, countryInfo, type CountryCode } from '../../geo';
import { applyMarket, bookableTownCount, COUNTRY_OPTIONS } from '../market';
import { Section, SelectField, useUi } from '../ui';
import type { TabProps } from './draft';

/** Home market: country, currency, VAT default, languages and regions all follow from this. */
export default function MarketTab({ draft, update }: TabProps) {
  const { confirm } = useUi();
  const ci = countryInfo(draft.locale.country);

  const change = async (code: CountryCode) => {
    if (code === draft.locale.country) return;
    const next = COUNTRIES[code];
    const ok = await confirm({
      title: `Switch this site to ${next.name}?`,
      body: `Currency becomes ${next.currency}, VAT defaults to ${next.defaultTaxPct}%, service areas reset to all ${next.regions.length} ${next.regionLabel.toLowerCase()}s, languages reset, and logistics rates reset to ${next.name} defaults. Fleet and service prices are NOT converted — review them after switching.`,
      confirmLabel: `Switch to ${next.name}`,
    });
    if (ok) update((d) => applyMarket(d, code));
  };

  return (
    <>
      <Section title="Home market" desc="Sets currency, phone format, VAT default, time zone and the towns customers can book.">
        <div className="form-grid">
          <SelectField<CountryCode> label="Country" value={draft.locale.country} options={COUNTRY_OPTIONS} onChange={(v) => void change(v)} />
          <div className="field">
            <span className="label">Currency</span>
            <div className="input" aria-readonly style={{ display: 'flex', alignItems: 'center' }}>
              {ci.currency} ({ci.currencySymbol})
            </div>
          </div>
        </div>
        <dl className="adm-kv" style={{ marginTop: 16 }}>
          <dt>Time zone</dt>
          <dd>{ci.timeZone}</dd>
          <dt>Phone format</dt>
          <dd>
            +{ci.dialCode} · e.g. {ci.phonePlaceholder}
          </dd>
          <dt>{ci.regionLabel}s served</dt>
          <dd>
            {draft.serviceAreas.length} of {ci.regions.length} · {bookableTownCount(ci.code, draft.serviceAreas)} bookable towns
          </dd>
          <dt>VAT on quotes</dt>
          <dd>{draft.booking.taxPct}% (Booking settings)</dd>
        </dl>
      </Section>
    </>
  );
}
