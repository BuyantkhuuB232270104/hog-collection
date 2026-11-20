// 4.4 Гомдлын жагсаалт, 4.5 төлөв өөрчлөх
import { api, fmtDT } from '../api';
import { Alert, Empty, Pill, useLoad } from '../components/ui';

export default function Complaints() {
  const [rows, err, reload] = useLoad(() => api('/complaints'));
  const set = async (id, status) => { await api(`/complaints/${id}`, { method: 'PATCH', body: { status } }); reload(); };
  return <><h1>Гомдол</h1><Alert>{err?.message}</Alert>
    <div className="tablewrap">{rows && !rows.length ? <Empty>Гомдол алга.</Empty> :
      <table><thead><tr><th>Огноо</th><th>Хүсэлт</th><th>Гүйцэтгэгч</th><th>Гомдол</th><th>Төлөв</th></tr></thead>
        <tbody>{rows?.map(c => <tr key={c.id}><td>{fmtDT(c.created_at)}</td><td>{c.request_no}<div className="muted">{c.zone_name}</div></td><td>{c.assignee}</td>
          <td style={{ maxWidth: 360 }}>{c.body}</td>
          <td><Pill status={c.status}>{c.status_label}</Pill><div style={{ marginTop: 6 }}><select value={c.status} onChange={e => set(c.id, e.target.value)} aria-label="Төлөв өөрчлөх">
            <option value="OPEN">Шинэ</option><option value="IN_REVIEW">Шалгаж байна</option><option value="RESOLVED">Шийдвэрлэсэн</option></select></div></td></tr>)}</tbody></table>}</div></>;
}
