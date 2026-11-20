// 3.5 Хүсэлтийн явц харах
import { Link } from 'react-router-dom';
import { api, fmtDT, fmtTime, fmtDate } from '../api';
import { Alert, Empty, Pill, Skeleton, useLoad, useTitle } from '../components/ui';

export default function MyRequests() {
  useTitle('Миний хүсэлтүүд');
  const [rows, err, , loading] = useLoad(() => api('/requests/mine'));
  return <>
    <div className="row"><h1>Миний хүсэлтүүд</h1><Link className="btn" to="/new">+ Шинэ хүсэлт</Link></div>
    <Alert>{err?.message}</Alert>
    {loading && !rows && <Skeleton rows={4} h={70} />}
    {rows && !rows.length && <Empty title="Одоогоор хүсэлт алга" action={<Link className="btn" to="/new">Анхны хүсэлтээ илгээх</Link>} />}
    <div className="grid half">
      {rows?.map(r => <Link key={r.id} to={`/my/${r.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row"><b>{r.request_no}</b><Pill status={r.status}>{r.status_label}</Pill></div>
        <div className="muted">{r.waste_type} · {r.zone_name}</div>
        <div className="muted">{r.street}</div>
        {r.planned_from && ['ASSIGNED'].includes(r.status) && <div style={{ marginTop: 6 }}>Ачих хугацаа: <b>{fmtDate(r.planned_from)} {fmtTime(r.planned_from)}–{fmtTime(r.planned_to)}</b></div>}
        <div className="muted" style={{ marginTop: 6 }}>Илгээсэн: {fmtDT(r.created_at)}</div>
      </Link>)}
    </div>
  </>;
}
