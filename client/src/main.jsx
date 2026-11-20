import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { ConfirmProvider, ToastProvider } from './components/ui';
import App from './App';
import './styles.css';

/** Дэлгэц дээр гэнэтийн алдаа гарвал цагаан дэлгэц биш, ойлгомжтой мессеж харуулна */
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="auth card" role="alert"><h1>Алдаа гарлаа</h1><p className="muted">Хуудсыг дахин ачаалж үзнэ үү. Үргэлжлээд гарвал админд мэдэгдээрэй.</p>
      <button className="btn" onClick={() => location.assign('/')}>Нүүр хуудас руу очих</button></div>;
  }
}

createRoot(document.getElementById('root')).render(<StrictMode><ErrorBoundary><BrowserRouter><ToastProvider><ConfirmProvider><AuthProvider><App /></AuthProvider></ConfirmProvider></ToastProvider></BrowserRouter></ErrorBoundary></StrictMode>);
