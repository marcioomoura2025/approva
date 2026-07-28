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
  const vencidos = [];
  const proximos = [];

  for (const list of byTopic.values()) {
    list.sort((a, b) => a.rn - b.rn);
    const last = list[0];
    const prev = list[1] || null;
    const { dias, motivo } = intervalFor(last, prev);
    const respondidoEm = parseUtc(last.answered_at);
    const dueAt = respondidoEm + dias * 864e5;

    const base = {
      topic_id: last.topic_id,
      topic_name: last.topic_name,
      subject_name: last.subject_name,
      motivo,                                   // errou | chute | acerto | solido
      intervalo_dias: dias,
      dias_desde_resposta: Math.floor((now - respondidoEm) / 864e5),
      ultima_resposta: last.answered_at,
    };

    if (now >= dueAt) {
      vencidos.push({ ...base, dias_em_atraso: Math.max(0, Math.floor((now - dueAt) / 864e5)) });
    } else {
      // Ainda "descansando": guardamos quando volta, para a tela poder dizer
      // "tudo em dia — próxima revisão em X dias" em vez de parecer vazia.
      proximos.push({ ...base, dias_para_revisar: Math.max(1, Math.ceil((dueAt - now) / 864e5)) });
    }
  }

  // Mais atrasado primeiro; empate → quem errou/chutou tem prioridade.
  const peso = { errou: 0, chute: 1, acerto: 2, solido: 3 };
  vencidos.sort((a, b) => (b.dias_em_atraso - a.dias_em_atraso) || (peso[a.motivo] - peso[b.motivo]));
  proximos.sort((a, b) => a.dias_para_revisar - b.dias_para_revisar);
  return { vencidos, proximos };
}

// Lista de tópicos prontos para revisão (e os que ainda estão descansando).
router.get('/revisao-programada', auth, async (req, res) => {
  const { vencidos, proximos } = await dueTopics(req.user.id);
  res.json({
    total: vencidos.length,
    itens: vencidos,
    proximos,
    // Diferencia "nunca respondeu nada" de "respondeu, mas ainda não venceu".
    ja_estudou: vencidos.length + proximos.length > 0,
    proximo_em_dias: proximos.length ? proximos[0].dias_para_revisar : null,
  });
});

// Resumo enxuto para o card do Painel.
router.get('/revisao-programada/resumo', auth, async (req, res) => {
  const { vencidos, proximos } = await dueTopics(req.user.id);
  res.json({
    total: vencidos.length,
    urgentes: vencidos.filter((i) => i.motivo === 'errou' || i.motivo === 'chute').length,
    topic_ids: vencidos.map((i) => i.topic_id),
    ja_estudou: vencidos.length + proximos.length > 0,
    proximo_em_dias: proximos.length ? proximos[0].dias_para_revisar : null,
  });
});

module.exports = router;
module.exports.dueTopics = dueTopics;
