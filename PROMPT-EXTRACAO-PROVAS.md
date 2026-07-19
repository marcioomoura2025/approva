# Prompt: Extrair prova (PDF) + gabarito (PDF) para o modelo Approva (.xlsx)

**Como usar:** abra uma conversa nova comigo, anexe os 3 arquivos — **prova em PDF**, **gabarito em PDF** e o **modelo `modelo-importacao-approva.xlsx`** — e cole todo o texto abaixo como sua mensagem. Repita para cada prova nova que você quiser importar.

---

## Mensagem para colar (com os 3 arquivos anexados)

```
Você vai extrair as questões da prova em PDF anexada e preencher o modelo
.xlsx anexado (Approva), usando o gabarito em PDF para conferir a alternativa
correta de cada questão. Siga exatamente estas regras:

## 1. Estrutura do arquivo
Use o arquivo modelo anexado como BASE (não recrie os cabeçalhos do zero) e
preencha uma linha por questão, nesta ordem de colunas:
materia | topico | enunciado | imagem_url | alternativa_a..e | correta |
comentario | dificuldade | banca | ano | orgao | cargo | nivel | video_url |
texto_base_titulo | texto_base_conteudo | texto_base_fonte |
texto_base_imagem_url

## 2. Matéria e tópico
- "materia": a disciplina como consta no edital/prova (ex.: "Língua
  Portuguesa", "Direito Constitucional", "Raciocínio Lógico-Matemático").
- "topico": o assunto específico dentro da matéria, no menor grão possível
  e com nomenclatura comum em concursos (ex.: "Crase", "Controle de
  constitucionalidade", "Regência verbal" — não use algo genérico como
  "Gramática" se der para ser mais específico).
- Use nomes de matéria/tópico CONSISTENTES entre todas as linhas (mesma
  grafia) para não duplicar categorias sem querer.

## 3. Enunciado e alternativas
- Transcreva o enunciado e as alternativas exatamente como aparecem na
  prova, sem resumir ou reescrever.
- Corrija apenas erros óbvios de OCR (ex.: espaçamento quebrado, caracteres
  trocados), nunca o conteúdo.
- Alternativas vazias/inexistentes: deixe a coluna em branco (não invente
  texto).
- Questões anuladas pelo gabarito oficial: pule a linha e me avise ao final
  na lista de observações — não invente uma "correta".

## 4. Coluna "correta"
- Use a LETRA (A–E) da alternativa certa, cruzando enunciado + gabarito
  oficial anexado.
- Se o gabarito trouxer mais de uma opção como válida (questão com
  duplicidade de gabarito), registre a que a banca manteve como definitiva;
  se não for possível saber, marque a mais provável e sinalize isso no
  comentário com o prefixo "REVISAR:".

## 5. Comentário (coluna "comentario")
Escreva uma explicação objetiva (2–4 frases) do motivo da alternativa
correta estar certa e, quando ajudar, por que as principais alternativas
erradas estão erradas. Baseie-se em:
- Direito: no dispositivo legal/constitucional aplicável (cite artigo/lei
  quando souber com segurança; se não tiver certeza da citação exata, explique
  o fundamento sem inventar número de artigo).
- Português: na regra gramatical/norma culta pertinente.
- Raciocínio lógico/matemática: no raciocínio resolvido passo a passo,
  resumido.
- Conhecimentos gerais/específicos: no fato ou conceito que resolve a questão.
Nunca invente uma justificativa que você não tem base para sustentar — nesse
caso, escreva um comentário mais genérico e sinalize com "REVISAR:" no início.

## 6. Dificuldade (coluna "dificuldade")
Classifique como "facil", "media" ou "dificil" com base na complexidade do
raciocínio exigido e no nível de detalhe cobrado (não pelo gabarito de
acertos). Na dúvida, use "media".

## 7. Origem da prova
Preencha "banca", "ano", "orgao", "cargo" e "nivel" com os dados que
aparecem no cabeçalho/rodapé da prova (mesmos valores em todas as linhas
dessa prova). Deixe "video_url" em branco.

## 8. Texto-base (MUITO IMPORTANTE)
Provas de Português/Interpretação (e às vezes outras matérias) trazem um
texto de apoio ("Texto I", "Leia o texto a seguir", uma reportagem, uma
tirinha, um poema) que serve de base para DUAS OU MAIS questões seguidas.
Quando isso acontecer:
- Dê um título curto e descritivo ao texto em "texto_base_titulo" (ex.:
  "Texto I — crônica sobre..."). Use o MESMO título, exatamente igual
  (mesma grafia), em todas as questões que compartilham esse texto.
- Preencha "texto_base_conteudo" (transcrição do texto completo) e
  "texto_base_fonte" (autor/veículo, se indicado) APENAS na primeira
  questão que usa esse texto. Nas demais questões do mesmo grupo, deixe
  "texto_base_conteudo" e "texto_base_fonte" em branco — o título repetido
  já identifica que é o mesmo texto-base.
- Se o texto-base for uma imagem (charge, tirinha, gráfico) sem conteúdo
  textual transcritível, deixe "texto_base_conteudo" em branco, preencha
  "texto_base_titulo" e sinalize na lista de observações que a imagem
  precisa ser anexada manualmente depois (ver item 9).
- Questões SEM texto-base: deixe as 4 colunas de texto-base em branco.

## 9. Imagens (gráficos, figuras, mapas, tirinhas)
Você não consegue gerar uma URL para uma imagem da prova. Portanto:
- Deixe "imagem_url" (ou "texto_base_imagem_url") em branco nessas linhas.
- Preencha normalmente enunciado/alternativas/comentário mesmo assim.
- Ao final, me dê uma lista separada: "Questões que dependem de imagem e
  precisam da URL preenchida manualmente depois" com o número da questão
  na prova original e uma descrição breve da imagem, para eu localizar e
  subir a imagem depois (a URL pode ser adicionada manualmente na tela
  "Gerenciar" do Banco de Questões).

## 10. Conferência final
Antes de entregar o arquivo, confira:
- Toda linha tem materia, topico e enunciado preenchidos.
- Toda linha tem "correta" preenchida e ela bate com o gabarito oficial.
- Questões do mesmo texto-base usam o título IDÊNTICO.
- Nenhuma questão anulada foi incluída.

## 11. Entrega
Gere o arquivo .xlsx preenchido (mesmo nome do modelo, mantendo a ordem das
colunas) pronto para eu importar direto no Approva, e me dê um resumo final
com:
- Quantas questões foram extraídas no total.
- Quantos grupos de texto-base foram identificados.
- Lista de questões puladas (anuladas) e o motivo.
- Lista de questões marcadas "REVISAR:" e por quê.
- Lista de questões que dependem de imagem (item 9).
```

---

## Observações para você

- **Isso é um prompt para o Claude fazer a extração numa conversa** (com os PDFs e o modelo anexados) — não é um recurso automático dentro do app Approva. O resultado é um `.xlsx` pronto para você importar na tela **Banco de questões → Importar Excel**.
- **Sempre revise antes de importar**, especialmente os comentários jurídicos (citações de artigo de lei) e as questões marcadas `REVISAR:` — a extração é uma ajuda, não substitui sua conferência final.
- Provas muito longas (50+ questões) podem exceder o limite de uma única resposta; se isso acontecer, peça para eu continuar "a partir da questão X" e depois junte as partes num único arquivo antes de importar.
- O arquivo `modelo-importacao-approva.xlsx` anexado aqui já está com as colunas mais recentes do app (incluindo `imagem_url` e as 4 colunas de texto-base). Sempre use o modelo baixado mais recente da tela **Banco de questões → Importar Excel → Baixar modelo**, caso o app seja atualizado no futuro.
