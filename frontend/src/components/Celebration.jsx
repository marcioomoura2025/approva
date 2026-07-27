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

// Duas intensidades: a festa completa e uma versão discreta para quem
// configurou o sistema para reduzir animações (ex.: "Efeitos visuais" do
// Windows desligado). A discreta apenas surge e desaparece, sem voar pela tela.
function criarPecas(suave) {
  const qtd = suave ? 28 : 70;
  return Array.from({ length: qtd }, (_, i) => ({
    id: i,
    left: Math.random() * 100,                       // % da largura
    top: 12 + Math.random() * 66,                    // % da altura (só na versão suave)
    cor: CORES[i % CORES.length],
    atraso: Math.random() * (suave ? 0.5 : 0.9),     // s
    duracao: suave ? 1.6 + Math.random() * 0.8 : 2.4 + Math.random() * 1.6,
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
    // Sistema pedindo menos movimento → versão discreta, nunca o silêncio total.
    const suave = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Automático: uma vez por simulado. Quando o usuário pede para rever
    // (repeticao > 0), toca de novo sem consultar a marca.
    if (repeticao === 0) {
      const marca = `approva_festa_${chave}`;
      try {
        if (localStorage.getItem(marca)) return;
        localStorage.setItem(marca, '1');
      } catch { /* se o navegador bloquear, apenas comemora normalmente */ }
    }

    setPecas({ suave, itens: criarPecas(suave) });
    const t = setTimeout(() => setPecas(null), suave ? 3000 : 4600); // limpa o DOM depois
    return () => clearTimeout(t);
  }, [chave, repeticao]);

  if (!pecas) return null;

  return (
    <div className={`confetti${pecas.suave ? ' soft' : ''}`} aria-hidden="true">
      {pecas.itens.map(p => (
        <span
          key={p.id}
          className={`confetti-piece${p.redondo ? ' round' : ''}`}
          style={{
            left: `${p.left}%`,
            ...(pecas.suave ? { top: `${p.top}%` } : null),
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
