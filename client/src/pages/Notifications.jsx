// 4.1, 4.6 Мэдэгдэл харах
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDT } from '../api';
import { useAuth, has } from '../auth';
import { Empty, useLoad } from '../components/ui';

export default function Notifications() {
  const { user, refresh } = useAuth();
  const [rows] = useLoad(() => api('/notifications'));
  useEffect(() => { if (rows?.some(n => !n.is_read)) api('/notifications/read', { method: 'POST' }).then(refresh); }, [rows]); // eslint-disable-line
  const target = (n) => (has(user, 'citizen', 'business') && n.request_id ? `/my/${n.request_id}` : null);
  return <><h1>Мэдэгдэл</h1><div className="card">
    {rows && !rows.length && <Empty>Мэдэгдэл алга.</Empty>}
    {rows?.map(n => <div key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`}>
      {target(n) ? <Link to={target(n)}>{n.message}</Link> : n.message}<div className="muted">{fmtDT(n.created_at)}</div></div>)}
  </div></>;
}
