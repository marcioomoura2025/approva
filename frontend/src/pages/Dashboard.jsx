import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Empty, Icons, STUDY_TIPS } from '../components/UI';
import Heatmap from '../components/Heatmap';
import ExamCountdown from '../components/ExamCountdown';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const recarregarAlvos = () => api('/provas-alvo').then(a => setData(d => ({ ...d, alvos: a }))).catch(() => {});

  useEffect(() => {
    Promise.all([
      api('/stats/geral'),
      api('/stats/dificuldades'),
      api('/simulados'),
      api('/revisao-programada/resumo'),
      api('/banco/resumo'),
      // O fuso do navegador define o que é "hoje" para o mapa de constância.
      api(`/stats/atividade?tz=${-new Date().getTimezoneOffset()}`),
      api('/provas-alvo'),
    ]).then(([geral, dificuldades, simulados, revisao, banco, atividade, alvos]) => {
      setData({ geral, dificuldades, simulados: simulados.slice(0, 5), revisao, banco, atividade, alvos });
    }).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;
  const { geral, dificuldades, simulados, revisao, banco, atividade, alvos } = data;
  const num = (n) => Number(n || 0).toLocaleString('pt-BR');
  const firstName = (user?.name || '').split(' ')[0];
  const meta = user?.pass_threshold ?? 60;

  return (
    <>
      <PageHead
        crumb="Painel"
        title={`Olá, ${firstName}!`}
        lead="Um resumo do seu preparo até aqui — e por onde vale continuar."
      />

      <ExamCountdown dados={alvos} revisao={revisao} onChange={recarregarAlvos} />

      {atividade && <Heatmap dados={atividade} />}

      {revisao.total > 0 && (
        <Link to="/revisao-programada" className="review-banner">
          <span className="rb-ic"><Icons.refresh size={20} /></span>
          <span className="rb-text">
            <strong>{revisao.total} {revisao.total === 1 ? 'tópico pronto' : 'tópicos prontos'} para revisar</strong>
            {revisao.urgentes > 0
              ? <span>{revisao.urgentes} de atenção — você errou ou acertou no chute</span>
              : <span>revise agora para fixar antes de esquecer</span>}
          </span>
          <span className="rb-go">Revisar <Icons.arrowRight size={16} /></span>
        </Link>
      )}

      <section className="bank-strip">
        <span className="bs-label"><Icons.db size={16} /> Banco de questões</span>
        <span className="bs-items">
          <span className="bs-item"><strong>{num(banco.questoes)}</strong> questões</span>
          <span className="bs-sep" aria-hidden="true">·</span>
          <span className="bs-item"><strong>{num(banco.provas)}</strong> {banco.provas === 1 ? 'prova completa' : 'provas completas'}</span>
          <span className="bs-sep" aria-hidden="true">·</span>
          <span className="bs-item"><strong>{num(banco.materias)}</strong> {banco.materias === 1 ? 'matéria' : 'matérias'}</span>
        </span>
      </section>

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
                      <td>{t.chutes > 0 ? <span className="badge badge-chute"><Icons.foot size={15} /> {t.chutes}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card hoverable">
          <div className="card-head">
            <div>
              <h2>Simulados recentes</h2>
              <p className="card-sub">Retome um simulado em andamento ou revise um resultado.</p>
            </div>
            {geral.simulados_finalizados > 0 && (
              <div className="head-stat">
                <strong>{geral.simulados_finalizados}</strong>
                <span>{geral.simulados_finalizados === 1 ? 'simulado' : 'simulados'}<br />média {geral.media_simulados}%</span>
              </div>
            )}
          </div>
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
                          : <span className="badge badge-gold">{s.paper_phase ? ({ ready: 'No papel · pronta', running: 'No papel · em andamento', transcribing: 'Aguardando respostas' }[s.paper_phase] || 'No papel') : `${s.answered_count}/${s.total_questions} respondidas`}</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.status === 'finalizado'
                          ? <Link className="btn btn-ghost btn-sm" to={`/simulados/${s.id}/resultado`}>Ver resultado</Link>
                          : <Link className="btn btn-primary btn-sm" to={`/simulados/${s.id}${s.paper_phase ? '/impresso' : ''}`}>Continuar</Link>}
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
