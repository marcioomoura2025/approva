import { useMemo } from 'react';
import { Icons } from './UI';

/*
  Mapa de constância — uma célula por dia, colunas = semanas.

  A intenção é mostrar o *padrão* de estudo, não transformar a sequência atual
  em cobrança: por isso o destaque fica no mapa e nos dias do mês, e a sequência
  aparece de forma discreta.
*/

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Faixas de intensidade por volume de questões no dia.
function nivel(n) {
  if (!n) return 0;
  if (n < 5) return 1;
  if (n < 10) return 2;
  if (n < 20) return 3;
  return 4;
}

function rotuloData(iso) {
  const [a, m, d] = iso.split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]}`;
}

export default function Heatmap({ dados }) {
  // Agrupa os dias em colunas de 7 (a API já começa no domingo).
  const semanas = useMemo(() => {
    const cols = [];
    for (let i = 0; i < dados.dias.length; i += 7) cols.push(dados.dias.slice(i, i + 7));
    return cols;
  }, [dados.dias]);

  // Rótulo de mês na primeira coluna em que o mês aparece.
  const rotulosMes = useMemo(() => {
    const out = [];
    let ultimo = null;
    semanas.forEach((sem, i) => {
      const mes = sem[0]?.dia.slice(5, 7);
      if (mes && mes !== ultimo) { out.push({ i, texto: MESES[Number(mes) - 1] }); ultimo = mes; }
    });
    return out;
  }, [semanas]);

  const semEstudo = dados.total_dias_estudados === 0;

  return (
    <section className="card heatmap-card">
      <div className="card-head">
        <div>
          <h2><Icons.calendar size={18} /> Constância nos estudos</h2>
          <p className="card-sub">
            {semEstudo
              ? 'Cada quadradinho é um dia. Resolva questões e o mapa começa a se preencher.'
              : 'Cada quadradinho é um dia; quanto mais escuro, mais questões você resolveu.'}
          </p>
        </div>
        <div className="hm-stats">
          <div className="hm-stat">
            <strong>{dados.dias_estudados_mes}</strong>
            <span>de {dados.dia_do_mes} dias<br />neste mês</span>
          </div>
          <div className="hm-stat">
            <strong>{dados.melhor_sequencia}</strong>
            <span>melhor<br />sequência</span>
          </div>
        </div>
      </div>

      <div className="hm-scroll">
        <div className="hm-grid-wrap">
          <div className="hm-months" style={{ gridTemplateColumns: `repeat(${semanas.length}, 1fr)` }}>
            {semanas.map((_, i) => {
              const r = rotulosMes.find(x => x.i === i);
              return <span key={i}>{r ? r.texto : ''}</span>;
            })}
          </div>

          <div className="hm-body">
            <div className="hm-weekdays">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i}>{i % 2 === 1 ? d : ''}</span>
              ))}
            </div>
            <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${semanas.length}, 1fr)` }}>
              {semanas.map((sem, ci) => (
                <div className="hm-col" key={ci}>
                  {sem.map(d => (
                    <div
                      key={d.dia}
                      className={`hm-cell n${nivel(d.n)}${d.dia === dados.hoje ? ' hoje' : ''}`}
                      title={d.n ? `${d.n} questão(ões) em ${rotuloData(d.dia)}` : `Sem estudo em ${rotuloData(d.dia)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hm-footer">
        <span className="hm-total">
          {dados.total_periodo} questões nas últimas {Math.round(dados.dias.length / 7)} semanas
          {dados.sequencia_atual > 1 && <> · <strong>{dados.sequencia_atual} dias seguidos</strong></>}
        </span>
        <span className="hm-legend">
          menos
          {[0, 1, 2, 3, 4].map(n => <i className={`hm-cell n${n}`} key={n} />)}
          mais
        </span>
      </div>
    </section>
  );
}
