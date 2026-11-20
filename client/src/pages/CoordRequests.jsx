// 5.1 Шинэ хүсэлт шалгах, 5.2–5.4 шийдвэр, 5.5 Ажил хуваарилах (+5.6 давхцал, 5.7 мэдэгдэл)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDT, fmtDate, fmtTime, today } from '../api';
import { Alert, Empty, Field, Kpi, Pill, SearchBox, Skeleton, useConfirm, useDebounced, useLoad, useTitle, useToast } from '../components/ui';

const FILTERS = [['SUBMITTED', 'Шинэ'], ['NEED_INFO', 'Мэдээлэл хүлээж буй'], ['APPROVED,NOT_DONE', 'Хуваарилах'], ['ASSIGNED', 'Оноогдсон'], ['DONE,REJECTED,CANCELLED', 'Хаагдсан']];

function Assign({ r, onDone }) {
  const [f, setF] = useState({ date: r.preferred_from ? fmtDate(r.preferred_from) : today(1), timeFrom: r.preferred_from ? fmtTime(r.preferred_from) : '10:00', timeTo: r.preferred_to ? fmtTime(r.preferred_to) : '12:00', assigneeId: '' });
  const [drivers] = useLoad(() => api(`/drivers?date=${f.date}`), [f.date]);
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (r.job_id && r.status === 'NOT_DONE') await api(`/jobs/${r.job_id}`, { method: 'PATCH', body: { action: 'reassign', reason: 'Гүйцэтгэгдээгүй ажлыг дахин товлосон', ...f, assigneeId: Number(f.assigneeId) } });
      else await api('/jobs', { method: 'POST', body: { requestId: r.id, ...f, assigneeId: Number(f.assigneeId) } });
      onDone('Ажил хуваарилагдлаа.');
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return <div style={{ marginTop: 12 }}><h2>{r.status === 'NOT_DONE' ? 'Дахин хуваарилах' : 'Ажил хуваарилах'}</h2>
    <div className="inline">
      <Field label="Огноо"><input type="date" min={today()} value={f.date} onChange={set('date')} /></Field>
      <Field label="Эхлэх"><input type="time" value={f.timeFrom} onChange={set('timeFrom')} /></Field>
      <Field label="Дуусах"><input type="time" value={f.timeTo} onChange={set('timeTo')} /></Field>
    </div>
    <Field label="Гүйцэтгэгч" required><select value={f.assigneeId} onChange={set('assigneeId')}><option value="">— сонгох —</option>
      {drivers?.map(d => <option key={d.id} value={d.id}>{d.full_name} · тухайн өдөр {d.jobs_that_day} ажилтай</option>)}</select></Field>
    {err && <Alert kind={err.code === 'OVERLAP' ? 'warn' : 'error'}>⚠ {err.message}</Alert>}
    <button className="btn" disabled={busy || !f.assigneeId} onClick={submit}>Хуваарилах</button>
  </div>;
}

function Detail({ id, onChanged }) {
  const [r, err, reload] = useLoad(() => api(`/requests/${id}`), [id]);
  const [reason, setReason] = useState(''); const [msg, setMsg] = useState(''); const [e2, setE2] = useState('');
  useEffect(() => { setMsg(''); setE2(''); setReason(''); }, [id]);
  const confirm = useConfirm(); const toast = useToast();
  const decide = async (decision) => {
    if (decision === 'reject' && !(await confirm('Хүсэлтээс татгалзах уу?', { danger: true, ok: 'Татгалзах' }))) return;
    setE2(''); try { await api(`/requests/${id}/decision`, { method: 'PATCH', body: { decision, reason: reason || undefined } }); setMsg('Шийдвэр бүртгэгдлээ.'); toast('Шийдвэр бүртгэгдлээ.'); reload(); onChanged(); } catch (x) { setE2(x.message); }
  };
  if (err) return <Alert>{err.message}</Alert>;
  if (!r) return null;
  return <div className="card">
    <div className="row"><h2 style={{ margin: 0 }}>{r.request_no}</h2><Pill status={r.status}>{r.status_label}</Pill></div>
    <Alert kind="ok">{msg}</Alert><Alert>{e2}</Alert>
    <dl className="kv" style={{ marginTop: 8 }}>
      <dt>Хаяг</dt><dd>{r.bag}, {r.street}{r.address_detail ? `, ${r.address_detail}` : ''}</dd>
      <dt>Бүс</dt><dd>{r.zone_name}</dd><dt>Төрөл</dt><dd>{r.waste_type}</dd>
      <dt>Хүссэн</dt><dd>{r.preferred_from ? `${fmtDate(r.preferred_from)} ${fmtTime(r.preferred_from)}–${fmtTime(r.preferred_to)}` : '—'}</dd>
      <dt>Суваг</dt><dd>{r.channel === 'web' ? 'Веб' : r.channel === 'phone' ? 'Утас' : 'Биечлэн'}{r.contact_name ? ` · ${r.contact_name}, ${r.contact_phone}` : ''}</dd>
      <dt>Тайлбар</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.description || '—'}</dd>
      {r.planned_from && <><dt>Товлосон</dt><dd>{fmtDate(r.planned_from)} {fmtTime(r.planned_from)}–{fmtTime(r.planned_to)}</dd></>}
      {r.job_reason && <><dt>Шалтгаан</dt><dd>{r.job_reason}</dd></>}
    </dl>
    {r.attachments?.length > 0 && <div className="btns" style={{ marginTop: 8 }}>{r.attachments.map(a => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${a.id}`} alt="Хавсаргасан зураг" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div>}
    {r.status === 'SUBMITTED' && <div style={{ marginTop: 12 }}>
      <Field label="Шалтгаан / асуулт" hint="Татгалзах, нэмэлт мэдээлэл шаардахад заавал."><textarea value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <div className="btns"><button className="btn" onClick={() => decide('approve')}>Батлах</button>
        <button className="btn sec" onClick={() => decide('need_info')}>Мэдээлэл шаардах</button>
        <button className="btn danger" onClick={() => decide('reject')}>Татгалзах</button></div></div>}
    {['APPROVED', 'NOT_DONE'].includes(r.status) && <Assign r={r} onDone={(m) => { setMsg(m); reload(); onChanged(); }} />}
    <h2 style={{ marginTop: 14 }}>Явц</h2>
    <ul className="timeline">{r.history.map((h, i) => <li key={i}><div><b>{h.new_label}</b><div className="muted">{fmtDT(h.changed_at)}{h.reason ? ` · ${h.reason}` : ''}</div></div></li>)}</ul>
  </div>;
}

export default function CoordRequests() {
  const [filter, setFilter] = useState(FILTERS[0][0]); const [sel, setSel] = useState(null);
  const [qtext, setQ] = useState(''); const dq = useDebounced(qtext, 300);
  useTitle('Хүсэлтүүд');
  const [rows, err, reload, loading] = useLoad(() => api(`/requests?status=${filter}${dq.trim() ? `&q=${encodeURIComponent(dq.trim())}` : ''}`), [filter, dq]);
  const [sum, , reloadSum] = useLoad(() => api(`/dashboard?today=${today()}`));
  const changed = () => { reload(); reloadSum(); };
  const pick = (f) => () => { setFilter(f); setSel(null); };
  return <>
    <div className="row"><h1>Хүсэлтүүд</h1><Link className="btn sec" to="/coordinator/phone">+ Утсаар ирсэн хүсэлт</Link></div>
 {sum && <div className="kpis">
      <button className="kpi warn" onClick={pick('SUBMITTED')}><span>Шинэ хүсэлт</span><b>{sum.requests.new}</b></button>
      <button className="kpi" onClick={pick('APPROVED,NOT_DONE')}><span>Хуваарилах</span><b>{sum.requests.toAssign}</b></button>
      <Kpi label="Өнөөдрийн ажил" value={sum.today.planned + sum.today.started} />
      <Kpi label="Өнөөдөр дууссан" value={sum.today.done} tone="good" />
      <Kpi label="Нээлттэй гомдол" value={sum.openComplaints} tone={sum.openComplaints ? 'bad' : ''} />
    </div>}
    <div style={{ maxWidth: 360, marginBottom: 10 }}><SearchBox value={qtext} onChange={setQ} placeholder="Дугаар, гудамж, хороо хайх…" /></div>
    <div className="seg" role="tablist" style={{ marginBottom: 12, flexWrap: 'wrap' }}>{FILTERS.map(([v, l]) => <button key={v} className={filter === v ? 'on' : ''} onClick={() => { setFilter(v); setSel(null); }}>{l}</button>)}</div>
    <Alert>{err?.message}</Alert>
    <div className="grid two">
      <div className="tablewrap">{loading && !rows ? <div style={{ padding: 12 }}><Skeleton rows={5} /></div> : rows && !rows.length ? <Empty title="Хүсэлт алга" /> :
        <table><thead><tr><th>Дугаар</th><th>Бүс</th><th>Төрөл</th><th>Хүссэн</th><th>Суваг</th><th>Төлөв</th></tr></thead>
          <tbody>{rows?.map(r => <tr key={r.id} className={`click ${sel === r.id ? 'sel' : ''}`} onClick={() => setSel(r.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSel(r.id)}>
            <td><b>{r.request_no}</b></td><td>{r.zone_name}</td><td>{r.waste_type}</td>
            <td>{r.preferred_from ? `${fmtDate(r.preferred_from).slice(5)} ${fmtTime(r.preferred_from)}` : '—'}</td>
            <td>{r.channel === 'web' ? 'Веб' : 'Утас'}</td><td><Pill status={r.status}>{r.status_label}</Pill></td></tr>)}</tbody></table>}</div>
      <div>{sel ? <Detail id={sel} onChanged={changed} /> : <div className="card"><Empty>Жагсаалтаас хүсэлт сонгоно уу.</Empty></div>}</div>
    </div>
  </>;
}
