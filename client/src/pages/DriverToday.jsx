// 6.1 Өнөөдрийн ажил, 6.2 эхлүүлэх, 6.3 дууссан, 6.4–6.5 гүйцэтгээгүй + шалтгаан, 6.7 дэлгэрэнгүй
import { useState } from 'react';
import { api, fmtTime, today } from '../api';
import { Alert, Empty, Field, Pill, useLoad } from '../components/ui';

function JobCard({ j, reasons, onChange }) {
  const [mode, setMode] = useState(null); const [reason, setReason] = useState(''); const [other, setOther] = useState(''); const [err, setErr] = useState('');
  const send = async (result) => {
    setErr('');
    try { await api(`/jobs/${j.id}/status`, { method: 'PATCH', body: { result, reason: result === 'not_done' ? (reason === 'Бусад' ? `Бусад: ${other}` : reason) : undefined } }); onChange(); }
    catch (x) { setErr(x.message); }
  };
  return <div className="card jobcard">
    <div className="row"><b>{fmtTime(j.planned_from)}–{fmtTime(j.planned_to)}</b><Pill status={j.status}>{j.status_label}</Pill></div>
    <div style={{ margin: '6px 0' }}>{j.bag}, {j.street}{j.address_detail ? `, ${j.address_detail}` : ''}</div>
    <div className="muted">{j.waste_type} · {j.request_no}</div>
    {j.description && <div className="muted">“{j.description}”</div>}
    <div className="muted">Холбоо барих: {j.contact_name}, <a href={`tel:${j.contact_phone}`}>{j.contact_phone}</a></div>
    {j.reason && <div className="muted">Шалтгаан: {j.reason}</div>}
    <Alert>{err}</Alert>
    {j.status === 'PLANNED' && <button className="btn block" style={{ marginTop: 10 }} onClick={() => send('start')}>Эхлүүлэх</button>}
    {j.status === 'STARTED' && mode !== 'nd' && <div className="acts"><button className="btn" onClick={() => send('done')}>✓ Дууссан</button><button className="btn danger" onClick={() => setMode('nd')}>Гүйцэтгээгүй</button></div>}
    {mode === 'nd' && j.status === 'STARTED' && <div style={{ marginTop: 10 }}>
      <Field label="Шалтгаан" required><select value={reason} onChange={e => setReason(e.target.value)}><option value="">— сонгох —</option>{reasons.map(r => <option key={r}>{r}</option>)}</select></Field>
      {reason === 'Бусад' && <Field label="Тайлбар"><input value={other} onChange={e => setOther(e.target.value)} /></Field>}
      <div className="acts"><button className="btn danger" disabled={!reason} onClick={() => send('not_done')}>Бүртгэх</button><button className="btn sec" onClick={() => setMode(null)}>Болих</button></div></div>}
  </div>;
}

export default function DriverToday() {
  const [date, setDate] = useState(today());
  const [rows, err, reload] = useLoad(() => api(`/jobs/today?date=${date}`), [date]);
  const [meta] = useLoad(() => api('/meta'));
  return <div style={{ maxWidth: 560, margin: '0 auto' }}>
    <div className="row"><h1>Өнөөдрийн ажил</h1><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} aria-label="Огноо" /></div>
    <Alert>{err?.message}</Alert>
    {rows && !rows.length && <Empty>Энэ өдөр танд оноосон ажил алга.</Empty>}
    {rows?.map(j => <JobCard key={j.id} j={j} reasons={meta?.notDoneReasons || []} onChange={reload} />)}
  </div>;
}
