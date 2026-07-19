# Approva — Simulados para Concursos Públicos

Plataforma completa de simulados: montagem de provas personalizadas, cronômetros no estilo prova real, correção comentada, marcação de **chutes** (respondeu na sorte? o tópico continua na sua lista de estudo), caderno automático de erros & chutes, estatísticas com **domínio real**, ranking e impressão de folha de prova.

**Stack:** React + Vite + React Router + Recharts · Node + Express · SQLite via `@libsql/client` (pronto para Turso) · JWT + bcrypt · importação de questões por Excel.

---

## Rodando localmente

Pré-requisito: Node 18+.

```bash
# 1) Backend
cd backend
npm install
npm run seed        # cria o banco com dados de exemplo + admin
npm run dev         # API em http://localhost:4000

# 2) Frontend (outro terminal)
cd frontend
npm install
npm run dev         # app em http://localhost:5173 (proxy /api -> 4000)
```

Login de demonstração: **admin@aprova.local** / **admin123**

### Build de produção (servidor único)

```bash
cd frontend && npm run build     # gera frontend/dist
cd ../backend && npm start       # Express serve a API e o dist na porta 4000
```

## Variáveis de ambiente (backend)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `4000` | Porta do servidor |
| `JWT_SECRET` | (dev) | **Defina em produção.** Segredo dos tokens (validade 30 dias) |
| `ADMIN_EMAIL` | — | E-mail administrador. Vira admin ao se registrar **e também** se a conta já existir (promovida a cada subida do app) |
| `PASS_THRESHOLD` | `60` | Meta de aprovação **padrão** — cada usuário pode definir a sua no app |
| `AUTO_SEED` | `true` | Cria os dados iniciais automaticamente se o banco estiver vazio. `false` desativa |
| `TURSO_DATABASE_URL` | — | **Obrigatória em produção.** URL do banco Turso. Sem ela, o app grava em arquivo local — que hospedagens como o Render apagam a cada deploy |
| `TURSO_AUTH_TOKEN` | — | **Obrigatória em produção.** Token do Turso |

## Publicando no GitHub

O projeto já vem com `.gitignore` (ignora `node_modules`, builds, banco local e `.env`). No diretório raiz:

```bash
git init
git add .
git commit -m "Approva — app de simulados para concursos"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/approva.git
git push -u origin main
```

> Crie antes o repositório vazio `approva` no GitHub (sem README, para não conflitar). Nunca commite o arquivo `backend/.env` — use o `backend/.env.example` como referência.

## Deploy gratuito (GitHub → Render + Turso)

1. **Turso** (banco persistente): crie conta em turso.tech, depois
   `turso db create approva` · `turso db show approva --url` · `turso db tokens create approva`.
2. **GitHub**: suba este repositório.
3. **Render** (render.com) → *New Web Service* → conecte o repo:
   - Build command: `cd frontend && npm install && npm run build && cd ../backend && npm install`
   - Start command: `cd backend && npm start`
   - Environment: `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (e opcionais acima)
4. **Dados iniciais:** nada a fazer — na primeira subida, se o banco estiver vazio, o app cria sozinho as matérias, questões de exemplo e o administrador de demonstração. Reinícios e novos deploys **não** duplicam dados (para desativar, defina `AUTO_SEED=false`).
5. **Troque o administrador padrão.** O login `admin@aprova.local / admin123` é público (consta neste README). Crie sua conta pelo app e defina a variável `ADMIN_EMAIL` com o seu e-mail — funciona tanto para contas novas quanto para contas já existentes (a promoção ocorre no próximo reinício).

## Funcionalidades

- **Autenticação** — registro/login, JWT 30 dias; 1º usuário vira admin.
- **Montagem de simulados** — modo simples (quantidade + filtros por matéria/tópico/banca/ano) ou composição por matéria (ex.: 10 de Português + 5 de Direito), ordem embaralhada.
- **Correção** — imediata (modo estudo) ou apenas no final (modo prova real). O gabarito nunca é enviado ao navegador antes da hora.
- **Tempo** — livre, total da prova (auto-finaliza) ou por questão (esgotou = erro, avança sozinho, sem voltar).
- **Chute 🎲** — marque quando responder na sorte; acerto no chute não conta como domínio e a questão entra no caderno de erros & chutes.
- **Interações** — favoritar, marcar para revisão, anotações pessoais por questão.
- **Revisões** — abas: marcadas p/ revisão · favoritas · erros & chutes (montado automaticamente).
- **Meta de aprovação pessoal** — cada usuário define seu % mínimo (chip editável no Painel e no Desempenho); o "Aprovado" do resultado e os selos verde/vermelho seguem essa meta.
- **Estatísticas** — aproveitamento vs **domínio real**, por matéria e tópico, pontos fracos, evolução, tempo médio.
- **Dicas de prova** — cinco boas práticas fixas no Painel e uma dica rotativa durante a resolução.
- **Ranking** — média de aproveitamento entre os usuários.
- **Impressão** — folha de prova limpa (Ctrl+P / PDF) com gabarito opcional ao final.
- **Admin — usuários** — aba *Usuários* no Banco de Questões: lista as contas, redefine a senha de quem esqueceu a sua e concede/remove acesso de administrador (um admin não consegue remover o próprio acesso).
- **Admin** — cadastro de questões (com texto-base compartilhado, imagem e vídeo-resolução), gerenciamento com filtros, importação em massa por planilha Excel (modelo para download, erros linha a linha, **incluindo texto-base e imagens**: colunas `imagem_url`, `texto_base_titulo`, `texto_base_conteudo`, `texto_base_fonte` e `texto_base_imagem_url` — linhas com o mesmo título de texto-base compartilham o mesmo texto). Questões já usadas em simulados não podem ser excluídas.
- **Exportação do banco** — na aba *Gerenciar*, um clique baixa todas as questões em `.xlsx` no mesmo formato do modelo de importação: serve como backup, permite edição em massa e o arquivo pode ser reimportado.
- **Extração de provas em PDF com IA** — veja `PROMPT-EXTRACAO-PROVAS.md`: um prompt pronto para colar numa conversa com Claude (anexando a prova em PDF, o gabarito em PDF e o modelo .xlsx) e receber a planilha de importação já preenchida, com tópicos identificados, comentários explicativos e texto-base reconhecido automaticamente.

## Estrutura

```
backend/    Express + SQLite (routes/, middleware/, db.js, seed-data.js, server.js)
frontend/   React + Vite (src/pages/, src/components/, src/context/, styles.css)
```
