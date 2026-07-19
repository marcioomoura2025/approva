import { useState } from 'react';
import { api } from '../api';
import { Icons, LETTERS } from './UI';

/*
  Exibe uma questão em modo de revisão: enunciado, texto-base, alternativas
  (correta destacada; a marcada pelo usuário, se errou), comentário, vídeo
  e anotação pessoal editável. `q` deve conter correct_index (gabarito revelado).
*/
export default function QuestionReview({ q, number, extraBadges = null, onStateChange }) {
  const [note, setNote] = useState(q.note || '');
  const [savedNote, setSavedNote] = useState(q.note || '');
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState({ favorite: !!q.favorite, review: !!q.review });
  const [err, setErr] = useState('');

  const toggle = async (kind) => {
    setErr('');
    try {
      const path = kind === 'favorite' ? `/questoes/${q.id}/favorito` : `/questoes/${q.id}/revisao`;
      const d = await api(path, { method: 'POST' });
      const next = { ...flags, [kind]: kind === 'favorite' ? d.favorite : d.review };
      setFlags(next);
      onStateChange?.(q.id, next);
    } catch (e) { setErr(e.message); }
  };

  const saveNote = async () => {
    setSaving(true); setErr('');
    try {
      await api(`/questoes/${q.id}/anotacao`, { method: 'PUT', body: { note } });
      setSavedNote(note.trim());
      setNote(note.trim());
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const answered = q.selected_index !== undefined && q.selected_index !== null;
  const skipped = q.answered && q.selected_index === null;

  return (
    <article className="qreview">
      <div className="qr-head">
        <div>
          <div className="qr-num">QUESTÃO {String(number).padStart(2, '0')}</div>
          <div className="origin-line" style={{ marginTop: 6 }}>
            <span>{q.subject_name}</span>
            <span>{q.topic_name}</span>
            {q.banca && <span>{q.banca}{q.ano ? ` · ${q.ano}` : ''}</span>}
            {q.orgao && <span>{q.orgao}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {extraBadges}
          {q.guessed && <span className="badge badge-chute"><Icons.foot size={13} /> Chutou</span>}
          {skipped && <span className="badge badge-bad"><Icons.clock size={13} /> Tempo esgotado</span>}
        </div>
      </div>

      {q.passage && (
        <div className="passage-box">
          {q.passage.title && <div className="p-title">{q.passage.title}</div>}
          <div style={{ whiteSpace: 'pre-wrap' }}>{q.passage.content}</div>
          {q.passage.image_url && <img src={q.passage.image_url} alt="Imagem do texto-base" />}
          {q.passage.source && <div className="p-source">{q.passage.source}</div>}
        </div>
      )}

      <p className="q-statement" style={{ fontSize: 15.5, margin: '10px 0 14px' }}>{q.statement}</p>
      {q.image_url && <img className="q-image" src={q.image_url} alt="Imagem da questão" />}

      <div style={{ display: 'grid', gap: 6 }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isUserWrong = answered && i === q.selected_index && !isCorrect;
          return (
            <div key={i} className={`qr-alt ${isCorrect ? 'is-correct' : ''} ${isUserWrong ? 'is-wrong' : ''}`}>
              <span className="letter">{LETTERS[i]})</span>
              <span>
                {opt}
                {isCorrect && <strong> — correta</strong>}
                {isUserWrong && <strong> — sua resposta</strong>}
              </span>
            </div>
          );
        })}
      </div>

      {q.comment && (
        <div className="qr-comment"><strong>Comentário:</strong> {q.comment}</div>
      )}
      {q.video_url && (
        <p style={{ marginTop: 12 }}>
          <a href={q.video_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
            <Icons.video /> Assistir à resolução em vídeo
          </a>
        </p>
      )}

      <div className="flag-row">
        <button className={`flag-btn ${flags.review ? 'on' : ''}`} onClick={() => toggle('review')}>
          <Icons.flag size={14} /> {flags.review ? 'Marcada p/ revisão' : 'Marcar p/ revisão'}
        </button>
        <button className={`flag-btn ${flags.favorite ? 'on' : ''}`} onClick={() => toggle('favorite')}>
          <Icons.star size={14} /> {flags.favorite ? 'Favorita' : 'Favoritar'}
        </button>
      </div>

      <div className="note-box" style={{ marginTop: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Sua anotação</label>
          <textarea
            rows={2}
            placeholder="Escreva um lembrete, macete ou o motivo do erro…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        {note.trim() !== savedNote && (
          <div className="note-actions">
            <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar anotação'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setNote(savedNote)}>Descartar</button>
          </div>
        )}
      </div>
      {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
    </article>
  );
}
