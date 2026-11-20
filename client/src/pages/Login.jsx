// 1.4 Нэвтрэх
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth';
import { api } from '../api';
import { Alert, Field, PasswordInput, useTitle } from '../components/ui';

export default function Login() {
  useTitle('Нэвтрэх');
  const { login } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ login: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.login, f.password); nav(homeFor(await api('/auth/me'))); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return <div className="auth card"><h1>Нэвтрэх</h1>
    <form onSubmit={submit} noValidate>
      <Alert>{err}</Alert>
      <Field label="Утас эсвэл имэйл" required><input autoComplete="username" value={f.login} onChange={e => setF({ ...f, login: e.target.value })} /></Field>
      <Field label="Нууц үг" required><PasswordInput autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
      <button className="btn block" disabled={busy}>{busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}</button>
    </form>
    <p className="muted">Бүртгэлгүй юу? <Link to="/register">Бүртгүүлэх</Link></p>
  </div>;
}
