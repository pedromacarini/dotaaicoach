# Agente 16 — Orquestração Luna

Este playbook incorpora a arquitetura do repositorio `AgentDevSystematic/gpt-5-6-Luna-orchestrator` ao fluxo local do devpedrao-site.

## Precedência

Os playbooks existentes e `AGENTS.md` continuam sendo a fonte de verdade. A Luna adiciona disciplina de escopo, delegação e verificação; não autoriza mudar padrões, cálculos, visualizações ou fluxos por conta própria.

Antes de qualquer roteamento, consultar `agents/00-coding-method-agent.md`. O contrato da tarefa precisa carregar os criterios de aceite, os arquivos protegidos, o loop de validacao e o estado final esperado.

## Papéis

1. **Orchestrator**: define objetivo, escopo, critérios de aceite, arquivos protegidos, delegação e decisão final.
2. **Coder**: edita somente os arquivos autorizados e segue os playbooks aplicáveis.
3. **Reviewer**: lê o diff de modo independente e aponta bugs, regressões, escopo e violações de padrão.
4. **Tester**: executa os checks definidos, audita o escopo Git e reporta evidências sem editar.

## Fluxo expandido para tarefas grandes

Quando houver ganho claro em separar responsabilidades, usar estas funcoes em
sequencia. Elas sao papeis de trabalho, nao obrigacao de criar seis processos:

1. **Specifier**: transforma o pedido em criterios de aceite observaveis e
   pendencias objetivas.
2. **Coder**: implementa uma fatia vertical por vez, com teste na interface
   publica quando houver seam adequado.
3. **Cleaner**: faz limpeza comportamental e remove duplicacao sem alterar o
   contrato.
4. **Architect**: confere fronteiras, dependencias, persistencia e impacto
   entre modulos.
5. **Hardender**: procura entradas perigosas, falhas de autorizacao, caminhos
   de dados, regressao e casos de borda.
6. **QA**: executa os checks finais, incluindo browser, build, banco/Storage e
   escopo Git quando aplicavel.

Para tarefa pequena, o Orchestrator pode combinar esses papeis numa unica
execucao. Para tarefa grande, cada handoff precisa conter objetivo, arquivos
permitidos, criterios de aceite, checks e pendencias. Nenhum papel pode
declarar conclusao baseado apenas em texto do papel anterior.

## Roteamento local

- tarefa comum: playbook diretamente aplicável;
- alteração em 3+ arquivos, banco/API/admin/deploy ou risco amplo: playbook aplicável + `agents/10-qa-review-agent.md`;
- calculadora: `agents/14-engenharia-calculadora-agent.md` + `agents/15-engenharia-qa-agent.md`;
- Memorial A4: `agents/12-engenharia-memorial-a4-agent.md` + `agents/15-engenharia-qa-agent.md`;
- ajuda/importação/lightbox: `agents/13-engenharia-ajuda-agent.md` + `agents/15-engenharia-qa-agent.md`;
- calculadora com Memorial e Ajuda: agentes 12, 13, 14 e 15.

## Contrato e conclusão

Toda delegação precisa declarar objetivo, arquivos permitidos, arquivos protegidos, critérios de aceite, checks obrigatórios e dependências. Não há conclusão sem revisão independente, teste ou justificativa explícita de `NOT_RUN`/`NOT_AVAILABLE`.

Estados finais: `DONE`, `FIX_REQUIRED`, `BLOCKED`, `UNVERIFIED` ou `PARTIAL`.

## Modelo

Quando o ambiente oferecer o seletor, usar `GPT-5.6 Luna`. Não gravar ID de modelo inventado no projeto. O Codex continua como executor, responsável por editar, validar, commitar e publicar quando autorizado.

Fonte: <https://github.com/AgentDevSystematic/gpt-5-6-Luna-orchestrator>.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

