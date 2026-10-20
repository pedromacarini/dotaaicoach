# 17 - Arquitetura e evidencia de mudancas

Playbook opcional para entender e registrar a arquitetura do site antes de
mudancas grandes. Ele incorpora a ideia do Archify sem exigir sua instalacao ou
criar um diagrama para cada ajuste.

Fonte de referencia: https://github.com/tt-a1i/archify

## Quando usar

Acionar quando a tarefa envolver tres ou mais modulos, API, Supabase, Storage,
autenticacao, upload, seguranca, Vercel, deploy, migracao ou uma refatoracao
que possa alterar fronteiras entre partes do sistema.

Nao usar para texto simples, ajuste isolado, pergunta, correcao pequena ou
mudanca que ja esteja totalmente mapeada.

## Objetivo

Produzir um mapa factual para responder:

- quais paginas, componentes, APIs, tabelas, buckets e servicos participam;
- por onde os dados entram, sao validados, salvos, lidos e excluidos;
- quais fronteiras de autenticacao e autorizacao existem;
- qual e o impacto Before / Delta / After da alteracao.

O mapa apoia a revisao. Ele nao substitui testes, RLS, grants, browser, build
ou verificacao de deploy.

## Procedimento

1. Ler `AGENTS.md`, `agents/00-coding-method-agent.md` e o playbook da area.
2. Mapear a implementacao real: rotas, componentes, `api/`, `lib/`, schemas,
   Storage, `vercel.json`, scripts e testes relevantes.
3. Registrar somente fatos encontrados. Diferenciar fato, hipotese e lacuna.
4. Escolher o tipo de mapa:
   - `architecture`: componentes, servicos, banco, Storage e fronteiras;
   - `workflow`: processo, aprovacao, deploy ou runbook;
   - `sequence`: chamadas entre navegador, API, banco e servicos;
   - `dataflow`: origem, transformacao, armazenamento e consumo de dados;
   - `lifecycle`: estados, retries, baixa, exclusao ou fluxo de aprovacao.
5. Manter um caminho principal claro, poucos nos relevantes e rotulos que
   expliquem a relacao. Nao inventar topologia para preencher o desenho.
6. Se o Archify estiver disponivel localmente, gerar a especificacao JSON e
   validar antes de entregar o HTML. Usar o CLI do checkout local; nao instalar
   automaticamente, nao baixar atualizacao e nao enviar dados do projeto.
7. Se nao estiver disponivel, entregar a mesma analise em Markdown simples ou
   Mermaid apenas como rascunho factual.
8. Antes da implementacao, comparar o mapa com os arquivos autorizados e
   registrar os pontos de impacto.
9. Depois da implementacao, atualizar o Delta e conferir se o resultado real
   bate com o que foi alterado.

## Evidencia minima

Cada componente ou relacao importante precisa apontar para arquivo, rota,
tabela, schema ou teste. Em banco/Storage, conferir tambem API, RLS, grants,
bucket, path e autorizacao. Nunca incluir valores de env, tokens, senhas,
service role, dados pessoais ou conteudo privado no mapa.

## Criterio de conclusao

`DONE` somente quando o mapa explica as fronteiras relevantes, as lacunas estao
marcadas, o Delta foi conferido e os checks do playbook da area foram
executados. Caso contrario, usar `PARTIAL` ou `UNVERIFIED`.

## Handoff

Enviar ao Coder e ao QA:

- objetivo e escopo;
- arquivos e fronteiras afetados;
- fatos e evidencias;
- riscos e lacunas;
- formato do mapa e local do artefato, se houver;
- checks obrigatorios.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

