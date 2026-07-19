import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoFull } from '../components/Logo';
import { GabaritoCard, Icons } from '../components/UI';

function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="brand-lockup">
          <LogoFull tone="light" height={78} />
        </div>
        <div>
          <h2 className="auth-headline">Treine como se fosse o <em>dia da prova</em>.</h2>
          <GabaritoCard />
        </div>
        <div>
          <p className="auth-hero-foot">
            Simulados cronometrados, correção comentada e estatísticas por matéria — do seu jeito, no seu ritmo.
          </p>
          <div className="trust-row">
            <span className="ti"><Icons.check size={16} /> Correção comentada</span>
            <span className="ti"><Icons.clock size={16} /> Cronômetro real</span>
            <span className="ti"><Icons.chart size={16} /> Estatísticas</span>
          </div>
        </div>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1>Entrar</h1>
        <p className="sub">Continue de onde parou nos seus estudos.</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field field-icon">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrap">
              <Icons.mail size={17} />
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
          </div>
          <div className="field field-icon">
            <label htmlFor="password">Senha</label>
            <div className="input-wrap">
              <Icons.lock size={17} />
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Entrando…' : <>Entrar <Icons.arrowRight /></>}</button>
        </form>
        <p className="auth-switch">Ainda não tem conta? <Link to="/registro">Criar conta grátis</Link></p>
      </div>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1>Criar conta</h1>
        <p className="sub">Comece a treinar em menos de um minuto.</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" value={form.name} onChange={set('name')} autoComplete="name" required />
          </div>
          <div className="field field-icon">
            <label htmlFor="remail">E-mail</label>
            <div className="input-wrap">
              <Icons.mail size={17} />
              <input id="remail" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
            </div>
          </div>
          <div className="field field-icon">
            <label htmlFor="rpassword">Senha</label>
            <div className="input-wrap">
              <Icons.lock size={17} />
              <input id="rpassword" type="password" value={form.password} onChange={set('password')} minLength={6} autoComplete="new-password" required />
            </div>
            <div className="hint">Mínimo de 6 caracteres.</div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Criando conta…' : <>Criar conta <Icons.arrowRight /></>}</button>
        </form>
        <p className="auth-switch">Já tem conta? <Link to="/login">Entrar</Link></p>
      </div>
    </AuthLayout>
  );
}
