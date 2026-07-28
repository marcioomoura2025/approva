import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PageHead, Spinner, Icons } from '../components/UI';
import ContentPicker from '../components/ContentPicker';

export default function NovoSimulado() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState(null);
  const [filters, setFilters] = useState({ bancas: [], anos: [], orgaos: [], cargos: [], dificuldades: {} });
  const [provas, setProvas] = useState([]);
  const [buscaProva, setBuscaProva] = useState('');
  const [provaChave, setProvaChave] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);

  // Montagem
  const [mode, setMode] = useState('simples');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [selTopics, setSelTopics] = useState([]);     // ids de tópicos (modo simples)
  const [composition, setComposition] = useState({}); // {subjectId: qty} (modo composto)
  const [banca, setBanca] = useState('');
  const [ano, setAno] = useState('');
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [dificuldade, setDificuldade] = useState('');
  const [usarDistribuicao, setUsarDistribuicao] = useState(false);
  const [dist, setDist] = useState({ facil: 30, media: 40, dificil: 30 });

  // Configurações
  const [feedbackMode, setFeedbackMode] = useState('final');
  const [timeMode, setTimeMode] = useState('livre');
  const [totalMinutes, setTotalMinutes] = useState(60);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(90);

  useEffect(() => {
    Promise.all([api('/materias'), api('/questoes/filtros'), api('/provas')])
      .then(([m, f, p]) => { setSubjects(m); setFilters(f); setProvas(p); })
      .catch(e => setError(e.message));
  }, []);

  // Prévia de quantas questões cairão em cada nível — espelha o cálculo do
  // servidor (método do maior resto) para o usuário ver antes de criar.
  const cotas = useMemo(() => {
    const niveis = ['facil', 'media', 'dificil'];
    const pesos = niveis.map(n => Math.max(0, Number(dist[n]) || 0));
    const soma = pesos.reduce((a, v) => a + v, 0);
    const qtd = Math.max(0, Number(quantity) || 0);
    if (!soma || !qtd) return { facil: 0, media: 0, dificil: 0, soma };
    const exatos = pesos.map(p => (p / soma) * qtd);
    const base = exatos.map(Math.floor);
    let sobra = qtd - base.reduce((a, v) => a + v, 0);
    const ordem = exatos.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
    for (let k = 0; sobra > 0; k++, sobra--) base[ordem[k % 3].i]++;
    return { facil: base[0], media: base[1], dificil: base[2], soma };
  }, [dist, quantity]);

  // Provas aplicadas, filtradas pela busca do usuário.
  const provasFiltradas = useMemo(() => {
    const t = buscaProva.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!t) return provas;
    return provas.filter(p =>
      [p.orgao, p.cargo, p.banca, p.prova, p.ano].filter(Boolean).join(' ')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(t));
  }, [provas, buscaProva]);

  const compTotal = Object.values(composition).reduce((a, v) => a + (Number(v) || 0), 0);

  const buildPayload = () => {
    const base = {
      title: title.trim() || undefined,
      banca: banca || undefined,
      ano: ano || undefined,
      orgao: orgao || undefined,
      cargo: cargo || undefined,
      dificuldade: dificuldade || undefined,
      feedback_mode: feedbackMode,
      time_mode: timeMode,
      total_seconds: timeMode === 'total' ? Math.round(Number(totalMinutes) * 60) : undefined,
      seconds_per_question: timeMode === 'questao' ? Number(secondsPerQuestion) : undefined,
    };
    if (mode === 'prova') {
      return { ...base, mode: 'prova', prova_chave: provaChave, banca: undefined, ano: undefined, orgao: undefined, cargo: undefined };
    }
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
      // A distribuição substitui o filtro de nível único.
      dificuldade: usarDistribuicao ? undefined : (dificuldade || undefined),
      distribuicao: usarDistribuicao ? dist : undefined,
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
          <button type="button" className={`mode-option ${mode === 'prova' ? 'active' : ''}`} onClick={() => setMode('prova')}>
            <div className="mo-title">Prova inteira</div>
            <div className="mo-desc">Aplique uma prova real já cadastrada, com todas as questões na ordem original.</div>
          </button>
        </div>

        {mode === 'prova' ? (
          <div className="provas-wrap">
            {provas.length === 0 ? (
              <div className="alert alert-info">
                <Icons.fileText size={16} />
                <span>Nenhuma prova completa identificada ainda. As provas aparecem aqui quando as questões têm <strong>órgão</strong> e <strong>cargo</strong> preenchidos — use a coluna <code>prova</code> da planilha para separar cadernos diferentes do mesmo concurso.</span>
              </div>
            ) : (
              <>
                <div className="picker-top">
                  <div className="picker-search">
                    <Icons.search size={16} />
                    <input type="search" value={buscaProva} placeholder="Buscar por órgão, cargo, banca ou ano…"
                      onChange={e => setBuscaProva(e.target.value)} aria-label="Buscar prova" />
                  </div>
                </div>
                <div className="prova-list">
                  {provasFiltradas.length === 0 && <div className="picker-empty">Nenhuma prova encontrada.</div>}
                  {provasFiltradas.map(p => (
                    <label className={`prova-row ${provaChave === p.chave ? 'on' : ''}`} key={p.chave}>
                      <input type="radio" name="prova" checked={provaChave === p.chave}
                        onChange={() => setProvaChave(p.chave)} />
                      <span className="pr-main">
                        <span className="pr-cargo">{p.cargo}{p.prova ? ` · ${p.prova}` : ''}</span>
                        <span className="pr-orgao">{p.orgao}{p.banca ? ` · ${p.banca}` : ''}{p.ano ? ` · ${p.ano}` : ''}</span>
                      </span>
                      <span className="pr-meta">{p.total} questões · {p.materias} matéria(s)</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : mode === 'simples' ? (
          <>
            <div className="field">
              <label>Quantidade de questões</label>
              <input type="number" min="1" max="200" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ maxWidth: 140 }} />
            </div>

            <div className="field">
              <label className="chk" style={{ maxWidth: 'fit-content' }}>
                <input type="checkbox" checked={usarDistribuicao} onChange={e => setUsarDistribuicao(e.target.checked)} />
                <span>Distribuir por nível de dificuldade</span>
              </label>

              {usarDistribuicao && (
                <div className="dist-box">
                  <div className="dist-grid">
                    {[
                      ['facil', 'Fácil', 'ok'],
                      ['media', 'Média', 'gold'],
                      ['dificil', 'Difícil', 'bad'],
                    ].map(([k, rotulo, tom]) => (
                      <div className={`dist-item ${tom}`} key={k}>
                        <label htmlFor={`d-${k}`}>{rotulo}</label>
                        <div className="dist-input">
                          <input id={`d-${k}`} type="number" min="0" max="100" value={dist[k]}
                            onChange={e => setDist(d => ({ ...d, [k]: e.target.value }))} />
                          <span>%</span>
                        </div>
                        <div className="dist-cota">{cotas[k]} questão(ões)</div>
                        <div className="dist-estoque">{filters.dificuldades?.[k] ?? 0} no banco</div>
                      </div>
                    ))}
                  </div>

                  {cotas.soma !== 100 && cotas.soma > 0 && (
                    <p className="dist-aviso">
                      Os percentuais somam <strong>{cotas.soma}%</strong>. Tudo bem — eles serão usados como proporção
                      (a soma não precisa dar 100).
                    </p>
                  )}
                  {cotas.soma === 0 && (
                    <p className="dist-aviso erro">Informe ao menos um percentual maior que zero.</p>
                  )}
                </div>
              )}
            </div>
            <div className="field">
              <label>Conteúdo <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional — vazio = todas as matérias)</span></label>
              <ContentPicker subjects={subjects} selecionados={selTopics} onChange={setSelTopics} />
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

        {mode !== 'prova' && (
          <div className="grid grid-4" style={{ marginTop: 8 }}>
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
            <div className="field">
              <label>Órgão <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
              <select value={orgao} onChange={e => setOrgao(e.target.value)}>
                <option value="">Todos</option>
                {(filters.orgaos || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cargo <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
              <select value={cargo} onChange={e => setCargo(e.target.value)}>
                <option value="">Todos</option>
                {(filters.cargos || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Dificuldade <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
              <select value={dificuldade} onChange={e => setDificuldade(e.target.value)} disabled={usarDistribuicao}>
                <option value="">Todas</option>
                <option value="facil">Fácil ({filters.dificuldades?.facil ?? 0})</option>
                <option value="media">Média ({filters.dificuldades?.media ?? 0})</option>
                <option value="dificil">Difícil ({filters.dificuldades?.dificil ?? 0})</option>
              </select>
              {usarDistribuicao && <div className="hint">Desativado: a distribuição por nível está ativa.</div>}
            </div>
          </div>
        )}
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
        <button className="btn btn-gold" onClick={() => create('resolver')} disabled={busy || (mode === 'prova' && !provaChave)}>
          <Icons.play /> {busy ? 'Montando…' : 'Iniciar no aplicativo'}
        </button>
        <button className="btn btn-ghost" onClick={() => create('imprimir')} disabled={busy || (mode === 'prova' && !provaChave)}>
          <Icons.print /> Gerar para impressão
        </button>
      </div>
    </>
  );
}
