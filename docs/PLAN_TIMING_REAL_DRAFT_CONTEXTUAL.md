# Plano técnico: timing real de itens e Draft contextual

Atualizado em 2026-10-21. Este documento transforma a pesquisa em implementação executável. A pesquisa de fontes está em [RESEARCH_TIMING_DRAFT.md](./RESEARCH_TIMING_DRAFT.md).

## Decisão principal

O produto terá duas camadas, sempre rotuladas separadamente:

1. **Ao vivo/local:** snapshots GSI do jogador e, quando o cliente realmente enviar, o bloco `draft`.
2. **Histórico:** benchmarks calculados de partidas parseadas por OpenDota ou STRATZ.

Um endpoint histórico nunca será usado para fingir que conhece o estado atual da partida.

## Fontes e o que cada uma pode fazer

| Necessidade | Fonte | Pode fazer | Não pode garantir |
|---|---|---|---|
| Relógio e inventário local | GSI local | Snapshot frequente, itens/slots/cargas e relógio calibrado | Compra exata; o item pode ter vindo de courier, stash, troca ou combinação |
| Pick/ban atual | GSI `draft`, se preenchido pelo cliente | Stream incremental de picks, bans, turno e tempo restante | Que todos os modos/patches preencham o bloco |
| Compra histórica | OpenDota `GET /matches/{id}` | `purchase_log`, `draft_timings`, patch e jogadores após parse | Baixa latência durante a partida |
| Benchmark agregado | OpenDota `GET /scenarios/itemTimings`, Explorer e partidas parseadas | Mediana, percentis, amostra e filtros | Benchmark específico se a amostra for pequena ou sem patch/modo |
| Contexto histórico adicional | STRATZ GraphQL autenticado | Analytics e partidas públicas observadas | Canal local gratuito ou compra exata do jogador |

Referências: [Dota 2 GSI e flags](https://github.com/ValveSoftware/Dota-2/issues/2333#issue-2333), [anúncio Valve sobre `-gamestateintegration`](https://store.steampowered.com/news/posts/?appids=570&enddate=1656109094&feed=steam_community_announcements), [OpenDota API](https://docs.opendota.com/), [OpenDota core](https://github.com/odota/core), [STRATZ API](https://stratz.com/api).

## Bloco A — Timing real de itens

### Estado atual

- `electron/gsi.ts` já normaliza inventário local.
- `src/core/item-tracker.ts` registra a primeira observação de cada tipo após `GAME_IN_PROGRESS`.
- `src/core/item-timing.ts` compara contra uma fixture sintética de Axe/posição 3.
- `electron/main.ts` já emite alerta de timing atrasado, mas a referência ainda é sintética.
- O estado não tem patch, modo, latência medida, fonte do benchmark ou checkpoint persistido.

### Contrato novo necessário

Adicionar ao estado de timing:

- `observedAt`: timestamp de recebimento do pacote;
- `gameTime`: relógio calibrado no pacote;
- `observationKind`: `inventory-transition`;
- `confidence`: `low | medium | high`;
- `benchmark`: fonte, patch, modo, posição, amostra, mediana, p25, p75 e última atualização;
- `precisionSeconds`: intervalo estimado pelo `throttle`/heartbeat, nunca uma precisão inventada;
- `sessionKey` e `matchId` sem salvar payload GSI bruto.

O nome exibido será **“observado no inventário”**. Só será chamado de **“compra histórica”** quando vier de `purchase_log` parseado.

### Pipeline histórico

1. Selecionar partidas elegíveis por herói, posição, patch, modo/lobby e faixa de habilidade.
2. Obter partidas parseadas; rejeitar `has_parsed=false`.
3. Ler `purchase_log` por jogador e normalizar item ID para chave local.
4. Definir milestone: primeira compra do item completo; componentes ficam separados e não contam como item final.
5. Agregar por `(hero, position, item, patch, mode)` com `n`, mediana, p25, p75 e intervalo de confiança simples.
6. Publicar somente quando `n >= 30` (configurável); abaixo disso mostrar “sem amostra”.
7. Salvar cache versionado localmente, com TTL e stale fallback.

OpenDota sem chave tem limite documentado de uso; consultas Explorer e detalhes de partidas devem ser agrupadas, limitadas e nunca executadas a cada pacote GSI. Chave de API, se usada, fica somente no processo principal/servidor local e nunca no renderer.

### Pipeline ao vivo

1. Medir intervalo entre pacotes GSI e registrar o maior erro esperado.
2. Reconciliar slots por item/área/carga; não registrar nova compra ao mover item.
3. Tratar combinação, courier, stash, venda, desaparecimento e reaparição como ambíguos.
4. Comparar `gameTime` observado contra benchmark compatível.
5. Alertar uma vez por `(matchId, item, benchmarkVersion, verdict)`.
6. Se o benchmark não for compatível, não classificar como cedo/tarde.

### Arquivos a alterar

- `src/shared/contracts.ts`: schema de benchmark/observação.
- `src/core/item-timing.ts`: agregados públicos e classificação por percentis.
- `src/core/item-tracker.ts`: metadados de precisão e transições.
- `electron/main.ts`: carregar benchmark local, não consultar rede por tick.
- `electron/preferences.ts`/novo store: cache e checkpoint compacto.
- `src/components/ItemTimingPage.tsx` e `Overlay.tsx`: origem, amostra, precisão e distinção observado/comprado.
- `dota-library-pack/scripts/serve-library.cjs`: endpoint de atualização manual/cacheada.

### Dados necessários do usuário

- 3–5 payloads GSI anonimizados de lobby, estratégia, início e partida contra bot;
- um caso com item no stash/courier e um caso com combinação;
- patch e modo da partida;
- confirmação da posição jogada;
- opcional: chave OpenDota para aumentar limite, nunca obrigatória.

## Bloco B — Draft contextual

### Estado atual

- `DraftScenario` manual já tem aliados, inimigos, bans, posição e modo.
- `recommendDraft` já usa confrontos OpenDota, amostra mínima e cobertura heurística.
- O GSI atual não pede nem normaliza `draft`.
- Não existe fase/ordem/turno, evento incremental, cooldown do pedido de ajuda ou origem do pick.

### CFG/GSI

Adicionar `draft` à configuração somente como canal opcional. Não usar `allplayers`, memória, leitura de tela ou inferência de pick inimigo. Se o payload vier vazio/ausente, o estado deve ser `unavailable`.

Contrato proposto:

```ts
interface DraftLiveState {
  source: 'gsi' | 'manual' | 'unavailable';
  phase: 'lobby' | 'strategy' | 'picking' | 'banning' | 'complete' | 'unknown';
  activeTeam: 'radiant' | 'dire' | 'unknown';
  secondsRemaining: number | null;
  allies: DraftPick[];
  enemies: DraftPick[];
  bans: DraftPick[];
  revision: number;
  receivedAt: number | null;
}
```

Cada `DraftPick` precisa de `heroId`, `team`, `kind`, `order`, `source` e `confirmedAt`. Um snapshot novo substitui somente a parte confirmada; nunca completa picks ausentes com API histórica.

### Fluxo contextual

1. Detectar `phase`/primeiro pick confirmado.
2. Mostrar uma única pergunta: **“Quer ajuda no draft?”**.
3. Ações: `Ajuda ranqueada`, `Só acompanhar` e `Agora não`.
4. `Agora não` recebe cooldown por fase/partida; não reaparece em cada pacote.
5. A cada pick confirmado, atualizar counters de forma incremental e cancelar requisições antigas.
6. Mostrar recomendação com: fonte, data, patch se disponível, amostra, cobertura, confiança e limitações.
7. Se não houver inimigos suficientes, explicar “adicione manualmente ou aguarde dado GSI”.

### API e cache do draft

- `heroes/{id}/matchups`: útil para counter agregado, mas não separa necessariamente patch/modo.
- `explorer`: usar somente consultas pré-definidas, nunca SQL fornecido pelo renderer.
- `matches/{id}`: histórico pós-jogo, não completar draft ao vivo.
- STRATZ GraphQL: integração futura opt-in, exige token e contrato de uso; não é dependência do MVP.

Cache por `(patch, mode, enemyHeroIds, position)` com TTL de 30 minutos, deduplicação de requests e stale fallback. Mudança de inimigo invalida somente a combinação afetada.

### Arquivos a alterar

- `electron/gsi.ts`: normalizar `draft` opcional e preservar ausência.
- `src/shared/contracts.ts`: `DraftLiveState`, `DraftPick`, `DraftContextPrompt`.
- `electron/main.ts`: publicar `draft:changed`, detectar transições e cooldown.
- `electron/draft-store.ts`: schema v2 para snapshots e preferências do prompt.
- `src/core/draft-advisor.ts`: recomendações incrementais e cancelamento lógico.
- `src/components/DraftPage.tsx`: timeline de picks, prompt e evidência.
- `src/components/Overlay.tsx`: cartão compacto somente durante draft.
- `tests/`: payload vazio, pick duplicado, regressão, reconexão, patch ausente e stale cache.

## Ordem de implementação

1. Fixtures GSI reais anonimizadas e schema versionado.
2. Timing: benchmark histórico local com amostra/patch e sem consulta por tick.
3. Timing: precisão, transições ambíguas, checkpoint e alertas.
4. GSI draft opcional + stream incremental.
5. Prompt contextual e cooldown.
6. Counters incrementais com cache/evidência.
7. Smoke Electron offline com payloads gravados e validação manual em lobby.

## Critérios de pronto

### Timing

- Nenhuma fixture sintética aparece como dado real.
- Compra histórica e observação GSI têm rótulos diferentes.
- Sem benchmark compatível, não há verde/vermelho nem alerta atrasado.
- Repetição, reconexão, combinação e mudança de slot não duplicam evento.
- Rede indisponível mantém último cache com aviso.

### Draft

- Picks ausentes não são inventados.
- Ajuda aparece no máximo uma vez por fase/cooldown.
- Cada recomendação mostra origem, amostra e confiança.
- Mudança de patch/modo invalida cache incompatível.
- O app segue útil com draft manual quando GSI não enviar `draft`.

## Decisões que ainda precisam de você

1. Benchmark deve ser global, por posição ou por faixa de medalha? Recomendação inicial: posição + patch, sem prometer medalha até termos dado suficiente.
2. Qual amostra mínima aceita: 30, 50 ou 100 partidas? Recomendação: 30 para exibir “experimental”, 100 para marcar confiança alta.
3. Draft deve pedir ajuda automaticamente na primeira mudança ou somente quando o usuário abrir Draft Advisor? Recomendação: primeira mudança, com `Agora não` persistente na partida.
4. Você consegue fornecer payloads GSI reais anonimizados? Sem eles, implementamos schema/simulador, mas não validamos nomes e cadência no seu Dota.
