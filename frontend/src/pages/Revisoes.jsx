import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { PageHead, Spinner, Empty, Icons } from '../components/UI';
import QuestionReview from '../components/QuestionReview';

const TABS = [
  { key: 'revisao', label: 'Marcadas p/ revisão' },
  { key: 'favoritas', label: 'Favoritas' },
  { key: 'erros', label: 'Erros & chutes' },
];

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function Revisoes() {
  const [tab, setTab] = useState('revisao');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [materia, setMateria] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => {
    setItems(null); setError('');
    const path = tab === 'erros' ? '/me/erros' : `/me/marcadas/completas?tipo=${tab}`;
    api(path).then(setItems).catch(e => setError(e.message));
  };

  useEffect(() => { setBusca(''); setMateria(''); setMsg(''); carregar(); }, [tab]);

  // Matérias presentes na lista atual, para o filtro.
  const materias = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map(q => q.subject_name).filter(Boolean))].sort();
  }, [items]);

  // Filtro aplicado no navegador (as listas já vêm completas).
  const visiveis = useMemo(() => {
    if (!items) return [];
    const t = norm(busca.trim());
    return items.filter(q => {
      if (materia && q.subject_name !== materia) return false;
      if (!t) return true;
      return norm([q.statement, q.topic_name, q.subject_name, q.banca, q.note].join(' ')).includes(t);
    });
  }, [items, busca, materia]);

  // Remove da tela quando o usuário desmarca (favorita/revisão).
  const aoMudarMarca = (id, flags) => {
    if (tab === 'favoritas' && !flags.favorite) setItems(l => l.filter(q => q.id !== id));
    if (tab === 'revisao' && !flags.review) setItems(l => l.filter(q => q.id !== id));
  };

  const resolver = async (id) => {
    setMsg('');
    try {
      await api(`/me/erros/${id}/resolver`, { method: 'POST' });
      setItems(l => l.filter(q => q.id !== id));
    } catch (e) { setError(e.message); }
  };

  const limparTudo = async () => {
    if (!confirm('Marcar todas as questões deste caderno como já estudadas? Elas saem da lista, mas voltam se você errar de novo.')) return;
    setOcupado(true); setMsg('');
    try {
      const r = await api('/me/erros/limpar', { method: 'POST' });
      setItems([]);
      setMsg(`${r.limpas} questão(ões) marcadas como estudadas.`);
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  };

  return (
    <>
      <PageHead
        crumb="Estudo dirigido"
        title="Marcações"
        lead="Tudo o que merece uma segunda olhada: questões marcadas, favoritas e o caderno automático de erros e chutes."
      />

      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'erros' && (
        <div className="alert alert-info">
          <Icons.foot size={18} />
          <span>
            Este caderno se monta sozinho: entram as questões que você <strong>errou</strong> e também as que <strong>acertou no chute</strong> —
            porque acerto na sorte não é conteúdo dominado.
            <br />
            Já revisou alguma? Use <strong>“Já estudei esta”</strong> para tirá-la da lista — ela volta sozinha se você errar de novo.
          </span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {items && items.length > 0 && (
        <div className="mark-tools">
          <div className="picker-search">
            <Icons.search size={16} />
            <input type="search" value={busca} placeholder="Buscar no enunciado, tópico ou banca…"
              onChange={e => setBusca(e.target.value)} aria-label="Buscar nas marcações" />
          </div>
          {materias.length > 1 && (
            <select value={materia} onChange={e => setMateria(e.target.value)} aria-label="Filtrar por matéria">
              <option value="">Todas as matérias</option>
              {materias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <span className="mark-count">
            {visiveis.length === items.length
              ? `${items.length} questão(ões)`
              : `${visiveis.length} de ${items.length}`}
          </span>
          {tab === 'erros' && (
            <button className="btn btn-danger btn-sm" onClick={limparTudo} disabled={ocupado}>
              <Icons.trash /> {ocupado ? 'Limpando…' : 'Limpar caderno'}
            </button>
          )}
        </div>
      )}

      {!items && !error && <Spinner />}

      {items && items.length > 0 && visiveis.length === 0 && (
        <Empty icon="search" title="Nenhuma questão com esses filtros">
          Ajuste a busca ou escolha outra matéria.
        </Empty>
      )}

      {items && items.length === 0 && tab === 'revisao' && (
        <Empty icon="flag" title="Nenhuma questão marcada ainda"
          action={<Link to="/novo" className="btn btn-gold"><Icons.play /> Iniciar um simulado</Link>}>
          Durante um simulado, toque em <strong>Marcar p/ revisão</strong> em qualquer questão que queira rever com calma. Elas se juntam aqui.
        </Empty>
      )}
      {items && items.length === 0 && tab === 'favoritas' && (
        <Empty icon="star" title="Suas favoritas aparecem aqui">
          Favoritou uma questão especialmente boa? Ela fica guardada nesta aba para consulta rápida a qualquer momento.
        </Empty>
      )}
      {items && items.length === 0 && tab === 'erros' && (
        <Empty icon="foot" title="Nenhum erro ou chute registrado"
          action={<Link to="/novo" className="btn btn-gold"><Icons.play /> Iniciar um simulado</Link>}>
          Resolva simulados: cada erro — e cada acerto na sorte — entra aqui automaticamente para virar revisão.
        </Empty>
      )}

      {items && visiveis.map((q, i) => (
        <div className="mark-item" key={q.id}>
          <QuestionReview
            q={q}
            number={i + 1}
            onStateChange={aoMudarMarca}
            extraBadges={tab === 'erros' ? (
              <>
                {q.wrong_count > 0 && <span className="badge badge-bad"><Icons.x size={13} /> {q.wrong_count} erro(s)</span>}
                {q.guess_count > 0 && <span className="badge badge-chute"><Icons.foot size={15} /> {q.guess_count} chute(s)</span>}
              </>
            ) : null}
          />
          {tab === 'erros' && (
            <div className="mark-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => resolver(q.id)}
                title="Sai da lista, mas volta se você errar essa questão de novo">
                <Icons.check /> Já estudei esta
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
