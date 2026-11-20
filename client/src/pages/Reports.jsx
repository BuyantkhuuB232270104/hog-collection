// 7.1 Гүйцэтгэлийн тайлан, 7.2 Хүсэлтийн тайлан, 7.3 шүүх, 7.4 CSV
import { useState } from 'react';
import { api, today } from '../api';
import { Alert, BarChart, Empty, Field, Skeleton, useLoad, useTitle } from '../components/ui';

export default function Reports() {
  useTitle('Тайлан');
  const [type, setType] = useState('performance');
  const [f, setF] = useState({ from: today(-30), to: today(7), zoneId: '' });
  const [zones] = useLoad(() => api('/zones'));
  const qs = `from=${f.from}&to=${f.to}${f.zoneId ? `&zoneId=${f.zoneId}` : ''}`;
  const [rep, err, , loading] = useLoad(() => api(`/reports/${type}?${qs}`), [type, qs]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const t = rep?.total || {};
  const kpis = type === 'performance'
    ? [['Нийт ажил', t.jobs], ['Дууссан', t.done], ['Гүйцэтгээгүй', t.not_done], ['Цагтаа дууссан', t.done ? `${Math.round((t.on_time / t.done) * 100)}%` : '—']]
    : [['Нийт хүсэлт', t.total], ['Хүлээгдэж буй', t.pending], ['Гүйцэтгэгдсэн', t.done], ['Утсаар ирсэн', t.by_phone]];
  return <>
    <div className="row"><h1>Тайлан</h1>
      <div className="seg">{[['performance', 'Гүйцэтгэл'], ['requests', 'Хүсэлт']].map(([v, l]) => <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>{l}</button>)}</div></div>
    <div className="card"><div className="inline">
      <Field label="Эхлэх"><input type="date" value={f.from} onChange={set('from')} /></Field>
      <Field label="Дуусах"><input type="date" value={f.to} onChange={set('to')} /></Field>
      <Field label="Бүс"><select value={f.zoneId} onChange={set('zoneId')}><option value="">Бүх бүс</option>{zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>
      <div className="field"><span className="lbl">&nbsp;</span><a className="btn sec" href={`/api/reports/${type}?${qs}&format=csv`}>CSV татах</a></div>
    </div></div>
    <Alert>{err?.message}</Alert>
    {loading && !rep && <Skeleton rows={4} />}
    {rep && <>
      <div className="kpis">{kpis.map(([l, v]) => <div className="kpi" key={l}><span className="muted">{l}</span><b>{v ?? 0}</b></div>)}</div>
      {rep.rows.length > 0 && <div className="card"><h2>{type === 'performance' ? 'Бүсээр: ажлын гүйцэтгэл' : 'Бүсээр: хүсэлт'}</h2>
        <BarChart items={rep.rows.map(r => ({ label: String(r[rep.keys[0]]), parts: type === 'performance'
          ? [{ name: 'Дууссан', value: Number(r.done) || 0, color: 'var(--green-t)' }, { name: 'Гүйцэтгээгүй', value: Number(r.not_done) || 0, color: 'var(--red)' }]
          : [{ name: 'Гүйцэтгэгдсэн', value: Number(r.done) || 0, color: 'var(--green-t)' }, { name: 'Хүлээгдэж буй', value: Number(r.pending) || 0, color: 'var(--amber)' }] }))}
          legend={type === 'performance' ? [{ name: 'Дууссан', color: 'var(--green-t)' }, { name: 'Гүйцэтгээгүй', color: 'var(--red)' }] : [{ name: 'Гүйцэтгэгдсэн', color: 'var(--green-t)' }, { name: 'Хүлээгдэж буй', color: 'var(--amber)' }]} /></div>}
      <div className="tablewrap">{!rep.rows.length ? <Empty>Сонгосон хугацаанд өгөгдөл олдсонгүй.</Empty> :
        <table><thead><tr>{rep.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rep.rows.map((r, i) => <tr key={i}>{rep.keys.map(k => <td key={k}>{r[k]}</td>)}</tr>)}
            <tr><td><b>Нийт</b></td>{rep.keys.slice(1).map(k => <td key={k}><b>{rep.total[k]}</b></td>)}</tr></tbody></table>}</div>
      <p className="muted">Тайланд хүний нэр, утас, хувийн хаяг харуулахгүй (NFR-10).</p>
    </>}
  </>;
}
