// 2.1 Бүсийн хуваарь нийтлэх (+2.2 хувилбар, хүчинтэй хугацаа, 2.3 өөрчлөлтийн тайлбар)
import { useEffect, useState } from 'react';
import { api, today, WEEKDAYS } from '../api';
import { Alert, Field, useLoad } from '../components/ui';

export default function CoordSchedule() {
  const [zones] = useLoad(() => api('/zones'));
  const [zoneId, setZoneId] = useState('');
  useEffect(() => { if (!zoneId && zones?.length) setZoneId(String(zones[0].id)); }, [zones, zoneId]);
  const [cur, , reload] = useLoad(() => (zoneId ? api(`/zones/${zoneId}/schedule`) : Promise.resolve(null)), [zoneId]);
  const [validFrom, setValidFrom] = useState(today(1)); const [note, setNote] = useState('');
  const [slots, setSlots] = useState([{ weekday: 1, timeFrom: '08:00', timeTo: '12:00' }]);
  useEffect(() => { if (cur?.slots?.length) setSlots(cur.slots.map(s => ({ weekday: s.weekday, timeFrom: s.time_from, timeTo: s.time_to }))); }, [cur]);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const upd = (i, k, v) => setSlots(slots.map((s, j) => (j === i ? { ...s, [k]: k === 'weekday' ? Number(v) : v } : s)));
  const publish = async () => {
    setErr(''); setMsg('');
    try { const r = await api('/schedules', { method: 'POST', body: { zoneId: Number(zoneId), validFrom, note: note || undefined, slots } }); setMsg(`Хувилбар ${r.version} нийтлэгдлээ (${r.validFrom}-ээс).`); reload(); }
    catch (x) { setErr(x.message); }
  };
  return <>
    <h1>Бүсийн хуваарь нийтлэх</h1>
    <div className="grid two">
      <div className="card">
        <Field label="Үйлчилгээний бүс"><select value={zoneId} onChange={e => setZoneId(e.target.value)}>{zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>
        <Alert kind="ok">{msg}</Alert><Alert>{err}</Alert>
        {slots.map((s, i) => <div className="inline" key={i}>
          <Field label="Гараг"><select value={s.weekday} onChange={e => upd(i, 'weekday', e.target.value)}>{WEEKDAYS.slice(1).map((w, k) => <option key={k} value={k + 1}>{w}</option>)}</select></Field>
          <Field label="Эхлэх"><input type="time" value={s.timeFrom} onChange={e => upd(i, 'timeFrom', e.target.value)} /></Field>
          <Field label="Дуусах"><input type="time" value={s.timeTo} onChange={e => upd(i, 'timeTo', e.target.value)} /></Field>
          <div className="field"><span className="lbl">&nbsp;</span><button className="btn danger sm" onClick={() => setSlots(slots.filter((_, j) => j !== i))} disabled={slots.length === 1}>Хасах</button></div>
        </div>)}
        <button className="btn sec sm" onClick={() => setSlots([...slots, { weekday: 1, timeFrom: '08:00', timeTo: '12:00' }])}>+ Өдөр нэмэх</button>
        <div className="inline" style={{ marginTop: 12 }}><Field label="Хүчинтэй эхлэх огноо" required><input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></Field></div>
        <Field label="Өөрчлөлтийн тайлбар" hint="Иргэдэд харагдана. Жишээ: баярын өдрийн шилжилт."><textarea value={note} onChange={e => setNote(e.target.value)} /></Field>
        <Alert kind="warn">Сум, дүүргийн Засаг даргаар батлагдсан хуваарийг л нийтэлнэ (Хог хаягдлын тухай хууль, 14.4).</Alert>
        <button className="btn" onClick={publish}>Шинэ хувилбар нийтлэх</button>
      </div>
      <div className="card"><h2>Одоо хүчинтэй</h2>
        {cur?.version ? <><span className="pill p-green">Хувилбар {cur.version}</span> <span className="muted">{cur.validFrom} – {cur.validTo || 'цаашид'}</span>
          {cur.slots.map((s, i) => <div className="day" key={i}><div className="dot">{WEEKDAYS[s.weekday].slice(0, 3).toUpperCase()}</div><div><b>{WEEKDAYS[s.weekday]}</b><div className="muted">{s.time_from} – {s.time_to}</div></div></div>)}</>
          : <p className="muted">Хуваарь алга.</p>}
      </div>
    </div>
  </>;
}
