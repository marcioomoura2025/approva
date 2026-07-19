import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Spinner, Icons, fmtTime } from '../components/UI';
import QuestionReview from '../components/QuestionReview';

function ScoreRing({ score }) {
  const r = 65, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score || 0));
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className="score-ring" role="img" aria-label={`Aproveitamento de ${pct}%`}>
      <svg width="156" height="156" viewBox="0 0 156 156">
        <circle cx="78" cy="78" r={r} fill="none" stroke="rgba(248,248,246,0.15)" strokeWidth="11" />
        <circle cx="78" cy="78" r={r} fill="none" stroke="#b49344" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={go ? c * (1 - pct / 100) : c} />
      </svg>
      <div className="score-num">
        <span className="n">{pct}%</span>
        <span className="d">APROVEITAMENTO</span>
      </div>
    </div>
  );
}

export default function Resultado() {
  const { id } = useParams();
  const [sim, setSim] = useState(null);
  const [error, setError] = useState('');
  const refs = useRef({});

  useEffect(() => {
    api(`/simulados/${id}`)
      .then(d => {
        if (d.status !== 'finalizado') { location.href = `/simulados/${id}`; return; }
        setSim(d);
      })
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!sim) return <Spinner />;

  const guesses = sim.questions.filter(q => q.guessed).length;
  const luckyHits = sim.questions.filter(q => q.guessed && q.is_correct).length;
  const solid = sim.correct_count - luckyHits;

  const scrollTo = (qid) => refs.current[qid]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <div className="result-hero no-print">
        <ScoreRing score={sim.score} />
        <div className="result-meta">
          <span className={`badge ${sim.approved ? 'badge-ok' : 'badge-bad'}`} style={{ marginBottom: 10 }}>
            {sim.approved ? `✓ Aprovado — atingiu os ${sim.pass_threshold}%` : `Revisar — abaixo de ${sim.pass_threshold}%`}
          </span>
          <h1>{sim.title || `Simulado #${sim.id}`}</h1>
          <div className="result-facts">
            <div className="fact"><div className="f-label">Acertos</div><div className="f-value">{sim.correct_count}/{sim.total_questions}</div></div>
            <div className="fact"><div className="f-label">Tempo total</div><div className="f-value">{fmtTime(sim.elapsed_seconds)}</div></div>
            <div className="fact"><div className="f-label">Chutes</div><div className="f-value">{guesses}</div></div>
            <div className="fact"><div className="f-label">Acertos sólidos</div><div className="f-value">{solid}</div></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link to={`/simulados/${sim.id}/imprimir`} className="btn btn-gold btn-sm"><Icons.print /> Imprimir prova</Link>
          <Link to="/novo" className="btn btn-outline-light btn-sm">
            <Icons.plus /> Novo simulado
          </Link>
        </div>
      </div>

      {luckyHits > 0 && (
        <div className="alert alert-warn no-print">
          <Icons.foot size={16} />
          <span>
            <strong>{luckyHits} acerto(s) foram no chute.</strong> Eles contam pontos, mas não contam conhecimento — as questões
            aparecem abaixo com o selo <span className="badge badge-chute" style={{ verticalAlign: 'middle' }}><Icons.foot size={12} /> Chutou</span> e
            já entraram no seu caderno de erros &amp; chutes.
          </span>
        </div>
      )}

      <section className="card no-print">
        <h2>Cartão de respostas</h2>
        <p className="card-sub">Toque em uma questão para ir direto à sua revisão.</p>
        <div className="result-grid-bubbles">
          {sim.questions.map((q, i) => (
            <button
              key={q.id}
              className={`rb ${q.is_correct ? 'ok' : 'bad'} ${q.guessed ? 'chute' : ''}`}
              onClick={() => scrollTo(q.id)}
              title={`Questão ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="legend">
          <span className="lg"><span className="dot" style={{ background: 'var(--ok)' }} /> acerto</span>
          <span className="lg"><span className="dot" style={{ background: 'var(--bad)' }} /> erro</span>
          <span className="lg"><span className="dot" style={{ background: '#fff', border: '2.5px solid var(--chute)' }} /> chute</span>
        </div>
      </section>

      <h2 style={{ margin: '30px 0 14px', fontSize: 21 }}>Revisão questão a questão</h2>
      {sim.questions.map((q, i) => (
        <div key={q.id} ref={el => (refs.current[q.id] = el)}>
          <QuestionReview
            q={q}
            number={i + 1}
            extraBadges={q.is_correct
              ? <span className="badge badge-ok"><Icons.check size={13} /> Acertou</span>
              : <span className="badge badge-bad"><Icons.x size={13} /> Errou</span>}
          />
        </div>
      ))}
    </>
  );
}
