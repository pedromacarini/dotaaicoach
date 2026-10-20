# 00 - Metodo global de coding

Este e o playbook transversal para qualquer alteracao no `devpedrao-site`. Ele combina os principios das skills de engenharia instaladas com os padroes proprios do projeto. Consultar antes do playbook especifico.

## Regra de precedencia

`AGENTS.md`, os playbooks locais e os padroes aprovados do projeto vencem qualquer recomendacao generica. As skills externas ajudam no metodo; nao autorizam alterar calculo, visual, fluxo, permissao, banco ou deploy sem pedido.

## Ciclo obrigatorio

### 1. Escopo verificavel

Antes de editar:

- escreva mentalmente o comportamento pedido;
- liste o que esta explicitamente fora do escopo;
- identifique arquivos de referencia e arquivos protegidos;
- defina criterios de aceite observaveis;
- procure a implementacao existente antes de criar outra.

Se o pedido for ambiguo, preserve o comportamento atual e registre a duvida. Nao transforme uma sugestao em mudanca automatica.

### 2. Contexto e modelo

Leia `CONTEXT.md` e ADRs quando existirem. Confira `package.json`, scripts, rotas, tabelas, API e testes da area. Use `rg` para localizar o fluxo real.

Quando houver codigo novo, prefira um modulo profundo: interface pequena, invariantes claras e implementacao complexa escondida. Separe a interface do modulo, a implementacao e os adapters externos. Aceite dependencias quando isso melhorar testes; devolva resultados em vez de espalhar efeitos colaterais.

Nao crie abstracao por especulacao. Extraia somente quando houver comportamento real compartilhado ou duas variacoes concretas.

### 2.1 Simplicidade deliberada

Antes de criar codigo, percorra esta ordem:

1. Isso precisa existir para atender ao pedido?
2. Ja existe uma funcao, componente, rota, tabela ou padrao que resolva?
3. A plataforma, a biblioteca padrao ou uma dependencia ja instalada resolve?
4. Qual e a menor implementacao que atende ao contrato completo?

A simplicidade vale depois de entender o fluxo real. Ela nao reduz validacao,
tratamento de erro, seguranca, acessibilidade, testes, observabilidade ou
requisitos expressos pelo usuario. O resultado esperado e uma mudanca pequena
porque ela e suficiente, nao porque codigo curto virou objetivo isolado.

### 3. Feedback loop

Para bug, erro, lentidao ou resultado incorreto, construa primeiro um loop red-capable que reproduza o sintoma exato:

- teste na interface publica;
- script/CLI com fixture;
- request HTTP;
- browser/Playwright;
- harness minimo, nessa ordem conforme o caso.

O loop precisa ser deterministico, rapido, repetivel e ja ter sido executado uma vez. Minimize o caso antes de formular a correcao. Gere 3 a 5 hipoteses falsificaveis e teste uma variavel por vez. Logs temporarios devem ter marcador unico e ser removidos no fim.

Se nao for possivel criar loop, declare `NOT_AVAILABLE`, explique o que foi tentado e nao apresente hipotese como fato.

### 4. Fatia vertical

Implemente uma fatia completa pela interface publica: entrada, regra, persistencia quando houver, saida e teste. Em codigo testavel, siga red -> green -> refactor:

1. teste falha com resultado esperado independente da implementacao;
2. menor alteracao que faz passar;
3. refatoracao somente depois do comportamento protegido.

Testes nao devem acessar detalhes privados, recomputar a mesma formula do codigo ou depender de mocks internos. Use exemplos de especificacao, casos reais e valores calculados independentemente.

### 5. Seguranca e dados

Antes de qualquer fluxo que leia, salve, edite, baixe ou exclua dados, mapeie tabela/coluna, grant, RLS, API, Storage, metadados, admin e limpeza. Valide entradas, limite tamanho e formato, trate erro sem vazar dados e mantenha segredos somente no backend/env.

Em URLs externas, valide SSRF, protocolo, redirecionamento, timeout e tamanho de resposta. Em logs, comandos e relatorios, redija tokens, senhas, chaves, cookies e dados pessoais.

### 6. Revisao em dois eixos

Antes de concluir, revise separadamente:

- **Padrao:** convencoes do repositorio, nomes, modulo profundo, duplicacao, acoplamento, escopo e seguranca;
- **Especificacao:** cada requisito pedido, cada criterio de aceite, comportamento nao solicitado e regressao possivel.

Trate smells como sinais para investigar, nao como erros automaticos. Procure especialmente nome misterioso, duplicacao, data clump, primitive obsession, shotgun surgery, divergent change, repeated switch e middle man.

### 7. Evidencia e fechamento

Execute os checks adequados: teste focal, `node --check`, lint, build, browser, HTTP, `git diff --check` e auditoria de arquivos staged. Nao diga "testado", "commitado", "publicado" ou "corrigido" sem evidencia do comando correspondente.

Remova debug e fixtures temporarios. Confira que o diff contem somente o escopo pedido. Feche com estado explicito:

```txt
DONE | FIX_REQUIRED | BLOCKED | UNVERIFIED | PARTIAL
```

`DONE` exige criterio de aceite atendido, validacao executada e nenhuma pendencia obrigatoria.

## Referencias de skills incorporadas

- `codebase-design`: modulos profundos, interfaces, seams, adapters, profundidade, localidade e testabilidade;
- `diagnosing-bugs`: loop red-capable, minimizacao, hipoteses falsificaveis, instrumentacao e regressao;
- `tdd`: testes na interface publica, red-green-refactor, fatias verticais e expectativas independentes;
- `code-review`: revisao separada por padrao e especificacao, com controle de scope creep;
- `research`: fontes primarias e registro de conclusoes quando pesquisa for solicitada;
- `writing-for-agents`: ponteiros fortes, fonte unica, divulgacao progressiva e criterios de conclusao;
- `git-guardrails-claude-code`: cuidado com operacoes destrutivas e escopo do stage;
- `handoff`: contexto curto, pendencias, arquivos e skills relevantes para continuidade.
- `ponytail`: simplicidade deliberada e revisao contra overengineering, sempre subordinada aos requisitos e aos gates de seguranca/QA;
- `swarm-forge`: separacao de papeis, handoffs verificaveis e gates independentes para tarefas grandes;
- `archify`: mapa arquitetural deterministico e comparacao Before/Delta/After quando uma mudanca grande exigir evidencia de estrutura.

Essas referencias sao metodo. Credenciais, deploy, Git, Vercel, Supabase, limite de funcoes e padroes AMFRI continuam documentados somente nos playbooks locais e em `AGENTS.md`.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

