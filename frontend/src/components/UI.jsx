import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogoFull } from './Logo';
import { useAuth } from '../context/AuthContext';

/* ---------- Ícones (traço simples, 18px) ---------- */
const I = (path, vb = '0 0 24 24') => ({ size = 18 }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
export const Icons = {
  home: I(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  plus: I(<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  book: I(<><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3z" /><path d="M4 4v16" /></>),
  chart: I(<><path d="M4 20V6" /><path d="M10 20v-9" /><path d="M16 20V9" /><path d="M22 20H2" /></>),
  trophy: I(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4" /><path d="M17 6h3a3 3 0 0 1-3 4" /></>),
  bookmark: I(<path d="M6 3h12v18l-6-4-6 4z" />),
  db: I(<><ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13" /><path d="M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8" /></>),
  logout: I(<><path d="M15 4h5v16h-5" /><path d="M11 8l-4 4 4 4" /><path d="M7 12h11" /></>),
  star: I(<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z" />),
  flag: I(<><path d="M5 21V4" /><path d="M5 4h13l-2.5 4L18 12H5" /></>),
  // Pé/chuteira "chutando" — símbolo do chute
  foot: I(<><path d="M8.2 3h3.9v6.4c0 1.3 1 2.3 2.3 2.3h1.7c2.9 0 5.4 1.9 5.4 4.4 0 1-.8 1.9-1.9 1.9H9.7a1.5 1.5 0 0 1-1.5-1.5V3z" /><path d="M8.2 14.4h13.2" /><path d="M2.6 7.6h2.7" /><path d="M2 11.4h3.3" /></>),
  print: I(<><path d="M7 8V3h10v5" /><rect x="4" y="8" width="16" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>),
  clock: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: I(<path d="m4.5 12.5 5 5L20 6" />),
  x: I(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>),
  download: I(<><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></>),
  target: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>),
  bulb: I(<><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.4-1 2.5h-6c0-1.1-.3-1.9-1-2.5A6 6 0 0 1 12 3z" /></>),
  menu: I(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>),
  play: I(<path d="M7 4.5v15l13-7.5z" />),
  mail: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  lock: I(<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  arrowRight: I(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>),
  trendUp: I(<><path d="M12 3v18" /><path d="m7 8 5-5 5 5" /></>),
  list: I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></>),
  video: I(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>),
};

/* ---------- Motivo decorativo: folha de gabarito ---------- */
export function BubbleSheet({ rows = 4, cols = 5 }) {
  // Um padrão fixo de "respostas marcadas" para o hero.
  const filled = [0, 2, 1, 3, 2];
  return (
    <div className="bubble-sheet" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="bubble-row" key={r}>
          <span className="num">{String(r + 1).padStart(2, '0')}</span>
          {Array.from({ length: cols }).map((_, c) => (
            <span key={c} className={`bubble ${filled[r % filled.length] === c ? 'filled' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Carregando" />;

/* Folha de gabarito "flutuante" do hero (cartão 3D do login) */
export function GabaritoCard() {
  return (
    <div className="gabarito-card">
      <div className="gc-head"><span>Folha de gabarito</span><span className="gc-dot" /></div>
      <BubbleSheet rows={4} cols={5} />
    </div>
  );
}

/* Cartão de indicador com ícone (tones: '', 'navy', 'gold', 'chute') */
export function StatCard({ tone = '', label, icon, value, suffix, foot }) {
  const Icon = icon ? Icons[icon] : null;
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && <span className="stat-ic"><Icon size={17} /></span>}
      </div>
      <div className="stat-value">{value}{suffix && <small>{suffix}</small>}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

export function Empty({ title, icon = 'bookmark', action = null, children }) {
  const Icon = Icons[icon] || Icons.bookmark;
  return (
    <div className="empty">
      <div className="empty-ic"><Icon size={26} /></div>
      <div className="empty-title">{title}</div>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* ---------- Shell autenticado ---------- */
const NAV = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/novo', label: 'Novo simulado', icon: 'plus' },
  { to: '/revisoes', label: 'Revisões', icon: 'bookmark' },
  { to: '/desempenho', label: 'Desempenho', icon: 'chart' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy' },
];

export function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initials = (user?.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const nav = (
    <>
      <NavLink to="/" className="logo-link" onClick={() => setOpen(false)}>
        <LogoFull tone="light" height={54} />
      </NavLink>
      <nav className="nav-group">
        {NAV.map(item => {
          const Icon = Icons[item.icon];
          return (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon /> {item.label}
            </NavLink>
          );
        })}
        {user?.role === 'admin' && (
          <>
            <div className="nav-label">Administração</div>
            <NavLink to="/banco" onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icons.db /> Banco de questões
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div className="who">
          <div className="name">{user?.name}</div>
          <div className="role">{user?.role === 'admin' ? 'ADMIN' : 'ESTUDANTE'}</div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} title="Sair" aria-label="Sair">
          <Icons.logout />
        </button>
      </div>
    </>
  );

  return (
    <div className="shell">
      <div className="mobile-bar no-print">
        <button className="burger" onClick={() => setOpen(true)} aria-label="Abrir menu"><Icons.menu size={22} /></button>
        <LogoFull tone="light" height={42} />
        <span style={{ width: 34 }} />
      </div>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar no-print ${open ? 'open' : ''}`}>{nav}</aside>
      <div className="main">{children}</div>
    </div>
  );
}

export function PageHead({ crumb, title, lead, children }) {
  return (
    <header className="page-head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </header>
  );
}


/* ---------- Dicas de prova (conteúdo fixo do produto) ---------- */
export const STUDY_TIPS = [
  'Leia todo o enunciado antes de marcar a alternativa.',
  'Elimine as alternativas claramente incorretas primeiro.',
  'Gerencie seu tempo: não gaste muito em uma única questão.',
  'Revise as questões erradas para aprender com os erros.',
  'Simule condições reais de prova para melhor preparação.',
];

/* ---------- Meta de desempenho (definida pelo usuário) ---------- */
import { useEffect as _useEffect } from 'react';
import { api as _api } from '../api';
import { useAuth as _useAuth } from '../context/AuthContext';

export function MetaEditor() {
  const { user, updateUser } = _useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user?.pass_threshold ?? 60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  _useEffect(() => { setValue(user?.pass_threshold ?? 60); }, [user?.pass_threshold]);

  const save = async () => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1 || v > 100) { setErr('Use um inteiro de 1 a 100.'); return; }
    setBusy(true); setErr('');
    try {
      await _api('/me/meta', { method: 'PUT', body: { pass_threshold: v } });
      updateUser({ pass_threshold: v });
      setEditing(false);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <button className="meta-chip" onClick={() => setEditing(true)} title="Percentual mínimo de aproveitamento para considerar um simulado aprovado. Toque para alterar.">
        <Icons.target size={15} /> Meta de desempenho: <strong>{user?.pass_threshold ?? 60}%</strong>
        <span className="meta-edit">✎</span>
      </button>
    );
  }
  return (
    <span className="meta-chip editing">
      <Icons.target size={15} /> Meta:
      <input
        type="number" min="1" max="100" value={value} autoFocus
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        aria-label="Meta de desempenho em porcentagem"
      />%
      <button className="btn btn-gold btn-sm" onClick={save} disabled={busy}>{busy ? '…' : 'Salvar'}</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setErr(''); }}>Cancelar</button>
      {err && <em className="meta-err">{err}</em>}
    </span>
  );
}
