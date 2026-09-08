import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Spinner, Icons, LETTERS } from '../components/UI';
import { LogoFull } from '../components/Logo';
import '../paper.css';

/*
  Folha de prova limpa para impressão (Ctrl+P / salvar em PDF).
  Ao imprimir, apenas a folha aparece — a barra de ferramentas é ocultada via CSS.
*/
export default function Impressao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [withKey, setWithKey] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const paperId = useRef(null);
  const printing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(''); paperId.current = null;
    api(`/simulados/${id}/impressao${withKey ? '?gabarito=1' : ''}`)
      .then(d => { if (!cancelled) { setData(d); paperId.current = d.paper && d.status !== 'finalizado' ? d.id : null; } })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id, withKey]);

  useEffect(() => {
    const afterPrint = () => {
      printing.current = false;
      if (paperId.current) navigate(`/simulados/${paperId.current}/impresso`, { replace: true });
    };
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [navigate]);

  const preparePaper = async (newAttempt = false) => {
    const d = await api(`/simulados/${id}/impresso/preparar`, { method: 'POST', body: { new_attempt: newAttempt } });
    return d.id;
  };
  const print = async () => {
    if (printing.current || busy) return;
    printing.current = true; setBusy(true); setError('');
    try {
      if (!data.paper && data.status !== 'finalizado' && data.answered_count === 0) {
        paperId.current = await preparePaper();
        setData(d => ({ ...d, paper: { phase: 'ready' } }));
      }
      // Browser return means the dialog closed, including cancellation; starting
      // the actual exam always requires the separate explicit button.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
    } catch (e) { setError(e.message); }
    finally { printing.current = false; setBusy(false); }
  };
  const newPaper = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { const next = await preparePaper(true); setWithKey(false); navigate(`/simulados/${next}/imprimir`, { replace: true }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error && !data) return <div className="alert alert-error" style={{ margin: 24 }}>{error}<button className="btn btn-ghost" onClick={() => navigate('/')}>Voltar ao painel</button></div>;
  if (!data) return <Spinner />;

  const dt = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline-light btn-sm" onClick={() => navigate(-1)}>← Voltar</button>
          {data.status === 'finalizado' && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={withKey} onChange={e => setWithKey(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
            Incluir gabarito ao final
          </label>}
          {data.paper && data.status !== 'finalizado' && <Link className="btn btn-outline-light btn-sm" to={`/simulados/${id}/impresso`}><Icons.clock /> Abrir painel da prova</Link>}
        </div>
        <button className="btn btn-gold" disabled={busy} onClick={print}><Icons.print />{busy ? 'Preparando…' : 'Imprimir / salvar PDF'}</button>
      </div>

      <div className="paper-print-notice no-print">
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {(location.state?.warnings || []).map((warning, i) => <p className="alert alert-warn" key={i}>{warning}</p>)}
        {data.paper && data.status !== 'finalizado' ? <><strong>Prova impressa com cronômetro e correção</strong><p>Ao fechar a janela de impressão, o painel será aberto. Você inicia o cronômetro quando estiver pronto e transcreve as respostas depois de encerrar a prova.</p>{data.time_mode === 'questao' && <p>No papel, o tempo por questão se torna um limite total. Não há medição individual de cada questão.</p>}</> : data.status !== 'finalizado' && data.answered_count === 0 ? <><strong>Realize esta prova no papel</strong><p>Ao usar o botão de impressão, esta tentativa passa para o modo impresso. O cronômetro começa somente quando você clicar em iniciar no painel.</p><button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { const next = await preparePaper(); navigate(`/simulados/${next}/impresso`); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Já imprimi — abrir painel da prova</button></> : <><p>Esta tentativa já possui respostas ou foi concluída. Uma nova tentativa mantém este resultado no histórico.</p><button className="btn btn-ghost btn-sm" disabled={busy} onClick={newPaper}><Icons.plus /> Nova tentativa no papel</button></>}
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
                {q.passage.image_url && <img src={q.passage.image_url} alt="Imagem do texto-base" style={{ display: 'block', maxWidth: '100%', marginTop: 8 }} />}
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

        <section className="paper-blank-sheet">
          <h2>Cartão de respostas</h2><p>Assinale suas alternativas. Você irá transcrevê-las no aplicativo depois de encerrar a prova.</p>
          <div className="paper-blank-grid">{data.questions.map(q => <div key={q.position}><strong>{String(q.position).padStart(2, '0')}</strong>{q.options.map((_, i) => <span key={i}>{LETTERS[i]}</span>)}</div>)}</div>
        </section>

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
