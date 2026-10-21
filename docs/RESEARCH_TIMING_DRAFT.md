# Pesquisa: timing de itens e draft contextual

Data da pesquisa: 2026-10-21

## Conclusão executiva

- Para timing real durante a partida, a fonte primária disponível ao overlay é o **Dota 2 Game State Integration (GSI)** local. O cliente envia snapshots HTTP para um endpoint configurado pelo usuário; a configuração pode solicitar `items` e `draft`. O GSI não documenta um `purchase_log` histórico com timestamp por compra: ele fornece o estado atual do inventário, então o aplicativo deve detectar a transição de um item ausente para presente e marcar o horário local/GSI da observação.
- **OpenDota** é apropriado para histórico, benchmarks e contexto estatístico, não como relógio de compra em tempo real. Sua própria documentação descreve dados avançados extraídos de replays; o endpoint `/live` só lista partidas atualmente acompanhadas. Partidas já processadas expõem `purchase_log` e `draft_timings`, mas esses dados chegam após ingestão/parse e podem faltar enquanto a partida está em andamento.
- **STRATZ** é uma API autenticada, hoje GraphQL. O próprio site diz que usa parser de replay (Clarity) e que fornece dados de partidas/analytics. A documentação histórica do cliente REST identifica `/match/{id}/live` como dados de partidas na watch list ainda ativas, mas o REST foi descontinuado em favor do GraphQL. Isso é útil para partidas públicas/profissionais acompanhadas, não substitui o GSI local para a partida do usuário.

## Valve / Dota 2 GSI

### O que é confiável

O anúncio oficial da Valve informa que GSI precisa da opção de inicialização `-gamestateintegration` e alerta para possível impacto de desempenho por uso por frame: [Dota 2 Update — March 11th, 2022](https://store.steampowered.com/news/posts/?appids=570&enddate=1656109094&feed=steam_community_announcements) (linha do anúncio: “Game State Integration now requires ... `-gamestateintegration`”).

O issue tracker oficial de Dota 2 contém um exemplo de configuração com `uri`, `throttle`, `heartbeat` e flags `provider`, `map`, `player`, `hero`, `abilities` e `items`; em comentário posterior, o mesmo exemplo inclui explicitamente `draft`, além de `events`, `buildings`, `league`, `minimap`, `roshan`, `couriers` e `neutralitems`: [ValveSoftware/Dota-2 issue #2333](https://github.com/ValveSoftware/Dota-2/issues/2333#issue-2333). Isso confirma que `items` e `draft` são canais de dados configuráveis do GSI, mas o issue não promete que todo campo esteja preenchido em todos os modos.

O schema observado por uma implementação de servidor GSI mantida publicamente lista, no bloco de draft, `activeteam`, `activeteam_time_remaining`, `pick`, bônus de tempo e IDs/classes de picks/bans; no bloco de itens, a implementação trata inventário e mudanças de itens: [xzion/dota2-gsi — estrutura e eventos](https://github.com/xzion/dota2-gsi#clients-and-events). É uma referência de compatibilidade/observação do payload, não uma especificação oficial da Valve.

### Implicação para timing de itens

Não há evidência, nas fontes acima, de um `purchase_log` nativo enviado pelo GSI. Portanto:

1. manter o último snapshot por jogador;
2. ao observar novo item em inventário, registrar `observedAt` e o `gameTime` do snapshot;
3. tratar venda, troca de slot, courier/stash e neutral item como transições que podem gerar falsos “comprou”; usar o item/slot e o histórico de snapshots para deduplicar;
4. chamar o resultado de **observed acquisition time**, não de hora econômica exata da compra.

O `throttle`/`heartbeat` configurado limita a resolução temporal; portanto a precisão real é no máximo a frequência dos snapshots e a latência do POST. Não se deve prometer precisão de segundo sem medir a configuração efetiva.

### Implicação para draft

O GSI pode fornecer o draft atual e o relógio de turno quando o cliente realmente expõe esses campos. O overlay deve modelar draft como stream incremental (picks/bans já vistos + turno ativo), tolerar payload vazio/ausente e nunca assumir que o endpoint remoto “completará” um pick local em tempo real. O conjunto atual de heróis deve ser derivado apenas de eventos confirmados no snapshot.

## OpenDota

O documento oficial da API afirma que os dados avançados são extraídos de replays e disponibiliza `GET /matches/{match_id}` e `GET /live` (“top currently ongoing live games”): [OpenDota API docs](https://docs.opendota.com/). A mesma documentação lista o cenário `GET /scenarios/itemTimings`, descrito como win rate para determinados timings de item; isso é agregado histórico, não feed de compras da partida atual.

O código-fonte do próprio projeto OpenDota tipa `ParsedMatch.draft_timings` e `ParsedPlayer.purchase_log`, além de campos derivados `purchase_time`/`first_purchase_time`: [odota/core `global.d.ts`](https://github.com/odota/core/blob/master/global.d.ts). Isso confirma que `purchase_log`/timing existem no resultado de partidas parseadas. O README do projeto explica que a plataforma combina Steam Web API com parsing automatizado de replays: [odota/core README](https://github.com/odota/core#overview).

### Disponibilidade real

- `/live` não é um espelho do estado completo de cada jogador; a documentação o descreve como lista de partidas em acompanhamento.
- `purchase_log` e `draft_timings` são propriedades do resultado parseado da partida, não um contrato de baixa latência para o cliente local.
- Para cálculo de benchmark (por exemplo, “item X costuma sair entre 10–12 min”), OpenDota é adequado. Para alertar “o inimigo acabou de comprar X”, não é fonte suficiente/garantida.

## STRATZ

O site oficial informa que a API mudou de REST para GraphQL e que usa o parser de replay Clarity, parsers próprios e analytics: [STRATZ — página oficial](https://stratz.com/). O portal de API aponta para o GraphQL Explorer/API: [STRATZ API](https://stratz.com/api).

A documentação histórica do wrapper público (útil para identificar a mudança de contrato) marca o REST como descontinuado e recomenda GraphQL; ela descreve `/match/{id}/live` como dados de uma partida na watch list ainda ativa e inclui eventos de partida/jogador: [stratz.js DOCS — deprecation e `getMatchLive`](https://github.com/ChocolateNao/stratz.js/blob/master/DOCS.md#-deprecation-notice). Como o repositório foi arquivado e a API REST foi descontinuada, não usar esses caminhos REST como dependência nova.

### Disponibilidade real

- Requer token/autenticação; não é um canal local gratuito e anônimo equivalente ao GSI.
- O modelo é baseado em partidas públicas observadas/parseadas pela STRATZ; “live” depende de a partida estar na watch list/infraestrutura da STRATZ.
- Pode servir como fonte contextual para draft de partidas públicas/profissionais e para estatísticas de builds, mas não deve ser usado para atribuir o instante exato de uma compra na partida do usuário.

## Recomendação de arquitetura para este projeto

| Necessidade | Fonte | Contrato operacional |
|---|---|---|
| relógio e estado local | GSI `map` | baixa latência, sujeito a `throttle` |
| inventário atual | GSI `items` | detectar transições; não há `purchase_log` nativo confirmado |
| pick/ban em andamento | GSI `draft` | consumir incrementalmente; aceitar ausência/vazio |
| timing exato pós-jogo | OpenDota match parseado ou STRATZ GraphQL | histórico, não realtime garantido |
| benchmark de timing por herói/item | OpenDota `/scenarios/itemTimings` | agregado histórico; não confundir com evento atual |
| contexto de draft (counters/synergy) | base histórica OpenDota/STRATZ | recomputar com patch, bracket e modo; sem alegar causalidade |

### Regra de produto

Exibir no overlay duas noções distintas: **observado agora (GSI)** e **benchmark histórico (OpenDota/STRATZ)**. Se GSI não fornecer draft ou inventário, mostrar “indisponível nesta sessão” em vez de preencher com um endpoint remoto atrasado. Guardar a origem e o timestamp de cada evento para que recomendações contextuais possam explicar se foram baseadas no estado atual ou em dados históricos.

