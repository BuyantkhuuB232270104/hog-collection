import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const STATUS_COLOR = { SUBMITTED: 'blue', NEED_INFO: 'amber', APPROVED: 'teal', ASSIGNED: 'blue', DONE: 'green', NOT_DONE: 'red', REJECTED: 'red', CANCELLED: 'grey',
  PLANNED: 'grey', POSTPONED: 'amber', STARTED: 'amber', OPEN: 'blue', IN_REVIEW: 'amber', RESOLVED: 'green' };
/** Төлөвийг өнгө + текстээр (өнгөнөөс хамааралгүй уншигдана) */
export const Pill = ({ status, children }) => <span className={`pill p-${STATUS_COLOR[status] || 'grey'}`}>{children}</span>;

export function Field({ label, error, hint, children, required }) {
  return <label className="field"><span className="lbl">{label}{required && <i aria-hidden> *</i>}</span>{children}
    {hint && !error && <span className="hint">{hint}</span>}{error && <span className="err" role="alert">{error}</span>}</label>;
}
export const Alert = ({ kind = 'error', children }) => children ? <div className={`alert a-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null;
export const Empty = ({ title, children, action }) => <div className="empty">{title && <b>{title}</b>}{children}{action && <div style={{ marginTop: 12 }}>{action}</div>}</div>;
export const Spinner = () => <span className="spinner" aria-hidden />;
/** Товчны ачаалж буй төлөв: ачаалж байхад товч идэвхгүй, эргэлддэг тэмдэг гарна */
export const Busy = ({ busy, children }) => <>{busy && <Spinner />}{children}</>;

/** Ачаалж буй хүснэгт, жагсаалтын орон */
export function Skeleton({ rows = 3, h = 18 }) {
  return <div role="status" aria-label="Ачаалж байна" className="stack" style={{ padding: 4 }}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: h, width: `${95 - (i % 3) * 12}%` }} />)}</div>;
}

/** Өгөгдөл ачаалах энгийн hook: [data, error, reload, loading] */
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true; set(s => ({ ...s, loading: true }));
    fn().then(data => alive && set({ data, error: null, loading: false }), error => alive && set({ data: null, error, loading: false }));
    return () => { alive = false; };
  }, [...deps, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state.data, state.error, () => setN(x => x + 1), state.loading];
}
/** Хуудасны гарчиг (хөтчийн таб, дэлгэц уншигч) */
export function useTitle(t) { useEffect(() => { document.title = t ? `${t} — Хог цуглуулалт` : 'Хог цуглуулалт — Дархан-Уул'; }, [t]); }
/** Хайлтын хүлээлт: бичиж дуустал 300 мс хүлээнэ */
export function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

// ---------- Товч мэдэгдэл (toast) ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const close = useCallback((i) => setItems(x => x.filter(t => t.id !== i)), []);
  const push = useCallback((message, kind = 'ok') => {
    const i = ++id.current; setItems(x => [...x.slice(-3), { id: i, message, kind }]);
    setTimeout(() => close(i), kind === 'error' ? 7000 : 4000);
  }, [close]);
  return <ToastCtx.Provider value={push}>{children}
    <div className="toast-host" aria-live="polite">{items.map(t => <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
      <span>{t.message}</span><button onClick={() => close(t.id)} aria-label="Хаах">×</button></div>)}</div></ToastCtx.Provider>;
}

// ---------- Баталгаажуулах цонх (window.confirm-ийн оронд) ----------
const ConfirmCtx = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const ask = useCallback((opts) => new Promise(res => setDlg({ ...(typeof opts === 'string' ? { message: opts } : opts), res })), []);
  const done = (v) => { dlg.res(v); setDlg(null); };
  useEffect(() => {
    if (!dlg) return;
    const k = (e) => e.key === 'Escape' && (dlg.res(false), setDlg(null));
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [dlg]);
  return <ConfirmCtx.Provider value={ask}>{children}
    {dlg && <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-m">
        <h2 id="cf-t">{dlg.title || 'Баталгаажуулна уу'}</h2><p id="cf-m" className="muted" style={{ fontSize: 14, margin: 0 }}>{dlg.message}</p>
        <div className="btns"><button className="btn sec" onClick={() => done(false)} autoFocus>{dlg.cancel || 'Болих'}</button>
          <button className={`btn ${dlg.danger ? 'danger' : ''}`} onClick={() => done(true)}>{dlg.ok || 'Тийм'}</button></div></div></div>}
  </ConfirmCtx.Provider>;
}

/** Нууц үгийн талбар: «Харах» товчтой */
export function PasswordInput({ value, onChange, autoComplete, invalid, ...rest }) {
  const [show, setShow] = useState(false);
  return <div className="pw"><input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} aria-invalid={invalid || undefined} {...rest} />
    <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Нуух' : 'Харах'}</button></div>;
}
/** Нууц үгийн хүч: уртад суурилсан энгийн үнэлгээ (8+, үсэг, тоо, том үсэг/тэмдэгт) */
export function PasswordMeter({ value }) {
  if (!value) return null;
  const has = (re) => re.test(value);
  const score = Number(value.length >= 8) + Number(has(/[A-Za-z\u0400-\u04FF]/) && has(/\d/)) + Number(value.length >= 12) + Number((has(/[A-Z\u0410-\u042F]/) && has(/[^A-Za-z0-9\u0400-\u04FF]/)) || value.length >= 16);
  const [w, c, t] = [[15, '#c0392b', 'Сул'], [40, '#d98b00', 'Дунд'], [70, '#2f9e6e', 'Сайн'], [100, '#1f6f43', 'Маш сайн'], [100, '#1f6f43', 'Маш сайн']][Math.min(score, 4)];
  return <div aria-live="polite"><div className="meter"><i style={{ width: `${w}%`, background: c }} /></div><span className="hint">Нууц үгийн хүч: {t}</span></div>;
}
export const SearchBox = ({ value, onChange, placeholder = 'Хайх…' }) => <div className="search">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
  <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>;

/** Нүүр хуудасны тоо: to өгвөл холбоос болно */
export function Kpi({ label, value, tone = '', to }) {
  const inner = <><span>{label}</span><b>{value ?? 0}</b></>;
  return to ? <a className={`kpi ${tone}`} href={to}>{inner}</a> : <div className={`kpi ${tone}`}>{inner}</div>;
}
/** Хэвтээ багана график (ямар ч сангүй): items = [{label, parts:[{value,color,name}]}] */
export function BarChart({ items, legend }) {
  const max = Math.max(1, ...items.map(i => i.parts.reduce((s, p) => s + p.value, 0)));
  return <div className="chart" role="img" aria-label={items.map(i => `${i.label}: ${i.parts.map(p => `${p.name} ${p.value}`).join(', ')}`).join('; ')}>
    {items.map(i => { const total = i.parts.reduce((s, p) => s + p.value, 0); return <div className="bar" key={i.label}>
      <span title={i.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
      <div className="track">{i.parts.map(p => p.value > 0 && <i key={p.name} title={`${p.name}: ${p.value}`} style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />)}</div>
      <b>{total}</b></div>; })}
    {legend && <div className="legend">{legend.map(l => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}</div>}</div>;
}
