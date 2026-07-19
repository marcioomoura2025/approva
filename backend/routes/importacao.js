const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { all, get, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const COLUMNS = ['materia', 'topico', 'enunciado', 'imagem_url', 'alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e', 'correta', 'comentario', 'dificuldade', 'banca', 'ano', 'orgao', 'cargo', 'nivel', 'video_url', 'texto_base_titulo', 'texto_base_conteudo', 'texto_base_fonte', 'texto_base_imagem_url'];

// Gera e baixa o arquivo-modelo .xlsx com uma linha de exemplo.
router.get('/importacao/modelo', auth, adminOnly, (_req, res) => {
  // Exemplo 2: questão de interpretação com texto-base. Linhas que repetirem o
  // mesmo texto_base_titulo compartilham o MESMO texto-base (criado uma única vez).
  const example2 = {
    materia: 'Língua Portuguesa',
    topico: 'Interpretação de texto',
    enunciado: 'Segundo o texto, a disciplina diária do candidato:',
    imagem_url: '',
    alternativa_a: 'É menos importante do que a motivação momentânea.',
    alternativa_b: 'Constrói o resultado ao longo do tempo.',
    alternativa_c: 'Deve ser substituída por longas sessões esporádicas.',
    alternativa_d: 'Não influencia o desempenho na prova.',
    alternativa_e: '',
    correta: 'B',
    comentario: 'O texto defende que a constância dos pequenos avanços diários é o que gera aprovação.',
    dificuldade: 'facil',
    banca: 'FGV',
    ano: 2024,
    orgao: 'TJ-MG',
    cargo: 'Analista Judiciário',
    nivel: 'superior',
    video_url: '',
    texto_base_titulo: 'O valor do hábito',
    texto_base_conteudo: 'A aprovação em um concurso raramente nasce de um único dia heroico de estudos. Ela é construída na soma silenciosa de pequenos avanços diários: a questão resolvida no intervalo, a revisão feita mesmo no cansaço, o simulado encarado como ensaio do dia da prova. Quem transforma o estudo em hábito deixa de depender da motivação — e passa a contar com a constância.',
    texto_base_fonte: 'Texto adaptado para fins didáticos',
    texto_base_imagem_url: '',
  };
  const example = {
    materia: 'Língua Portuguesa',
    topico: 'Concordância verbal',
    enunciado: 'Assinale a frase em que a concordância verbal está correta.',
    imagem_url: '',
    alternativa_a: 'Fazem dois anos que estudo para concursos.',
    alternativa_b: 'Houveram muitos aprovados neste ano.',
    alternativa_c: 'Faz dois anos que estudo para concursos.',
    alternativa_d: 'Existe muitas vagas neste edital.',
    alternativa_e: '',
    correta: 'C',
    comentario: 'O verbo "fazer" indicando tempo decorrido é impessoal e fica na 3ª pessoa do singular.',
    dificuldade: 'media',
    banca: 'FGV',
    ano: 2024,
    orgao: 'TJ-MG',
    cargo: 'Analista Judiciário',
    nivel: 'superior',
    video_url: '',
    texto_base_titulo: '',
    texto_base_conteudo: '',
    texto_base_fonte: '',
    texto_base_imagem_url: '',
  };
  const ws = XLSX.utils.json_to_sheet([example, example2], { header: COLUMNS });
  ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(14, c.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'questoes');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-approva.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Exporta TODO o banco de questões para .xlsx no mesmo formato do modelo de
// importação — o arquivo gerado pode ser reimportado (backup / edição em massa).
router.get('/importacao/exportar', auth, adminOnly, async (_req, res) => {
  const rows = await all(`
    SELECT
      s.name  AS materia,
      t.name  AS topico,
      q.statement, q.image_url, q.options, q.correct_index, q.comment, q.difficulty,
      q.banca, q.ano, q.orgao, q.cargo, q.nivel, q.video_url,
      p.title AS p_title, p.content AS p_content, p.source AS p_source, p.image_url AS p_image
    FROM questions q
    JOIN topics   t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN passages p ON p.id = q.passage_id
    ORDER BY s.name, t.name, q.id`);

  // Um texto-base compartilhado por várias questões só traz o conteúdo na
  // primeira linha em que aparece — igual à regra da importação.
  const seenPassages = new Set();

  const data = rows.map((r) => {
    let options = [];
    try { options = JSON.parse(r.options) || []; } catch { options = []; }

    const row = {
      materia: r.materia || '',
      topico: r.topico || '',
      enunciado: r.statement || '',
      imagem_url: r.image_url || '',
      alternativa_a: options[0] ?? '',
      alternativa_b: options[1] ?? '',
      alternativa_c: options[2] ?? '',
      alternativa_d: options[3] ?? '',
      alternativa_e: options[4] ?? '',
      correta: Number.isInteger(r.correct_index) ? String.fromCharCode(65 + r.correct_index) : '',
      comentario: r.comment || '',
      dificuldade: r.difficulty || '',
      banca: r.banca || '',
      ano: r.ano ?? '',
      orgao: r.orgao || '',
      cargo: r.cargo || '',
      nivel: r.nivel || '',
      video_url: r.video_url || '',
      texto_base_titulo: '',
      texto_base_conteudo: '',
      texto_base_fonte: '',
      texto_base_imagem_url: '',
    };

    if (r.p_content) {
      const key = (r.p_title || r.p_content).toLowerCase();
      row.texto_base_titulo = r.p_title || '';
      if (!seenPassages.has(key)) {
        row.texto_base_conteudo = r.p_content || '';
        row.texto_base_fonte = r.p_source || '';
        row.texto_base_imagem_url = r.p_image || '';
        seenPassages.add(key);
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS });
  ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'questoes');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="banco-questoes-approva-${stamp}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Converte "A".."E" ou "1".."5" para índice 0-based.
function parseCorrect(value, optionCount) {
  const v = String(value ?? '').trim().toUpperCase();
  if (!v) return null;
  let idx = null;
  if (/^[A-E]$/.test(v)) idx = v.charCodeAt(0) - 65;
  else if (/^[1-5]$/.test(v)) idx = parseInt(v, 10) - 1;
  if (idx === null || idx < 0 || idx >= optionCount) return null;
  return idx;
}

router.post('/importacao', auth, adminOnly, upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo .xlsx.' });
  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch {
    return res.status(400).json({ error: 'Não foi possível ler a planilha. Confirme que é um arquivo .xlsx válido.' });
  }
  if (!rows.length) return res.status(400).json({ error: 'A planilha está vazia.' });

  const errors = [];
  let imported = 0;
  const subjectCache = new Map(); // nome -> id
  const topicCache = new Map();   // "subjectId|nome" -> id
  const passageCache = new Map(); // chave (título ou conteúdo) -> id

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2; // linha na planilha (1 = cabeçalho)
    const r = rows[i];
    const materia = String(r.materia ?? '').trim();
    const topico = String(r.topico ?? '').trim();
    const enunciado = String(r.enunciado ?? '').trim();
    if (!materia || !topico || !enunciado) {
      errors.push({ linha: line, motivo: 'Campos obrigatórios ausentes (materia, topico e enunciado).' });
      continue;
    }
    const options = ['alternativa_a', 'alternativa_b', 'alternativa_c', 'alternativa_d', 'alternativa_e']
      .map(k => String(r[k] ?? '').trim()).filter(Boolean);
    if (options.length < 2) {
      errors.push({ linha: line, motivo: 'Preencha ao menos 2 alternativas.' });
      continue;
    }
    const correctIndex = parseCorrect(r.correta, options.length);
    if (correctIndex === null) {
      errors.push({ linha: line, motivo: `Coluna "correta" inválida (use letra A–E ou número 1–5 dentro do total de alternativas).` });
      continue;
    }
    let difficulty = String(r.dificuldade ?? '').trim().toLowerCase() || 'media';
    if (!['facil', 'media', 'dificil'].includes(difficulty)) difficulty = 'media';

    // Texto-base (opcional): linhas com o mesmo título compartilham o mesmo texto.
    const tbTitulo = String(r.texto_base_titulo ?? '').trim();
    const tbConteudo = String(r.texto_base_conteudo ?? '').trim();
    const tbFonte = String(r.texto_base_fonte ?? '').trim();
    const tbImagem = String(r.texto_base_imagem_url ?? '').trim();

    try {
      let passageId = null;
      if (tbTitulo || tbConteudo) {
        const pKey = (tbTitulo || tbConteudo).toLowerCase();
        passageId = passageCache.get(pKey) || null;
        if (!passageId) {
          // Reaproveita um texto-base já cadastrado com o mesmo título (ou conteúdo idêntico).
          const existing = tbTitulo
            ? await get('SELECT id FROM passages WHERE lower(title) = lower(?)', [tbTitulo])
            : await get('SELECT id FROM passages WHERE content = ?', [tbConteudo]);
          if (existing) {
            passageId = existing.id;
          } else if (tbConteudo) {
            passageId = (await run(
              'INSERT INTO passages (title, content, source, image_url) VALUES (?, ?, ?, ?)',
              [tbTitulo || null, tbConteudo, tbFonte || null, tbImagem || null]
            )).lastId;
          } else {
            errors.push({ linha: line, motivo: `Texto-base "${tbTitulo}" não existe: preencha "texto_base_conteudo" na primeira linha que o utiliza.` });
            continue;
          }
          passageCache.set(pKey, passageId);
        }
      }

      // Matérias/tópicos inexistentes são criados automaticamente.
      let subjectId = subjectCache.get(materia.toLowerCase());
      if (!subjectId) {
        const existing = await get('SELECT id FROM subjects WHERE lower(name) = lower(?)', [materia]);
        subjectId = existing ? existing.id : (await run('INSERT INTO subjects (name) VALUES (?)', [materia])).lastId;
        subjectCache.set(materia.toLowerCase(), subjectId);
      }
      const tKey = `${subjectId}|${topico.toLowerCase()}`;
      let topicId = topicCache.get(tKey);
      if (!topicId) {
        const existing = await get('SELECT id FROM topics WHERE subject_id = ? AND lower(name) = lower(?)', [subjectId, topico]);
        topicId = existing ? existing.id : (await run('INSERT INTO topics (subject_id, name) VALUES (?, ?)', [subjectId, topico])).lastId;
        topicCache.set(tKey, topicId);
      }
      const ano = String(r.ano ?? '').trim() ? parseInt(r.ano, 10) : null;
      await run(`
        INSERT INTO questions (topic_id, passage_id, statement, image_url, options, correct_index, comment, difficulty, banca, ano, orgao, cargo, nivel, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [topicId, passageId, enunciado, String(r.imagem_url ?? '').trim() || null, JSON.stringify(options), correctIndex,
         String(r.comentario ?? '').trim() || null, difficulty,
         String(r.banca ?? '').trim() || null, Number.isFinite(ano) ? ano : null,
         String(r.orgao ?? '').trim() || null, String(r.cargo ?? '').trim() || null,
         String(r.nivel ?? '').trim().toLowerCase() || null, String(r.video_url ?? '').trim() || null]);
      imported++;
    } catch (e) {
      errors.push({ linha: line, motivo: 'Erro ao gravar a questão: ' + e.message });
    }
  }

  res.json({ importadas: imported, total_linhas: rows.length, erros: errors });
});

module.exports = router;
