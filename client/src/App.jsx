import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { has, homeFor, useAuth } from './auth';
import Layout from './components/Layout';
import Schedule from './pages/Schedule';
import Login from './pages/Login';
import Register from './pages/Register';
import NewRequest from './pages/NewRequest';
import MyRequests from './pages/MyRequests';
import RequestDetail from './pages/RequestDetail';
import Notifications from './pages/Notifications';
import CoordRequests from './pages/CoordRequests';
import CoordJobs from './pages/CoordJobs';
import CoordSchedule from './pages/CoordSchedule';
import Complaints from './pages/Complaints';
import DriverToday from './pages/DriverToday';
import Reports from './pages/Reports';
import AdminUsers from './pages/AdminUsers';
import AdminLookups from './pages/AdminLookups';
import AdminAudit from './pages/AdminAudit';
import Profile from './pages/Profile';

/** Үүргээр хамгаалсан зам (эрхийн эцсийн шалгалт сервер дээр — NFR-01) */
function Guard({ roles, children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !has(user, ...roles)) return <Navigate to={homeFor(user)} replace />;
  return children;
}
export default function App() {
  const { user } = useAuth();
  const R = (roles, el) => <Guard roles={roles}>{el}</Guard>;
  return <Routes><Route element={<Layout />}>
    <Route index element={<Schedule />} />
    <Route path="login" element={user ? <Navigate to={homeFor(user)} replace /> : <Login />} />
    <Route path="register" element={<Register />} />
    <Route path="new" element={R(['citizen', 'business'], <NewRequest />)} />
    <Route path="my" element={R(['citizen', 'business'], <MyRequests />)} />
    <Route path="my/:id" element={R(null, <RequestDetail />)} />
    <Route path="profile" element={R(null, <Profile />)} />
    <Route path="notifications" element={R(null, <Notifications />)} />
    <Route path="coordinator" element={R(['coordinator'], <CoordRequests />)} />
    <Route path="coordinator/phone" element={R(['coordinator'], <NewRequest staff />)} />
    <Route path="coordinator/jobs" element={R(['coordinator'], <CoordJobs />)} />
    <Route path="coordinator/schedule" element={R(['coordinator'], <CoordSchedule />)} />
    <Route path="coordinator/complaints" element={R(['coordinator'], <Complaints />)} />
    <Route path="driver" element={R(['driver'], <DriverToday />)} />
    <Route path="reports" element={R(['manager', 'coordinator'], <Reports />)} />
    <Route path="admin" element={R(['admin'], <AdminUsers />)} />
    <Route path="admin/lookups" element={R(['admin'], <AdminLookups />)} />
    <Route path="admin/audit" element={R(['admin'], <AdminAudit />)} />
    <Route path="*" element={<div className="empty"><b>Хуудас олдсонгүй</b><Link to="/">Нүүр хуудас руу буцах</Link></div>} />
  </Route></Routes>;
}
