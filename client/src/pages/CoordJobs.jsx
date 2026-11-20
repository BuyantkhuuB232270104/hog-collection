// Өдрийн ажлын хуваарь: 5.8 дахин хуваарилах, 5.9 хойшлуулах, 5.10 цуцлах
import { useState } from 'react';
import { api, fmtTime, today } from '../api';
import { Alert, Empty, Field, Pill, useLoad } from '../components/ui';

function Change({ job, date, onDone, onClose }) {
  const [f, setF] = useState({ action: 'reassign', reason: '', date, timeFrom: fmtTime(job.planned_from), timeTo: fmtTime(job.planned_to), assigneeId: String(job.assignee_id) });
  const [drivers] = useLoad(() => api(`/drivers?date=${f.date}`), [f.date]);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setErr(null);
    try { await api(`/jobs/${job.id}`, { method: 'PATCH', body: { ...f, assigneeId: Number(f.assigneeId), reason: f.reason || undefined } }); onDone(); }
    catch (x) { setErr(x); }
  };
  return <tr><td colSpan={6} style={{ background: '#fafbfc' }}>
    <div className="inline">
      <Field label="Үйлдэл"><select value={f.action} onChange={set('action')}><option value="reassign">Дахин хуваарилах</option><option value="postpone">Хойшлуулах</option><option value="cancel">Цуцлах</option></select></Field>
      {f.action === 'reassign' && <>
        <Field label="Огноо"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Эхлэх"><input type="time" value={f.timeFrom} onChange={set('timeFrom')} /></Field>
        <Field label="Дуусах"><input type="time" value={f.timeTo} onChange={set('timeTo')} /></Field>
        <Field label="Гүйцэтгэгч"><select value={f.assigneeId} onChange={set('assigneeId')}>{drivers?.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></Field></>}
    </div>
    <Field label="Шалтгаан" required><input value={f.reason} onChange={set('reason')} /></Field>
    {err && <Alert kind={err.code === 'OVERLAP' ? 'warn' : 'error'}>{err.message}</Alert>}
    <div className="btns"><button className="btn sm" onClick={submit}>Хадгалах</button><button className="btn sec sm" onClick={onClose}>Болих</button></div>
  </td></tr>;
}

export default function CoordJobs() {
  const [date, setDate] = useState(today()); const [open, setOpen] = useState(null); const [msg, setMsg] = useState('');
  const [rows, err, reload] = useLoad(() => api(`/jobs?date=${date}`), [date]);
  return <>
    <div className="row"><h1>Ажлын хуваарь</h1><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} aria-label="Огноо" /></div>
    <Alert>{err?.message}</Alert><Alert kind="ok">{msg}</Alert>
    <div className="tablewrap">{rows && !rows.length ? <Empty>Энэ өдөр ажил алга.</Empty> :
      <table><thead><tr><th>Интервал</th><th>Хүсэлт</th><th>Хаяг</th><th>Гүйцэтгэгч</th><th>Төлөв</th><th></th></tr></thead>
        <tbody>{rows?.map(j => [<tr key={j.id}>
          <td><b>{fmtTime(j.planned_from)}–{fmtTime(j.planned_to)}</b></td><td>{j.request_no}</td><td>{j.zone_name}<div className="muted">{j.street}</div></td>
          <td>{j.assignee}</td><td><Pill status={j.status}>{j.status_label}</Pill>{j.reason && <div className="muted">{j.reason}</div>}</td>
          <td>{['PLANNED', 'POSTPONED', 'NOT_DONE'].includes(j.status) && <button className="btn sec sm" onClick={() => setOpen(open === j.id ? null : j.id)}>Өөрчлөх</button>}</td></tr>,
          open === j.id && <Change key={'c' + j.id} job={j} date={date} onClose={() => setOpen(null)} onDone={() => { setOpen(null); setMsg('Ажил шинэчлэгдлээ.'); reload(); }} />])}</tbody></table>}</div>
  </>;
}
