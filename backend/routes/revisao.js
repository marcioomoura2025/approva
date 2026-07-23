const express = require('express');
const { all } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

/*
  Repetição espaçada — sem tabela nova: tudo é derivado do histórico de respostas.

  Para cada tópico que o usuário já respondeu, olhamos a resposta MAIS RECENTE
  (e a penúltima, para detectar "acerto com folga") e definimos o intervalo até
  a próxima revisão:

    errou                         → 2 dias
    acertou, mas chutou           → 3 dias   (acerto na sorte quase não conta)
    acertou (sem chute)           → 7 dias
    acertou as 2 últimas s/ chute → 16 dias  (demonstrou domínio consistente)

  "Vencido" = já passou a data de revisão (agora >= última resposta + intervalo).
  A antecedência (dias em atraso) serve para ordenar: o mais atrasado primeiro.
*/

const INTERVALS = { errou: 2, chute: 3, acerto: 7, solido: 16 };

function intervalFor(last, prev) {
  if (!last.is_correct) return { dias: INTERVALS.errou, motivo: 'errou' };
  if (last.guessed) return { dias: INTERVALS.chute, motivo: 'chute' };
  if (prev && prev.is_correct && !prev.guessed) return { dias: INTERVALS.solido, motivo: 'solido' };
  return { dias: INTERVALS.acerto, motivo: 'acerto' };
}

async function dueTopics(userId) {
  // Duas respostas mais recentes por tópico (janela por answered_at).
  const rows = await all(`
    SELECT t.id AS topic_id, t.name AS topic_name,
           s.id AS subject_id, s.name AS subject_name,
           a.is_correct, a.guessed, a.answered_at,
           ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY a.answered_at DESC, a.id DESC) AS rn
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN topics t    ON t.id = q.topic_id
    JOIN subjects s  ON s.id = t.subject_id
    WHERE a.user_id = ?`, [userId]);

  // Agrupa por tópico preservando a ordem (rn=1 é a última resposta).
  const byTopic = new Map();
  for (const r of rows) {
    if (!byTopic.has(r.topic_id)) byTopic.set(r.topic_id, []);
    byTopic.get(r.topic_id).push(r);
  }

  const now = Date.now();
  const parseUtc = (s) => Date.parse(String(s).replace(' ', 'T') + 'Z');
  const items = [];

  for (const list of byTopic.values()) {
    list.sort((a, b) => a.rn - b.rn);
    const last = list[0];
    const prev = list[1] || null;
    const { dias, motivo } = intervalFor(last, prev);
    const dueAt = parseUtc(last.answered_at) + dias * 864e5;
    const overdueDays = Math.floor((now - dueAt) / 864e5);
    if (now >= dueAt) {
      items.push({
        topic_id: last.topic_id,
        topic_name: last.topic_name,
        subject_name: last.subject_name,
        motivo,                                   // errou | chute | acerto | solido
        intervalo_dias: dias,
        dias_desde_resposta: Math.floor((now - parseUtc(last.answered_at)) / 864e5),
        dias_em_atraso: Math.max(0, overdueDays),
        ultima_resposta: last.answered_at,
      });
    }
  }

  // Mais atrasado primeiro; empate → quem errou/chutou tem prioridade.
  const peso = { errou: 0, chute: 1, acerto: 2, solido: 3 };
  items.sort((a, b) => (b.dias_em_atraso - a.dias_em_atraso) || (peso[a.motivo] - peso[b.motivo]));
  return items;
}

// Lista de tópicos prontos para revisão.
router.get('/revisao-programada', auth, async (req, res) => {
  const itens = await dueTopics(req.user.id);
  res.json({ total: itens.length, itens });
});

// Resumo enxuto para o card do Painel.
router.get('/revisao-programada/resumo', auth, async (req, res) => {
  const itens = await dueTopics(req.user.id);
  res.json({
    total: itens.length,
    urgentes: itens.filter((i) => i.motivo === 'errou' || i.motivo === 'chute').length,
    topic_ids: itens.map((i) => i.topic_id),
  });
});

module.exports = router;
module.exports.dueTopics = dueTopics;
