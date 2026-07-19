import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PageHead, Spinner, Icons } from '../components/UI';

export default function NovoSimulado() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState(null);
  const [filters, setFilters] = useState({ bancas: [], anos: [] });
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);

  // Montagem
  const [mode, setMode] = useState('simples');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [selSubjects, setSelSubjects] = useState([]); // ids (modo simples)
  const [selTopics, setSelTopics] = useState([]);     // ids (modo simples)
  const [composition, setComposition] = useState({}); // {subjectId: qty} (modo composto)
  const [banca, setBanca] = useState('');
  const [ano, setAno] = useState('');

  // Configurações
  const [feedbackMode, setFeedbackMode] = useState('final');
  const [timeMode, setTimeMode] = useState('livre');
  const [totalMinutes, setTotalMinutes] = useState(60);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(90);

  useEffect(() => {
    Promise.all([api('/materias'), api('/questoes/filtros')])
      .then(([m, f]) => { setSubjects(m); setFilters(f); })
      .catch(e => setError(e.message));
  }, []);

  const toggleIn = (list, setList, id) =>
    setList(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));

  const visibleTopics = useMemo(() => {
    if (!subjects) return [];
    const pool = selSubjects.length ? subjects.filter(s => selSubjects.includes(s.id)) : subjects;
    return pool.flatMap(s => s.topics.map(t => ({ ...t, subject: s.name })));
  }, [subjects, selSubjects]);

  const compTotal = Object.values(composition).reduce((a, v) => a + (Number(v) || 0), 0);

  const buildPayload = () => {
    const base = {
      title: title.trim() || undefined,
      banca: banca || undefined,
      ano: ano || undefined,
      feedback_mode: feedbackMode,
      time_mode: timeMode,
      total_seconds: timeMode === 'total' ? Math.round(Number(totalMinutes) * 60) : undefined,
      seconds_per_question: timeMode === 'questao' ? Number(secondsPerQuestion) : undefined,
    };
    if (mode === 'composto') {
      return {
        ...base, mode: 'composto',
        composition: Object.entries(composition)
          .filter(([, v]) => Number(v) > 0)
          .map(([subject_id, q]) => ({ subject_id: Number(subject_id), quantity: Number(q) })),
      };
    }
    return {
      ...base, mode: 'simples', quantity: Number(quantity),
      topic_ids: selTopics.length ? selTopics : undefined,
      subject_ids: !selTopics.length && selSubjects.length ? selSubjects : undefined,
    };
  };

  // O candidato decide: resolver no app ou gerar a folha para impressão.
  const create = async (destination) => {
    setBusy(true); setError(''); setWarnings([]);
    try {
      const d = await api('/simulados', { method: 'POST', body: buildPayload() });
      if (d.warnings?.length && destination === 'imprimir') {
        // Avisos ainda aparecem na tela de impressão via query? Simples: seguem no state da navegação.
      }
      if (destination === 'imprimir') navigate(`/simulados/${d.id}/imprimir`);
      else navigate(`/simulados/${d.id}`, { state: { warnings: d.warnings } });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (error && !subjects) return <div className="alert alert-error">{error}</div>;
  if (!subjects) return <Spinner />;

  return (
    <>
      <PageHead
        crumb="Montagem"
        title="Novo simulado"
        lead="Escolha o conteúdo, o modo de correção e o controle de tempo. Depois, resolva no app ou imprima a folha de prova."
      />

      {error && <div className="alert alert-error">{error}</div>}
      {warnings.map((w, i) => <div className="alert alert-warn" key={i}>{w}</div>)}

      <section className="card">
        <h2><span className="step-badge">1</span>Conteúdo</h2>
        <p className="card-sub">Como você quer montar a prova?</p>

        <div className="mode-switch">
          <button type="button" className={`mode-option ${mode === 'simples' ? 'active' : ''}`} onClick={() => setMode('simples')}>
            <div className="mo-title">Montagem simples</div>
            <div className="mo-desc">Uma quantidade única de questões, com filtros opcionais por matéria ou tópico.</div>
          </button>
          <button type="button" className={`mode-option ${mode === 'composto' ? 'active' : ''}`} onClick={() => setMode('composto')}>
            <div className="mo-title">Composição por matéria</div>
            <div className="mo-desc">Defina quantas questões de cada disciplina — como na prova real do seu edital.</div>
          </button>
        </div>

        {mode === 'simples' ? (
          <>
            <div className="field">
              <label>Quantidade de questões</label>
              <input type="number" min="1" max="200" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
            <div className="field">
              <label>Matérias <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional — vazio = todas)</span></label>
              <div className="chip-list">
                {subjects.map(s => (
                  <button type="button" key={s.id} className={`chip ${selSubjects.includes(s.id) ? 'active' : ''}`}
                    onClick={() => { toggleIn(selSubjects, setSelSubjects, s.id); setSelTopics([]); }}>
                    {s.name} · {s.question_count}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Tópicos específicos <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional — sobrepõe as matérias)</span></label>
              <div className="chip-list">
                {visibleTopics.map(t => (
                  <button type="button" key={t.id} className={`chip ${selTopics.includes(t.id) ? 'active' : ''}`}
                    onClick={() => toggleIn(selTopics, setSelTopics, t.id)}>
                    {t.name} · {t.question_count}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            {subjects.map(s => (
              <div className="comp-row" key={s.id}>
                <span className="comp-name">{s.name}</span>
                <span className="comp-count">{s.question_count} disponíveis</span>
                <input
                  type="number" min="0" max="200" placeholder="0"
                  value={composition[s.id] ?? ''}
                  onChange={e => setComposition(c => ({ ...c, [s.id]: e.target.value }))}
                  aria-label={`Questões de ${s.name}`}
                />
              </div>
            ))}
            <p style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>
              Total: <strong style={{ color: 'var(--ink)' }}>{compTotal}</strong> questões (a ordem final é embaralhada)
            </p>
          </div>
        )}

        <div className="grid grid-2" style={{ marginTop: 8 }}>
          <div className="field">
            <label>Banca <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
            <select value={banca} onChange={e => setBanca(e.target.value)}>
              <option value="">Todas</option>
              {filters.bancas.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Ano <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
            <select value={ano} onChange={e => setAno(e.target.value)}>
              <option value="">Todos</option>
              {filters.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h2><span className="step-badge">2</span>Correção</h2>
        <p className="card-sub">Quando você quer ver o gabarito?</p>
        <div className="radio-cards">
          <label className={`radio-card ${feedbackMode === 'imediato' ? 'active' : ''}`}>
            <input type="radio" name="fb" checked={feedbackMode === 'imediato'} onChange={() => setFeedbackMode('imediato')} />
            <span>
              <span className="rc-title">Imediata — modo estudo</span>
              <span className="rc-desc" style={{ display: 'block' }}>Gabarito e comentário logo após cada resposta.</span>
            </span>
          </label>
          <label className={`radio-card ${feedbackMode === 'final' ? 'active' : ''}`}>
            <input type="radio" name="fb" checked={feedbackMode === 'final'} onChange={() => setFeedbackMode('final')} />
            <span>
              <span className="rc-title">Somente no final — modo prova real</span>
              <span className="rc-desc" style={{ display: 'block' }}>O gabarito só é revelado quando você finalizar o simulado.</span>
            </span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2><span className="step-badge">3</span>Tempo</h2>
        <p className="card-sub">Como o cronômetro deve funcionar?</p>
        <div className="radio-cards">
          <label className={`radio-card ${timeMode === 'livre' ? 'active' : ''}`}>
            <input type="radio" name="tm" checked={timeMode === 'livre'} onChange={() => setTimeMode('livre')} />
            <span>
              <span className="rc-title">Livre</span>
              <span className="rc-desc" style={{ display: 'block' }}>Sem limite — apenas cronometra o tempo decorrido.</span>
            </span>
          </label>
          <label className={`radio-card ${timeMode === 'total' ? 'active' : ''}`}>
            <input type="radio" name="tm" checked={timeMode === 'total'} onChange={() => setTimeMode('total')} />
            <span>
              <span className="rc-title">Tempo total da prova</span>
              <span className="rc-desc" style={{ display: 'block' }}>
                Um único cronômetro; ao esgotar, o simulado é finalizado automaticamente. Você distribui o tempo como quiser.
              </span>
              {timeMode === 'total' && (
                <span className="inline-number">
                  <input type="number" min="1" max="600" value={totalMinutes} onChange={e => setTotalMinutes(e.target.value)} onClick={e => e.preventDefault()} />
                  minutos no total
                </span>
              )}
            </span>
          </label>
          <label className={`radio-card ${timeMode === 'questao' ? 'active' : ''}`}>
            <input type="radio" name="tm" checked={timeMode === 'questao'} onChange={() => setTimeMode('questao')} />
            <span>
              <span className="rc-title">Tempo por questão</span>
              <span className="rc-desc" style={{ display: 'block' }}>
                Tempo fixo por questão. Esgotou sem responder? Conta como erro e avança sozinho. Sem voltar, sem alterar resposta.
              </span>
              {timeMode === 'questao' && (
                <span className="inline-number">
                  <input type="number" min="10" max="900" value={secondsPerQuestion} onChange={e => setSecondsPerQuestion(e.target.value)} onClick={e => e.preventDefault()} />
                  segundos por questão
                </span>
              )}
            </span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2><span className="step-badge">4</span>Identificação</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Título do simulado <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Reta final TJ-MG — semana 3" />
        </div>
      </section>

      <div className="solve-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-gold" onClick={() => create('resolver')} disabled={busy}>
          <Icons.play /> {busy ? 'Montando…' : 'Iniciar no aplicativo'}
        </button>
        <button className="btn btn-ghost" onClick={() => create('imprimir')} disabled={busy}>
          <Icons.print /> Gerar para impressão
        </button>
      </div>
    </>
  );
}
