import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { deepMerge, normalizeTenant } from '../../tenant/merge';
import { DEFAULT_TENANT_ID, PRESETS } from '../../tenant/presets';
import type { TenantConfig } from '../../tenant/types';
import { dataMode } from '../../lib/data';
import { downloadText, errMsg, fmtDateTime, Section, useUi } from '../ui';
import { useDraft, type TabProps } from './draft';

function validateImport(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'File is not a JSON object.';
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return 'Missing "id".';
  if (typeof o.name !== 'string' || !o.name) return 'Missing "name".';
  if (!o.theme || typeof o.theme !== 'object') return 'Missing "theme" object.';
  const th = o.theme as Record<string, unknown>;
  if (typeof th.primary !== 'string') return 'theme.primary is missing.';
  return null;
}

export default function AdvancedTab({ draft }: TabProps) {
  const { replace, saved } = useDraft();
  const { toast, confirm } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<string>(PRESETS[draft.id] ? draft.id : DEFAULT_TENANT_ID);

  const exportJson = () => {
    downloadText(`${draft.id}-site-config.json`, JSON.stringify(draft, null, 2), 'application/json');
    toast('Config exported');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text()) as unknown;
      const problem = validateImport(raw);
      if (problem) {
        toast(`Import failed: ${problem}`, 'err');
        return;
      }
      const cfg = raw as TenantConfig;
      const ok = await confirm({
        title: `Import “${cfg.name}”?`,
        body: (
          <>
            This replaces the current draft. {cfg.id !== draft.id ? <>The file’s id “{cfg.id}” will be changed to “{draft.id}”. </> : null}
            Nothing is published until you click Save &amp; publish.
          </>
        ),
        confirmLabel: 'Import',
      });
      if (!ok) return;
      const base = PRESETS[draft.id] ?? PRESETS[DEFAULT_TENANT_ID];
      replace(normalizeTenant({ ...deepMerge(base, cfg), id: draft.id }));
      toast('Imported into draft — review and publish', 'info');
    } catch (e) {
      toast(`Import failed: ${e instanceof SyntaxError ? 'invalid JSON' : errMsg(e)}`, 'err');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    const p = PRESETS[preset];
    if (!p) return;
    const ok = await confirm({
      title: `Reset draft to “${p.name}” preset?`,
      body: 'All content, branding and settings in the draft are replaced by the preset. Site id and domains are kept. Nothing is published until you Save & publish.',
      confirmLabel: 'Reset draft',
      danger: true,
    });
    if (!ok) return;
    replace({ ...JSON.parse(JSON.stringify(p)), id: draft.id, domains: draft.domains, updatedAt: draft.updatedAt });
    toast('Draft reset to preset', 'info');
  };

  return (
    <>
      <Section title="Site info">
        <dl className="adm-dl">
          <div className="adm-dl-row">
            <dt>Site id</dt>
            <dd className="mono">{draft.id}</dd>
          </div>
          <div className="adm-dl-row">
            <dt>Domains</dt>
            <dd>{draft.domains.length ? draft.domains.join(', ') : <span className="muted">None (use ?site={draft.id})</span>}</dd>
          </div>
          <div className="adm-dl-row">
            <dt>Last published</dt>
            <dd>{saved.updatedAt ? fmtDateTime(saved.updatedAt) : 'Never (bundled preset)'}</dd>
          </div>
          <div className="adm-dl-row">
            <dt>Storage</dt>
            <dd>{dataMode === 'firebase' ? <>Firestore <span className="mono">tenants/{draft.id}</span></> : 'Browser localStorage (demo)'}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Export / import" desc="Back up a site or copy configuration between sites.">
        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportJson}>
            <Icon name="download" size={16} /> Download JSON
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Import JSON…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Imports must contain <code className="mono">id</code>, <code className="mono">name</code> and <code className="mono">theme</code>. Missing fields are filled from the preset.
        </p>
      </Section>

      <Section title="Reset to preset" desc="Start over from a bundled template.">
        <div className="row">
          <select className="select" style={{ maxWidth: 280 }} aria-label="Preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.values(PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void reset()}>
            Reset draft
          </button>
        </div>
      </Section>
    </>
  );
}
