import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHead, Spinner, Empty } from '../components/UI';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Ranking() {
  const { user } = useAuth();
  const meta = user?.pass_threshold ?? 60;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/ranking').then(setRows).catch(e => setError(e.message)); }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <Spinner />;

  return (
    <>
      <PageHead
        crumb="Comunidade"
        title="Ranking"
        lead="Classificação pela média de aproveitamento nos simulados finalizados."
      />
      <section className="card">
        {rows.length === 0 ? (
          <Empty icon="trophy" title="Ranking vazio">Assim que alguém finalizar um simulado, a classificação aparece aqui.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th style={{ width: 70 }}>Pos.</th><th>Estudante</th><th>Simulados</th><th>Acertos</th><th>Média</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.user_id} className={r.voce ? 'is-you' : ''}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {MEDALS[r.posicao - 1] || `${r.posicao}º`}
                    </td>
                    <td>
                      <strong>{r.nome}</strong>
                      {r.voce && <span className="badge badge-gold" style={{ marginLeft: 8 }}>você</span>}
                    </td>
                    <td>{r.simulados}</td>
                    <td>{r.acertos}</td>
                    <td><span className={`badge ${r.media >= meta ? 'badge-ok' : 'badge-bad'}`}>{r.media}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
