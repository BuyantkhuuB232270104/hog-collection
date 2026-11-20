// 1.8 Лавлах удирдах: 1.10 нэмэх, 1.11 засах, 1.12 идэвхгүй болгох
import { useState } from 'react';
import { api } from '../api';
import { Alert, useLoad } from '../components/ui';

const DEFS = {
  service_zones: { title: 'Үйлчилгээний бүс', cols: [['name', 'Нэр'], ['soum', 'Сум'], ['bag', 'Баг'], ['organization_id', 'Байгууллага', 'org']] },
  addresses: { title: 'Хаяг', cols: [['soum', 'Сум'], ['bag', 'Баг'], ['street', 'Гудамж, байр'], ['zone_id', 'Бүс', 'zone']] },
  waste_types: { title: 'Хаягдлын төрөл', cols: [['name', 'Нэр'], ['active', 'Идэвхтэй', 'bool']] },
  organizations: { title: 'Байгууллага', cols: [['name', 'Нэр'], ['type', 'Төрөл', 'type'], ['active', 'Идэвхтэй', 'bool']] },
};
export default function AdminLookups() {
  const [tab, setTab] = useState('service_zones'); const def = DEFS[tab];
  const [rows, err, reload] = useLoad(() => api(`/admin/lookups/${tab}`), [tab]);
  const [orgs] = useLoad(() => api('/admin/lookups/organizations'));
  const [zones] = useLoad(() => api('/admin/lookups/service_zones'));
  const [edit, setEdit] = useState({}); const [neu, setNeu] = useState({}); const [e2, setE2] = useState('');
  const input = (col, val, on) => {
    const [k, , kind] = col;
    if (kind === 'bool') return <input type="checkbox" checked={!!val} onChange={e => on(k, e.target.checked)} style={{ width: 'auto' }} />;
    if (kind === 'org') return <select value={val || ''} onChange={e => on(k, Number(e.target.value))}><option value="">—</option>{orgs?.filter(o => o.type === 'collector').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>;
    if (kind === 'zone') return <select value={val || ''} onChange={e => on(k, Number(e.target.value))}><option value="">—</option>{zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>;
    if (kind === 'type') return <select value={val || 'collector'} onChange={e => on(k, e.target.value)}><option value="collector">Хог тээвэр</option><option value="business">ААН</option><option value="government">Төрийн</option></select>;
    return <input value={val ?? ''} onChange={e => on(k, e.target.value)} />;
  };
  const show = (col, v) => col[2] === 'bool' ? (v ? 'Тийм' : 'Үгүй') : col[2] === 'org' ? orgs?.find(o => o.id === v)?.name : col[2] === 'zone' ? zones?.find(z => z.id === v)?.name : v;
  const save = async (id) => { setE2(''); try { await api(`/admin/lookups/${tab}/${id}`, { method: 'PATCH', body: edit[id] }); setEdit({}); reload(); } catch (x) { setE2(x.message); } };
  const add = async () => { setE2(''); try { await api(`/admin/lookups/${tab}`, { method: 'POST', body: neu }); setNeu({}); reload(); } catch (x) { setE2(x.message); } };
  return <>
    <h1>Лавлах мэдээлэл</h1>
    <div className="seg" style={{ marginBottom: 12, flexWrap: 'wrap' }}>{Object.entries(DEFS).map(([k, d]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setEdit({}); setNeu({}); }}>{d.title}</button>)}</div>
    <Alert>{e2 || err?.message}</Alert>
    <div className="tablewrap"><table><thead><tr>{def.cols.map(c => <th key={c[0]}>{c[1]}</th>)}<th></th></tr></thead>
      <tbody>{rows?.map(r => <tr key={r.id}>{def.cols.map(c => <td key={c[0]}>{edit[r.id] ? input(c, edit[r.id][c[0]], (k, v) => setEdit({ [r.id]: { ...edit[r.id], [k]: v } })) : show(c, r[c[0]])}</td>)}
        <td><div className="btns">{edit[r.id] ? <><button className="btn sm" onClick={() => save(r.id)}>Хадгалах</button><button className="btn sec sm" onClick={() => setEdit({})}>Болих</button></>
          : <button className="btn sec sm" onClick={() => setEdit({ [r.id]: Object.fromEntries(def.cols.map(c => [c[0], r[c[0]]])) })}>Засах</button>}</div></td></tr>)}
        <tr>{def.cols.map(c => <td key={c[0]}>{input(c, neu[c[0]], (k, v) => setNeu({ ...neu, [k]: v }))}</td>)}<td><button className="btn sm" onClick={add}>+ Нэмэх</button></td></tr>
      </tbody></table></div>
  </>;
}
