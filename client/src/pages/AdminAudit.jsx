// Аюулгүй байдлын аудит бүртгэл (зөвхөн админ): нэвтрэлт, нууц үг, админы үйлдлүүд
import { useState } from 'react';
import { api, fmtDT } from '../api';
import { Alert, Empty, Field, Skeleton, useLoad, useTitle } from '../components/ui';

const LABEL = { LOGIN_OK: 'Нэвтэрсэн', LOGIN_FAIL: 'Нэвтрэлт амжилтгүй', LOGIN_LOCKED: 'Түр хаагдсан', PASSWORD_CHANGE: 'Нууц үг солисон', PASSWORD_RESET: 'Нууц үг сэргээсэн (админ)',
  PROFILE_UPDATE: 'Профайл засасан', USER_CREATE: 'Ажилтан нэмсэн', USER_VERIFY: 'ААН баталгаажуулсан', USER_STATUS: 'Төлөв өөрчилсөн', ROLE_ASSIGN: 'Үүрэг оноосон',
  ROLE_REVOKE: 'Үүрэг хассан', LOOKUP_CREATE: 'Лавлах нэмсэн', LOOKUP_UPDATE: 'Лавлах засасан', SCHEDULE_PUBLISH: 'Хуваарь нийтэлсэн' };
const BAD = new Set(['LOGIN_FAIL', 'LOGIN_LOCKED']);

export default function AdminAudit() {
  useTitle('Аудит');
  const [action, setAction] = useState('');
  const [rows, err, , loading] = useLoad(() => api(`/admin/audit?limit=200${action ? `&action=${action}` : ''}`), [action]);
  return <>
    <h1>Аудит бүртгэл</h1>
    <p className="muted" style={{ marginTop: -8 }}>Сүүлийн 200 үйлдэл. Нууц үг, токен хэзээ ч бүртгэгддэггүй.</p>
    <div style={{ maxWidth: 320 }}><Field label="Үйлдлээр шүүх"><select value={action} onChange={e => setAction(e.target.value)}>
      <option value="">Бүгд</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></div>
    <Alert>{err?.message}</Alert>
    <div className="tablewrap">{loading ? <div style={{ padding: 12 }}><Skeleton rows={5} /></div> : rows && !rows.length ? <Empty title="Бүртгэл алга" /> :
      <table><thead><tr><th>Огноо</th><th>Хэрэглэгч</th><th>Үйлдэл</th><th>Дэлгэрэнгүй</th><th>IP</th></tr></thead>
        <tbody>{rows?.map(r => <tr key={r.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtDT(r.at)}</td><td>{r.user_name || '—'}</td>
          <td><span className={`pill p-${BAD.has(r.action) ? 'red' : 'grey'}`}>{LABEL[r.action] || r.action}</span></td>
          <td>{[r.entity, r.entity_id, r.detail].filter(Boolean).join(' · ')}</td><td className="muted">{r.ip}</td></tr>)}</tbody></table>}</div>
  </>;
}
