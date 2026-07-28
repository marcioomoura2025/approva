import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PageHead, Spinner, Empty, Icons } from '../components/UI';

const TETO = 20; // máximo de questões por revisão

const MOTIVO = {
  errou: { label: 'Você errou', cls: 'badge-bad', icon: 'x' },
  chute: { label: 'Acertou no chute', cls: 'badge-chute', icon: 'foot' },
  acerto: { label: 'Prazo de revisão', cls: 'badge-gold', icon: 'clock' },
  solido: { label: 'Domínio consolidado', cls: 'badge-ok', icon: 'check' },
};

function tempo(dias) {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 14) return 'há 1 semana';
  if (dias < 30) return `há ${Math.round(dias / 7)} semanas`;
  return `há ${Math.round(dias / 30)} mês(es)`;
}

export default function RevisaoProgramada() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/revisao-programada').then(setData).catch(e => setError(e.message));
  }, []);

  const iniciar = async (topicIds) => {
    setBusy(true); setError('');
    try {
      const ids = topicIds.slice(0, TETO);
      const d = await api('/simulados', {
        method: 'POST',
        body: {
          title: 'Revisão programada',
          mode: 'simples',
          quantity: ids.length,
          topic_ids: ids,
          feedback_mode: 'imediato',
          time_mode: 'livre',
        },
      });
      navigate(`/simulados/${d.id}`, { state: { warnings: d.warnings } });
    } catch (e) { setError(e.message); setBusy(false); }
  };

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;

  const { total, itens, proximos = [], ja_estudou } = data;
  const urgentes = itens.filter(i => i.motivo === 'errou' || i.motivo === 'chute').length;

  return (
    <>
      <PageHead
        crumb="Estudo dirigido"
        title="Revisão programada"
        lead="O app acompanha quando você respondeu cada tópico e sugere revisá-lo pouco antes de você esquecer — priorizando o que errou ou acertou no chute."
      />

      {error && <div className="alert alert-error">{error}</div>}

      {total === 0 && !ja_estudou ? (
        <Empty icon="refresh" title="Nada para revisar por enquanto"
          action={<button className="btn btn-gold" onClick={() => navigate('/novo')}><Icons.play /> Fazer um simulado</button>}>
          Assim que você resolver simulados, cada tópico ganha uma data de revisão. Quando essa data chegar, ele aparece aqui automaticamente — mais cedo para o que você errou ou chutou, mais tarde para o que domina.
        </Empty>
      ) : total === 0 ? (
        <>
          <section className="review-cta em-dia">
            <div>
              <div className="rc-count"><Icons.check size={30} /></div>
              <div className="rc-text">
                <strong>Tudo em dia — nada vencido agora</strong>
                <span className="rc-sub">
                  {proximos.length === 1
                    ? `Você tem 1 tópico em espera. O primeiro volta em ${proximos[0].dias_para_revisar} dia(s).`
                    : `Você tem ${proximos.length} tópicos em espera. O primeiro volta em ${proximos[0]?.dias_para_revisar} dia(s).`}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate('/novo')}>
              <Icons.play /> Fazer um simulado
            </button>
          </section>
          <p className="review-note">
            A revisão só sugere um tópico quando chega perto da hora de você esquecê-lo — por isso ele não aparece logo depois de responder. O que você errou volta em 2 dias; o que acertou no chute, em 3; o que acertou, em 7; e o que já domina, em 16.
          </p>
          <ProximasRevisoes proximos={proximos} />
        </>
      ) : (
        <>
          <section className="review-cta">
            <div>
              <div className="rc-count">{total}</div>
              <div className="rc-text">
                <strong>{total === 1 ? 'tópico pronto' : 'tópicos prontos'} para revisar</strong>
                {urgentes > 0 && <span className="rc-urgent">{urgentes} de atenção (erro ou chute)</span>}
              </div>
            </div>
            <button className="btn btn-gold" disabled={busy} onClick={() => iniciar(itens.map(i => i.topic_id))}>
              <Icons.play /> {busy ? 'Montando…' : `Revisar ${Math.min(total, TETO)} agora`}
            </button>
          </section>
          {total > TETO && (
            <p className="review-note">
              Você tem {total} tópicos vencidos; para a revisão não ficar longa demais, cada sessão traz os {TETO} mais atrasados. Ao terminar, volte aqui para os próximos.
            </p>
          )}

          <div className="review-list">
            {itens.map(it => {
              const m = MOTIVO[it.motivo] || MOTIVO.acerto;
              const Icon = Icons[m.icon];
              return (
                <div className="review-row" key={it.topic_id}>
                  <div className="rr-main">
                    <div className="rr-topic">{it.topic_name}</div>
                    <div className="rr-subject">{it.subject_name}</div>
                  </div>
                  <div className="rr-meta">
                    <span className={`badge ${m.cls}`}><Icon size={13} /> {m.label}</span>
                    <span className="rr-when">respondido {tempo(it.dias_desde_resposta)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <ProximasRevisoes proximos={proximos} />
        </>
      )}
    </>
  );
}

/* Agenda do que ainda está "descansando" — deixa claro que o app está contando. */
function ProximasRevisoes({ proximos }) {
  if (!proximos?.length) return null;
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-head">
        <div>
          <h2><Icons.clock size={18} /> Próximas revisões</h2>
          <p className="card-sub">Tópicos já estudados que ainda estão no intervalo de descanso.</p>
        </div>
      </div>
      <div className="review-list" style={{ marginTop: 4 }}>
        {proximos.slice(0, 12).map(it => (
          <div className="review-row proxima" key={it.topic_id}>
            <div className="rr-main">
              <div className="rr-topic">{it.topic_name}</div>
              <div className="rr-subject">{it.subject_name}</div>
            </div>
            <div className="rr-meta">
              <span className="badge badge-muted">em {it.dias_para_revisar} dia(s)</span>
              <span className="rr-when">respondido {tempo(it.dias_desde_resposta)}</span>
            </div>
          </div>
        ))}
        {proximos.length > 12 && (
          <p className="review-note">e mais {proximos.length - 12} tópico(s).</p>
        )}
      </div>
    </section>
  );
}
