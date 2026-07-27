import { useEffect, useState } from 'react';

/*
  Comemoração de meta atingida — confete em CSS puro (sem bibliotecas).

  Regras de convivência:
  - Só aparece quando o usuário bate a própria meta de desempenho.
  - Toca uma vez por simulado: revisitar um resultado antigo não repete a festa.
  - Respeita "prefers-reduced-motion": quem pede menos animação não vê nada.
  - Puramente decorativo (aria-hidden) e sem captura de cliques.
*/

const CORES = ['#d8b55c', '#b49344', '#2e7d5b', '#29456e', '#f8f8f6', '#c9a24e'];
const QTD = 70;

function criarPecas() {
  return Array.from({ length: QTD }, (_, i) => ({
    id: i,
    left: Math.random() * 100,                       // % da largura
    cor: CORES[i % CORES.length],
    atraso: Math.random() * 0.9,                     // s
    duracao: 2.4 + Math.random() * 1.6,              // s
    deriva: (Math.random() - 0.5) * 220,             // px de deslocamento lateral
    giro: (Math.random() - 0.5) * 900,               // graus
    largura: 7 + Math.random() * 6,
    altura: 10 + Math.random() * 8,
    redondo: Math.random() > 0.72,
  }));
}

export default function Celebration({ chave, repeticao = 0 }) {
  const [pecas, setPecas] = useState(null);

  useEffect(() => {
    // Quem prefere menos movimento não recebe animação alguma.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Automático: uma vez por simulado. Quando o usuário pede para rever
    // (repeticao > 0), toca de novo sem consultar a marca.
    if (repeticao === 0) {
      const marca = `approva_festa_${chave}`;
      try {
        if (localStorage.getItem(marca)) return;
        localStorage.setItem(marca, '1');
      } catch { /* se o navegador bloquear, apenas comemora normalmente */ }
    }

    setPecas(criarPecas());
    const t = setTimeout(() => setPecas(null), 4600); // limpa o DOM depois
    return () => clearTimeout(t);
  }, [chave, repeticao]);

  if (!pecas) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {pecas.map(p => (
        <span
          key={p.id}
          className={`confetti-piece${p.redondo ? ' round' : ''}`}
          style={{
            left: `${p.left}%`,
            background: p.cor,
            width: `${p.largura}px`,
            height: `${p.redondo ? p.largura : p.altura}px`,
            animationDelay: `${p.atraso}s`,
            animationDuration: `${p.duracao}s`,
            '--dx': `${p.deriva}px`,
            '--rot': `${p.giro}deg`,
          }}
        />
      ))}
    </div>
  );
}
