# 14 - Engenharia Calculadora Agent

Padroniza criacao e manutencao das calculadoras em `/engenharia`.

---

## Quando usar

Use sempre que o pedido envolver:

- criar calculadora nova;
- alterar calculo, entrada, resultado, quantitativo, orcamento ou memorial;
- mexer em colunas, cards, tabelas, botoes, imagens, modais ou importacao;
- adicionar botoes de copia;
- mudar ordem de itens de orcamento;
- integrar dados administraveis do Supabase para calculadoras.

Se tiver `Memorial A4`, use tambem `12-engenharia-memorial-a4-agent.md`.
Se tiver `Ajuda`, use tambem `13-engenharia-ajuda-agent.md`.
Antes de entregar, use `15-engenharia-qa-agent.md`.
Antes de editar, consultar tambem `agents/00-coding-method-agent.md` para preservar escopo, criterios, formulas, seam de teste e evidencia.

---

## Objetivo

Garantir que todas as calculadoras parecam e funcionem como partes da mesma ferramenta AMFRI: mesma estrutura, mesmas larguras, mesma linguagem visual, mesmas classes, mesmos botoes e mesma logica de copia/memorial/orcamento.

## Metodo de calculo e teste

- Trate cada regra como contrato: entrada, unidade, formula, arredondamento, excecao, trava e saida.
- Se o pedido alterar calculo, crie uma amostra red-capable com valor esperado independente antes da alteracao e transforme-a em regressao.
- Se o pedido for visual, congele o calculo e compare somente a apresentacao.
- Se o pedido for calculo, congele layout, ordem, botoes e agrupamentos, salvo solicitacao explicita.
- Centralize formulas em modulo profundo e mantenha a interface da calculadora fina; evite duplicar a mesma regra em card, copia, memorial e orcamento.

---

## Referencias aprovadas obrigatorias

Antes de criar ou alterar calculadora, abrir as referencias equivalentes:

### Layout, colunas e botoes

- CSS global aprovado: `engenharia/core/styles.css`.
- Estrutura base de tela com `calculator-head`, `quick-actions`, `calc-shell`, `calc-editor`, `calc-results`: `engenharia/calhas-pluviais/index.html`.
- Topo e botões equivalentes em calculadoras com orçamento: `engenharia/muro-de-alvenaria/index.html` e `engenharia/muro-para-gradil/index.html`.
- Calculadora com importação e layout especial: `engenharia/paredes/index.html`.

Seletores que devem ser preservados:

- `.calculator-head`;
- `.quick-actions`;
- `.calc-shell`;
- `.calc-editor`;
- `.calc-results`;
- `.form-card`;
- `.result-card`;
- `.result-actions`;
- `.criteria-details`;
- `.image-lightbox`.

### Botoes

- Fonte de verdade visual: `engenharia/core/styles.css`, seletores `.engineering-body button`, `.engineering-body .btn`, `.engineering-body button:hover`, `.quick-actions`.
- Botões de topo aprovados: `engenharia/calhas-pluviais/index.html`.
- Botões de copia por grupo: `engenharia/muro-de-alvenaria/calculadora-muro-de-alvenaria.js`, funções `copyButton`, `copyActionRow`, `copyActionGroup`.
- Todo botão que copia texto deve exibir a prévia rápida padrão em hover e foco, usando `engenharia/core/copy-preview.mjs`. A prévia deve receber exatamente a mesma string do clique, inclusive em orçamento, TSV e memorial completo; nunca montar texto aproximado só para exibição.
- Grupos de botões de resultado usam o layout flexível compartilhado: cada botão deve ter largura mínima consistente e a última linha deve repartir toda a largura disponível entre os botões restantes. Não criar grade rígida que deixe célula vazia à direita; no mobile, manter uma ação por linha.
- Novos botões de cópia devem trazer `data-copy-preview` com a chave já usada pela ação e chamar `attachCopyPreview` com o resolvedor do mapa atual de textos. A prévia é somente leitura e não pode alterar cálculo, estado, área de transferência ou status de cópia.

### Criterios recolhidos

- Modelo simples: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, função `renderCriterios`.
- Modelo com critérios estruturais: `engenharia/esquadrias/calculadora-esquadrias.js`, função `renderCriteriosEstruturais`.
- Modelo de lista simples aprovado: `engenharia/banco-concreto-amfri/calculadora-banco-concreto-amfri.js`, bloco `details.criteria-details`.
- Estilo: `engenharia/core/styles.css`, seletor `.criteria-details`.
- `Critérios adotados` deve ser lista simples em `<ul><li>...`, sem cards internos, sem `formula-grid`, sem transformar fórmulas em bloco visual grande quando o usuário não pedir.
- Cada fórmula, exceção e regra usada pelo cálculo da tela deve aparecer nos critérios adotados da própria calculadora. Exemplo: se o cálculo usa lastro, pilarete, desconto, DMT, importação, arredondamento, ausência de empolamento ou trava de negativo, isso precisa estar citado.
- Quando houver sobra para bota-fora com empolamento, critérios, cards, textos de cópia, memorial e orçamento devem indicar que a sobra está com empolamento. O volume empolado é o que alimenta carga/manobra/descarga e transporte até bota-fora.
- Antes de entregar ajuste de cálculo, comparar os critérios visíveis contra as funções reais de cálculo. Se tiver fórmula nova no código e não tiver item nos critérios, a entrega está incompleta.
- Ajuste visual em critérios não pode remover fórmula, exceção ou observação técnica existente.

### Resumo da coluna direita

- Fonte de verdade aprovada: `engenharia/paredes/calculadora-paredes.js`, funções `renderSummary` e `resultCard`.
- O primeiro bloco dentro de `aside.calc-results` deve ser sempre o resumo da calculadora.
- Estrutura obrigatória:

```html
<section class="form-card blue">
  <p class="eyebrow">Resumo</p>
  <h3>Resultados gerais</h3>
  <div class="result-grid">
    <div class="result-card"><span>Rótulo da calculadora</span><strong>Valor</strong></div>
  </div>
</section>
```

- O conteúdo dos cards muda conforme a calculadora, mas os nomes `Resumo` e `Resultados gerais` não mudam.
- Usar `.result-grid` e `.result-card` no resumo; não usar tabela como primeiro resumo salvo pedido explícito.
- Cards comuns do resumo não devem receber `.green`; o padrão visual é valor azul como em `paredes`.
- `.green` e `.red` ficam reservados para status real de OK/erro/não conforme, quando a calculadora precisar comunicar risco.
- Se a calculadora usa helper compartilhado (`sectionResultados`, `resultSection` etc.), criar opção explícita tipo `{ summary: true }` e aplicar somente na primeira seção.
- Não nomear o primeiro resumo como `Resultados`, `Resumo geral`, `Dados gerais`, `Quantitativos`, `Valor para orçamento` ou outro título local.
- Blocos detalhados, tabelas, orçamento, memorial, critérios e composição padrão começam abaixo do resumo.

### Textos administráveis

- Toda calculadora listada em `/engenharia` deve ter card administrável no `/admin`, app `app:engenharia`, usando `engineering_calculator_admin_items` com:
  - `calculator_slug = 'hub'`;
  - `item_type = 'calculator_card'`;
  - `item_key = '<slug-da-calculadora>'`;
  - `data.description` para a descrição do card da página `/engenharia`;
  - `data.badge_status` para `available` ou `development`.
- Toda calculadora deve ter descrição interna administrável no mesmo admin do hub, usando:
  - `calculator_slug = '<slug-da-calculadora>'`;
  - `item_type = 'calculator_intro'`;
  - `item_key = 'main'`;
  - `data.description` para o texto do `<p class="sec-sub">` dentro da calculadora.
- A aplicação pública da descrição interna deve ser centralizada em `engenharia/core/calculator-intro.mjs`, chamado por `engenharia/core/nav.js`.
- A descrição interna deve usar `textContent`, nunca `innerHTML`, para não injetar HTML vindo do banco.
- Se o Supabase falhar ou o item não existir, manter o texto estático do `index.html` como fallback.
- Ao criar calculadora nova, adicionar default em `lib/engineering-hub.js` e seed em `docs/supabase-engenharia-admin-items.sql`.

### Cotações externas

- Fontes de cotação ficam vinculadas ao par `fonte + código` do insumo e são reutilizadas pelas composições que usam esse mesmo par.
- O admin deve permitir cadastrar o próprio insumo de cotação sem exigir composição existente, usando `engineering_calculator_admin_items` com `calculator_slug = 'composicoes'`, `item_type = 'quote_item'` e `data` contendo `source`, `code`, `description` e `unit`.
- Fluxo obrigatório no admin: primeiro `Salvar insumo`; depois selecionar esse insumo em `Fontes reutilizáveis` para cadastrar um ou mais fornecedores.
- Insumos `quote_item` ativos devem aparecer no acervo público de cotações mesmo antes de serem usados em uma composição.
- Nunca apresentar preço como atualizado automaticamente quando o fornecedor bloqueou a consulta. Preservar a última referência manual e indicar que ela precisa ser confirmada no link.
- Mercado Livre deve usar a API oficial quando `MERCADO_LIVRE_ACCESS_TOKEN` estiver configurado; não depender apenas do HTML público, que pode redirecionar servidores para verificação.
- Fornecedores com proteção antirobô, como a Leroy Merlin, permanecem em conferência manual enquanto não houver integração oficial ou navegador remoto autorizado.
- A página pública deve exibir ação explícita `Ver cotações` nas composições com insumos cotados; não esconder a funcionalidade apenas no fim de um modal sem indicação na listagem.
- Não criar nova função em `api/` para cotações. Reutilizar os dispatchers existentes em `api/contact.js` e `api/admin.js`, preservando o limite de 12 Serverless Functions do plano Hobby da Vercel.
- O admin de composições deve aceitar importação em lote do TXT de cotações com `@@EMPRESAS`, blocos `@@NovaCotação` e `@@END`.
- O formato antigo `empresa;preço;DD/MM/AAAA` continua válido e cadastra o insumo, mas não cria fonte porque a tabela exige URL HTTPS.
- O formato ampliado é `empresa;preço;DD/MM/AAAA;URL HTTPS do produto;nome opcional do produto`. Com URL válida, importar fornecedor, preço manual, data da referência e histórico.
- Toda importação em lote deve ter análise prévia com totais de empresas, insumos, preços, links prontos e preços sem link. O backend deve analisar novamente o texto antes de gravar.
- Links importados passam pela mesma validação SSRF de `validatePublicUrl`; link inválido não interrompe os demais registros e deve voltar como aviso.

### Orçamento e copiar para planilha

- Orçamento administrável/Supabase: `engenharia/muro-de-alvenaria/orcamento-muro-de-alvenaria.mjs` e `engenharia/muro-para-gradil/orcamento-muro-para-gradil.mjs`.
- Renderização de lista de orçamento com botões: `engenharia/muro-de-alvenaria/calculadora-muro-de-alvenaria.js`, função `renderListaOrcamento`.
- Orçamento BIM/títulos por especialidade: `engenharia/paredes/calcular-paredes.mjs`, funções `gerarOrcamentoParedes` e `gerarTsvOrcamento`; render em `engenharia/paredes/calculadora-paredes.js`, funções `renderQuantitativos` e `renderBudget`.
- Formato de planilha bloqueada do usuário: copiar somente colunas/posições solicitadas, sem tentar preencher descrição/unidade quando a planilha bloquear.

#### Tabela para orçamento

Fonte de verdade visual aprovada: `engenharia/paredes/calculadora-paredes.js`, funções `renderBudget` e `renderBudgetTable`.

Toda seção chamada `Tabela para orçamento` deve seguir este padrão:

- `section.form-card.blue` com `p.eyebrow` = `Orçamento` e `h3` = `Tabela para orçamento`.
- Tabela com colunas, nessa ordem fixa: `Base`, `Código`, `Descrição`, `Unidade`, `Quantidade`.
- Largura visual padrao: `Base` estreita para caber `SINAPI`; `Código` estreita para ate 6 caracteres; `Unidade` estreita para ate `M3XKM`; `Quantidade` estreita e alinhada a direita; `Descrição` deve ocupar a maior parte da tabela.
- Não usar colunas `Grupo`, `Tipo`, `Item` ou `Aplicação` na tabela visual de orçamento.
- Títulos/especialidades entram como linha própria da tabela, com `td colspan="5"` e classe `budget-title-row`.
- Títulos/especialidades não devem aparecer presos na primeira coluna nem quebrados como item comum; devem ocupar a linha inteira da tabela.
- Descrições de composições devem usar texto em frase, como em `paredes`: primeira letra maiúscula e restante minúsculo, preservando siglas/unidades técnicas (`SINAPI`, `CA-50`, `FCK`, `MPa`, `AF_01/2021`). Não copiar descrições em CAIXA ALTA para a interface.
- Itens sem composição/SINAPI usam `Base` como `-` e `Código` como `-`, sem inventar código nem usar texto longo na coluna curta.
- Wrapper padrão: `.budget-table-wrap`; tabela padrão: `.budget-table.engineering-budget-table`.
- Botões de cópia ficam abaixo da tabela, dentro de `.result-actions`/`.budget-actions`.
- Botões padrão quando existirem: `Copiar orçamento`, `Copiar para planilha`; botões extras existentes podem permanecer se não quebrarem o padrão nem removerem funcionalidade.
- `Copiar para planilha` deve acompanhar as mesmas colunas visuais, salvo quando o usuário pedir formato específico para planilha bloqueada.
- Referências já padronizadas: `engenharia/paredes`, `engenharia/muro-de-alvenaria`, `engenharia/muro-para-gradil`, `engenharia/pergolado-madeira`.
- A integração de projetos está temporariamente suspensa. Preservar `engenharia/projetos/` e `engenharia/core/project-widget.mjs`, mas não exibir o card ou link de `Projetos` no hub/navegação e não injetar botões `Adicionar ao projeto` enquanto `engineeringProjectsEnabled` estiver `false` em `engenharia/core/nav.js`.
- Não apagar nem desmontar o motor de projetos durante ajustes em calculadoras. A futura reativação deve ocorrer pelo controle central, sem implementar botões manualmente em páginas isoladas.
- As tabelas `.engineering-budget-table` continuam usando colunas `Base`, `Código`, `Descrição`, `Unidade`, `Quantidade` e títulos em `tr.budget-title-row`, preservando compatibilidade com o motor de projetos para reativação futura.

### Memorial A4 e PDF continuo

- Toda calculadora criada ou ajustada com `Memorial A4` deve seguir `agents/12-engenharia-memorial-a4-agent.md`.
- O HTML do memorial deve carregar `/engenharia/core/memorial-continuo.js`.
- Esse helper tambem padroniza tabelas dos memoriais: impede corte lateral e converte tabelas largas em fichas tecnicas quando nao couberem no A4.
- Nao criar solucao local por calculadora para esconder, cortar, reduzir fonte demais ou forcar largura de tabelas A4. Se precisar comportamento especifico, usar `data-memorial-table-mode="cards"` para forcar fichas ou `data-memorial-table-mode="table"` para manter tabela.
- A barra do memorial deve ter os tres botoes, nesta ordem: `Imprimir / Salvar PDF`, `Imprimir PDF contínuo`, `Fechar aba`.
- `Imprimir / Salvar PDF` mantém o A4 normal e chama `window.printA4()`.
- `Imprimir PDF contínuo` chama `window.printContinuousPdf()`, com altura calculada automaticamente pela `.page`.
- Nao substituir A4 por PDF continuo; os dois modos devem existir.

### Importação

- Importação de tabela com conflitos/duplicados: `engenharia/esquadrias/calculadora-esquadrias.js`.
- Importação BIM agrupada por parede: `engenharia/paredes/calcular-paredes.mjs` e `engenharia/paredes/calculadora-paredes.js`.
- Ajuda associada ao modal: `engenharia/esquadrias/ajuda-importacao.html` e `engenharia/paredes/ajuda-importacao.html`.

### BIM / IFC estrutural

- Fonte inicial para implementação BIM estrutural: `engenharia/bim-estruturas/`.
- A calculadora BIM estrutural deve ficar separada de `engenharia/escavacao/`; pode reaproveitar fórmulas estruturais aprovadas, mas não deve exibir tubos, caixas ou redes de infraestrutura quando o foco for IFC estrutural.
- A primeira fase IFC usa diagnóstico local no navegador: ler arquivo `.ifc` textual, identificar schema, entidades estruturais, GUID, nome, propriedades e quantidades. Não prometer cálculo automático por geometria sem validar IFC real.
- Entidades IFC estruturais mínimas para diagnóstico: `IfcFooting`, `IfcPile`, `IfcBeam`, `IfcSlab` e `IfcColumn`.
- Quando evoluir para geometria real, avaliar `web-ifc`/ThatOpen como motor de leitura IFC/WASM, mantendo fallback por tabela colada quando a exportação BIM não trouxer propriedades confiáveis.
- Conversão IFC para quantitativo só deve ser ativada após mapear nomes de propriedades por origem BIM e manter conferência visual antes de gravar/adicionar estruturas.
- Importação por tabela continua sendo caminho conferido para sapatas, blocos, vigas baldrame e lajes enquanto IFC automático estiver em desenvolvimento.

### Imagens e lightbox

- Padrão de imagem ampliável dentro de calculadora: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, bloco HTML com `pattern-visual expandable-image` e funções `ensureLightbox`, `openLightbox`, `closeLightbox`.
- Estilo global: `engenharia/core/styles.css`, seletores `.pattern-visual`, `.expandable-image`, `.image-lightbox`.

---

## Padrao visual obrigatorio

- Usar `nav.js` e `styles.css` compartilhados.
- Usar `calc-shell`, `calc-editor`, `calc-results`, `form-card`, `result-card`, `result-actions` e `quick-actions` quando aplicavel.
- Desktop com duas colunas simetricas quando a calculadora tiver entrada e resultados.
- Coluna esquerda e direita nao podem se sobrepor.
- Tabela larga deve ter wrapper com rolagem ou ficar em area principal.
- Nao jogar tabela larga em painel lateral estreito.
- Cards nao devem vazar horizontalmente.
- Botoes devem seguir o padrao aprovado das calculadoras.
- `Voltar`, `Limpar tudo`, `Importar tabela`, `Memorial A4` e similares devem manter alinhamento e tamanho padrao.
- Nao usar cor nova sem pedido explicito.
- Nao mudar layout, agrupamento ou ordem por iniciativa propria.
- Nao usar ajuste especial de uma calculadora como padrao global. Exemplo: regras `.paredes-*` so valem para paredes, salvo pedido explicito.
- Se alterar `engenharia/core/styles.css`, conferir impacto em pelo menos: calhas, esquadrias, muro de alvenaria e paredes.

### Titulos de cards/itens

- Fonte de verdade: cards de `engenharia/paredes/calculadora-paredes.js`, com titulo principal em `<h4>` dentro de `.calc-item-head`.
- O titulo principal do card deve usar o padrao global `.calc-item h4`: fonte `var(--head)`, cor `var(--amfri-blue)`, `20px`, `line-height:1.12` e caixa alta.
- Nao criar titulo pequeno duplicado quando ele repetir o mesmo conteudo do `<h4>`.
- Nao adicionar numeracao artificial ao titulo do card (`Sapata 2`, `Bloco 4`, etc.) sem pedido explicito.
- Subtitulo abaixo do titulo deve mostrar metadado util, como `Adicionado manualmente` ou `Informações importadas`, status ou contexto. Nao repetir a descricao editavel do proprio card.
- Se o card tiver campo `Descrição`, essa descricao fica no campo de entrada, nao duplicada no cabecalho.

---

## Padrao funcional

- Alteracao de calculo nao deve alterar visual sem pedido.
- Alteracao visual nao deve alterar calculo sem pedido.
- Manter modo manual quando existir.
- Nao remover botoes, campos, secoes ou formas de uso sem pedido explicito.
- Botoes de copiar devem gerar texto pronto para uso, com unidade e pontuacao padronizadas. Quando o botao copiar um item, o texto deve conter somente o memorial daquele item em uma linha, sem titulo de grupo, linha em branco ou quebra de linha. Titulos e quebras so entram em botoes que pedirem explicitamente a copia do grupo completo.
- `Copiar para planilha` deve respeitar formato esperado da planilha do usuario.
- Quantitativos e orcamento devem ser separados conforme o padrao real de orcamento do usuario.
- Titulos em tabela de orcamento devem ser linhas proprias quando o usuario pedir separacao por especialidade.
- Dados zerados so devem aparecer quando forem relevantes para conferencia.
- Valores exibidos em cards, tabelas, textos de copia e memoriais devem usar 2 casas decimais em PT-BR para quantitativos de engenharia (`m²`, `m³`, `m³xkm`), sem reduzir a precisao interna dos calculos.
- Na calculadora de escavacao, caixas de passagem entram na disciplina da rede selecionada para totais e orcamento; nao concentrar todas em um grupo generico quando o pedido for separacao por disciplina.
- Na calculadora de escavacao, titulos de lastro em orcamento estrutural devem carregar o tipo da estrutura: `LASTRO DE BRITA - SAPATA`, `LASTRO DE BRITA - BLOCO`, `LASTRO DE BRITA - VIGA`, `LASTRO DE BRITA - LAJE`.

### Entradas decimais pt-BR

Padrao obrigatorio para TODAS as calculadoras, novas e existentes, incluindo campos manuais, dinamicos e de edicao de itens importados.

- Campos que aceitam fracao usam `type="text"` com `inputmode="decimal"` e virgula decimal visivel. Preservar a digitacao parcial e normalizar a exibicao no `blur`, sem interromper a entrada.
- No `blur`, completar o zero inicial e exibir pelo menos duas casas decimais; preservar casas adicionais significativas. A formatacao de entrada nao pode arredondar valores pequenos para zero nem reduzir a precisao usada no calculo ou na persistencia.
- Interpretar a virgula como separador decimal e o ponto de milhares como agrupamento no texto pt-BR. Normalizar e validar o valor completo antes da conversao numerica; nao aplicar `Number`/`parseFloat` diretamente em strings com virgula nem aceitar conversao parcial que trunque milhares ou fracoes.
- Area (`m2`) e comprimento (`m`) sao grandezas fracionarias, mesmo quando o valor inicial for inteiro. Nao usar `step="1"` nem arredondamento inteiro nesses campos. Contagens realmente inteiras continuam com validacao e exibicao inteiras, sem forcar `,00`.
- Manter limites, unidades e tratamento de vazio/invalido definidos pela calculadora; em campos de texto, validar explicitamente as restricoes numericas antes atendidas pelo input numerico.
- Helper compartilhado em desenvolvimento: `engenharia/core/numeric-input.js`. Ao integrar, consultar sua API real e reutilizar o helper para leitura/formatacao, sem criar parsers locais concorrentes. Cada `engenharia/<slug>/index.html` deve carrega-lo antes dos scripts da calculadora, com ordem de execucao garantida. Esta referencia nao comprova que a integracao ja foi concluida.
- Separar texto localizado de valor numerico interno. Importacao deve preservar os formatos ja aceitos e numeros ja normalizados; edicao e persistencia devem manter o contrato/tipo de dados existente, sem salvar a mascara como substituto do valor numerico nem reaplicar a regra de milhares a numeros internos.
- Resultados, quantitativos, orcamento, copias e memorial mantem suas regras e formatacao aprovadas; a exibicao com duas casas nao deve voltar ao estado interno como valor arredondado. Este padrao nao autoriza mudar formulas, layout, ordem ou fluxos existentes.

#### Regressao obrigatoria de entradas

Validar pela interface publica os casos abaixo, com expectativas independentes do helper:

| Caso | Entrada | Apos `blur` | Valor interno esperado |
|---|---|---|---|
| Fracao sem zero inicial | `,6` | `0,60` | `0.6` |
| Area fracionaria | `132,06` | `132,06` | `132.06` |
| Milhares com fracao | `1.132,06` | `1.132,06` | `1132.06`, sem truncamento |
| Valor pequeno preciso | `0,000125` | `0,000125` | `0.000125`, sem arredondar para zero |
| Contagem inteira | `3` | `3` | inteiro `3` |

1. Digitar e colar os valores, sair do campo e repetir foco/`blur`; conferir virgula visivel, precisao e resultado calculado. Cobrir area e comprimento, campos dinamicos e contagens, em desktop e mobile.
2. Onde houver importacao, importar e abrir `Editar`; salvar sem alterar, depois alterar o decimal e salvar novamente. Conferir entrada, resultado, copia e memorial/orcamento quando existirem. Onde houver persistencia, salvar e recarregar/reabrir, verificando o mesmo valor e resultado, inclusive milhares e valores pequenos precisos.
3. Executar regressao das formulas e formatos de importacao ja aceitos. Se o helper compartilhado mudar, cobrir TODAS as calculadoras consumidoras; registrar calculadora, casos executados e resultado. Marcar fluxos inexistentes como nao aplicaveis e casos nao executados como pendentes; build ou teste isolado do parser nao substitui essa evidencia.

### Persistencia de parametros e memoriais de item

- DMT, empolamento, fatores e demais parametros globais editaveis devem ser carregados do estado persistido antes de preencher o DOM. O valor fixo do HTML e apenas fallback inicial e nunca pode sobrescrever o valor salvo durante a inicializacao.
- Validar persistencia apos sair/voltar, recarregar e usar `Ctrl+F5`. Limpar itens nao deve apagar parametros globais sem confirmacao especifica.
- Quando existir padrao global e personalizacao por item, registrar se o item continua vinculado ao padrao. Alterar o padrao atualiza itens vinculados e preserva os personalizados.
- O botao `Copiar memorial` de um item deve gerar texto corrido com identificacao, grandezas informadas, unidades, formula, fatores aplicados e resultado. Exemplo: `area x espessura = volume original x (1 + empolamento) = volume solto`.
- Em toda saída calculada visível (card, tabela, memorial A4 e botão de cópia), a unidade fica colada ao valor: `12,90m`, `11,90m²`, `1,70m³`, `17un`, `30kg`, `0,80km`. Não usar `12,90 m` ou `17 un`.
- Em fórmula entre grandezas, preservar espaços ao redor de `x`: `17un x 0,50m x 0,50m x 0,40m`. Em dimensão declarativa, compactar os lados: `0,30x0,30x0,30m` e `30x30x30cm`. Para multiplicador puro de quantidade ou bitola, usar `x1` e `x2\"`.
- Todo novo texto copiado deve seguir o padrão de memória: serviço e elemento, expressão com valores e unidades, resultado final e ponto. Usar `×` em multiplicações, `−` em subtrações e unidades coladas aos números. Carga deve declarar se usa volume natural ou solto; transporte deve declarar material/origem, volume, DMT e resultado em `m³×km`. Não alterar fórmula interna somente para adequar o texto.
- Para medidas contínuas exibidas em cópias, usar duas casas decimais; preservar inteiros para contagens e a precisão própria de coeficientes técnicos. Arredondamento é apenas de apresentação.

---

## Padrao de importacao

- Modal de importacao deve ser limpo, sem rolagem interna desnecessaria.
- Sempre mostrar exemplo de tabela.
- Quando houver ajuda, botao `Ajuda` fica dentro do modal.
- Perguntar/permitir modo substituir ou acrescentar quando importar lista.
- Tratar duplicidade com regra clara.
- Preservar IDs de origem BIM quando existirem.
- Agrupar dados repetidos conforme regra da calculadora.
- No `engenharia/composicoes`, o TXT importado e uma fonte de candidatos: analisar, selecionar individualmente e gravar somente as composicoes aprovadas. Nunca publicar automaticamente todas as composicoes do arquivo.
- A pagina publica do acervo de composicoes e somente para consulta e exportacao. A manutencao fica no `/admin`.
- A exportacao das composicoes deve preservar fonte, codigo e coeficiente dos insumos, sem incorporar precos, para que a planilha aplique a base orcamentaria vigente.
- Composicoes e insumos de cotacao usam numeracoes automaticas independentes, atribuidas pelo banco na ordem de insercao. O admin nunca pede que o usuario escolha esses numeros.
- A identidade tecnica de composicoes e insumos de cotacao e `record_uuid`; o numero automatico e apenas referencia visivel e codigo de intercambio com a planilha.
- Componentes cotados das composicoes e fontes de fornecedor se vinculam por `quote_item_uuid`. Nunca criar relacao nova baseada somente em `component_source + component_code`.
- `source + code` permanece apenas como compatibilidade de importacao/exportacao TXT e migracao de registros antigos. Ao salvar, a API deve resolver o codigo legado para UUID e rejeitar cotacao inexistente.
- As sequencias de composicoes e cotacoes sao separadas. Renumerar uma composicao nao pode alterar a identidade ou os vinculos de um insumo cotado.
- A migracao de referencia e `docs/supabase-engenharia-composicoes-identidade.sql`; ela preserva `legacy_code`, retrovincula dados existentes e nao troca UUID em edicoes posteriores.
- Cada fonte de cotacao deve guardar fornecedor, URL HTTPS, nome de referencia, produto identificado, preco atual, moeda, disponibilidade, status e data da ultima leitura.
- Toda alteracao valida de preco deve gerar historico. Falha de leitura nunca pode criar ou substituir preco por valor estimado; preservar o ultimo preco conhecido e registrar o erro.
- A pagina publica deve mostrar preco como referencia, data da conferencia, link direto para a oferta e acao `Avisar problema`. Avisos de link fora do ar, preco incorreto ou produto alterado devem aparecer no `/admin`.
- Leitura de URL externa deve ocorrer somente no backend, com validacao contra SSRF, timeout, limite de resposta e redirecionamentos validados. Nunca buscar fornecedor diretamente pelo navegador do usuario.
- Precos externos nunca entram no TXT exportado. O TXT continua contendo somente fonte, codigo e coeficiente para a planilha aplicar a base vigente.
- A base orcamentaria ativa substitui integralmente a versao anterior. Consultas publicas usam somente os itens vinculados ao `import_id` ativo; nunca completar codigo ausente com referencia arquivada.
- O acervo de composicoes deve listar referencias usadas pelas composicoes que nao existem na base ativa e fontes de cotacao sem conferencia ha 30 dias ou mais.

---

## Imagens e referencias

- Imagens da calculadora ficam na pasta da propria calculadora.
- Imagens de referencia devem carregar, ter tamanho util e abrir em lightbox quando forem de consulta.
- Fundo/logo global vem de `/engenharia/core`.
- Nao criar SVG decorativo quando uma imagem real/referencia existe.

---

## Testes e validacao

Antes de entregar:

```powershell
rg -n "quick-actions|calc-shell|calc-editor|calc-results|criteria-details|result-actions|image-lightbox|Memorial A4|Ajuda" engenharia/<slug> engenharia/core/styles.css
node engenharia/<slug>/<teste>.mjs
git diff --check -- <arquivos>
```

Se nao existir teste, fazer pelo menos amostra via `node --input-type=module` para validar calculo central.

---

## Checklist de entrega

- [ ] Escopo do pedido foi respeitado sem mudanca extra.
- [ ] Padrao visual comparado com calculadora aprovada.
- [ ] Primeiro card da coluna direita segue `paredes`: `form-card blue`, `Resumo`, `Resultados gerais`, `result-grid`, `result-card`.
- [ ] Colunas nao sobrepoem.
- [ ] Tabelas nao invadem card vizinho.
- [ ] Botoes seguem padrao.
- [ ] Copias geram texto certo.
- [ ] Calculo validado.
- [ ] Memorial A4 conferido com agente 12, se existir.
- [ ] Ajuda conferida com agente 13, se existir.
- [ ] QA conferido com agente 15.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

