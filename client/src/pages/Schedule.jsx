// 2.4–2.6 Тогтмол хуваарь харах — нэвтрэлгүйгээр (FR-09)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, WEEKDAYS } from '../api';
import { useAuth, has } from '../auth';
import { Alert, Empty, Field, useLoad } from '../components/ui';

export default function Schedule() {
  const { user } = useAuth();
  const [zones] = useLoad(() => api('/zones'));
  const [zoneId, setZoneId] = useState(() => localStorage.getItem('zone') || '');
  useEffect(() => { if (!zoneId && zones?.length) setZoneId(String(zones[0].id)); }, [zones, zoneId]);
  const [sch, err] = useLoad(() => (zoneId ? api(`/zones/${zoneId}/schedule`) : Promise.resolve(null)), [zoneId]);
  const pick = (v) => { setZoneId(v); try { localStorage.setItem('zone', v); } catch { /* хувийн цонх */ } };
  return <>
    <h1>Тогтмол хуваарь</h1>
    <div className="grid two">
      <div>
        <Field label="Үйлчилгээний бүс">
          <select value={zoneId} onChange={e => pick(e.target.value)} aria-label="Үйлчилгээний бүс">
            {zones?.map(z => <option key={z.id} value={z.id}>{z.soum} — {z.name}</option>)}
          </select>
        </Field>
        <Alert>{err?.message}</Alert>
        {sch && <div className="card">
          <div className="row"><h2>Хүчинтэй хуваарь</h2>{sch.version && <span className="pill p-green">Хувилбар {sch.version}</span>}</div>
          {sch.version ? <>
            <div className="muted">{sch.validFrom} – {sch.validTo || 'цаашид'} · {sch.zone.bag}</div>
            {sch.slots.map((s, i) => <div className="day" key={i}><div className="dot">{WEEKDAYS[s.weekday].slice(0, 3).toUpperCase()}</div>
              <div><b>{WEEKDAYS[s.weekday]}</b><div className="muted">{s.time_from} – {s.time_to}</div></div></div>)}
            {sch.note && <Alert kind="warn"><b>Тайлбар:</b> {sch.note}</Alert>}
          </> : <Empty>Энэ бүсэд хуваарь нийтлэгдээгүй байна.</Empty>}
        </div>}
      </div>
      <div className="card">
        <h2>Тогтмол хуваарьт багтахгүй хог байна уу?</h2>
        <p className="muted">Том оврын ахуйн хог, барилгын жижиг хог зэрэг нэмэлт цуглуулалтыг цахимаар хүсэж, явцыг нь дугаараар хянаарай.
          Интернэт ашигладаггүй бол хог тээврийн байгууллагад утсаар хандахад зохицуулагч бүртгэнэ.</p>
        {has(user, 'citizen', 'business') ? <Link className="btn block" to="/new">+ Нэмэлт цуглуулалт хүсэх</Link>
          : !user ? <div className="btns"><Link className="btn" to="/login">Нэвтрэх</Link><Link className="btn sec" to="/register">Бүртгүүлэх</Link></div> : null}
      </div>
    </div>
  </>;
}
