import { useEffect, useState } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { PageHead, Spinner, Empty, Icons } from '../components/UI';
import QuestionReview from '../components/QuestionReview';

const TABS = [
  { key: 'revisao', label: 'Marcadas p/ revisão' },
  { key: 'favoritas', label: 'Favoritas' },
  { key: 'erros', label: 'Erros & chutes' },
];

export default function Revisoes() {
  const [tab, setTab] = useState('revisao');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(null); setError('');
    const path = tab === 'erros' ? '/me/erros' : `/me/marcadas/completas?tipo=${tab}`;
    api(path).then(setItems).catch(e => setError(e.message));
  }, [tab]);

  return (
    <>
      <PageHead
        crumb="Estudo dirigido"
        title="Revisões"
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
          </span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {!items && !error && <Spinner />}

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

      {items && items.map((q, i) => (
        <QuestionReview
          key={q.id}
          q={q}
          number={i + 1}
          extraBadges={tab === 'erros' ? (
            <>
              {q.wrong_count > 0 && <span className="badge badge-bad"><Icons.x size={13} /> {q.wrong_count} erro(s)</span>}
              {q.guess_count > 0 && <span className="badge badge-chute"><Icons.foot size={15} /> {q.guess_count} chute(s)</span>}
            </>
          ) : null}
        />
      ))}
    </>
  );
}
