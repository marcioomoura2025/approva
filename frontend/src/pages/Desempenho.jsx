import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Empty, Icons, StatCard, MetaEditor, fmtTime } from '../components/UI';

/* Donut animado "Domínio real geral" (SVG puro, na direção do design) */
function Donut({ pct }) {
  const r = 60, c = 2 * Math.PI * r;
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="donut" role="img" aria-label={`Domínio real de ${v}%`}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        <circle className="val" cx="75" cy="75" r={r} fill="none" stroke="var(--gold)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={go ? c * (1 - v / 100) : c} />
      </svg>
      <div className="dn-center"><span className="n">{v}%</span><span className="l">domínio</span></div>
    </div>
  );
}

export default function Desempenho() {
  const { user } = useAuth();
  const meta = user?.pass_threshold ?? 60;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/stats/geral'), api('/stats/materias'), api('/stats/topicos'), api('/stats/evolucao'),
    ]).then(([geral, materias, topicos, evolucao]) =>
      setData({ geral, materias, topicos, evolucao })
    ).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;
  const { geral, materias, topicos, evolucao } = data;

  const pctChutes = geral.total_respondidas
    ? Math.round((geral.chutes / geral.total_respondidas) * 100) : 0;
  // Subtrair decimais em JS pode gerar cauda de dígitos (35.7 - 28.6 = 7.100000000000001),
  // então arredondamos para uma casa, como o resto dos percentuais do app.
  const perdidoNoChute = Math.max(0, Math.round((geral.aproveitamento - geral.dominio_real) * 10) / 10);

  const evoData = evolucao.map((s) => ({
    name: s.title ? (s.title.length > 12 ? s.title.slice(0, 12) + '…' : s.title) : `#${s.id}`,
    Aproveitamento: s.score,
  }));

  return (
    <>
      <PageHead
        crumb="Estatísticas"
        title="Desempenho"
        lead='O "aproveitamento" conta todo acerto; o "domínio real" desconta os acertos no chute — é ele que mostra o que você realmente sabe.'
      >
        <MetaEditor />
      </PageHead>

      <div className="grid grid-4">
        <StatCard tone="navy" icon="check" label="Aproveitamento geral" value={geral.aproveitamento} suffix="%"
          foot={`${geral.total_acertos}/${geral.total_respondidas} questões`} />
        <StatCard tone="gold" icon="dominio" label="Domínio real" value={geral.dominio_real} suffix="%"
          foot={`${geral.chutes} chute(s), ${geral.acertos_no_chute} deram certo`} />
        <StatCard tone="chute" icon="foot" label="Total de chutes" value={geral.chutes}
          foot={`${pctChutes}% das respostas foram na sorte`} />
        <StatCard icon="clock" label="Tempo médio / questão" value={fmtTime(geral.tempo_medio_questao)}
          foot="minutos:segundos" />
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Aproveitamento × Domínio real por matéria</h2>
        <p className="card-sub">A distância entre a barra dourada e a navy é o quanto o chute está inflando seus acertos.</p>
        {materias.length === 0 ? (
          <Empty icon="chart" title="Sem respostas ainda">Resolva um simulado para ver esta análise.</Empty>
        ) : (
          <>
            <div style={{ width: '100%', height: 290 }}>
              <ResponsiveContainer>
                <BarChart data={materias} margin={{ top: 20, right: 8, left: -18, bottom: 4 }} barGap={6}>
                  <defs>
                    <linearGradient id="gradAprov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d8b55c" /><stop offset="100%" stopColor="#b49344" />
                    </linearGradient>
                    <linearGradient id="gradDom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#29456e" /><stop offset="100%" stopColor="#152641" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e4e2da" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }} interval={0} angle={-12} height={54} textAnchor="end" axisLine={{ stroke: '#e4e2da' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: 'rgba(180,147,68,0.07)' }} />
                  <Bar dataKey="aproveitamento" name="Aproveitamento" fill="url(#gradAprov)" radius={[7, 7, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="dominio_real" name="Domínio real" fill="url(#gradDom)" radius={[7, 7, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <span className="cl"><span className="sw" style={{ background: 'var(--gold)' }} /> Aproveitamento</span>
              <span className="cl"><span className="sw" style={{ background: 'var(--navy)' }} /> Domínio real</span>
            </div>
          </>
        )}
      </section>

      <div className="grid grid-2" style={{ marginTop: 18, alignItems: 'stretch' }}>
        <section className="card">
          <h2>Evolução</h2>
          <p className="card-sub">Aproveitamento nos últimos simulados finalizados.</p>
          {evoData.length < 2 ? (
            <Empty icon="chart" title="Poucos simulados">Finalize ao menos dois simulados para ver sua curva.</Empty>
          ) : (
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <AreaChart data={evoData} margin={{ top: 8, right: 10, left: -18, bottom: 4 }}>
                  <defs>
                    <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d8b55c" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#d8b55c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e4e2da" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: '#e4e2da' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Area type="monotone" dataKey="Aproveitamento" stroke="var(--gold)" strokeWidth={3}
                    fill="url(#goldArea)" dot={{ fill: '#fff', stroke: 'var(--gold)', strokeWidth: 3, r: 4.5 }}
                    activeDot={{ r: 6, fill: '#fff', stroke: 'var(--gold)', strokeWidth: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>Domínio real geral</h2>
          <p className="card-sub">Quanto do seu aproveitamento é conhecimento sólido.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginTop: 6, flex: 1 }}>
            <Donut pct={geral.dominio_real} />
            <div style={{ flex: 1, minWidth: 150, display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aproveitamento</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>{geral.aproveitamento}%</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--chute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Perdido no chute</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--chute)' }}>−{perdidoNoChute}%</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Aproveitamento por tópico</h2>
        <div className="table-wrap">
          {topicos.length === 0 ? (
            <Empty icon="chart" title="Sem respostas ainda">Resolva um simulado para ver esta análise.</Empty>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Tópico</th><th>Respondidas</th><th>Acertos</th><th>Aproveitamento</th><th>Domínio real</th><th>Chutes</th></tr>
              </thead>
              <tbody>
                {topicos.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.respondidas}</td>
                    <td>{t.acertos}</td>
                    <td>{t.aproveitamento}%</td>
                    <td><span className={`badge ${t.dominio_real >= meta ? 'badge-ok' : 'badge-bad'}`}>{t.dominio_real}%</span></td>
                    <td>{t.chutes > 0 ? <span className="badge badge-chute"><Icons.foot size={15} /> {t.chutes}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ResetDados />
    </>
  );
}

/* ---------- Recomeçar do zero ---------- */
function ResetDados() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [marcacoes, setMarcacoes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const fechar = () => { setAberto(false); setTexto(''); setMarcacoes(false); setErro(''); };

  const apagar = async () => {
    setBusy(true); setErro('');
    try {
      await api('/me/dados', { method: 'DELETE', body: { confirmar: 'APAGAR', marcacoes } });
      location.href = '/'; // recarrega já com tudo zerado
    } catch (e) { setErro(e.message); setBusy(false); }
  };

  return (
    <section className="danger-zone">
      <div>
        <h3>Recomeçar do zero</h3>
        <p>Apaga seus simulados e respostas, zerando estatísticas, ranking e revisão programada. O banco de questões não é afetado, e as outras contas também não.</p>
      </div>
      <button className="btn btn-danger btn-sm" onClick={() => setAberto(true)}>
        <Icons.trash /> Apagar meu histórico
      </button>

      {aberto && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) fechar(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ttl-reset">
            <h3 id="ttl-reset">Apagar seu histórico?</h3>
            <p>Serão apagados <strong>todos os seus simulados e respostas</strong>. Isto <strong>não pode ser desfeito</strong>.</p>

            <label className="chk">
              <input type="checkbox" checked={marcacoes} onChange={e => setMarcacoes(e.target.checked)} />
              <span>Apagar também favoritos, marcações de revisão e anotações</span>
            </label>

            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="conf">Para confirmar, digite <strong>APAGAR</strong></label>
              <input id="conf" value={texto} autoFocus autoComplete="off"
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') fechar(); }} />
            </div>

            {erro && <div className="alert alert-error" style={{ marginTop: 12 }}>{erro}</div>}

            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={fechar} disabled={busy}>Cancelar</button>
              <button className="btn btn-danger btn-sm" disabled={texto !== 'APAGAR' || busy} onClick={apagar}>
                {busy ? 'Apagando…' : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
