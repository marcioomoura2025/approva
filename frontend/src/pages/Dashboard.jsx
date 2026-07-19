import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Empty, Icons, StatCard, STUDY_TIPS, fmtTime } from '../components/UI';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/stats/geral'),
      api('/stats/dificuldades'),
      api('/simulados'),
    ]).then(([geral, dificuldades, simulados]) => {
      setData({ geral, dificuldades, simulados: simulados.slice(0, 5) });
    }).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;
  const { geral, dificuldades, simulados } = data;
  const firstName = (user?.name || '').split(' ')[0];
  const meta = user?.pass_threshold ?? 60;

  return (
    <>
      <PageHead
        crumb="Painel"
        title={`Olá, ${firstName}!`}
        lead="Um resumo do seu preparo até aqui — e por onde vale continuar."
      />

      <div className="grid grid-4">
        <StatCard tone="navy" icon="check" label="Aproveitamento" value={geral.aproveitamento} suffix="%"
          foot={`${geral.total_acertos} acertos em ${geral.total_respondidas} questões`} />
        <StatCard tone="gold" icon="trendUp" label="Domínio real" value={geral.dominio_real} suffix="%"
          foot={`desconta ${geral.acertos_no_chute} acerto(s) no chute`} />
        <StatCard icon="list" label="Simulados" value={geral.simulados_finalizados}
          foot={`média de ${geral.media_simulados}% por prova`} />
        <StatCard icon="clock" label="Tempo por questão" value={fmtTime(geral.tempo_medio_questao)}
          foot="média entre todas as respostas" />
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <section className="card hoverable">
          <div className="card-head"><div><h2>Pontos de atenção</h2>
          <p className="card-sub">Tópicos com menor domínio real — priorize-os no estudo.</p></div></div>
          {dificuldades.length === 0 ? (
            <Empty icon="chart" title="Ainda sem dados suficientes">Resolva alguns simulados para mapear seus pontos fracos.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Tópico</th><th>Domínio real</th><th>Chutes</th></tr></thead>
                <tbody>
                  {dificuldades.map(t => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td><span className={`badge ${t.dominio_real >= meta ? 'badge-ok' : 'badge-bad'}`}>{t.dominio_real}%</span></td>
                      <td>{t.chutes > 0 ? <span className="badge badge-chute"><Icons.foot size={13} /> {t.chutes}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card hoverable">
          <div className="card-head"><div><h2>Simulados recentes</h2>
          <p className="card-sub">Retome um simulado em andamento ou revise um resultado.</p></div></div>
          {simulados.length === 0 ? (
            <Empty icon="plus" title="Nenhum simulado ainda"
              action={<Link to="/novo" className="btn btn-gold"><Icons.play /> Montar meu primeiro simulado</Link>}>
              Escolha as matérias, o tempo e o modo de correção — em um minuto você está treinando.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Simulado</th><th>Situação</th><th></th></tr></thead>
                <tbody>
                  {simulados.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.title || `Simulado #${s.id}`}</strong>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.total_questions} questões</div>
                      </td>
                      <td>
                        {s.status === 'finalizado'
                          ? <span className={`badge ${s.score >= meta ? 'badge-ok' : 'badge-bad'}`}>{s.score}%</span>
                          : <span className="badge badge-gold">{s.answered_count}/{s.total_questions} respondidas</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.status === 'finalizado'
                          ? <Link className="btn btn-ghost btn-sm" to={`/simulados/${s.id}/resultado`}>Ver resultado</Link>
                          : <Link className="btn btn-primary btn-sm" to={`/simulados/${s.id}`}>Continuar</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><div>
            <h2><Icons.bulb size={19} /> Dicas para o dia da prova</h2>
            <p className="card-sub">Cinco hábitos simples que valem pontos — dentro e fora do simulado.</p>
          </div></div>
          <ul className="tips-list">
            {STUDY_TIPS.map((tip, i) => (
              <li key={i}><span className="tip-num">{String(i + 1).padStart(2, '0')}</span>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
