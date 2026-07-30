import { createContext, useContext, useEffect, useState } from 'react';

/*
  Tema Dia/Noite.

  - Na primeira visita, segue a preferência do sistema operacional.
  - Depois que o usuário escolhe, a escolha dele manda (guardada no navegador).
  - Se o usuário nunca escolheu e o sistema muda, o app acompanha.
*/

const CHAVE = 'approva_tema';
const ThemeContext = createContext({ tema: 'light', definir: () => {} });

function preferenciaDoSistema() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function temaInicial() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'light' || salvo === 'dark') return salvo;
  } catch { /* navegador sem storage: usa o sistema */ }
  return preferenciaDoSistema();
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    // Ajusta a cor da barra do navegador no celular.
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = tema === 'dark' ? '#101a2b' : '#152641';
  }, [tema]);

  // Acompanha o sistema enquanto o usuário não tiver escolhido manualmente.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const aoMudar = (e) => {
      try { if (localStorage.getItem(CHAVE)) return; } catch { /* segue */ }
      setTema(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener?.('change', aoMudar);
    return () => mq.removeEventListener?.('change', aoMudar);
  }, []);

  const definir = (novo) => {
    setTema(novo);
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem storage: vale só nesta sessão */ }
  };

  return (
    <ThemeContext.Provider value={{ tema, definir }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/* Alternador Dia / Noite */
export function ThemeToggle() {
  const { tema, definir } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Aparência">
      <button
        type="button"
        className={tema === 'light' ? 'on' : ''}
        aria-pressed={tema === 'light'}
        onClick={() => definir('light')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </svg>
        Dia
      </button>
      <button
        type="button"
        className={tema === 'dark' ? 'on' : ''}
        aria-pressed={tema === 'dark'}
        onClick={() => definir('dark')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
        </svg>
        Noite
      </button>
    </div>
  );
}
