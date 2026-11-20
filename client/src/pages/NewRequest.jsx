// 3.1 Хүсэлт илгээх (+3.2 бүс, 3.3 дугаар, 3.4 зураг); staff=true бол 3.8 утсаар ирсэн хүсэлт бүртгэх
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, newKey, today } from '../api';
import { Alert, Field, useLoad } from '../components/ui';

const SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

export default function NewRequest({ staff = false }) {
  const nav = useNavigate();
  const [addresses] = useLoad(() => api('/addresses'));
  const [types] = useLoad(() => api('/waste-types'));
  const [q, setQ] = useState('');
  const [f, setF] = useState({ addressId: '', addressDetail: '', wasteTypeId: '', preferredDate: today(1), slot: '10:00-12:00', description: '', channel: 'phone', contactName: '', contactPhone: '' });
  const [file, setFile] = useState(null);
  const [key, setKey] = useState(newKey); // нэг маягтын илгээлт бүр нэг түлхүүртэй (BR-09)
  const [errs, setErrs] = useState({}); const [err, setErr] = useState(''); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const list = useMemo(() => (addresses || []).filter(a => !q || `${a.bag} ${a.street}`.toLowerCase().includes(q.toLowerCase())), [addresses, q]);
  const zone = addresses?.find(a => String(a.id) === String(f.addressId));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setErrs({});
    if (file && file.size > 5 * 1024 * 1024) return setErrs({ file: 'Зураг 5 МБ-аас ихгүй байна.' });
    setBusy(true);
    try {
      const [from, to] = f.slot.split('-');
      const body = { addressId: Number(f.addressId) || undefined, addressDetail: f.addressDetail || undefined, wasteTypeId: Number(f.wasteTypeId) || undefined,
        preferredDate: f.preferredDate || undefined, preferredFrom: from, preferredTo: to, description: f.description || undefined };
      if (staff) Object.assign(body, { channel: f.channel, contactName: f.contactName, contactPhone: f.contactPhone });
      const r = await api('/requests', { method: 'POST', body, headers: { 'Idempotency-Key': key } });
      if (file && !staff) { const fd = new FormData(); fd.append('file', file); await api(`/requests/${r.id}/attachments`, { method: 'POST', body: fd }); }
      setDone(r); setKey(newKey());
    } catch (x) { setErr(x.message); setErrs(x.details || {}); } finally { setBusy(false); }
  };

  if (done) return <div className="auth card">
    <Alert kind="ok">Хүсэлт амжилттай бүртгэгдлээ.</Alert>
    <h1 style={{ textAlign: 'center' }}>{done.request_no}</h1>
    <p className="muted" style={{ textAlign: 'center' }}>Төлөв: Илгээсэн. Зохицуулагч шалгаж, ачих хугацааг баталгаажуулна.</p>
    <div className="btns">{!staff && <button className="btn" onClick={() => nav(`/my/${done.id}`)}>Явцыг харах</button>}
      <button className="btn sec" onClick={() => { setDone(null); setFile(null); setF({ ...f, description: '', contactName: '', contactPhone: '' }); }}>Шинэ хүсэлт</button></div>
  </div>;

  return <div className="auth card" style={{ maxWidth: 560 }}>
    <h1>{staff ? 'Утсаар ирсэн хүсэлт бүртгэх' : 'Нэмэлт цуглуулалтын хүсэлт'}</h1>
    <form onSubmit={submit} noValidate>
      <Alert>{err}</Alert>
      {staff && <>
        <Field label="Эх суваг"><select value={f.channel} onChange={set('channel')}><option value="phone">Утсаар</option><option value="walkin">Биечлэн</option></select></Field>
        <div className="inline">
          <Field label="Холбоо барих хүн" required error={errs.contactName}><input value={f.contactName} onChange={set('contactName')} /></Field>
          <Field label="Утас" required error={errs.contactPhone}><input inputMode="numeric" maxLength={8} value={f.contactPhone} onChange={set('contactPhone')} /></Field>
        </div></>}
      <Field label="Хаяг хайх"><input placeholder="Баг, гудамж, байр…" value={q} onChange={e => setQ(e.target.value)} /></Field>
      <Field label="Хаяг" required error={errs.addressId}
        hint={zone ? `✓ Үйлчилгээний бүс: ${zone.zone_name}` : 'Жагсаалтад хаяг тань байхгүй бол үйлчилгээний бүсэд хамаарахгүй байж болно.'}>
        <select value={f.addressId} onChange={set('addressId')}><option value="">— сонгох —</option>
          {list.map(a => <option key={a.id} value={a.id}>{a.soum}, {a.bag}, {a.street}</option>)}</select>
      </Field>
      <Field label="Орц, тоот, нэмэлт тайлбар"><input value={f.addressDetail} onChange={set('addressDetail')} placeholder="3-р орц, 45 тоот" /></Field>
      <Field label="Хаягдлын төрөл" required error={errs.wasteTypeId}>
        <select value={f.wasteTypeId} onChange={set('wasteTypeId')}><option value="">— сонгох —</option>{types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </Field>
      <div className="inline">
        <Field label="Хүссэн өдөр" error={errs.preferredDate}><input type="date" min={today()} value={f.preferredDate} onChange={set('preferredDate')} /></Field>
        <Field label="Хүссэн цаг"><select value={f.slot} onChange={set('slot')}>{SLOTS.map(s => <option key={s} value={s}>{s.replace('-', ' – ')}</option>)}</select></Field>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>Хүссэн хугацаа баталгаат хуваарь биш; зохицуулагч ачих интервалыг баталгаажуулна.</p>
      <Field label="Тайлбар" error={errs.description}><textarea value={f.description} onChange={set('description')} placeholder="Юу, хэр хэмжээтэй вэ? Жишээ нь: хуучин тавилга 3 ширхэг" /></Field>
      {!staff && <Field label="Зураг (заавал биш)" error={errs.file}>
        <div className="photo"><input type="file" accept="image/jpeg,image/png" onChange={e => setFile(e.target.files[0] || null)} aria-label="Зураг сонгох" />
          <div>JPG/PNG, ≤ 5 МБ. Хүний нүүр, бусдын мэдээлэл оруулахгүй байна уу.</div></div></Field>}
      <button className="btn block" disabled={busy}>{busy ? 'Илгээж байна…' : 'Хүсэлт илгээх'}</button>
    </form>
  </div>;
}
