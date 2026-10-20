# 15 - Engenharia QA Agent

Verifica se os agentes de engenharia foram bem sucedidos.

Antes da lista especifica, usar `agents/00-coding-method-agent.md`: confirmar loop red-capable quando houver bug/calculo, seam de teste, revisao em dois eixos e diff restrito ao pedido.

---

## Quando usar

Use antes de entregar qualquer mudanca em `/engenharia`, principalmente quando:

- usar `12-engenharia-memorial-a4-agent.md`;
- usar `13-engenharia-ajuda-agent.md`;
- usar `14-engenharia-calculadora-agent.md`;
- alterar 3+ arquivos;
- mexer em layout, calculo, importacao, orcamento, memoriais ou botoes de copia.

---

## Objetivo

Fazer auditoria final especifica da area de engenharia, evitando quebra de padrao, mudanca nao solicitada e erro de quantitativo.

---

## Referencias aprovadas para comparar

Durante QA, comparar contra estes arquivos conforme o tipo de mudança:

- Layout, botões e duas colunas: `engenharia/core/styles.css` e `engenharia/calhas-pluviais/index.html`.
- Cores e hover de botões: `engenharia/core/styles.css`, seletores `.engineering-body button`, `.engineering-body .btn`, `.quick-actions`.
- Resumo da primeira seção da coluna direita: `engenharia/paredes/calculadora-paredes.js`, funções `renderSummary` e `resultCard`.
- Memorial A4: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, função `gerarHtmlMemorialA4`; quando houver orçamento, comparar também `engenharia/muro-de-alvenaria/calculadora-muro-de-alvenaria.js`.
- PDF continuo dos memoriais A4: `engenharia/core/memorial-continuo.js`; todo memorial ajustado deve manter A4 normal e adicionar `Imprimir PDF contínuo`.
- Ajuda/importação/lightbox: `engenharia/esquadrias/ajuda-importacao.html` e `engenharia/paredes/ajuda-importacao.html`.
- Importação com conflito: `engenharia/esquadrias/calculadora-esquadrias.js`, função `renderImportModal`.
- Importação BIM/agrupamento: `engenharia/paredes/calcular-paredes.mjs` e `engenharia/paredes/calculadora-paredes.js`.
- Orçamento com títulos/admin: `engenharia/muro-de-alvenaria/orcamento-muro-de-alvenaria.mjs`, `engenharia/muro-para-gradil/orcamento-muro-para-gradil.mjs`, `engenharia/paredes/calcular-paredes.mjs`.
- Imagem ampliável: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, funções `ensureLightbox`, `openLightbox`, `closeLightbox`; estilo em `engenharia/core/styles.css`.

---

## Checklist do agente 12 - Memorial A4

- [ ] Botao chama `Memorial A4`.
- [ ] Abre nova aba.
- [ ] Nao abre dialogo de impressao automaticamente.
- [ ] Tem `Imprimir / Salvar PDF`.
- [ ] Tem `Imprimir PDF contínuo`.
- [ ] Carrega `/engenharia/core/memorial-continuo.js`.
- [ ] `Imprimir / Salvar PDF` chama `printA4()` e mantém A4.
- [ ] `Imprimir PDF contínuo` chama `printContinuousPdf()` e calcula altura pela `.page`.
- [ ] PDF continuo neutraliza `break-before`, `page-break-before` e `.page-break-soft`.
- [ ] Tem `Fechar aba`.
- [ ] Logo e fundo carregam.
- [ ] A4 configurado.
- [ ] Tabelas cabem.
- [ ] Tabelas largas nao ficam cortadas nas laterais; se tiver muitas colunas, aparecem como fichas tecnicas pelo `memorial-continuo.js`.
- [ ] Nenhuma secao A4 esconde coluna por `overflow:hidden`.
- [ ] Texto nao tem plural feio tipo `(s)` quando o usuario pediu texto limpo.

---

## Checklist do agente 13 - Ajuda

- [ ] Botao `Ajuda` fica no fluxo certo.
- [ ] Ajuda abre em nova aba.
- [ ] `Fechar aba` funciona.
- [ ] Imagens carregam.
- [ ] Imagens ampliam em lightbox.
- [ ] Textos explicam o uso real, sem linguagem de briefing.

---

## Checklist do agente 14 - Calculadora

- [ ] Nao houve mudanca fora do pedido.
- [ ] Calculo nao mudou quando pedido era visual.
- [ ] Visual nao mudou quando pedido era calculo.
- [ ] Entradas numericas: em toda calculadora criada/ajustada, consultar e validar integralmente [Entradas decimais pt-BR e regressao obrigatoria](14-engenharia-calculadora-agent.md#entradas-decimais-pt-br). Ao alterar o helper compartilhado, verificar todas as consumidoras e a ordem de carregamento nos `index.html`; exigir evidencia dos casos e fluxos aplicaveis, registrando pendencias antes de aprovar.
- [ ] Parametros editaveis como DMT, empolamento e fatores permanecem iguais apos navegacao, recarga e `Ctrl+F5`; o valor inicial do HTML nao sobrescreve o estado salvo.
- [ ] Copias de memorial por item mostram a conta em texto corrido, com entradas, unidades, formula, fatores e resultado coerentes com cards e orcamento.
- [ ] Botao de copia por item entrega somente uma linha de texto, sem cabecalho de grupo ou linhas em branco; copia de grupo completo so usa titulos quando isso estiver explicito no botao.
- [ ] Todo botão de cópia exibe em hover e foco a prévia rápida do mesmo texto que será copiado, sem disparar cópia nem alterar o estado da calculadora.
- [ ] Colunas seguem mesmo tamanho/padrao.
- [ ] `calc-shell`, `calc-editor`, `calc-results`, `form-card`, `result-card`, `quick-actions` preservados.
- [ ] Primeiro bloco de `calc-results` usa `form-card blue`, `Resumo`, `Resultados gerais`, `result-grid` e cards no padrão de `paredes`.
- [ ] Primeiro resumo não usa nomes locais como `Resumo geral`, `Resultados`, `Dados gerais`, `Quantitativos` ou `Valor para orçamento`.
- [ ] Titulos principais de cards/itens usam `<h4>` em caixa alta, no padrao de `paredes`, sem numeracao artificial e sem subtitulo redundante repetindo a descricao.
- [ ] Cards importados/manuais mostram origem ou status util (`Informações importadas`, `Adicionado manualmente`) quando houver esse contexto.
- [ ] Descrição do card da página `/engenharia` está administrável no `/admin` via `calculator_card.data.description`.
- [ ] Descrição interna da calculadora (`.calculator-head .sec-sub`) está administrável no `/admin` via `calculator_intro.data.description`.
- [ ] Loader público de descrição interna usa `textContent` e mantém fallback estático quando o banco falha.
- [ ] Botoes seguem cor/tamanho/padrao aprovado.
- [ ] Tabelas nao vazam nem sobrepoem.
- [ ] Modo manual preservado.
- [ ] Importacao preserva IDs BIM quando existirem.
- [ ] Orcamento respeita separacao real do usuario.
- [ ] `Tabela para orçamento` segue o padrão de `paredes`: `form-card blue`, colunas `Base`, `Código`, `Descrição`, `Unidade`, `Quantidade`, títulos em linha própria `colspan="5"`, sem colunas `Grupo`, `Tipo`, `Item` ou `Aplicação`.
- [ ] Em tabelas de orçamento, `Base`, `Código`, `Unidade` e `Quantidade` ficam estreitas, `Descrição` fica larga, e título/especialidade ocupa uma linha inteira.
- [ ] Tabelas de orçamento mantêm `.engineering-budget-table`, ordem fixa de colunas e `tr.budget-title-row`, preservando compatibilidade com o motor `engenharia/core/project-widget.mjs` atualmente suspenso.
- [ ] Enquanto `engineeringProjectsEnabled` estiver `false`, não aparece link/card de `Projetos` no hub ou navegação e nenhum botão `Adicionar ao projeto` é injetado nas calculadoras.
- [ ] A rota `engenharia/projetos/` e o motor `engenharia/core/project-widget.mjs` permanecem intactos para reativação futura.
- [ ] Copiar textos gera unidade e descricao corretas.
- [ ] Cards, tabelas, memoriais e cópias mantêm unidade colada ao número (`12,90m`, `11,90m²`, `1,70m³`, `17un`); fórmulas usam ` x ` entre grandezas e dimensões declarativas usam `x` compacto (`0,30x0,30x0,30m`).
- [ ] `Critérios adotados` segue padrão de lista simples em `<ul><li>...`, comparado com `engenharia/banco-concreto-amfri/calculadora-banco-concreto-amfri.js`.
- [ ] Toda fórmula/regra usada pelo cálculo aparece nos critérios: desconto, lastro, pilarete, DMT, importação, travas, exceções e ausência de empolamento quando isso impactar o resultado.
- [ ] Quando houver bota-fora com empolamento, cards, critérios, cópias, memorial e orçamento deixam claro que carga/manobra/descarga e transporte usam a sobra empolada.
- [ ] Não existe fórmula nova em código/memorial/orçamento sem critério visível correspondente na calculadora.
- [ ] Nenhum seletor global em `engenharia/core/styles.css` foi alterado para resolver problema de uma calculadora só sem testar as demais.
- [ ] Nenhuma regra especial `.paredes-*`, `.esquadrias-*`, `.muro-*`, `.calhas-*` virou padrão global sem pedido explícito.
- [ ] Em calculadora BIM/IFC estrutural, a interface pública não exibe tubos, caixas ou redes de infraestrutura; esses itens só podem existir como código herdado invisível enquanto o motor não for separado.
- [ ] Em leitura IFC, texto visível deixa claro se o recurso é diagnóstico ou conversão automática validada. Não aprovar promessa de cálculo IFC automático sem teste com arquivo real.
- [ ] Em `composicoes` e `cotacao`, novos registros recebem numero automatico sem campo editavel no admin.
- [ ] Composicao, insumo cotado e fornecedor continuam relacionados por UUID mesmo quando codigos legados forem diferentes.
- [ ] Importacao TXT preserva o formato da planilha, registra o codigo recebido como legado e nao o usa como chave primaria.
- [ ] Edicao de descricao, unidade, ordem ou status nao altera `record_uuid` nem `catalog_number`.

---

## Comandos recomendados

```powershell
git diff --check -- <arquivos>
node engenharia/<slug>/<teste>.mjs
rg -n "quick-actions|calc-shell|calc-editor|calc-results|criteria-details|printA4|printContinuousPdf|memorial-continuo|window.print|Memorial A4|Ajuda|data-copy|tipo === \"titulo\"|image-lightbox" engenharia/<slug> engenharia/core/styles.css
```

Quando visual for relevante:

- abrir local/publicado;
- verificar desktop e mobile;
- conferir que nao ha overflow horizontal inesperado;
- testar botoes principais;
- testar modais;
- testar lightbox;
- testar copiar texto.

---

## Nao aprovar se

- tabela larga invadir coluna vizinha;
- botao sumir, mudar nome sem pedido ou ficar fora do padrao;
- memorial A4 abrir impressao automaticamente;
- memorial A4 sem botao `Imprimir PDF contínuo` quando estiver sendo criado ou ajustado;
- PDF continuo gerando varias paginas gigantes por causa de quebra manual de pagina;
- ajuda tiver botao de imprimir sem pedido;
- calculo mudou sem pedido;
- modo manual sumiu;
- arquivo fora do escopo entrou no commit.
- o resultado foi validado somente por `node --check`/build sem testar a interface ou a formula afetada;
- houve formula nova sem exemplo independente, criterio visivel e regressao correspondente;
- o diff introduziu mudanca visual, de calculo ou de fluxo que o pedido nao autorizou.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

