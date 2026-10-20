# 12 - Engenharia Memorial A4 Agent

Padroniza memoriais A4 das calculadoras em `/engenharia`.

---

## Quando usar

Use sempre que o pedido envolver:

- criar ou ajustar `Memorial A4`;
- botao `Memorial A4`, `Gerar PDF`, `Imprimir` ou janela de impressao;
- HTML aberto em nova aba para impressao;
- texto, tabelas, logo, fundo, margens ou seccionamento do memorial.

Se a calculadora tambem estiver sendo criada ou reorganizada, use junto com `14-engenharia-calculadora-agent.md`.
Antes de entregar, use `15-engenharia-qa-agent.md`.

---

## Objetivo

Garantir que todos os memoriais A4 tenham o mesmo padrao de funcionalidade, texto visual e impressao. O conteudo muda por calculadora; o comportamento e a apresentacao nao.

---

## Referencias aprovadas obrigatorias

Use estes arquivos como fonte de verdade antes de criar ou alterar qualquer memorial:

- Modelo A4 mais completo: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, funcao `gerarHtmlMemorialA4`.
- Modelo A4 simples com boa estrutura de seções: `engenharia/administracao-local/calculadora-administracao-local.js`, funcao `gerarHtmlMemorialA4`.
- Modelo A4 com orçamento/lista de composições: `engenharia/muro-de-alvenaria/calculadora-muro-de-alvenaria.js`, funcao `gerarHtmlMemorialA4`.
- Modelo A4 para calculadora com importação/BIM: `engenharia/paredes/calculadora-paredes.js`, HTML gerado em `gerarHtmlA4`.
- Estilo global de botões e página de engenharia: `engenharia/core/styles.css`.
- Helper aprovado para PDF continuo: `engenharia/core/memorial-continuo.js`.
- Assets obrigatorios: `engenharia/core/logo-calculadora.png` e `engenharia/core/fundo.png`.

Antes de editar, abrir pelo menos uma referência equivalente ao caso:

- memorial só de cálculo: administração local ou calhas;
- memorial com quantitativos/orçamento: muro de alvenaria ou muro para gradil;
- memorial com importação/tabela BIM: paredes.

---

## Padrao obrigatorio

- Botao na calculadora: `Memorial A4`.
- Abrir em nova aba/janela HTML.
- Nao chamar `window.print()` automaticamente ao abrir.
- Ter barra superior de acoes com:
  - `Imprimir / Salvar PDF`;
  - `Imprimir PDF contínuo`;
  - `Fechar aba` quando for pagina HTML propria;
  - `Fechar` só é aceito em memoriais antigos ja aprovados, mas novas implementações devem usar `Fechar aba`.
- `Fechar aba`/`Fechar` deve usar `window.close()`.
- O botao `Imprimir / Salvar PDF` deve manter A4 normal e chamar `window.printA4()` quando o helper estiver carregado.
- O botao `Imprimir PDF contínuo` deve chamar `window.printContinuousPdf()`.
- Todo memorial A4 novo ou ajustado deve carregar `<script src="/engenharia/core/memorial-continuo.js"></script>` dentro do HTML gerado, antes de `</head>`.
- O helper `memorial-continuo.js` tambem e o padrao global para tabelas em memoriais: ele injeta CSS de seguranca, remove corte lateral por `overflow:hidden` e converte automaticamente tabelas largas em fichas tecnicas quando houver muitas colunas ou estouro horizontal.
- Nao resolver tabela A4 larga com hack local de largura/zoom por calculadora. Primeiro usar o comportamento global do helper.
- Quando uma tabela especifica precisar sempre virar ficha, marcar a tabela com `data-memorial-table-mode="cards"`. Quando uma tabela especifica precisar permanecer tabela mesmo larga, marcar com `data-memorial-table-mode="table"` e justificar no codigo/comentario.
- O PDF continuo aprovado usa largura de `294mm` e calcula a altura automaticamente pela altura renderizada de `.page`; nao fixar altura manual dentro da calculadora.
- No modo PDF continuo, o helper deve neutralizar quebras manuais como `break-before`, `break-after`, `page-break-before`, `page-break-after` e classes tipo `.page-break-soft`, para nao gerar varias folhas continuas gigantes.
- Nao substituir o A4 pelo continuo. Manter os dois modos.
- Usar `@page { size: A4; ... }`.
- Usar logo de `/engenharia/core/logo-calculadora.png`.
- Usar fundo discreto de `/engenharia/core/fundo.png`.
- Logo principal centralizada, no padrao aprovado.
- Conteudo com secoes claras: resumo, dados informados, criterios, calculos, resultados, verificacao, orcamento ou memoria conforme a calculadora.
- Tabelas devem caber dentro da folha A4.
- Tabelas com muitas colunas devem mostrar todos os campos no A4. Se a tabela nao couber como tabela horizontal, deve aparecer como fichas tecnicas, sem perder colunas escondidas.
- Secoes do memorial nao podem cortar tabelas por `overflow:hidden`; o helper global deve prevalecer.
- Tabelas A4 de orçamento com cabeçalhos `Base`, `Código`, `Descrição`, `Unidade`, `Quantidade` sao normalizadas pelo helper: `Base`, `Código`, `Unidade` e `Quantidade` ficam estreitas, `Descrição` fica larga, e titulos/especialidades ocupam a linha inteira.
- Secoes devem evitar quebra ruim com `break-inside: avoid` quando fizer sentido.
- A partir da segunda pagina, o conteudo nao deve colar no topo da folha.
- Nao colocar texto tecnico de briefing ou requisito visivel no memorial.

---

## Textos e nomes

- Usar linguagem objetiva de memorial tecnico.
- Nao usar titulo generico extra como `Memorial completo` dentro do A4 se a calculadora aprovada nao usa.
- Nao duplicar informacoes que ja estao na logo ou cabecalho.
- Plural deve ser natural: `1 segmento`, `3 segmentos`, nunca `segmento(s)`.
- Omitir itens zerados quando o usuario pediu memorial enxuto ou quando o valor nao agrega conferencia.
- Quantitativos exibidos em memoriais devem usar 2 casas decimais em PT-BR (`1,12 m³`, `30,00 m³xkm`), mantendo a precisao interna do calculo separada da exibicao.
- Em memoriais de escavacao, tabelas de tubulacao/caixas devem abreviar a rede quando solicitado (`Esgoto`, `IE`, `Drenagem`) para evitar quebra ruim.
- Em memoriais de escavacao, a tabela de estruturas deve identificar o item pelo tipo compacto (`Laje`, `Viga 14x50`, `Bloco 70x70`, `Sapata 70x70`) e nao duplicar coluna `Item` + `Tipo`.

---

## Comparar antes de editar

Antes de criar ou alterar, procurar exemplos existentes:

```powershell
rg -n "function gerarHtmlMemorialA4|Memorial A4|print-actions|printA4|printContinuousPdf|memorial-continuo|window.open|window.print|window.close|logo-calculadora|fundo.png" engenharia
```

Comparar:

- botoes;
- nomes;
- estrutura da funcao de impressao;
- CSS A4;
- formato das tabelas;
- comportamento de fechar aba;
- ausencia de impressao automatica.
- presenca dos dois modos de impressao: A4 normal e PDF continuo.

Se o pedido nao for para mudar padrao de A4, copiar a estrutura do arquivo de referencia e alterar apenas o conteudo da calculadora.

---

## Checklist de entrega

- [ ] Botao chama nova aba.
- [ ] Nova aba nao abre dialogo de impressao sozinha.
- [ ] Tem `Imprimir / Salvar PDF`.
- [ ] Tem `Imprimir PDF contínuo`.
- [ ] Carrega `/engenharia/core/memorial-continuo.js`.
- [ ] A4 normal usa `printA4()` e continua A4.
- [ ] PDF continuo usa `printContinuousPdf()` e calcula altura automaticamente.
- [ ] PDF continuo neutraliza quebras manuais de pagina.
- [ ] Tem `Fechar aba`.
- [ ] Logo e fundo carregam.
- [ ] A4 configurado.
- [ ] Tabelas cabem na folha.
- [ ] Tabelas largas nao perdem colunas; viram fichas tecnicas pelo helper global ou usam atributo explicito.
- [ ] Textos seguem padrao da calculadora.
- [ ] Nao houve mudanca de calculo sem pedido.
- [ ] Teste/manual ou unitario rodado quando existir.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

