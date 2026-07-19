// Popula o banco com dados de demonstração: matérias, tópicos, texto-base,
// questões de exemplo e um usuário administrador (admin@aprova.local / admin123).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { get, run, init } = require('./db');

async function upsertSubject(name) {
  const existing = await get('SELECT id FROM subjects WHERE name = ?', [name]);
  if (existing) return existing.id;
  return (await run('INSERT INTO subjects (name) VALUES (?)', [name])).lastId;
}
async function upsertTopic(subjectId, name) {
  const existing = await get('SELECT id FROM topics WHERE subject_id = ? AND name = ?', [subjectId, name]);
  if (existing) return existing.id;
  return (await run('INSERT INTO topics (subject_id, name) VALUES (?, ?)', [subjectId, name])).lastId;
}
async function addQuestion(q) {
  await run(`
    INSERT INTO questions (topic_id, passage_id, statement, options, correct_index, comment, difficulty, banca, ano, orgao, cargo, nivel, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [q.topic_id, q.passage_id || null, q.statement, JSON.stringify(q.options), q.correct_index,
     q.comment || null, q.difficulty || 'media', q.banca || null, q.ano || null, q.orgao || null,
     q.cargo || null, q.nivel || null, q.video_url || null]);
}

async function main() {
  await init();

  // Admin de demonstração
  const adminEmail = 'admin@aprova.local';
  if (!(await get('SELECT id FROM users WHERE email = ?', [adminEmail]))) {
    const hash = await bcrypt.hash('admin123', 10);
    await run(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
      ['Administrador', adminEmail, hash]);
    console.log('✓ Admin criado: admin@aprova.local / admin123');
  }

  const already = await get('SELECT COUNT(*) AS n FROM questions');
  if (Number(already.n) > 0) {
    console.log('Banco já possui questões — seed de conteúdo ignorado.');
    return;
  }

  // Matérias e tópicos
  const port = await upsertSubject('Língua Portuguesa');
  const tInterp = await upsertTopic(port, 'Interpretação de texto');
  const tConc = await upsertTopic(port, 'Concordância verbal');

  const rlm = await upsertSubject('Raciocínio Lógico-Matemático');
  const tProp = await upsertTopic(rlm, 'Proposições lógicas');
  const tPorc = await upsertTopic(rlm, 'Porcentagem');

  const dc = await upsertSubject('Direito Constitucional');
  const tDF = await upsertTopic(dc, 'Direitos fundamentais');
  const tOrg = await upsertTopic(dc, 'Organização do Estado');

  const info = await upsertSubject('Informática');
  const tSeg = await upsertTopic(info, 'Segurança da informação');

  // Texto-base para interpretação
  const passageId = (await run(`INSERT INTO passages (title, content, source) VALUES (?, ?, ?)`, [
    'O valor do hábito',
    'Estudar para concursos é, antes de tudo, um exercício de constância. Não é o volume de horas em um único dia que aprova, mas a soma silenciosa de sessões curtas e frequentes. O cérebro consolida o que revisita: quem retorna ao conteúdo em intervalos regulares transforma informação em conhecimento durável. Por isso, o simulado não é apenas um teste — é uma ferramenta de aprendizagem. Errar em casa, com tempo para entender o erro, é o caminho mais barato para acertar no dia da prova.',
    'Texto de apoio — equipe Approva, 2026',
  ])).lastId;

  await addQuestion({
    topic_id: tInterp, passage_id: passageId,
    statement: 'De acordo com o texto, o principal fator de aprovação em concursos é:',
    options: [
      'O volume de horas estudadas em um único dia.',
      'A constância de sessões curtas e frequentes de estudo.',
      'A quantidade de simulados realizados por semana.',
      'A memorização integral dos conteúdos do edital.',
    ],
    correct_index: 1,
    comment: 'O texto afirma que "não é o volume de horas em um único dia que aprova, mas a soma silenciosa de sessões curtas e frequentes".',
    difficulty: 'facil', banca: 'FGV', ano: 2024, orgao: 'TJ-MG', cargo: 'Analista Judiciário', nivel: 'superior',
  });

  await addQuestion({
    topic_id: tInterp, passage_id: passageId,
    statement: 'Segundo o autor, o simulado deve ser entendido principalmente como:',
    options: [
      'Um instrumento de avaliação definitiva do candidato.',
      'Uma ferramenta de aprendizagem que permite compreender os erros.',
      'Uma etapa dispensável para quem estuda com constância.',
      'Um substituto da leitura da teoria.',
    ],
    correct_index: 1,
    comment: 'O texto diz que "o simulado não é apenas um teste — é uma ferramenta de aprendizagem".',
    difficulty: 'facil', banca: 'FGV', ano: 2024, orgao: 'TJ-MG', cargo: 'Analista Judiciário', nivel: 'superior',
  });

  await addQuestion({
    topic_id: tConc,
    statement: 'Assinale a alternativa em que a concordância verbal está de acordo com a norma-padrão.',
    options: [
      'Fazem dois anos que ele foi aprovado.',
      'Houveram muitos candidatos na última prova.',
      'Faz dois anos que ele foi aprovado.',
      'Existe, naquele edital, muitas vagas.',
    ],
    correct_index: 2,
    comment: 'O verbo "fazer" indicando tempo decorrido é impessoal: fica na 3ª pessoa do singular ("Faz dois anos...").',
    difficulty: 'media', banca: 'CEBRASPE', ano: 2023, orgao: 'PF', cargo: 'Agente', nivel: 'superior',
  });

  await addQuestion({
    topic_id: tProp,
    statement: 'A negação da proposição "Todos os candidatos estudaram" é:',
    options: [
      'Nenhum candidato estudou.',
      'Algum candidato não estudou.',
      'Todos os candidatos não estudaram.',
      'Algum candidato estudou.',
    ],
    correct_index: 1,
    comment: 'A negação de "todo A é B" é "existe A que não é B" — ou seja, "algum candidato não estudou".',
    difficulty: 'media', banca: 'FCC', ano: 2023, orgao: 'TRT-3', cargo: 'Técnico Judiciário', nivel: 'medio',
  });

  await addQuestion({
    topic_id: tPorc,
    statement: 'Um produto de R$ 200,00 sofreu aumento de 10% e, em seguida, desconto de 10% sobre o novo valor. O preço final é:',
    options: ['R$ 200,00', 'R$ 198,00', 'R$ 202,00', 'R$ 190,00', 'R$ 180,00'],
    correct_index: 1,
    comment: '200 × 1,10 = 220; 220 × 0,90 = 198. Aumentos e descontos sucessivos de mesma taxa não se anulam.',
    difficulty: 'facil', banca: 'VUNESP', ano: 2024, orgao: 'Prefeitura de Campinas', cargo: 'Assistente Administrativo', nivel: 'medio',
  });

  await addQuestion({
    topic_id: tDF,
    statement: 'Conforme a Constituição Federal de 1988, é direito fundamental expressamente previsto no art. 5º:',
    options: [
      'A inviolabilidade do sigilo de correspondência, sem qualquer exceção.',
      'A liberdade de expressão, vedado o anonimato.',
      'O direito de reunião mediante autorização prévia da autoridade.',
      'A prisão civil por dívida em qualquer hipótese.',
    ],
    correct_index: 1,
    comment: 'O art. 5º, IV, assegura a livre manifestação do pensamento, sendo vedado o anonimato. As demais alternativas contrariam o texto constitucional.',
    difficulty: 'media', banca: 'CEBRASPE', ano: 2024, orgao: 'STJ', cargo: 'Analista', nivel: 'superior',
  });

  await addQuestion({
    topic_id: tOrg,
    statement: 'São entes federativos da República Federativa do Brasil:',
    options: [
      'União, Estados, Distrito Federal e Municípios.',
      'União, Estados e Territórios.',
      'Apenas União e Estados.',
      'União, Estados, Municípios e Regiões Metropolitanas.',
    ],
    correct_index: 0,
    comment: 'O art. 18 da CF/88 dispõe que a organização político-administrativa compreende a União, os Estados, o Distrito Federal e os Municípios, todos autônomos.',
    difficulty: 'facil', banca: 'FGV', ano: 2023, orgao: 'Senado Federal', cargo: 'Policial Legislativo', nivel: 'superior',
  });

  await addQuestion({
    topic_id: tSeg,
    statement: 'O tipo de golpe em que o criminoso envia mensagens fraudulentas se passando por instituição confiável para roubar dados é chamado de:',
    options: ['Ransomware', 'Phishing', 'Firewall', 'Spyware', 'Backup'],
    correct_index: 1,
    comment: 'Phishing é a fraude que "pesca" dados do usuário por meio de mensagens falsas. Ransomware sequestra dados; firewall e backup são mecanismos de proteção.',
    difficulty: 'facil', banca: 'IBFC', ano: 2024, orgao: 'EBSERH', cargo: 'Assistente Administrativo', nivel: 'medio',
  });

  console.log('✓ Seed concluído: 4 matérias, 7 tópicos, 1 texto-base e 8 questões.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
