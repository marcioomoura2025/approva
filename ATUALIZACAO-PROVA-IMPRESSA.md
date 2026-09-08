# Approva — prova impressa com cronômetro e correção

Esta atualização foi aplicada ao código do aplicativo real enviado em `approva(1).rar`. O pacote contém o projeto completo, com as pastas `backend` e `frontend`, e mantém a identidade visual existente.

## Como usar

1. Em **Novo simulado**, escolha as questões e as configurações de tempo e use a opção de gerar para impressão.
2. Na folha de prova, clique em **Imprimir / salvar PDF**. O documento inclui um cartão de respostas em branco.
3. Ao fechar a janela de impressão, o aplicativo abre o painel da prova. Se seu navegador não fizer a transição, use **Abrir painel da prova**.
4. Quando estiver pronto para resolver no papel, clique em **Iniciar cronômetro**.
5. Ao terminar, clique em **Terminei a prova** e confirme. O aplicativo registra o fim e libera o cartão de transcrição.
6. Preencha as alternativas, marque **Em branco** quando necessário e indique os chutes. As marcações são salvas automaticamente.
7. Clique em **Conferir e corrigir**, confira as quantidades e confirme o envio. O resultado aparece na tela habitual e alimenta o histórico, o desempenho e as revisões.

O navegador informa que a janela de impressão foi fechada, inclusive quando a impressão é cancelada. Por isso, o cronômetro sempre depende do botão de início. Imprimir ou gerar o simulado não inicia a contagem.

## Tempo e retomada

- O servidor registra início e fim. Atualizar a página ou fechar a aba não reinicia o cronômetro.
- Impressão e transcrição não entram no tempo da prova.
- No modo livre, o encerramento é manual. Com limite total, o encerramento é registrado no instante do limite e o cartão fica disponível na atualização seguinte do painel.
- A configuração de tempo por questão se converte em um limite total: tempo por questão × quantidade de questões. A prova impressa não mede o tempo individual de cada questão.
- Na lista de simulados recentes, **Continuar** retoma a etapa em que a prova está.
- Iniciar, encerrar e confirmar a correção exigem conexão com o servidor. Marcações ainda não enviadas têm uma cópia local, quando o navegador permite, e podem ser recuperadas no mesmo navegador e conta. Aguarde **Respostas salvas** antes de mudar de dispositivo.
- Alterações concorrentes em duas abas geram um aviso de conflito. Ao recarregar, o painel permite escolher entre a cópia local pendente e as respostas salvas.

## Tentativas e resultados

Uma tentativa digital sem respostas pode ser convertida para o modo impresso na tela de impressão. Se já houver respostas ou um resultado final, use **Nova tentativa no papel**: as questões e sua ordem são copiadas e o histórico anterior é preservado.

Questões em branco contam como erro e são confirmadas antes do envio. O gabarito oficial é liberado após a correção. Repetir o envio de uma correção concluída não duplica as respostas.

A duração total aparece no resultado. O tempo médio por questão considera apenas respostas com tempo individual medido no aplicativo; não é estimado a partir da prova impressa.

## Aplicar a atualização

O site publicado não foi alterado durante este trabalho. Este pacote é o código para atualizar a instalação existente.

1. Extraia o ZIP e aplique os arquivos da pasta `Approva-prova-impressa` na raiz do projeto usado pelo deploy, preservando a estrutura `backend` / `frontend`.
2. Mantenha as variáveis de ambiente e a conexão com o banco da instalação atual. O pacote não inclui banco de dados, configurações privadas ou dependências instaladas.
3. Execute o build e o deploy pelo processo já usado no projeto. Não é necessário executar `seed`, limpar o histórico ou recriar o banco.
4. Na inicialização, a aplicação cria automaticamente a tabela adicional `paper_sessions`, se ela ainda não existir. A migração mantém as tabelas e os registros anteriores.

Os comandos do projeto permanecem os mesmos. Comandos a partir da raiz:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
npm ci --prefix backend
npm start --prefix backend
```

Se o serviço no Render já utiliza um comando de build equivalente, ele pode ser mantido. A atualização exige tanto os arquivos do backend quanto um novo build do frontend. Não substitua o banco da instalação pelo banco de um ambiente de desenvolvimento.

Após o deploy, gere uma tentativa curta para conferir a impressão no navegador usado pelos alunos, o botão de início, o encerramento, a transcrição e a exibição do resultado.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Sessão impressa e correção atômica | `backend/paper.js`, `backend/routes/impresso.js` |
| Migração e integração com o app | `backend/db.js`, `backend/server.js`, `backend/routes/simulados.js`, `backend/routes/auth.js`, `backend/routes/stats.js` |
| Painel e cartão de respostas | `frontend/src/pages/ProvaImpressa.jsx`, `frontend/src/paper.css` |
| Impressão e criação de tentativas | `frontend/src/pages/Impressao.jsx`, `frontend/src/pages/NovoSimulado.jsx` |
| Navegação, histórico e resultados | `frontend/src/App.jsx`, `frontend/src/api.js`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Resolucao.jsx`, `frontend/src/pages/Resultado.jsx`, `frontend/src/pages/Desempenho.jsx`, `frontend/src/components/QuestionReview.jsx` |
| Testes de integração | `backend/test/impresso.test.js` |

## Validação realizada

- 11 testes automatizados de integração passaram, usando SQLite temporário e contas exclusivas de teste.
- Cobertura: início e fim idempotentes, retomada, limite de tempo, transcrição, alternativas inválidas, questões em branco, chutes, revisão concorrente, autorização por usuário, correção sem duplicação, rollback em falha parcial, histórico, estatísticas, nova tentativa e compatibilidade com o fluxo digital.
- A inicialização do banco foi repetida para verificar a migração sem recriação de dados.
- Build de produção do frontend concluído. O Vite emite o aviso de tamanho do bundle principal; isso não impede a compilação.
- Não foram realizados testes em navegador, impressora física ou no banco remoto da instalação publicada.

Para repetir os testes, com as dependências do backend instaladas:

```sh
cd backend
node --test test/impresso.test.js
```

Os testes criam e removem seu próprio banco temporário; não usam o banco publicado.
