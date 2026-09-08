import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Icons, LETTERS, fmtTime } from '../components/UI';
import '../paper.css';

const phaseLabels = { ready: 'Pronta para começar', running: 'Prova em andamento', transcribing: 'Preencha suas respostas', corrected: 'Prova corrigida' };
const timestamp = value => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';

export default function ProvaImpressa() {
  const { id } = useParams();
  return <PaperPanel key={id} id={id} />;
}

function PaperPanel({ id }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [answers, setAnswers] = useState([]);
  const [saveState, setSaveState] = useState('saved'), [conflict, setConflict] = useState(false);
  const [recovery, setRecovery] = useState(null), [confirming, setConfirming] = useState(false);
  const [tick, setTick] = useState(0), [filter, setFilter] = useState('all');
  const [storageWarning, setStorageWarning] = useState(false);
  const mounted = useRef(true), revision = useRef(0), latest = useRef([]), saved = useRef('[]');
  const timer = useRef(null), pendingSave = useRef(null), dirty = useRef(false), blocked = useRef(false), actionBusy = useRef(false);
  const anchor = useRef({ server: Date.now(), client: performance.now() });
  const key = `approva_paper_draft_${user.id}_${id}`;
  const cardRef = useRef(null), confirmationRef = useRef(null);

  const localWrite = useCallback(items => {
    try { localStorage.setItem(key, JSON.stringify({ revision: revision.current, answers: items })); }
    catch { setStorageWarning(true); }
  }, [key]);
  const localRemove = useCallback(() => { try { localStorage.removeItem(key); } catch {} }, [key]);
  const applyPaper = useCallback(p => {
    // A delayed clock refresh must not undo a newer finish or draft save.
    if (p.revision < revision.current) return;
    anchor.current = { server: Date.parse(p.server_now), client: performance.now() };
    revision.current = p.revision;
    setData(d => ({ ...d, paper: p })); setTick(t => t + 1);
    if (p.phase === 'corrected') { localRemove(); navigate(`/simulados/${id}/resultado`, { replace: true }); }
  }, [id, localRemove, navigate]);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    api(`/simulados/${id}/impresso`).then(d => {
      if (cancelled || !mounted.current) return;
      setData(d); applyPaper(d.paper);
      latest.current = d.paper.answers; saved.current = JSON.stringify(d.paper.answers);
      setAnswers(d.paper.answers);
      if (d.paper.phase === 'transcribing') {
        let local;
        try { local = JSON.parse(localStorage.getItem(key)); } catch {}
        if (Array.isArray(local?.answers) && JSON.stringify(local.answers) !== saved.current) {
          if (local.revision === d.paper.revision) {
            latest.current = local.answers; setAnswers(local.answers); dirty.current = true; setSaveState('pending');
          } else setRecovery(local.answers);
        }
      }
    }).catch(e => { if (!cancelled && mounted.current) setError(e.message); });
    const leaving = e => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leaving);
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer.current); window.removeEventListener('beforeunload', leaving); };
  }, [id, key, applyPaper]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (pendingSave.current) return pendingSave.current;
    if (blocked.current) throw new Error('Recarregue o cartão para resolver a alteração feita em outra aba.');
    if (!dirty.current) return;
    const task = (async () => {
      while (dirty.current && mounted.current) {
        const snapshot = latest.current, json = JSON.stringify(snapshot);
        setSaveState('saving');
        try {
          const r = await api(`/simulados/${id}/impresso/respostas`, { method: 'PUT', body: { revision: revision.current, answers: snapshot } });
          revision.current = r.revision; saved.current = json;
          dirty.current = JSON.stringify(latest.current) !== json;
          if (dirty.current) localWrite(latest.current); else localRemove();
          if (mounted.current) { setSaveState(dirty.current ? 'pending' : 'saved'); setError(''); }
        } catch (e) {
          // Preserve the pending answers on failure; never silently replace them.
          localWrite(latest.current);
          if (mounted.current) {
            setSaveState('error'); setError(e.message);
            if (e.status === 409) { blocked.current = true; setConflict(true); }
          }
          throw e;
        }
      }
    })();
    pendingSave.current = task;
    try { return await task; } finally { pendingSave.current = null; }
  }, [id, localWrite, localRemove]);

  useEffect(() => {
    if (data?.paper.phase === 'transcribing' && dirty.current && !blocked.current && !recovery) {
      timer.current = setTimeout(() => save().catch(() => {}), 600);
    }
    return () => clearTimeout(timer.current);
  }, [answers, data?.paper.phase, recovery, save]);

  useEffect(() => {
    if (data?.paper.phase !== 'running') return;
    const clock = setInterval(() => setTick(t => t + 1), 1000);
    const refresh = () => api(`/simulados/${id}/impresso`).then(d => {
      if (mounted.current) applyPaper(d.paper);
    }).catch(() => {});
    const poll = setInterval(refresh, 10000);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(clock); clearInterval(poll); document.removeEventListener('visibilitychange', visible); };
  }, [data?.paper.phase, id, applyPaper]);

  useEffect(() => {
    if (data?.paper.phase === 'transcribing') cardRef.current?.focus();
  }, [data?.paper.phase]);
  useEffect(() => { if (confirming) confirmationRef.current?.focus(); }, [confirming]);

  const changeAnswer = (qid, patch) => {
    const current = latest.current.find(a => a.question_id === qid) || { question_id: qid, selected_index: null, guessed: false };
    const changed = { ...current, ...patch };
    if (changed.selected_index === null) changed.guessed = false;
    const next = [...latest.current.filter(a => a.question_id !== qid), changed].sort((a, b) => a.question_id - b.question_id);
    latest.current = next; dirty.current = true; localWrite(next);
    setAnswers(next); setSaveState('pending'); setConfirming(false);
  };

  const phaseAction = async action => {
    if (actionBusy.current) return;
    if (action === 'encerrar' && !window.confirm('Você terminou de responder a prova no papel? O cronômetro será encerrado e você poderá transcrever as respostas.')) return;
    actionBusy.current = true; setBusy(true); setError('');
    try { const d = await api(`/simulados/${id}/impresso/${action}`, { method: 'POST' }); applyPaper(d.paper); }
    catch (e) { setError(e.message); }
    finally { actionBusy.current = false; if (mounted.current) setBusy(false); }
  };

  const submit = async () => {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError('');
    try {
      await save();
      const blanks = data.questions.filter(q => latest.current.find(a => a.question_id === q.id)?.selected_index == null).length;
      await api(`/simulados/${id}/impresso/corrigir`, { method: 'POST', body: { revision: revision.current, answers: latest.current, confirm_blank_count: blanks } });
      dirty.current = false; localRemove(); navigate(`/simulados/${id}/resultado`, { replace: true });
    } catch (e) {
      setError(e.message);
      if (e.status === 409) { blocked.current = true; setConflict(true); }
    } finally { actionBusy.current = false; if (mounted.current) setBusy(false); }
  };

  if (!data) return error ? <div className="alert alert-error">{error}<button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Tentar novamente</button></div> : <Spinner />;
  const p = data.paper;
  // Derive the visible timer from server time + monotonic elapsed time, never a counter reset on reload.
  const serverNow = anchor.current.server + performance.now() - anchor.current.client;
  const elapsed = p.phase === 'ready' ? 0 : p.elapsed_seconds ?? Math.max(0, Math.floor((serverNow - Date.parse(p.started_at)) / 1000));
  const displayed = p.time_limit_seconds == null ? elapsed : Math.min(elapsed, p.time_limit_seconds);
  const remaining = p.time_limit_seconds == null ? null : Math.max(0, p.time_limit_seconds - displayed);
  const byId = new Map(answers.map(a => [a.question_id, a]));
  const filled = data.questions.filter(q => byId.has(q.id)).length;
  const marked = data.questions.filter(q => byId.get(q.id)?.selected_index != null).length;
  const blanks = data.questions.length - marked;
  const guessed = answers.filter(a => a.guessed && a.selected_index !== null).length;
  const phaseIndex = { ready: 0, running: 1, transcribing: 2, corrected: 3 }[p.phase];
  const shown = data.questions.filter(q => filter === 'all' || (filter === 'missing' ? !byId.has(q.id) : byId.get(q.id)?.guessed));

  return <div className="paper-panel">
    <PageHead crumb="Simulado · prova impressa" title={data.title || `Simulado #${id}`} lead="Resolva no papel. Registre o tempo e corrija suas respostas aqui." />
    <ol className="paper-steps" aria-label="Etapas da prova">{['Preparar', 'Realizar', 'Transcrever', 'Corrigir'].map((label, i) => <li key={label} className={i === phaseIndex ? 'current' : i < phaseIndex ? 'done' : ''} aria-current={i === phaseIndex ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
    {error && <div className="alert alert-error" role="alert">{error}{conflict && <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Recarregar cartão</button>}</div>}
    <section className="paper-clock-card" aria-labelledby="paper-state">
      <div className="paper-clock-copy"><span className="badge badge-gold"><Icons.print size={15} /> PROVA NO PAPEL</span><h2 id="paper-state">{phaseLabels[p.phase]}</h2><p>{p.phase === 'ready' ? 'Organize sua prova e clique em iniciar quando estiver pronto. A impressão não conta no tempo.' : p.phase === 'running' ? 'Concentre-se na prova impressa. O cronômetro continua se você fechar ou atualizar esta página.' : 'Tempo registrado. A transcrição das respostas não aumenta a duração da sua prova.'}</p>
        <div className="paper-clock-actions">{p.phase === 'ready' && <><button className="btn btn-gold" disabled={busy} onClick={() => phaseAction('iniciar')}><Icons.play />{busy ? 'Registrando…' : 'Iniciar cronômetro'}</button><Link className="btn btn-outline-light" to={`/simulados/${id}/imprimir`}><Icons.print /> Imprimir novamente</Link></>}
          {p.phase === 'running' && <button className="btn btn-gold" disabled={busy} onClick={() => phaseAction('encerrar')}><Icons.check />{busy ? 'Registrando…' : 'Terminei a prova'}</button>}
        </div>
      </div>
      <div className="paper-clock-display"><span>TEMPO DE PROVA</span><output aria-label="Tempo decorrido de prova" aria-live="off" data-tick={tick}>{fmtTime(displayed)}</output>{remaining != null && <small>{p.phase === 'ready' ? 'Limite total: ' : 'Tempo restante: '}{fmtTime(p.phase === 'ready' ? p.time_limit_seconds : remaining)}</small>}</div>
    </section>
    {p.phase === 'running' && remaining === 0 && <p className="alert alert-warn" role="status">O limite foi atingido. Registrando o encerramento; o cartão será liberado em alguns segundos.</p>}
    {p.end_reason === 'limit' && <p className="alert alert-warn">O limite de tempo encerrou a prova. Transcreva somente as respostas que você havia marcado no papel até esse momento.</p>}
    <dl className="paper-times"><div><dt>Início registrado</dt><dd>{timestamp(p.started_at)}</dd></div><div><dt>Fim registrado</dt><dd>{timestamp(p.ended_at)}</dd></div><div><dt>Questões</dt><dd>{data.total_questions}</dd></div></dl>
    {p.phase === 'transcribing' && <section className="card paper-answer-card" ref={cardRef} tabIndex={-1} aria-labelledby="paper-card-title">
      <div className="paper-card-header"><div><h2 id="paper-card-title">Seu cartão de respostas</h2><p>Transcreva o que marcou na prova. Use “Em branco” para as questões não respondidas.</p></div><span className={`paper-save-status ${saveState}`} role="status" aria-live="polite">{{ saved: 'Respostas salvas', pending: 'Alterações pendentes', saving: 'Salvando respostas…', error: 'Não foi possível salvar' }[saveState]}</span></div>
      {storageWarning && <p className="alert alert-warn">Seu navegador não permitiu guardar uma cópia local. Aguarde “Respostas salvas” antes de sair.</p>}
      {recovery && <div className="alert alert-warn paper-recovery"><p>Há marcações neste navegador que diferem das respostas salvas. Como deseja continuar?</p><button className="btn btn-primary btn-sm" onClick={() => { latest.current = recovery; dirty.current = true; localWrite(recovery); setAnswers(recovery); setRecovery(null); setSaveState('pending'); }}>Recuperar minhas marcações</button><button className="btn btn-ghost btn-sm" onClick={() => { localRemove(); setRecovery(null); }}>Usar respostas salvas</button></div>}
      <div className="paper-card-summary"><strong>{filled} de {data.total_questions} conferidas</strong><span>{marked} com alternativa</span><span>{guessed} chutes</span></div>
      <div className="paper-filter" role="group" aria-label="Filtrar cartão">{[['all', 'Todas'], ['missing', `Não preenchidas (${data.total_questions - filled})`], ['guessed', 'Chutes']].map(([value, label]) => <button className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`} type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <div className="paper-answer-rows">{shown.map(q => { const answer = byId.get(q.id); return <fieldset key={q.id} className={`paper-answer-row ${answer ? 'filled' : ''}`} disabled={busy || conflict || !!recovery}><legend>Questão {String(q.position).padStart(2, '0')}</legend><div className="paper-answer-options">{Array.from({ length: q.option_count }, (_, i) => <label key={i} className={answer?.selected_index === i ? 'selected' : ''}><input type="radio" name={`paper-${q.id}`} checked={answer?.selected_index === i} onChange={() => changeAnswer(q.id, { selected_index: i })} /><span>{LETTERS[i]}</span></label>)}<label className={`paper-blank ${answer && answer.selected_index === null ? 'selected' : ''}`}><input type="radio" name={`paper-${q.id}`} checked={!!answer && answer.selected_index === null} onChange={() => changeAnswer(q.id, { selected_index: null })} /><span>Em branco</span></label></div><label className="paper-guess"><input type="checkbox" checked={answer?.guessed || false} disabled={answer?.selected_index == null || busy || conflict || !!recovery} onChange={e => changeAnswer(q.id, { guessed: e.target.checked })} /><Icons.foot size={16} /> Foi chute</label></fieldset>; })}</div>
      {shown.length === 0 && <p className="paper-empty">Nenhuma questão neste filtro.</p>}
      <div className="paper-submit-actions"><button className="btn btn-ghost" disabled={busy || conflict || !!recovery || saveState === 'saving'} onClick={() => save().catch(() => {})}><Icons.bookmark /> Salvar agora</button><button className="btn btn-gold" disabled={busy || conflict || !!recovery} onClick={() => setConfirming(true)}><Icons.check /> Conferir e corrigir</button></div>
      {confirming && <section className="paper-confirm" ref={confirmationRef} tabIndex={-1} aria-labelledby="paper-confirm-title"><h3 id="paper-confirm-title">Confira antes de enviar</h3><p><strong>{marked}</strong> questões com alternativa, <strong>{blanks}</strong> em branco e <strong>{guessed}</strong> marcadas como chute.</p>{blanks > 0 && <p>As {blanks} questões em branco ou não preenchidas contarão como erro.</p>}<p>Após a correção, as alternativas desta tentativa não poderão ser alteradas.</p><div><button className="btn btn-primary" disabled={busy || conflict} onClick={submit}>{busy ? 'Corrigindo…' : 'Confirmar e corrigir meu simulado'}</button><button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Voltar à conferência</button></div></section>}
    </section>}
  </div>;
}
