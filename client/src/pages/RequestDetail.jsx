// 3.5 явц, 3.6 цуцлах, 3.7 нэмэлт мэдээлэл нөхөх, 4.2 гомдол гаргах
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtDT, fmtDate, fmtTime } from '../api';
import { Alert, Field, Pill, Skeleton, useConfirm, useLoad, useTitle, useToast } from '../components/ui';

export default function RequestDetail() {
  const { id } = useParams();
  const [r, err, reload] = useLoad(() => api(`/requests/${id}`), [id]);
  const confirm = useConfirm(); const toast = useToast(); useTitle('Хүсэлт');
  const [msg, setMsg] = useState(''); const [e2, setE2] = useState('');
  const [info, setInfo] = useState(''); const [complaint, setComplaint] = useState('');
  const act = async (fn, ok) => { setE2(''); setMsg(''); try { await fn(); setMsg(ok); toast(ok); reload(); } catch (x) { setE2(x.message); } };
  if (err) return <Alert>{err.message}</Alert>;
  if (!r) return err ? <Alert>{err.message}</Alert> : <div className="card"><Skeleton rows={5} /></div>;
  return <div className="grid two">
    <div className="card">
      <div className="row"><h1 style={{ margin: 0 }}>{r.request_no}</h1><Pill status={r.status}>{r.status_label}</Pill></div>
      <Alert kind="ok">{msg}</Alert><Alert>{e2}</Alert>
      <dl className="kv">
        <dt>Хаяг</dt><dd>{r.soum}, {r.bag}, {r.street}{r.address_detail ? `, ${r.address_detail}` : ''}</dd>
        <dt>Бүс</dt><dd>{r.zone_name}</dd>
        <dt>Хаягдлын төрөл</dt><dd>{r.waste_type}</dd>
        <dt>Хүссэн хугацаа</dt><dd>{r.preferred_from ? `${fmtDate(r.preferred_from)} ${fmtTime(r.preferred_from)}–${fmtTime(r.preferred_to)}` : '—'}</dd>
        <dt>Ачих хугацаа</dt><dd>{r.planned_from && r.job_status !== 'CANCELLED' ? <b>{fmtDate(r.planned_from)} {fmtTime(r.planned_from)}–{fmtTime(r.planned_to)}</b> : 'Товлогдоогүй'}</dd>
        <dt>Тайлбар</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.description || '—'}</dd>
        {r.job_reason && <><dt>Шалтгаан</dt><dd>{r.job_reason}</dd></>}
      </dl>
      {r.attachments?.length > 0 && <div className="btns" style={{ marginTop: 10 }}>{r.attachments.map(a => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${a.id}`} alt="Хавсаргасан зураг" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div>}
      {r.status === 'NEED_INFO' && <div style={{ marginTop: 12 }}>
        <Field label="Нэмэлт мэдээлэл"><textarea value={info} onChange={e => setInfo(e.target.value)} /></Field>
        <button className="btn" onClick={() => act(() => api(`/requests/${id}/info`, { method: 'POST', body: { description: info } }), 'Мэдээлэл илгээгдлээ.')}>Илгээх</button></div>}
      {r.can_cancel && <button className="btn danger" style={{ marginTop: 12 }} onClick={async () => (await confirm({ message: 'Хүсэлтийг цуцлах уу?', danger: true, ok: 'Цуцлах', cancel: 'Үгүй' })) && act(() => api(`/requests/${id}/cancel`, { method: 'POST' }), 'Хүсэлт цуцлагдлаа.')}>Хүсэлт цуцлах</button>}
      {r.can_complain && <div style={{ marginTop: 12 }}>
        <Field label="Гомдол гаргах" hint="Үр дүн бүртгэгдсэнээс хойш 7 хоногийн дотор."><textarea value={complaint} onChange={e => setComplaint(e.target.value)} /></Field>
        <button className="btn sec" onClick={() => act(() => api('/complaints', { method: 'POST', body: { requestId: Number(id), body: complaint } }), 'Гомдол бүртгэгдлээ.')}>Гомдол илгээх</button></div>}
    </div>
    <div className="card"><h2>Явц</h2>
      <ul className="timeline">{r.history.map((h, i) => <li key={i}><div><b>{h.new_label}</b><div className="muted">{fmtDT(h.changed_at)}{h.reason ? ` · ${h.reason}` : ''}</div></div></li>)}</ul>
      <Link to="/my" className="muted">← Бүх хүсэлт</Link>
    </div>
  </div>;
}
