import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Spinner, Icons, LETTERS } from '../components/UI';
import { LogoFull } from '../components/Logo';

/*
  Folha de prova limpa para impressão (Ctrl+P / salvar em PDF).
  Ao imprimir, apenas a folha aparece — a barra de ferramentas é ocultada via CSS.
*/
export default function Impressao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [withKey, setWithKey] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/simulados/${id}/impressao${withKey ? '?gabarito=1' : ''}`)
      .then(setData)
      .catch(e => setError(e.message));
  }, [id, withKey]);

  if (error) return <div className="alert alert-error" style={{ margin: 24 }}>{error}</div>;
  if (!data) return <Spinner />;

  const dt = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline-light btn-sm" onClick={() => navigate(-1)}>← Voltar</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={withKey} onChange={e => setWithKey(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
            Incluir gabarito ao final
          </label>
        </div>
        <button className="btn btn-gold" onClick={() => window.print()}><Icons.print /> Imprimir / salvar PDF</button>
      </div>

      <div className="print-sheet">
        <div className="ph">
          <div>
            <LogoFull tone="dark" height={56} />
            <h1 style={{ marginTop: 10 }}>{data.title || `Simulado #${data.id}`}</h1>
          </div>
          <div className="meta">
            {data.questions.length} QUESTÕES<br />
            GERADO EM {dt}
          </div>
        </div>
        <div className="id-fields">
          <span>Nome: </span>
          <span style={{ maxWidth: 160 }}>Data: </span>
        </div>

        {data.questions.map(q => (
          <div className="print-q" key={q.position}>
            <div className="pq-head">
              <strong>{String(q.position).padStart(2, '0')}.</strong>{' '}
              {q.subject_name} · {q.topic_name}
              {q.banca ? ` · ${q.banca}${q.ano ? ` ${q.ano}` : ''}` : ''}
              {q.orgao ? ` · ${q.orgao}` : ''}
            </div>
            {q.passage && (
              <div className="print-passage">
                {q.passage.title && <strong>{q.passage.title}<br /></strong>}
                <span style={{ whiteSpace: 'pre-wrap' }}>{q.passage.content}</span>
                {q.passage.source && <div style={{ fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic' }}>{q.passage.source}</div>}
              </div>
            )}
            <div className="pq-statement">{q.statement}</div>
            {q.image_url && <img src={q.image_url} alt="" style={{ maxWidth: '70%', margin: '6px 0' }} />}
            <ol>
              {q.options.map((opt, i) => (
                <li key={i}><span className="pl">{LETTERS[i]})</span><span>{opt}</span></li>
              ))}
            </ol>
          </div>
        ))}

        {data.gabarito && (
          <div className="print-key">
            <h2>Gabarito</h2>
            <div className="key-grid">
              {data.gabarito.map(g => (
                <span className="key-cell" key={g.position}>{String(g.position).padStart(2, '0')} → {g.letra}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
