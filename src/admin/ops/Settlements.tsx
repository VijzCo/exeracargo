// Transporter settlements: statement of delivered hired jobs → draft → approved → paid.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { deleteSettlement, newId, saveSettlement } from '../../ops/store';
import { RATE_BASIS_LABEL, type Job, type JobFinance, type Settlement, type SettlementLine, type SettlementStatus, type Transporter } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { downloadText, EmptyState, errMsg, Field, Modal, PageHeader, useUi } from '../ui';
import { effectiveCost, VAT_ZA } from './cost';
import { useFinance, useJobs, useOpsUser, useSettlements, useToday, useTransporters } from './hooks';
import { addDays, csv, DONE, fmtTs, fmtYmd } from './lib';
import { LoadingRows } from './widgets';
import './ops-admin.css';

const STATUS_LABEL: Record<SettlementStatus, string> = { draft: 'Draft', approved: 'Approved', paid: 'Paid' };
const STATUS_LVL: Record<SettlementStatus, string> = { draft: 'ops-lvl-none', approved: 'ops-lvl-warn', paid: 'ops-lvl-ok' };
const r2 = (n: number) => Math.round(n * 100) / 100;

function podOk(j: Job): boolean {
  if (j.stops?.length) return j.stops.filter((s) => s.kind === 'delivery').every((s) => !!s.pod);
  return !!j.pod;
}
const route = (j: Job) => `${j.pickup.place} → ${j.dropoff.place}${j.stops && j.stops.length > 2 ? ` (${j.stops.length} stops)` : ''}`;

/** Delivered hired jobs of a transporter in a period whose cost isn't on a statement yet. */
function openLines(t: Transporter, jobs: Job[], fin: Map<string, JobFinance>, from: string, to: string, keep: Set<string> = new Set()): SettlementLine[] {
  const out: SettlementLine[] = [];
  for (const j of jobs) {
    if (j.transporterId !== t.id || !DONE.includes(j.status) || j.scheduledDate < from || j.scheduledDate > to) continue;
    const f = fin.get(j.id);
    const c = effectiveCost(f?.cost, j);
    if (!c || (f?.settlementId && !keep.has(j.id))) continue;
    // the cost must have been agreed with THIS transporter (job may have been re-assigned since)
    if (c.transporterId && c.transporterId !== t.id) continue;
    out.push({ jobId: j.id, ref: j.ref, date: j.scheduledDate, route: route(j), vehicleReg: j.vehicleReg, basis: c.basis, qty: c.qty, amount: c.total, vatRate: c.vatRate, podOk: podOk(j) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function totals(lines: SettlementLine[], vatRate: number) {
  const subtotal = r2(lines.reduce((a, l) => a + l.amount, 0));
  // VAT as agreed on each job's cost; the transporter's current status only for older lines
  const vat = r2(lines.reduce((a, l) => a + l.amount * (l.vatRate ?? vatRate), 0));
  return { subtotal, vat, total: r2(subtotal + vat) };
}

export default function Settlements() {
  useOpsUser();
  const { fmtMoney } = useTenant();
  const [params, setParams] = useSearchParams();
  const { data: list, loading } = useSettlements();
  const { data: transporters } = useTransporters();
  const [statusF, setStatusF] = useState<SettlementStatus | 'all'>('all');
  const [trF, setTrF] = useState('');
  const open = params.get('open');
  const setOpen = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('open', v);
    else next.delete('open');
    setParams(next, { replace: true });
  };
  const rows = list.filter((s) => (statusF === 'all' || s.status === statusF) && (!trF || s.transporterId === trF));
  const selected = open && open !== 'new' ? list.find((s) => s.id === open) ?? null : null;
  const owed = list.filter((s) => s.status === 'approved').reduce((a, s) => a + s.total, 0);

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Settlements"
        subtitle={loading ? 'Loading…' : `${list.length} statement${list.length === 1 ? '' : 's'} · ${fmtMoney(owed)} approved, not yet paid`}
        actions={
          <>
            <Link to="/admin/transporters" className="btn btn-ghost btn-sm">
              <Icon name="truck" size={16} /> Transporters
            </Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('new')} disabled={!transporters.length}>
              <Icon name="plus" size={16} /> New statement
            </button>
          </>
        }
      />
      <div className="card ops-filters ops-filters-2">
        <label className="field">
          <span className="label">Transporter</span>
          <select className="select" value={trF} onChange={(e) => setTrF(e.target.value)}>
            <option value="">All</option>
            {transporters.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select className="select" value={statusF} onChange={(e) => setStatusF(e.target.value as SettlementStatus | 'all')}>
            <option value="all">All</option>
            {(Object.keys(STATUS_LABEL) as SettlementStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="tag" title={list.length ? 'No statements match' : 'No statements yet'}>
            {list.length ? 'Change the filters.' : 'Create a statement per transporter and period from delivered hired jobs — approve it, then mark it paid.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table adm-table-click">
            <thead>
              <tr>
                <th>Statement</th>
                <th>Transporter</th>
                <th className="adm-hide-sm">Period</th>
                <th className="adm-num adm-hide-sm">Jobs</th>
                <th className="adm-num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => setOpen(s.id)}>
                  <td>
                    <button
                      type="button"
                      className="adm-link mono adm-row-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(s.id);
                      }}
                    >
                      {s.ref}
                    </button>
                    {s.invoiceNo ? <div className="muted tiny">Inv {s.invoiceNo}</div> : null}
                  </td>
                  <td className="small">{s.transporterName}</td>
                  <td className="adm-hide-sm small">
                    {fmtYmd(s.from)} – {fmtYmd(s.to)}
                  </td>
                  <td className="adm-num adm-hide-sm">{s.lines.length}</td>
                  <td className="adm-num">{fmtMoney(s.total)}</td>
                  <td>
                    <span className={`ops-chip ${STATUS_LVL[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    {s.paidAt ? <div className="muted tiny">{fmtTs(s.paidAt)}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open === 'new' ? <NewStatement onClose={() => setOpen(null)} onCreated={(id) => setOpen(id)} /> : selected ? <StatementDrawer key={selected.id} st={selected} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function NewStatement({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { tenant, fmtMoney, country } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast } = useUi();
  const { data: transporters } = useTransporters();
  const { data: jobs } = useJobs(400);
  const { data: fin } = useFinance();
  const [trId, setTrId] = useState('');
  const first = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(`${addDays(first, -1).slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const t = transporters.find((x) => x.id === trId);
  const lines = useMemo(() => (t ? openLines(t, jobs, fin, from, to) : []), [t, jobs, fin, from, to]);
  const missingCost = useMemo(() => (t ? jobs.filter((j) => j.transporterId === t.id && DONE.includes(j.status) && j.scheduledDate >= from && j.scheduledDate <= to && !fin.get(j.id)?.cost) : []), [t, jobs, fin, from, to]);
  const chosen = lines.filter((l) => !skip.has(l.jobId));
  const vatRate = t?.vatRegistered ? (country.code === 'ZA' ? VAT_ZA : 0.18) : 0;
  const tot = totals(chosen, vatRate);

  const create = async () => {
    if (!t || !chosen.length) return;
    setBusy(true);
    try {
      const now = Date.now();
      const st: Settlement = {
        id: newId(),
        ref: newId('STL'),
        transporterId: t.id,
        transporterName: t.name,
        from,
        to,
        lines: chosen,
        ...tot,
        currency: tenant.locale.currency,
        status: 'draft',
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await saveSettlement(tenant.id, st);
      toast(`${st.ref} created`);
      onCreated(st.id);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title="New settlement statement"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !chosen.length} onClick={() => void create()}>
            {busy ? 'Creating…' : `Create draft (${chosen.length})`}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label="Transporter *" span>
            <select className="select" value={trId} onChange={(e) => setTrId(e.target.value)} data-autofocus>
              <option value="">— Choose —</option>
              {transporters.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
        </div>
        {!t ? (
          <p className="muted small">Pick a transporter to see delivered hired jobs that aren’t on a statement yet.</p>
        ) : (
          <>
            {missingCost.length ? (
              <div className="alert alert-warn small">
                {missingCost.length} delivered job{missingCost.length === 1 ? '' : 's'} without a buy cost: {missingCost.slice(0, 6).map((j) => j.ref).join(', ')}
                {missingCost.length > 6 ? '…' : ''} — add the cost on the job first.
              </div>
            ) : null}
            {lines.length === 0 ? (
              <p className="muted small">Nothing to settle for {t.name} in this period.</p>
            ) : (
              <LinesTable lines={lines} skip={skip} onToggle={(id) => setSkip((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))} />
            )}
            <Totals {...tot} vatRate={vatRate} fmt={fmtMoney} />
          </>
        )}
      </div>
    </Modal>
  );
}

function LinesTable({ lines, skip, onToggle, locked }: { lines: SettlementLine[]; skip?: Set<string>; onToggle?: (id: string) => void; locked?: boolean }) {
  const { fmtMoney } = useTenant();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {onToggle ? <th className="ops-pickcol">Incl.</th> : null}
            <th>Job</th>
            <th className="adm-hide-sm">Route</th>
            <th className="adm-hide-sm">Basis</th>
            <th>POD</th>
            <th className="adm-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.jobId}>
              {onToggle ? (
                <td className="ops-pickcol">
                  <input type="checkbox" checked={!skip?.has(l.jobId)} disabled={locked} onChange={() => onToggle(l.jobId)} aria-label={`Include ${l.ref}`} />
                </td>
              ) : null}
              <td>
                <Link className="adm-link mono small" to={`/admin/jobs/${encodeURIComponent(l.jobId)}`}>
                  {l.ref}
                </Link>
                <div className="muted tiny">
                  {l.date}
                  {l.vehicleReg ? ` · ${l.vehicleReg}` : ''}
                </div>
              </td>
              <td className="adm-hide-sm small">{l.route}</td>
              <td className="adm-hide-sm small">
                {l.qty} × {RATE_BASIS_LABEL[l.basis].replace('per ', '')}
              </td>
              <td>{l.podOk ? <span className="ops-chip ops-lvl-ok">POD</span> : <span className="ops-chip ops-lvl-err">No POD</span>}</td>
              <td className="adm-num">{fmtMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ subtotal, vat, total, vatRate, fmt }: { subtotal: number; vat: number; total: number; vatRate: number; fmt: (n: number) => string }) {
  return (
    <div className="ops-costsum ops-costsum-3">
      <div>
        <span className="muted small">Subtotal</span>
        <strong>{fmt(subtotal)}</strong>
      </div>
      <div>
        <span className="muted small">VAT {vatRate ? `${Math.round(vatRate * 100)}%` : '(not registered)'}</span>
        <strong>{fmt(vat)}</strong>
      </div>
      <div>
        <span className="muted small">Total payable</span>
        <strong>{fmt(total)}</strong>
      </div>
    </div>
  );
}

function StatementDrawer({ st, onClose }: { st: Settlement; onClose: () => void }) {
  const { tenant, fmtMoney, country } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast, confirm } = useUi();
  const { data: transporters } = useTransporters();
  const { data: jobs } = useJobs(400);
  const { data: fin } = useFinance();
  const t = transporters.find((x) => x.id === st.transporterId);
  const [invoiceNo, setInvoiceNo] = useState(st.invoiceNo ?? '');
  const [notes, setNotes] = useState(st.notes ?? '');
  const [payRef, setPayRef] = useState(st.paymentRef ?? '');
  const [payDate, setPayDate] = useState(today);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const paid = st.status === 'paid';
  const vatRate = st.subtotal > 0 ? r2(st.vat / st.subtotal) : t?.vatRegistered ? (country.code === 'ZA' ? VAT_ZA : 0.18) : 0;
  // draft: refresh amounts from the jobs (ODO-based km may have changed) and offer new delivered jobs
  const fresh = useMemo(() => (st.status === 'draft' && t ? openLines(t, jobs, fin, st.from, st.to, new Set(st.lines.map((l) => l.jobId))) : st.lines), [st, t, jobs, fin]);
  const lines = st.status === 'draft' ? fresh : st.lines;
  const chosen = lines.filter((l) => !skip.has(l.jobId));
  const tot = st.status === 'draft' ? totals(chosen, vatRate) : { subtotal: st.subtotal, vat: st.vat, total: st.total };
  const noPod = chosen.filter((l) => !l.podOk).length;

  const persist = async (patch: Partial<Settlement>, msg: string) => {
    setBusy(true);
    try {
      const release = st.lines.map((l) => l.jobId).filter((id) => !chosen.some((l) => l.jobId === id));
      const next: Settlement = { ...st, ...(st.status === 'draft' ? { lines: chosen, ...tot } : {}), invoiceNo: invoiceNo.trim() || undefined, notes: notes.trim() || undefined, ...patch };
      await saveSettlement(tenant.id, next, st.status === 'draft' ? release : []);
      setSkip(new Set());
      toast(msg);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (noPod && !(await confirm({ title: `Approve with ${noPod} job(s) missing POD?`, body: 'Proof of delivery is missing on some lines. Approve anyway?', confirmLabel: 'Approve' }))) return;
    await persist({ status: 'approved', approvedBy: user.name, approvedAt: Date.now() }, `${st.ref} approved`);
  };
  const markPaid = async () => {
    if (payRef.trim().length < 2) return toast('Enter the payment reference', 'err');
    await persist({ status: 'paid', paidAt: Date.parse(`${payDate}T12:00:00`), paymentRef: payRef.trim() }, `${st.ref} marked paid`);
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${st.ref}?`, body: 'The jobs become available for a new statement.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteSettlement(tenant.id, st);
      toast(`${st.ref} deleted`);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const exportCsv = () => {
    const rows: (string | number | undefined)[][] = [
      ['Statement', st.ref, 'Transporter', st.transporterName, 'Period', `${st.from} to ${st.to}`, 'Status', STATUS_LABEL[st.status], 'Invoice', st.invoiceNo],
      [],
      ['Job', 'Date', 'Route', 'Vehicle', 'Basis', 'Qty', 'POD', `Amount (${st.currency})`],
      ...lines.map((l) => [l.ref, l.date, l.route, l.vehicleReg, RATE_BASIS_LABEL[l.basis], l.qty, l.podOk ? 'yes' : 'no', l.amount]),
      [],
      ['', '', '', '', '', '', 'Subtotal', tot.subtotal],
      ['', '', '', '', '', '', 'VAT', tot.vat],
      ['', '', '', '', '', '', 'Total', tot.total],
    ];
    downloadText(`${st.ref}-${st.transporterName.replace(/\W+/g, '-')}.csv`, csv(rows), 'text/csv');
  };

  const print = () => {
    const esc = (x: unknown) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups to print', 'err');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(st.ref)}</title><style>
      body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}td.n,th.n{text-align:right}.muted{color:#666}.tot td{border:0;font-weight:600}
      .grid{display:flex;gap:40px;margin-top:12px}@media print{button{display:none}}</style></head><body>
      <h1>Settlement statement ${esc(st.ref)}</h1><div class="muted">${esc(tenant.name)} · ${esc(STATUS_LABEL[st.status])}${st.paidAt ? ` · paid ${esc(new Date(st.paidAt).toLocaleDateString())} (${esc(st.paymentRef)})` : ''}</div>
      <div class="grid"><div><strong>${esc(st.transporterName)}</strong><br>${esc(t?.contactName)} · ${esc(t?.phone)}<br>${t?.vatNo ? `VAT ${esc(t.vatNo)}<br>` : ''}${t?.bank ? `${esc(t.bank.bank)} · ${esc(t.bank.accountName)} · ${esc(t.bank.accountNo)}${t.bank.branchCode ? ` · ${esc(t.bank.branchCode)}` : ''}` : ''}</div>
      <div>Period: ${esc(st.from)} – ${esc(st.to)}<br>Transporter invoice: ${esc(st.invoiceNo || '—')}<br>Terms: ${esc(t?.paymentTermsDays ?? '—')} days</div></div>
      <table><thead><tr><th>Job</th><th>Date</th><th>Route</th><th>Vehicle</th><th>Basis</th><th>POD</th><th class="n">Amount</th></tr></thead><tbody>
      ${lines.map((l) => `<tr><td>${esc(l.ref)}</td><td>${esc(l.date)}</td><td>${esc(l.route)}</td><td>${esc(l.vehicleReg)}</td><td>${esc(l.qty)} ${esc(RATE_BASIS_LABEL[l.basis])}</td><td>${l.podOk ? '✓' : '✗'}</td><td class="n">${esc(fmtMoney(l.amount))}</td></tr>`).join('')}
      <tr class="tot"><td colspan="6" class="n">Subtotal</td><td class="n">${esc(fmtMoney(tot.subtotal))}</td></tr>
      <tr class="tot"><td colspan="6" class="n">VAT</td><td class="n">${esc(fmtMoney(tot.vat))}</td></tr>
      <tr class="tot"><td colspan="6" class="n">Total payable</td><td class="n">${esc(fmtMoney(tot.total))}</td></tr></tbody></table>
      ${st.notes ? `<p class="muted">${esc(st.notes)}</p>` : ''}<p><button onclick="print()">Print</button></p></body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={
        <span className="row" style={{ gap: 10 }}>
          <span className="mono">{st.ref}</span> <span className={`ops-chip ${STATUS_LVL[st.status]}`}>{STATUS_LABEL[st.status]}</span>
        </span>
      }
      footer={
        <>
          {!paid ? (
            <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => void remove()} style={{ marginRight: 'auto' }}>
              <Icon name="trash" size={16} /> Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
            <Icon name="download" size={16} /> CSV
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={print}>
            Print
          </button>
          {st.status === 'draft' ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void persist({}, `${st.ref} saved`)}>
                Save draft
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !chosen.length} onClick={() => void approve()}>
                Approve
              </button>
            </>
          ) : st.status === 'approved' ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void persist({ status: 'draft', approvedAt: undefined, approvedBy: undefined }, `${st.ref} back to draft`)}>
                Back to draft
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void markPaid()}>
                Mark paid
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className="stack">
        <dl className="adm-dl">
          <div className="adm-dl-row">
            <dt>Transporter</dt>
            <dd>
              <Link className="adm-link" to={`/admin/transporters?open=${encodeURIComponent(st.transporterId)}`}>
                {st.transporterName}
              </Link>
              {t?.paymentTermsDays ? <span className="muted"> · {t.paymentTermsDays}-day terms</span> : null}
            </dd>
          </div>
          <div className="adm-dl-row">
            <dt>Period</dt>
            <dd>
              {fmtYmd(st.from)} – {fmtYmd(st.to)}
            </dd>
          </div>
          {st.approvedAt ? (
            <div className="adm-dl-row">
              <dt>Approved</dt>
              <dd>
                {fmtTs(st.approvedAt)} · {st.approvedBy}
              </dd>
            </div>
          ) : null}
          {st.paidAt ? (
            <div className="adm-dl-row">
              <dt>Paid</dt>
              <dd>
                {fmtTs(st.paidAt)} · ref <span className="mono">{st.paymentRef}</span>
              </dd>
            </div>
          ) : null}
          {t?.bank ? (
            <div className="adm-dl-row">
              <dt>Bank</dt>
              <dd className="small">
                {t.bank.bank} · {t.bank.accountName} · <span className="mono">{t.bank.accountNo}</span>
                {t.bank.branchCode ? ` · ${t.bank.branchCode}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
        {noPod ? <div className="alert alert-warn small">{noPod} line(s) without proof of delivery.</div> : null}
        <LinesTable lines={lines} skip={st.status === 'draft' ? skip : undefined} onToggle={st.status === 'draft' ? (id) => setSkip((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id]))) : undefined} />
        <Totals {...tot} vatRate={vatRate} fmt={fmtMoney} />
        <div className="form-grid">
          <Field label="Transporter invoice no.">
            <input className="input mono" value={invoiceNo} maxLength={40} disabled={paid} onChange={(e) => setInvoiceNo(e.target.value)} />
          </Field>
          {st.status === 'approved' ? (
            <>
              <Field label="Payment date">
                <input className="input" type="date" value={payDate} onChange={(e) => e.target.value && setPayDate(e.target.value)} />
              </Field>
              <Field label="Payment reference *">
                <input className="input mono" value={payRef} maxLength={60} placeholder="EFT ref" onChange={(e) => setPayRef(e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="Notes" span>
            <textarea className="textarea" rows={2} maxLength={500} value={notes} disabled={paid} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {st.status === 'approved' ? (
          <div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void persist({}, 'Saved')}>
              Save invoice no. & notes
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
