// 1.6 ААН баталгаажуулах, 1.7 ажилтны эрх оноох (+1.9 байгууллагын хүрээ), 1.12 идэвхгүй болгох
import { useState } from 'react';
import { api, ROLE_LABEL } from '../api';
import { Alert, Field, Pill, useLoad } from '../components/ui';

export default function AdminUsers() {
  const [users, err, reload] = useLoad(() => api('/admin/users'));
  const [orgs] = useLoad(() => api('/admin/lookups/organizations'));
  const [f, setF] = useState({ fullName: '', phone: '', email: '', password: '', role: 'driver', organizationId: '' });
  const [msg, setMsg] = useState(''); const [e2, setE2] = useState(''); const [errs, setErrs] = useState({});
  const run = async (fn, ok) => { setMsg(''); setE2(''); setErrs({}); try { await fn(); setMsg(ok); reload(); } catch (x) { setE2(x.message); setErrs(x.details || {}); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const collectors = orgs?.filter(o => o.type === 'collector') || [];
  return <>
    <h1>Хэрэглэгч ба эрх</h1>
    <Alert kind="ok">{msg}</Alert><Alert>{e2 || err?.message}</Alert>
    <div className="stack">
      <div className="tablewrap"><table><thead><tr><th>Нэр</th><th>Холбоо барих</th><th>Үүрэг</th><th>Төлөв</th><th></th></tr></thead>
        <tbody>{users?.map(u => <tr key={u.id}><td>{u.full_name}</td><td>{u.phone}<div className="muted">{u.email}</div></td>
          <td>{u.roles.map(r => <div key={r.id}>{ROLE_LABEL[r.code]}{r.organization ? <span className="muted"> · {r.organization}</span> : ''}</div>)}</td>
          <td><Pill status={u.status === 'active' ? 'DONE' : u.status === 'pending' ? 'NEED_INFO' : 'CANCELLED'}>{{ active: 'Идэвхтэй', pending: 'Баталгаажаагүй', disabled: 'Идэвхгүй' }[u.status]}</Pill></td>
          <td><div className="btns">{u.status === 'pending' && <button className="btn sm" onClick={() => run(() => api(`/admin/users/${u.id}/verify`, { method: 'POST' }), 'ААН баталгаажлаа.')}>Баталгаажуулах</button>}
            {u.status === 'active' && !u.roles.some(r => r.code === 'admin') && <button className="btn danger sm" onClick={() => run(() => api(`/admin/users/${u.id}/status`, { method: 'POST', body: { status: 'disabled' } }), 'Идэвхгүй боллоо.')}>Идэвхгүй</button>}
            {u.status === 'disabled' && <button className="btn sec sm" onClick={() => run(() => api(`/admin/users/${u.id}/status`, { method: 'POST', body: { status: 'active' } }), 'Идэвхжлээ.')}>Идэвхжүүлэх</button>}</div></td></tr>)}</tbody></table></div>
      <div className="card" style={{ maxWidth: 640 }}><h2>Ажилтан нэмэх</h2>
        <Field label="Овог нэр" required error={errs.fullName}><input value={f.fullName} onChange={set('fullName')} /></Field>
        <div className="inline"><Field label="Утас" required error={errs.phone}><input value={f.phone} onChange={set('phone')} maxLength={8} /></Field>
          <Field label="Имэйл" error={errs.email}><input value={f.email} onChange={set('email')} /></Field></div>
        <Field label="Түр нууц үг" required error={errs.password}><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <div className="inline"><Field label="Үүрэг"><select value={f.role} onChange={set('role')}>{['coordinator', 'driver', 'manager', 'admin'].map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
          {f.role !== 'admin' && <Field label="Байгууллагын хүрээ" required><select value={f.organizationId} onChange={set('organizationId')}><option value="">— сонгох —</option>{collectors.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>}</div>
        <button className="btn" onClick={() => run(() => api('/admin/users', { method: 'POST', body: { ...f, email: f.email || undefined, organizationId: f.organizationId ? Number(f.organizationId) : undefined } }), 'Ажилтан нэмэгдлээ.')}>Нэмэх</button>
      </div>
    </div>
  </>;
}
