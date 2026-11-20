// REST API-тэй харилцах нэгдсэн функц. Алдааг { message, code, details } хэлбэрээр шиднэ.
export class ApiError extends Error {
  constructor(status, body) { super(body?.error?.message || 'Алдаа гарлаа'); this.status = status; this.code = body?.error?.code; this.details = body?.error?.details; }
}
export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: { ...headers } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const res = await fetch('/api' + path, opts);
  if (raw) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
export const newKey = () => crypto.randomUUID();
const TZ = 'Asia/Ulaanbaatar';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('sv-SE', { timeZone: TZ }) : '';
export const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '';
export const fmtDT = (d) => d ? `${fmtDate(d)} ${fmtTime(d)}` : '';
export const today = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('sv-SE', { timeZone: TZ });
export const WEEKDAYS = ['', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];
export const ROLE_LABEL = { citizen: 'Иргэн', business: 'ААН-ийн төлөөлөгч', coordinator: 'Зохицуулагч', driver: 'Гүйцэтгэгч', admin: 'Админ', manager: 'Удирдлага' };
