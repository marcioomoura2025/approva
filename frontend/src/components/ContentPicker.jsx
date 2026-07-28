import { useMemo, useState } from 'react';
import { Icons } from './UI';

/*
  Seletor de conteúdo — substitui as listas de "pastilhas" que cresciam sem
  limite conforme o banco aumentava.

  Ideias centrais:
  - Busca no topo filtra matérias E tópicos ao mesmo tempo.
  - Os tópicos ficam recolhidos dentro de cada matéria (abre só o que interessa).
  - Marcar a matéria equivale a marcar todos os seus tópicos, então a seleção
    é sempre uma lista de topic_ids — sem ambiguidade entre matéria e tópico.
  - A área tem altura máxima e rola, então a página nunca "estoura".
*/

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ContentPicker({ subjects, selecionados, onChange }) {
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState({});   // { [subjectId]: true }

  const sel = useMemo(() => new Set(selecionados), [selecionados]);
  const termo = norm(busca.trim());

  // Filtra: mostra a matéria se ela casa com o termo, ou se algum tópico casa.
  const lista = useMemo(() => {
    if (!termo) return subjects.map(s => ({ ...s, topicsVisiveis: s.topics }));
    return subjects
      .map(s => {
        const materiaCasa = norm(s.name).includes(termo);
        const topicos = s.topics.filter(t => norm(t.name).includes(termo));
        if (!materiaCasa && !topicos.length) return null;
        return { ...s, topicsVisiveis: materiaCasa && !topicos.length ? s.topics : topicos };
      })
      .filter(Boolean);
  }, [subjects, termo]);

  const estadoMateria = (s) => {
    const ids = s.topics.map(t => t.id);
    const marcados = ids.filter(id => sel.has(id)).length;
    if (!marcados) return 'nenhum';
    return marcados === ids.length ? 'todos' : 'parcial';
  };

  const alternarMateria = (s) => {
    const ids = s.topics.map(t => t.id);
    const estado = estadoMateria(s);
    const novo = new Set(sel);
    if (estado === 'todos') ids.forEach(id => novo.delete(id));
    else ids.forEach(id => novo.add(id));
    onChange([...novo]);
  };

  const alternarTopico = (id) => {
    const novo = new Set(sel);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    onChange([...novo]);
  };

  const totalQuestoes = useMemo(() => {
    let n = 0;
    for (const s of subjects) for (const t of s.topics) if (sel.has(t.id)) n += Number(t.question_count || 0);
    return n;
  }, [subjects, sel]);

  const materiasComSelecao = subjects.filter(s => estadoMateria(s) !== 'nenhum').length;

  return (
    <div className="picker">
      <div className="picker-top">
        <div className="picker-search">
          <Icons.search size={16} />
          <input
            type="search" value={busca} placeholder="Buscar matéria ou tópico…"
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar matéria ou tópico"
          />
        </div>
        {sel.size > 0 && (
          <button type="button" className="picker-clear" onClick={() => onChange([])}>
            Limpar seleção
          </button>
        )}
      </div>

      <div className="picker-summary">
        {sel.size === 0
          ? <span className="ps-muted">Nada selecionado — o simulado usará <strong>todas as matérias</strong>.</span>
          : <span><strong>{sel.size}</strong> tópico(s) em <strong>{materiasComSelecao}</strong> matéria(s) · {totalQuestoes} questões disponíveis</span>}
      </div>

      <div className="picker-list">
        {lista.length === 0 && <div className="picker-empty">Nenhuma matéria ou tópico com “{busca}”.</div>}

        {lista.map(s => {
          const estado = estadoMateria(s);
          const aberta = termo ? true : !!abertas[s.id];
          return (
            <div className={`pk-group ${estado !== 'nenhum' ? 'has-sel' : ''}`} key={s.id}>
              <div className="pk-subject">
                <label className="pk-check">
                  <input
                    type="checkbox"
                    checked={estado === 'todos'}
                    ref={el => { if (el) el.indeterminate = estado === 'parcial'; }}
                    onChange={() => alternarMateria(s)}
                  />
                  <span className="pk-name">{s.name}</span>
                </label>
                <span className="pk-count">{s.question_count}</span>
                <button
                  type="button" className="pk-toggle"
                  onClick={() => setAbertas(a => ({ ...a, [s.id]: !aberta }))}
                  aria-expanded={aberta}
                  aria-label={aberta ? `Recolher ${s.name}` : `Expandir ${s.name}`}
                  disabled={!!termo}
                >
                  <span className={`pk-caret ${aberta ? 'open' : ''}`}>▾</span>
                </button>
              </div>

              {aberta && (
                <div className="pk-topics">
                  {s.topicsVisiveis.map(t => (
                    <label className={`pk-topic ${sel.has(t.id) ? 'on' : ''}`} key={t.id}>
                      <input type="checkbox" checked={sel.has(t.id)} onChange={() => alternarTopico(t.id)} />
                      <span className="pk-name">{t.name}</span>
                      <span className="pk-count">{t.question_count}</span>
                    </label>
                  ))}
                  {!s.topicsVisiveis.length && <div className="pk-none">Sem tópicos cadastrados.</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
