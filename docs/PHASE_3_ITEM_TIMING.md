# Fase 3 — Inventário e timing de itens

Implementado em 2026-10-20 sobre Electron 37.x.

## Decisões e limites

- O CFG solicita somente `provider`, `map`, `player`, `hero` e `items`. `allplayers` continua ausente.
- A normalização cobre seis slots ativos, três de mochila (`slot6`–`slot8`), seis de baú, TP e neutro. Campo `items` ausente produz inventário `unknown`; chave de slot ausente também é `unknown`; somente uma chave presente sem item é `empty`.
- Apenas o inventário do jogador local é aceito. O payload GSI integral não é salvo nem repassado ao histórico.
- O tracker registra **primeira observação do tipo de item**. Ele não chama o evento de compra. Troca de slot/área, desaparecimento, venda, combinação, courier e reaparição não podem ser distinguidos com segurança por esse estado.
- Um item movido entre inventário, mochila e baú não gera nova observação. Reaparecer na mesma sessão também não. Uma combinação gera primeira observação do novo tipo de item, sem alegar como ele surgiu.
- Dois `matchid` confiáveis diferentes ou forte retorno ao início abrem uma sessão nova e limpam também o herói anterior. Se o primeiro `matchid` confiável chega tarde, ele apenas identifica a sessão já em curso e preserva as observações anteriores. Reconexão com o mesmo `matchid` mantém a deduplicação.
- Pacotes sem mudança observável no inventário, sessão, posição ou comparação não geram um novo evento `items:changed` para os renderers.
- O benchmark inicial é uma fixture autoral sintética para Axe posição 3, patch rotulado `7.41-fixture`, com amostra fictícia declarada. Ele serve apenas para testar cedo/no esperado/tarde; não é OpenDota, não é profissional e não afirma representar o patch do cliente.
- O estado GSI aparece como **não validado** até termos fixtures e uma execução real em lobby/bots. A demo aparece sempre como sintética.

## Arquitetura

- `electron/gsi.ts`: normalização defensiva e CFG com `items`.
- `src/core/item-tracker.ts`: sessão, deduplicação e primeiras observações.
- `src/core/item-timing.ts`: benchmark versionado e comparação pura.
- `src/shared/contracts.ts`: inventário, observações, comparações e IPC.
- `electron/main.ts` e `electron/preload.ts`: estado em memória e ponte mínima para painel/overlay.
- `src/components/ItemTimingPage.tsx`: inventário, evidência e histórico.
- `src/components/Overlay.tsx`: cartão compacto, controlado pelo módulo Itens.

O renderer não escolhe arquivos, não recebe token GSI, não acessa `allplayers` e não consulta OpenDota por pacote. A página usa somente o catálogo local carregado sob demanda. O smoke substitui qualquer consulta da recomendação já existente por respostas locais controladas.

## Verificação automatizada

- GSI: campo ausente, vazio observado, slot desconhecido, ativo, mochila, baú, TP e neutro.
- Tracker: primeira aparição, troca entre áreas, combinação, desaparecimento/reaparição, reconexão, item desconhecido, nova partida sem herói residual, adoção tardia de `matchid` e pacote duplicado sem publicação.
- Benchmark: cedo, intervalo esperado, tarde e ausência de amostra.
- Smoke Electron: abre a página Itens pela UI, ativa a demo, comprova rótulo sintético e histórico no painel, IPC real e cartão no DOM do overlay.

## Checklist visual

1. Em **Visão geral**, ligue **Modo demonstração**.
2. Abra **Itens** e confirme “DEMO SINTÉTICA”.
3. Confira os slots presentes, vazios e desconhecidos com estilos diferentes.
4. Confira Boots of Speed, Blink Dagger e Tango no histórico de primeira observação.
5. Confirme que o benchmark diz “Fixture autoral sintética”, mostra amostra/patch e que Tango fica “SEM AMOSTRA”.
6. Olhe o overlay e confira o cartão “PRIMEIRA OBSERVAÇÃO · NÃO É COMPRA”.
7. Desative o módulo **Itens** nas configurações e confirme que recomendações e timing somem do overlay.

## Ainda pendente

- Capturar payloads reais anonimizados do Dota para confirmar nomes/cadência de todos os slots, cargas, combinação e reconexão.
- Substituir/ampliar a fixture por benchmark público real com consulta, patch, filtros, tamanho da amostra, cache e ressalva de que `purchase_log` e primeira observação GSI não são grandezas idênticas.
- Persistência/checkpoint do tracker fica para a Fase 9; nesta fase o estado de partida permanece somente em memória.
