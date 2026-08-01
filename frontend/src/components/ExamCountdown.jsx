import { useState } from 'react';
import { api } from '../api';
import { Icons } from './UI';

/*
  Contagem regressiva até a prova.

  Decisões de desenho:
  - O número sozinho ("23 dias") é pressão sem direção. Por isso o card mostra
    ao lado o que existe para fazer hoje (tópicos pedindo revisão).
  - A conta de dias usa o dia LOCAL do usuário, não UTC: perto da meia-noite,
    UTC erraria por um dia.
  - Depois que a data passa, o card muda de tom em vez de mostrar número negativo.
*/

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function hojeLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diasAte(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  return Math.round((alvo - hojeLocal()) / 864e5);
}

function porExtenso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export default function ExamCountdown({ dados, revisao, onChange }) {
  const [abrindo, setAbrindo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const alvos = dados?.alvos || [];
  const proximo = alvos.map(a => ({ ...a, dias: diasAte(a.exam_date) }))
    .sort((x, y) => x.dias - y.dias)
    .find(a => a.dias >= 0) || null;

  const abrirNovo = () => {
    setEditando(null); setNome(''); setData(''); setErro(''); setAbrindo(true);
  };
  const abrirEdicao = (a) => {
    setEditando(a); setNome(a.name); setData(a.exam_date); setErro(''); setAbrindo(true);
  };

  const salvar = async () => {
    setBusy(true); setErro('');
    try {
      const corpo = { name: nome.trim(), exam_date: data };
      if (editando) await api(`/provas-alvo/${editando.id}`, { method: 'PUT', body: corpo });
      else await api('/provas-alvo', { method: 'POST', body: corpo });
      setAbrindo(false);
      onChange?.();
    } catch (e) { setErro(e.message); }
    finally { setBusy(false); }
  };

  const remover = async (a) => {
    if (!confirm(`Parar de acompanhar “${a.name}”?`)) return;
    try { await api(`/provas-alvo/${a.id}`, { method: 'DELETE' }); onChange?.(); }
    catch (e) { setErro(e.message); }
  };

  const dispensar = async () => {
    try { await api('/provas-alvo/dispensar', { method: 'POST' }); onChange?.(); }
    catch (e) { setErro(e.message); }
  };

  // ---------- formulário (usado tanto para criar quanto para editar) ----------
  const formulario = (
    <div className="alvo-form">
      <div className="af-campos">
        <div className="field">
          <label htmlFor="alvo-nome">Concurso</label>
          <input id="alvo-nome" value={nome} maxLength={60} autoFocus
            placeholder="Ex.: TJ-MG — Analista Judiciário"
            onChange={e => { setNome(e.target.value); setErro(''); }} />
        </div>
        <div className="field">
          <label htmlFor="alvo-data">Data da prova</label>
          <input id="alvo-data" type="date" value={data}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => { setData(e.target.value); setErro(''); }} />
        </div>
      </div>
      {erro && <div className="af-erro">{erro}</div>}
      <div className="af-acoes">
        <button className="btn btn-gold btn-sm" onClick={salvar} disabled={busy || !nome.trim() || !data}>
          {busy ? 'Salvando…' : editando ? 'Salvar' : 'Marcar data'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAbrindo(false)} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );

  // ---------- 1) ainda não perguntamos ----------
  if (!alvos.length && dados?.perguntar && !abrindo) {
    return (
      <section className="alvo-card pergunta">
        <span className="ac-ic"><Icons.calendar size={20} /></span>
        <div className="ac-texto">
          <strong>Tem algum concurso à vista?</strong>
          <span>Marque a data da prova e acompanhe a contagem regressiva por aqui.</span>
        </div>
        <div className="ac-acoes">
          <button className="btn btn-gold btn-sm" onClick={abrirNovo}>Sim, marcar data</button>
          <button className="btn btn-ghost btn-sm" onClick={dispensar}>Agora não</button>
        </div>
      </section>
    );
  }

  // ---------- 2) formulário aberto ----------
  if (abrindo) {
    return (
      <section className="alvo-card">
        <div className="ac-topo">
          <span className="ac-ic"><Icons.calendar size={20} /></span>
          <strong>{editando ? 'Editar concurso' : 'Marcar a data da prova'}</strong>
        </div>
        {formulario}
      </section>
    );
  }

  // ---------- 3) sem alvo e já dispensado ----------
  // Não desaparece por completo: fica um acesso discreto, para quando um
  // concurso aparecer no meio do caminho.
  if (!alvos.length) {
    return (
      <button type="button" className="alvo-atalho" onClick={abrirNovo}>
        <Icons.calendar size={15} /> Marcar a data de um concurso
      </button>
    );
  }

  // ---------- 4) contagem regressiva ----------
  const passados = alvos.map(a => ({ ...a, dias: diasAte(a.exam_date) })).filter(a => a.dias < 0);
  const alvo = proximo || passados[passados.length - 1];
  const dias = alvo.dias;
  const futuro = dias >= 0;

  let numero, rotulo;
  if (dias > 0) { numero = dias; rotulo = dias === 1 ? 'dia' : 'dias'; }
  else if (dias === 0) { numero = 'Hoje'; rotulo = 'é o dia'; }
  else { numero = Math.abs(dias); rotulo = Math.abs(dias) === 1 ? 'dia atrás' : 'dias atrás'; }

  return (
    <section className={`alvo-card contagem${futuro ? '' : ' passou'}`}>
      <div className="ac-num">
        <strong>{numero}</strong>
        <span>{rotulo}</span>
      </div>
      <div className="ac-texto">
        <strong>{alvo.name}</strong>
        <span>{porExtenso(alvo.exam_date)}</span>
        {futuro && dias > 0 && (
          <span className="ac-plano">
            {revisao?.total > 0
              ? <>Hoje tem <strong>{revisao.total}</strong> {revisao.total === 1 ? 'tópico' : 'tópicos'} pedindo revisão.</>
              : <>Nenhuma revisão vencida — bom momento para avançar em conteúdo novo.</>}
          </span>
        )}
        {!futuro && <span className="ac-plano">Como foi? Marque o próximo desafio quando quiser.</span>}
      </div>
      <div className="ac-acoes">
        <button className="btn btn-ghost btn-sm" onClick={() => abrirEdicao(alvo)} title="Editar">✎</button>
        <button className="btn btn-ghost btn-sm" onClick={() => remover(alvo)} title="Remover">
          <Icons.trash />
        </button>
        {alvos.length < 10 && (
          <button className="btn btn-ghost btn-sm" onClick={abrirNovo} title="Acompanhar outro concurso">
            <Icons.plus />
          </button>
        )}
      </div>
      {alvos.length > 1 && (
        <div className="ac-outros">
          {alvos.map(a => ({ ...a, dias: diasAte(a.exam_date) }))
            .filter(a => a.id !== alvo.id)
            .sort((x, y) => x.dias - y.dias)
            .map(a => (
              <span className="ac-outro" key={a.id}>
                {a.name} · {a.dias >= 0 ? `em ${a.dias} dia(s)` : 'já passou'}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
