import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Empty, Icons, LETTERS } from '../components/UI';

const TABS = [
  { key: 'cadastrar', label: 'Cadastrar questão' },
  { key: 'gerenciar', label: 'Gerenciar' },
  { key: 'importar', label: 'Importar Excel' },
  { key: 'textos', label: 'Textos-base' },
  { key: 'usuarios', label: 'Usuários' },
];

const emptyForm = {
  subject_id: '', topic_id: '', passage_id: '', statement: '',
  options: ['', '', '', ''], correct_index: 0, comment: '',
  difficulty: 'media', banca: '', ano: '', orgao: '', cargo: '', nivel: '',
  image_url: '', video_url: '',
};

export default function Banco() {
  const [tab, setTab] = useState('cadastrar');
  const [subjects, setSubjects] = useState([]);
  const [passages, setPassages] = useState([]);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(() => {
    Promise.all([api('/materias'), api('/textos-base')])
      .then(([m, p]) => { setSubjects(m); setPassages(p); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  return (
    <>
      <PageHead
        crumb="Administração"
        title="Banco de questões"
        lead="Cadastre questões uma a uma, importe em massa por planilha e organize textos-base compartilhados."
      />
      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'cadastrar' && <TabCadastrar subjects={subjects} passages={passages} onCatalogChange={loadCatalog} />}
      {tab === 'gerenciar' && <TabGerenciar subjects={subjects} passages={passages} />}
      {tab === 'importar' && <TabImportar onDone={loadCatalog} />}
      {tab === 'textos' && <TabTextos passages={passages} onChange={loadCatalog} />}
      {tab === 'usuarios' && <TabUsuarios />}
    </>
  );
}

/* ---------- Formulário de questão (criar e editar) ---------- */
function QuestionForm({ subjects, passages, initial, onSaved, onCancel, onCatalogChange }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newSubject, setNewSubject] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const subject = subjects.find(s => s.id === Number(form.subject_id));
  const topics = subject?.topics || [];

  const setOption = (i, v) => setForm(f => {
    const options = [...f.options]; options[i] = v; return { ...f, options };
  });
  const addOption = () => form.options.length < 6 && setForm(f => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (i) => setForm(f => {
    const options = f.options.filter((_, j) => j !== i);
    return { ...f, options, correct_index: Math.min(f.correct_index, options.length - 1) };
  });

  const createSubject = async () => {
    if (!newSubject.trim()) return;
    try {
      const d = await api('/materias', { method: 'POST', body: { name: newSubject.trim() } });
      setNewSubject('');
      onCatalogChange?.();
      setForm(f => ({ ...f, subject_id: String(d.id), topic_id: '' }));
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };
  const createTopic = async () => {
    if (!newTopic.trim() || !form.subject_id) return;
    try {
      const d = await api('/topicos', { method: 'POST', body: { subject_id: Number(form.subject_id), name: newTopic.trim() } });
      setNewTopic('');
      onCatalogChange?.();
      setForm(f => ({ ...f, topic_id: String(d.id) }));
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = {
      topic_id: Number(form.topic_id) || undefined,
      passage_id: form.passage_id ? Number(form.passage_id) : undefined,
      statement: form.statement,
      options: form.options,
      correct_index: Number(form.correct_index),
      comment: form.comment || undefined,
      difficulty: form.difficulty,
      banca: form.banca || undefined,
      ano: form.ano ? Number(form.ano) : undefined,
      orgao: form.orgao || undefined,
      cargo: form.cargo || undefined,
      nivel: form.nivel || undefined,
      image_url: form.image_url || undefined,
      video_url: form.video_url || undefined,
    };
    try {
      if (initial?.id) {
        await api(`/questoes/${initial.id}`, { method: 'PUT', body });
        setMsg({ type: 'ok', text: 'Questão atualizada.' });
      } else {
        await api('/questoes', { method: 'POST', body });
        setMsg({ type: 'ok', text: 'Questão cadastrada! Você pode cadastrar a próxima.' });
        setForm(f => ({ ...emptyForm, subject_id: f.subject_id, topic_id: f.topic_id, banca: f.banca, ano: f.ano, orgao: f.orgao, cargo: f.cargo, nivel: f.nivel }));
      }
      onSaved?.();
    } catch (e2) { setMsg({ type: 'error', text: e2.message }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}

      <div className="grid grid-2">
        <div className="field">
          <label>Matéria *</label>
          <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value, topic_id: '' }))} required>
            <option value="">Selecione…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="inline-add">
            <input placeholder="Nova matéria…" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={createSubject}>+ Criar</button>
          </div>
        </div>
        <div className="field">
          <label>Tópico *</label>
          <select value={form.topic_id} onChange={set('topic_id')} required disabled={!form.subject_id}>
            <option value="">{form.subject_id ? 'Selecione…' : 'Escolha a matéria antes'}</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="inline-add">
            <input placeholder="Novo tópico…" value={newTopic} onChange={e => setNewTopic(e.target.value)} disabled={!form.subject_id} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={createTopic} disabled={!form.subject_id}>+ Criar</button>
          </div>
        </div>
      </div>

      <div className="field">
        <label>Texto-base <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional — compartilhado entre questões)</span></label>
        <select value={form.passage_id} onChange={set('passage_id')}>
          <option value="">Sem texto-base</option>
          {passages.map(p => <option key={p.id} value={p.id}>{p.title || `Texto #${p.id}`}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Enunciado *</label>
        <textarea rows={4} value={form.statement} onChange={set('statement')} required />
      </div>

      <div className="field">
        <label>Alternativas * <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(marque a correta)</span></label>
        {form.options.map((opt, i) => (
          <div className="alt-row" key={i}>
            <input type="radio" name="correta" checked={Number(form.correct_index) === i} onChange={() => setForm(f => ({ ...f, correct_index: i }))} title="Correta" />
            <span className="alt-letter">{LETTERS[i]})</span>
            <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Alternativa ${LETTERS[i]}`} required />
            {form.options.length > 2 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOption(i)} aria-label="Remover alternativa">✕</button>
            )}
          </div>
        ))}
        {form.options.length < 6 && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addOption}>+ Adicionar alternativa</button>
        )}
      </div>

      <div className="field">
        <label>Comentário do gabarito <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
        <textarea rows={2} value={form.comment} onChange={set('comment')} />
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label>Dificuldade</label>
          <select value={form.difficulty} onChange={set('difficulty')}>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>
        <div className="field"><label>Banca</label><input value={form.banca} onChange={set('banca')} placeholder="Ex.: FGV" /></div>
        <div className="field"><label>Ano</label><input type="number" value={form.ano} onChange={set('ano')} placeholder="Ex.: 2024" /></div>
        <div className="field"><label>Órgão</label><input value={form.orgao} onChange={set('orgao')} placeholder="Ex.: TJ-MG" /></div>
        <div className="field"><label>Cargo</label><input value={form.cargo} onChange={set('cargo')} placeholder="Ex.: Analista" /></div>
        <div className="field"><label>Nível</label><input value={form.nivel} onChange={set('nivel')} placeholder="Ex.: Superior" /></div>
      </div>

      <div className="grid grid-2">
        <div className="field"><label>URL de imagem <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label><input value={form.image_url} onChange={set('image_url')} placeholder="https://…" /></div>
        <div className="field"><label>URL de vídeo-resolução <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label><input value={form.video_url} onChange={set('video_url')} placeholder="https://youtube.com/…" /></div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-gold" disabled={busy}>{busy ? 'Salvando…' : (initial?.id ? 'Salvar alterações' : 'Cadastrar questão')}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}

function TabCadastrar({ subjects, passages, onCatalogChange }) {
  return (
    <section className="card">
      <h2>Nova questão</h2>
      <p className="card-sub">Matéria e tópico podem ser criados aqui mesmo, sem sair do formulário.</p>
      <QuestionForm subjects={subjects} passages={passages} onCatalogChange={onCatalogChange} />
    </section>
  );
}

/* ---------- Gerenciar ---------- */
function TabGerenciar({ subjects, passages }) {
  const [filters, setFilters] = useState({ materia: '', banca: '', dificuldade: '', busca: '' });
  const [meta, setMeta] = useState({ bancas: [] });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api('/questoes/filtros').then(setMeta).catch(() => {}); }, []);

  // Baixa TODO o banco no mesmo formato do modelo — o arquivo pode ser reimportado.
  const exportar = async () => {
    setExporting(true); setMsg(null);
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      await apiDownload('/importacao/exportar', `banco-questoes-approva-${stamp}.xlsx`);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setExporting(false); }
  };

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page, limit: 10 });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    api(`/questoes?${qs}`).then(setData).catch(e => setMsg({ type: 'error', text: e.message }));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const remove = async (q) => {
    if (!confirm(`Excluir a questão #${q.id}? Esta ação não pode ser desfeita.`)) return;
    setMsg(null);
    try {
      await api(`/questoes/${q.id}`, { method: 'DELETE' });
      setMsg({ type: 'ok', text: 'Questão excluída.' });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const startEdit = async (q) => {
    const full = await api(`/questoes/${q.id}`);
    const subj = subjects.find(s => s.topics.some(t => t.id === full.topic_id));
    setEditing({
      id: full.id,
      subject_id: String(subj?.id || ''),
      topic_id: String(full.topic_id),
      passage_id: full.passage_id ? String(full.passage_id) : '',
      statement: full.statement,
      options: full.options,
      correct_index: full.correct_index,
      comment: full.comment || '',
      difficulty: full.difficulty || 'media',
      banca: full.banca || '', ano: full.ano || '', orgao: full.orgao || '',
      cargo: full.cargo || '', nivel: full.nivel || '',
      image_url: full.image_url || '', video_url: full.video_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (editing) {
    return (
      <section className="card">
        <h2>Editar questão #{editing.id}</h2>
        <QuestionForm
          subjects={subjects} passages={passages} initial={editing}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </section>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Questões cadastradas {data ? `· ${data.total}` : ''}</h2>
          <p className="card-sub">Filtre, edite ou exclua questões — ou baixe o banco inteiro em planilha.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportar} disabled={exporting || !data?.total}
          title="Baixa todas as questões em .xlsx, no mesmo formato do modelo de importação">
          <Icons.download /> {exporting ? 'Gerando…' : 'Exportar banco (.xlsx)'}
        </button>
      </div>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Matéria</label>
          <select value={filters.materia} onChange={e => { setFilters(f => ({ ...f, materia: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Banca</label>
          <select value={filters.banca} onChange={e => { setFilters(f => ({ ...f, banca: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            {meta.bancas.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Dificuldade</label>
          <select value={filters.dificuldade} onChange={e => { setFilters(f => ({ ...f, dificuldade: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>
        <div className="field">
          <label>Buscar no enunciado</label>
          <input value={filters.busca} onChange={e => { setFilters(f => ({ ...f, busca: e.target.value })); setPage(1); }} placeholder="Palavra-chave…" />
        </div>
      </div>

      {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}
      {!data && <Spinner />}
      {data && data.questions.length === 0 && <Empty icon="db" title="Nenhuma questão encontrada">Ajuste os filtros ou cadastre novas questões.</Empty>}

      {data && data.questions.map(q => (
        <div className="qrow" key={q.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="origin-line">
              <span>#{q.id}</span>
              <span>{q.subject_name}</span>
              <span>{q.topic_name}</span>
              {q.banca && <span>{q.banca}{q.ano ? ` ${q.ano}` : ''}</span>}
              <span className={`badge badge-${q.difficulty === 'facil' ? 'ok' : q.difficulty === 'dificil' ? 'bad' : 'gold'}`}>{q.difficulty}</span>
              {q.used_count > 0 && <span className="badge">usada em {q.used_count} simulado(s)</span>}
            </div>
            <div className="qrow-statement">{q.statement}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(q)}>Editar</button>
            <button className="btn btn-danger btn-sm" onClick={() => remove(q)} disabled={q.used_count > 0}
              title={q.used_count > 0 ? 'Questão usada em simulados não pode ser excluída' : 'Excluir'}>
              Excluir
            </button>
          </div>
        </div>
      ))}

      {data && totalPages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>página {page}/{totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
        </div>
      )}
    </section>
  );
}

/* ---------- Importação por Excel ---------- */
function TabImportar({ onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const download = async () => {
    try { await apiDownload('/importacao/modelo', 'modelo-importacao-approva.xlsx'); }
    catch (e) { setError(e.message); }
  };

  const send = async () => {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const d = await api('/importacao', { method: 'POST', formData: fd });
      setResult(d);
      onDone?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="card">
      <h2>Importar questões em massa</h2>
      <p className="card-sub">
        Baixe o modelo, preencha uma questão por linha e envie de volta. Matérias e tópicos novos são criados automaticamente.
      </p>
      <ol className="import-steps">
        <li>Baixe a planilha-modelo (já vem com uma linha de exemplo).</li>
        <li>Preencha: <code>materia, topico, enunciado, imagem_url, alternativa_a…e, correta (A–E ou 1–5), comentario, dificuldade, banca, ano, orgao, cargo, nivel, video_url</code>.</li>
        <li>Questão com <strong>texto-base</strong>? Preencha <code>texto_base_titulo</code>, <code>texto_base_conteudo</code> e <code>texto_base_fonte</code> — linhas com o mesmo título compartilham o mesmo texto (preencha o conteúdo só na primeira). O modelo traz um exemplo pronto.</li>
        <li>Envie o arquivo (.xlsx, até 5&nbsp;MB). Linhas com erro são ignoradas e listadas no resumo.</li>
      </ol>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={download}><Icons.db /> Baixar modelo (.xlsx)</button>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {file ? file.name : 'Escolher arquivo…'}
          <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0] || null); setResult(null); }} />
        </label>
        <button className="btn btn-gold" onClick={send} disabled={!file || busy}>{busy ? 'Importando…' : 'Importar'}</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <div className={`alert ${result.erros.length ? 'alert-warn' : 'alert-ok'}`}>
            <strong>{result.importadas}</strong> de <strong>{result.total_linhas}</strong> linha(s) importadas com sucesso.
          </div>
          {result.erros.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th style={{ width: 90 }}>Linha</th><th>Motivo do erro</th></tr></thead>
                <tbody>
                  {result.erros.map((e, i) => (
                    <tr key={i}><td style={{ fontFamily: 'var(--font-mono)' }}>{e.linha}</td><td>{e.motivo}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Textos-base ---------- */
function TabTextos({ passages, onChange }) {
  const [form, setForm] = useState({ title: '', content: '', source: '', image_url: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api('/textos-base', { method: 'POST', body: form });
      setMsg({ type: 'ok', text: 'Texto-base cadastrado. Agora ele pode ser vinculado a várias questões.' });
      setForm({ title: '', content: '', source: '', image_url: '' });
      onChange?.();
    } catch (e2) { setMsg({ type: 'error', text: e2.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <h2>Novo texto-base</h2>
        <p className="card-sub">Um mesmo texto (ou imagem) pode servir de apoio a várias questões, como nas provas de interpretação.</p>
        {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}
        <form onSubmit={submit}>
          <div className="field"><label>Título</label><input value={form.title} onChange={set('title')} placeholder="Ex.: O valor do hábito" /></div>
          <div className="field"><label>Conteúdo *</label><textarea rows={7} value={form.content} onChange={set('content')} required /></div>
          <div className="field"><label>Fonte <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label><input value={form.source} onChange={set('source')} placeholder="Autor, obra, veículo…" /></div>
          <div className="field"><label>URL de imagem <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label><input value={form.image_url} onChange={set('image_url')} placeholder="https://…" /></div>
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Salvando…' : 'Cadastrar texto-base'}</button>
        </form>
      </section>

      <section className="card">
        <h2>Textos cadastrados · {passages.length}</h2>
        {passages.length === 0 ? (
          <Empty icon="book" title="Nenhum texto-base">Cadastre o primeiro ao lado.</Empty>
        ) : passages.map(p => (
          <div className="qrow" key={p.id}>
            <div style={{ minWidth: 0 }}>
              <strong>{p.title || `Texto #${p.id}`}</strong>
              {p.question_count !== undefined && (
                <span className="badge" style={{ marginLeft: 8 }}>{p.question_count} questão(ões)</span>
              )}
              <div className="qrow-statement">{p.content}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}


/* ---------- Usuários (admin) ---------- */
function TabUsuarios() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState(null);
  const [resetting, setResetting] = useState(null); // id do usuário em edição
  const [newPass, setNewPass] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/usuarios').then(setUsers).catch(e => setMsg({ type: 'error', text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const salvarSenha = async (u) => {
    if (newPass.length < 6) { setMsg({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api(`/usuarios/${u.id}/senha`, { method: 'PUT', body: { password: newPass } });
      setMsg({ type: 'ok', text: `Senha de ${u.email} redefinida. Informe a nova senha ao usuário.` });
      setResetting(null); setNewPass('');
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setBusy(false); }
  };

  const alterarPapel = async (u, role) => {
    const acao = role === 'admin' ? 'tornar administrador' : 'remover o acesso de administrador de';
    if (!confirm(`Deseja ${acao} ${u.name}?`)) return;
    setMsg(null);
    try {
      await api(`/usuarios/${u.id}/papel`, { method: 'PUT', body: { role } });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Usuários {users ? `· ${users.length}` : ''}</h2>
          <p className="card-sub">Redefina a senha de quem esqueceu a sua e gerencie quem tem acesso de administrador.</p>
        </div>
      </div>

      {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`}>{msg.text}</div>}
      {!users && <Spinner />}

      {users && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Simulados</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.id === current?.id ? 'is-you' : ''}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === current?.id && <span className="badge badge-gold" style={{ marginLeft: 8 }}>você</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-gold' : ''}`}>
                      {u.role === 'admin' ? 'administrador' : 'estudante'}
                    </span>
                  </td>
                  <td>{u.simulados}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setResetting(u.id); setNewPass(''); setMsg(null); }}>
                      Redefinir senha
                    </button>
                    {u.role === 'admin' ? (
                      u.id !== current?.id && (
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => alterarPapel(u, 'user')}>
                          Remover admin
                        </button>
                      )
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => alterarPapel(u, 'admin')}>
                        Tornar admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetting && users && (
        <div className="reset-box">
          {(() => {
            const u = users.find(x => x.id === resetting);
            return (
              <>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Nova senha para <strong>{u?.email}</strong></label>
                  <input
                    type="text" value={newPass} autoFocus minLength={6}
                    placeholder="Mínimo de 6 caracteres"
                    onChange={e => setNewPass(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') salvarSenha(u); if (e.key === 'Escape') setResetting(null); }}
                  />
                  <div className="hint">A senha aparece em texto para você poder anotá-la e repassar ao usuário.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-gold btn-sm" onClick={() => salvarSenha(u)} disabled={busy}>
                    {busy ? 'Salvando…' : 'Salvar nova senha'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setResetting(null); setNewPass(''); }}>Cancelar</button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
