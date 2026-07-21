import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { PageHead, Spinner, Icons, STUDY_TIPS, fmtTime, LETTERS } from '../components/UI';

const parseUtc = (s) => Date.parse(String(s).replace(' ', 'T') + 'Z');

export default function Resolucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const warnings = location.state?.warnings || [];

  const [sim, setSim] = useState(null);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [chute, setChute] = useState(false); // "estou chutando esta resposta"
  const [feedback, setFeedback] = useState(null); // retorno do modo imediato
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [qStart, setQStart] = useState(Date.now());
  const [qRemaining, setQRemaining] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showNote, setShowNote] = useState(false);
  const finishing = useRef(false);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/simulados/${id}`);
      if (d.status === 'finalizado') { navigate(`/simulados/${id}/resultado`, { replace: true }); return; }
      setSim(d);
      // No modo "tempo por questão" a navegação é sequencial: sempre a 1ª não respondida.
      const firstOpen = d.questions.findIndex(q => !q.answered);
      setIdx(d.time_mode === 'questao' ? Math.max(0, firstOpen) : (firstOpen >= 0 ? firstOpen : 0));
    } catch (e) { setError(e.message); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  // Relógio global (1s)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const q = sim?.questions[idx];

  // Ao trocar de questão: zera seleção, feedback e cronômetro local.
  useEffect(() => {
    if (!q) return;
    setSelected(q.answered ? q.selected_index : null);
    setChute(q.answered ? q.guessed : false);
    setFeedback(null);
    setNoteDraft(q.note || '');
    setShowNote(!!q.note);
    setQStart(Date.now());
    setQRemaining(sim?.time_mode === 'questao' && !q.answered ? sim.seconds_per_question : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  const elapsed = sim ? Math.max(0, Math.round((now - parseUtc(sim.created_at)) / 1000)) : 0;
  const remainingTotal = sim?.time_mode === 'total' ? sim.total_seconds - elapsed : null;

  const finish = useCallback(async (auto = false) => {
    if (finishing.current) return;
    if (!auto && !confirm('Finalizar o simulado agora? As questões não respondidas contarão como erro.')) return;
    finishing.current = true;
    try {
      await api(`/simulados/${id}/finalizar`, { method: 'POST', body: { elapsed_seconds: elapsed } });
      navigate(`/simulados/${id}/resultado`);
    } catch (e) { setError(e.message); finishing.current = false; }
  }, [id, elapsed, navigate]);

  // Tempo total esgotado → finaliza automaticamente.
  useEffect(() => {
    if (remainingTotal !== null && remainingTotal <= 0 && sim?.status === 'em_andamento') finish(true);
  }, [remainingTotal, sim, finish]);

  const updateLocal = (qid, patch) => {
    setSim(s => ({ ...s, questions: s.questions.map(x => (x.id === qid ? { ...x, ...patch } : x)) }));
  };

  const answeredCount = sim ? sim.questions.filter(x => x.answered).length : 0;

  const goNextOpen = useCallback(() => {
    if (!sim) return;
    const next = sim.questions.findIndex((x, i) => i > idx && !x.answered);
    if (next >= 0) setIdx(next);
    else {
      const anyOpen = sim.questions.findIndex(x => !x.answered);
      if (anyOpen >= 0) setIdx(anyOpen);
    }
  }, [sim, idx]);

  const submit = useCallback(async ({ timedOut = false } = {}) => {
    if (!q || q.answered || submitting.current) return;
    if (!timedOut && selected === null) return;
    submitting.current = true;
    setBusy(true); setError('');
    const timeSpent = Math.round((Date.now() - qStart) / 1000);
    try {
      const d = await api(`/simulados/${id}/responder`, {
        method: 'POST',
        body: {
          question_id: q.id,
          selected_index: timedOut ? null : selected,
          timed_out: timedOut,
          guessed: !timedOut && chute,
          time_spent: timeSpent,
        },
      });
      const patch = { answered: true, selected_index: timedOut ? null : selected, guessed: !timedOut && chute, time_spent: timeSpent };
      if (sim.feedback_mode === 'imediato') {
        Object.assign(patch, { correct_index: d.correct_index, is_correct: d.is_correct, comment: d.comment, video_url: d.video_url });
        updateLocal(q.id, patch);
        if (timedOut) {
          // Sem resposta: registra e segue direto para a próxima.
          setTimeout(() => goNextOpen(), 400);
        } else {
          setFeedback(d);
        }
      } else {
        updateLocal(q.id, patch);
        // Modo prova real: avança sozinho para a próxima em aberto.
        setTimeout(() => goNextOpen(), timedOut ? 400 : 150);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); submitting.current = false; }
  }, [q, selected, chute, qStart, id, sim, goNextOpen]);

  // Cronômetro por questão: esgotou → registra como erro e avança.
  useEffect(() => {
    if (qRemaining === null || !q || q.answered) return;
    if (qRemaining <= 0) { submit({ timedOut: true }); return; }
    const t = setTimeout(() => setQRemaining(r => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [qRemaining, q, submit]);

  const toggleChuteAfter = async () => {
    if (!q?.answered) return;
    try {
      const d = await api(`/simulados/${id}/chute`, { method: 'POST', body: { question_id: q.id, guessed: !q.guessed } });
      updateLocal(q.id, { guessed: d.guessed });
      setChute(d.guessed);
    } catch (e) { setError(e.message); }
  };

  const toggleFlag = async (kind) => {
    try {
      const path = kind === 'favorite' ? `/questoes/${q.id}/favorito` : `/questoes/${q.id}/revisao`;
      const d = await api(path, { method: 'POST' });
      updateLocal(q.id, kind === 'favorite' ? { favorite: d.favorite } : { review: d.review });
    } catch (e) { setError(e.message); }
  };

  const saveNote = async () => {
    try {
      await api(`/questoes/${q.id}/anotacao`, { method: 'PUT', body: { note: noteDraft } });
      updateLocal(q.id, { note: noteDraft.trim() });
    } catch (e) { setError(e.message); }
  };

  if (error && !sim) return <div className="alert alert-error">{error}</div>;
  if (!sim || !q) return <Spinner />;

  const perQuestionMode = sim.time_mode === 'questao';
  const revealed = q.correct_index !== undefined && q.answered;

  return (
    <>
      <PageHead
        crumb={`Simulado · ${sim.feedback_mode === 'imediato' ? 'modo estudo' : 'modo prova real'}`}
        title={sim.title || `Simulado #${sim.id}`}
      >
        <Link to={`/simulados/${sim.id}/imprimir`} className="btn btn-ghost btn-sm no-print"><Icons.print /> Imprimir</Link>
        <button className="btn btn-primary btn-sm" onClick={() => finish(false)}><Icons.check /> Finalizar</button>
      </PageHead>

      {warnings.map((w, i) => <div className="alert alert-warn" key={i}>{w}</div>)}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="solve-top">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>
          {answeredCount}/{sim.total_questions} respondidas
        </div>
        {sim.time_mode === 'livre' && <div className="timer"><Icons.clock /> {fmtTime(elapsed)}</div>}
        {sim.time_mode === 'total' && (
          <div className={`timer ${remainingTotal <= 60 ? 'warn' : ''}`}><Icons.clock /> restam {fmtTime(remainingTotal)}</div>
        )}
        {perQuestionMode && !q.answered && (
          <div className={`timer ${qRemaining <= 10 ? 'warn' : ''}`}><Icons.clock /> {fmtTime(qRemaining ?? 0)} nesta questão</div>
        )}
      </div>

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${sim.total_questions ? Math.round((answeredCount / sim.total_questions) * 100) : 0}%` }} />
      </div>

      <nav className="qnav" aria-label="Navegação entre questões">
        {sim.questions.map((x, i) => (
          <button
            key={x.id}
            className={`${x.answered ? 'answered' : ''} ${i === idx ? 'current' : ''} ${x.review ? 'flagged' : ''}`}
            disabled={perQuestionMode}
            title={perQuestionMode ? 'Navegação desabilitada no modo tempo por questão' : `Questão ${i + 1}`}
            onClick={() => !perQuestionMode && setIdx(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <section className="card">
        <div className="qr-head" style={{ marginBottom: 4 }}>
          <div>
            <div className="qr-num">QUESTÃO {String(idx + 1).padStart(2, '0')} / {sim.total_questions}</div>
            <div className="origin-line" style={{ marginTop: 7 }}>
              <span>{q.subject_name}</span>
              <span>{q.topic_name}</span>
              {q.banca && <span>{q.banca}{q.ano ? ` · ${q.ano}` : ''}</span>}
              {q.orgao && <span>{q.orgao}</span>}
              {q.cargo && <span>{q.cargo}</span>}
            </div>
          </div>
          {q.answered && q.guessed && <span className="badge badge-chute"><Icons.foot size={15} /> Você chutou</span>}
        </div>

        {q.passage && (
          <div className="passage-box">
            {q.passage.title && <div className="p-title">{q.passage.title}</div>}
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.passage.content}</div>
            {q.passage.image_url && <img src={q.passage.image_url} alt="Imagem do texto-base" />}
            {q.passage.source && <div className="p-source">{q.passage.source}</div>}
          </div>
        )}

        <p className="q-statement">{q.statement}</p>
        {q.image_url && <img className="q-image" src={q.image_url} alt="Imagem da questão" />}

        <div className="options" role="listbox" aria-label="Alternativas">
          {q.options.map((opt, i) => {
            let cls = '';
            if (revealed) {
              if (i === q.correct_index) cls = 'correct';
              else if (i === q.selected_index) cls = 'wrong';
            } else if (i === selected) cls = 'selected';
            return (
              <button
                key={i}
                className={`option ${cls}`}
                disabled={q.answered || busy}
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
              >
                <span className="letter">{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {!q.answered && (
          <div className="solve-actions">
            <button className="btn btn-gold" onClick={() => submit()} disabled={selected === null || busy}>
              {busy ? 'Registrando…' : 'Responder'}
            </button>
            <div>
              <button type="button" className={`chute-toggle ${chute ? 'active' : ''}`} onClick={() => setChute(c => !c)} aria-pressed={chute}>
                <Icons.foot size={17} /> {chute ? 'Estou chutando' : 'Marcar como chute'}
              </button>
              <div className="chute-help">Respondeu na sorte? Marque: mesmo se acertar, o tópico entra na sua lista de estudo.</div>
            </div>
          </div>
        )}

        {q.answered && !revealed && (
          <div className="alert alert-info" style={{ marginTop: 20, marginBottom: 0 }}>
            Resposta registrada. O gabarito será revelado ao finalizar o simulado.
          </div>
        )}

        {revealed && (feedback || sim.feedback_mode === 'imediato') && q.selected_index !== null && (
          <div className={`feedback ${q.is_correct ? 'ok' : 'bad'}`}>
            <div className="fb-title">
              {q.is_correct ? <><Icons.check /> Você acertou{q.guessed ? ' — mas foi no chute' : '!'}</> : <><Icons.x /> Você errou.</>}
            </div>
            {q.is_correct && q.guessed && (
              <p style={{ marginTop: 6, fontSize: 14 }}>Acerto no chute não conta como domínio: este tópico ficou registrado para você revisar.</p>
            )}
            {!q.is_correct && <p style={{ marginTop: 6, fontSize: 14 }}>Alternativa correta: <strong>{LETTERS[q.correct_index]}</strong></p>}
            {q.comment && <p className="fb-comment"><strong>Comentário:</strong> {q.comment}</p>}
            {q.video_url && (
              <p style={{ marginTop: 10 }}>
                <a href={q.video_url} target="_blank" rel="noreferrer"><Icons.video /> Ver resolução em vídeo</a>
              </p>
            )}
          </div>
        )}
        {revealed && q.answered && q.selected_index === null && (
          <div className="feedback bad">
            <div className="fb-title"><Icons.clock /> Tempo esgotado — registrada como erro.</div>
            <p style={{ marginTop: 6, fontSize: 14 }}>Alternativa correta: <strong>{LETTERS[q.correct_index]}</strong></p>
            {q.comment && <p className="fb-comment"><strong>Comentário:</strong> {q.comment}</p>}
          </div>
        )}

        <div className="flag-row">
          {q.answered && (
            <button className={`flag-btn ${q.guessed ? 'on-chute' : ''}`} onClick={toggleChuteAfter}>
              <Icons.foot size={16} /> {q.guessed ? 'Marcada como chute' : 'Foi chute? Marcar'}
            </button>
          )}
          <button className={`flag-btn ${q.review ? 'on' : ''}`} onClick={() => toggleFlag('review')}>
            <Icons.flag size={14} /> {q.review ? 'Marcada p/ revisão' : 'Marcar p/ revisão'}
          </button>
          <button className={`flag-btn ${q.favorite ? 'on' : ''}`} onClick={() => toggleFlag('favorite')}>
            <Icons.star size={14} /> {q.favorite ? 'Favorita' : 'Favoritar'}
          </button>
          <button className="flag-btn" onClick={() => setShowNote(v => !v)}>✎ Anotação</button>
        </div>

        {showNote && (
          <div className="note-box" style={{ marginTop: 12 }}>
            <textarea rows={2} placeholder="Anotação pessoal sobre esta questão…" value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
            {noteDraft.trim() !== (q.note || '') && (
              <div className="note-actions">
                <button className="btn btn-primary btn-sm" onClick={saveNote}>Salvar anotação</button>
              </div>
            )}
          </div>
        )}
      </section>

      <p className="solve-tip no-print"><Icons.bulb size={15} /> <strong>Dica:</strong> {STUDY_TIPS[idx % STUDY_TIPS.length]}</p>

      {!perQuestionMode && (
        <div className="solve-actions no-print">
          <button className="btn btn-ghost" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>← Anterior</button>
          <button className="btn btn-ghost" onClick={() => setIdx(i => Math.min(sim.questions.length - 1, i + 1))} disabled={idx === sim.questions.length - 1}>Próxima →</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => finish(false)}>Finalizar simulado</button>
        </div>
      )}
    </>
  );
}
