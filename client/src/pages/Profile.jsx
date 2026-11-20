// Профайл: нэр, имэйл засах; нууц үг солих (хуучин сесс хүчингүй болно)
import { useState } from 'react';
import { api } from '../api';
import { has, useAuth } from '../auth';
import { ROLE_LABEL } from '../api';
import { Alert, Field, PasswordInput, PasswordMeter, useTitle, useToast } from '../components/ui';

export default function Profile() {
  useTitle('Профайл');
  const { user, refresh } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ fullName: user.full_name, email: user.email || '' });
  const [e1, setE1] = useState({}); const [m1, setM1] = useState('');
  const [p, setP] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [e2, setE2] = useState({}); const [m2, setM2] = useState(''); const [busy, setBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault(); setE1({}); setM1('');
    try { await api('/auth/profile', { method: 'PATCH', body: { fullName: f.fullName, email: f.email } }); await refresh(); toast('Профайл хадгалагдлаа.'); }
    catch (x) { setE1({ _: x.message, ...x.details }); }
  };
  const savePassword = async (e) => {
    e.preventDefault(); setE2({}); setM2('');
    if (p.newPassword !== p.again) return setE2({ again: 'Шинэ нууц үг таарахгүй байна.' });
    setBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: p.currentPassword, newPassword: p.newPassword } });
      setP({ currentPassword: '', newPassword: '', again: '' }); toast('Нууц үг солигдлоо. Бусад төхөөрөмж дээрх нэвтрэлт хаагдсан.');
    } catch (x) { setE2({ _: x.message, ...x.details }); } finally { setBusy(false); }
  };
  const initials = user.full_name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return <>
    <h1>Профайл</h1>
    <div className="grid half" style={{ alignItems: 'start' }}>
      <form className="card" onSubmit={saveProfile} noValidate>
        <div className="row" style={{ justifyContent: 'flex-start', marginBottom: 14 }}>
          <div className="avatar" aria-hidden>{initials}</div>
          <div><b>{user.full_name}</b><div className="muted">{user.roles.map(r => ROLE_LABEL[r.code]).join(', ')}{user.phone ? ` · ${user.phone}` : ''}</div></div>
        </div>
        <Alert>{e1._}</Alert><Alert kind="ok">{m1}</Alert>
        <Field label="Овог нэр" required error={e1.fullName}><input value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} autoComplete="name" /></Field>
        <Field label="Имэйл" error={e1.email} hint="Нэвтрэх нэрээр ашиглаж болно."><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
        {!has(user, 'admin') && <p className="muted">Утасны дугаар солих бол зохицуулагч эсвэл админд хандана уу.</p>}
        <button className="btn">Хадгалах</button>
      </form>
      <form className="card" onSubmit={savePassword} noValidate>
        <h2>Нууц үг солих</h2>
        <Alert>{e2._}</Alert><Alert kind="ok">{m2}</Alert>
        <Field label="Одоогийн нууц үг" required error={e2.currentPassword}><PasswordInput value={p.currentPassword} onChange={e => setP({ ...p, currentPassword: e.target.value })} autoComplete="current-password" invalid={!!e2.currentPassword} /></Field>
        <Field label="Шинэ нууц үг" required error={e2.newPassword} hint="8+ тэмдэгт, үсэг ба тоо агуулна.">
          <PasswordInput value={p.newPassword} onChange={e => setP({ ...p, newPassword: e.target.value })} autoComplete="new-password" invalid={!!e2.newPassword} /></Field>
        <PasswordMeter value={p.newPassword} />
        <div style={{ height: 10 }} />
        <Field label="Шинэ нууц үг (давтах)" required error={e2.again}><PasswordInput value={p.again} onChange={e => setP({ ...p, again: e.target.value })} autoComplete="new-password" invalid={!!e2.again} /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Солиж байна…' : 'Нууц үг солих'}</button>
      </form>
    </div></>;
}
