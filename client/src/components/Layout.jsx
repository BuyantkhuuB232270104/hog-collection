import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { has, useAuth } from '../auth';
import { ROLE_LABEL } from '../api';

function links(user) {
  if (!user) return [['/', 'Хуваарь'], ['/login', 'Нэвтрэх']];
  const l = [];
  if (has(user, 'citizen', 'business')) l.push(['/', 'Хуваарь'], ['/my', 'Миний хүсэлт'], ['/new', 'Хүсэлт илгээх']);
  if (has(user, 'coordinator')) l.push(['/coordinator', 'Хүсэлтүүд'], ['/coordinator/jobs', 'Ажлын хуваарь'], ['/coordinator/schedule', 'Бүсийн хуваарь'], ['/coordinator/complaints', 'Гомдол']);
  if (has(user, 'driver')) l.push(['/driver', 'Өнөөдрийн ажил']);
  if (has(user, 'manager', 'coordinator')) l.push(['/reports', 'Тайлан']);
  if (has(user, 'admin')) l.push(['/admin', 'Хэрэглэгч'], ['/admin/lookups', 'Лавлах'], ['/admin/audit', 'Аудит']);
  l.push(['/notifications', 'Мэдэгдэл']);
  return l;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const roles = user?.roles?.map(r => ROLE_LABEL[r.code]).join(', ');
  return <div className="shell">
    <a className="skip" href="#main">Үндсэн агуулга руу очих</a>
    <header className="top">
      <NavLink to="/" className="brand"><span className="logo" aria-hidden>♻</span> Хог цуглуулалт</NavLink>
      {user && <div className="who"><span className="uname">{user.full_name}</span><span className="role">{roles}</span>
        <NavLink to="/profile">Профайл</NavLink>
        <button className="link" onClick={async () => { await logout(); nav('/'); }}>Гарах</button></div>}
    </header>
    <nav className="tabs" aria-label="Үндсэн цэс">
      {links(user).map(([to, label]) => <NavLink key={to} to={to} end={to === '/' || to === '/coordinator' || to === '/admin'}>
        {label}{to === '/notifications' && user?.unread > 0 && <b className="badge">{user.unread}</b>}</NavLink>)}
    </nav>
    {user?.status === 'pending' && <div className="banner">Таны байгууллагын бүртгэл админаар баталгаажаагүй байна. Баталгаажсаны дараа хүсэлт илгээх боломжтой.</div>}
    <main className="wrap" id="main" tabIndex={-1}><Outlet /></main>
    <footer className="foot">Дархан-Уул аймгийн хог хаягдал цуглуулах захиалга, хуваарийн веб систем · F.CSA350 төсөл</footer>
  </div>;
}
