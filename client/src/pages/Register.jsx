// 1.1 Бүртгүүлэх, 1.2 зөвшөөрөл (BR-01), 1.3 байгууллагын мэдээлэл (FR-02)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Field, PasswordInput, PasswordMeter, useTitle } from '../components/ui';

export default function Register() {
  const nav = useNavigate(); const { login } = useAuth();
  useTitle('Бүртгүүлэх');
  const [f, setF] = useState({ accountType: 'citizen', fullName: '', phone: '', email: '', password: '', organizationName: '', consent: false });
  const [errs, setErrs] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setErrs({}); setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: { ...f, organizationName: f.accountType === 'business' ? f.organizationName : undefined } });
      await login(f.phone || f.email, f.password); nav('/my');
    } catch (x) { setErr(x.message); setErrs(x.details || {}); } finally { setBusy(false); }
  };
  return <div className="auth card"><h1>Бүртгүүлэх</h1>
    <form onSubmit={submit} noValidate>
      <Alert>{err}</Alert>
      <div className="seg" role="group" aria-label="Бүртгэлийн төрөл" style={{ marginBottom: 12 }}>
        {[['citizen', 'Иргэн'], ['business', 'Аж ахуйн нэгж']].map(([v, l]) => <button type="button" key={v} className={f.accountType === v ? 'on' : ''} onClick={() => setF({ ...f, accountType: v })}>{l}</button>)}
      </div>
      <Field label="Овог нэр" required error={errs.fullName}><input value={f.fullName} onChange={set('fullName')} autoComplete="name" /></Field>
      {f.accountType === 'business' && <Field label="Байгууллагын нэр" required error={errs.organizationName} hint="Админ баталгаажуулсны дараа хүсэлт илгээх боломжтой.">
        <input value={f.organizationName} onChange={set('organizationName')} /></Field>}
      <div className="inline">
        <Field label="Утас" error={errs.phone}><input inputMode="numeric" maxLength={8} value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
        <Field label="Имэйл" error={errs.email}><input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
      </div>
      <Field label="Нууц үг" required error={errs.password} hint="8+ тэмдэгт, үсэг ба тоо"><PasswordInput value={f.password} onChange={set('password')} autoComplete="new-password" invalid={!!errs.password} /></Field>
      <PasswordMeter value={f.password} />
      <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} />
        <span>Миний нэр, утас, хаягийг зөвхөн хог цуглуулалтын хүсэлтийг гүйцэтгэх зорилгоор боловсруулахыг зөвшөөрч байна (Хүний хувийн мэдээлэл хамгаалах тухай хууль, 8-р зүйл).</span></label>
      {errs.consent && <div className="err">{errs.consent}</div>}
      <button className="btn block" disabled={busy}>Бүртгүүлэх</button>
    </form>
    <p className="muted">Бүртгэлтэй юу? <Link to="/login">Нэвтрэх</Link></p>
  </div>;
}
