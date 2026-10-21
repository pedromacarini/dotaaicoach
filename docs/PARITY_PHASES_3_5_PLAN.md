# Plano executável — paridade, fases 3 a 5

## Primary goal

Entregar três blocos utilizáveis e verificáveis — inventário/timing, Draft Advisor e assistência de wards/dispel/movimento — enquanto a checklist completa mantém toda a paridade restante rastreável sem prometer dados que o app não observa.

## Phase 0 — Documentation discovery e contrato de evidência

**How this serves the primary goal:** fixa as fontes e os limites antes de qualquer decisão de domínio, impedindo que demo, inferência ou nomes do app de referência virem fatos falsos.

### What to implement

1. Consolidar `MASTER_IMPLEMENTATION_PLAN.md`, `PARIDADE_DOTA2BRASIL.md`, `dota2brasil-analise.json` e o inventário Aura em `FULL_PARITY_CHECKLIST.md`.
2. Classificar cada item como feito, parcial, planejado, bloqueado ou somente evidência.
3. Registrar explicitamente que não existe schema oficial Valve completo e versionado localizado; fixtures reais são necessárias para fechar campos GSI incertos.
4. Usar somente dependências instaladas e dados públicos/licenciados; nenhuma dependência nova é necessária.

### Documentation references

- `docs/MASTER_IMPLEMENTATION_PLAN.md`
- `docs/PARIDADE_DOTA2BRASIL.md`
- `docs/DATA_SOURCES.md`
- `.local/arquivo/evidencias/research/aura-file-inventory.json` (arquivo local ignorado pelo Git)
- `dota2brasil-analise.json`
- OpenDota API docs e implementações abertas `xzion/dota2-gsi` e `antonpup/Dota2GSI`

### Verification checklist

- Toda área observada possui status, lacuna e ordem.
- Demo, fixture, inferência e validação real aparecem separadas.
- Itens incertos não recebem comportamento por associação de nome.

### Anti-pattern guards

- Não copiar bancos, fórmulas, coordenadas, código ou ativos proprietários.
- Não chamar arquivo observado de funcionalidade comprovada.
- Não usar `allplayers`, memória, injeção ou interceptação.

## Phase 3 — Inventário e timing de itens

**How this serves the primary goal:** transforma o inventário próprio legitimamente observado em histórico útil e comparação honesta de timing, além de criar a base de dados para a Fase 5.

### What to implement

1. Copiar o padrão de normalização defensiva de `electron/gsi.ts`: solicitar `items` no CFG e normalizar slots ativos, backpack, stash, teleport e neutral como `present`, `empty` ou `unknown`.
2. Expandir `GameSnapshot` com inventário compacto e manter campo ausente como desconhecido.
3. Criar domínio puro `src/core/item-tracker.ts`: eventos de primeira observação, deduplicação entre áreas, reconexão, combinação e reaparição; nunca nomear evento como compra confirmada.
4. Criar `src/core/item-timing.ts`: comparar primeira observação com benchmarks versionados e rotulados por fonte/amostra; fixtures autorais/demo na primeira entrega.
5. Criar estado de sessão no main process e contratos/IPC explícitos, copiando o encapsulamento do notification center e stores atômicos existentes.
6. Adicionar página “Itens” no painel, cartão modular no overlay, estado de fonte/confiança e demo offline.
7. Estender smokes Electron sem requests externos por pacote e sem salvar payload GSI integral.

### Documentation references

- `electron/gsi.ts`: `normalizeGsi`, `makeGsiConfig`
- `src/shared/contracts.ts`: `GameSnapshot`, `DotaOverlayAPI`
- `src/core/builds.ts`: `PurchaseEvent`, `generateBuilds`, `averagePurchaseTime`
- `src/core/opendota.ts`: normalização e rejeições explícitas
- `electron/notification-center.ts`, `electron/notification-store.ts`: domínio/store encapsulado
- `src/components/NotificationPage.tsx`: página e estado de carregamento

### Verification checklist

- Fixtures: campo ausente, slot vazio, compra/aparição, troca entre slots, backpack/stash, item desconhecido, combinação, desaparecimento/reaparição e reconexão.
- GSI config contém `items`, mas não `allplayers`.
- Testes do benchmark cobrem cedo/no esperado/tarde/sem amostra.
- Build, suíte completa e smoke Electron passam com app fechado.
- App reabre pelo VBS e há checklist visual separado.

### Anti-pattern guards

- Não tratar troca, sumiço, combinação ou courier como compra comprovada.
- Não comparar primeira observação GSI e `purchase_log` como grandezas idênticas sem ressalva.
- Não requisitar OpenDota a cada pacote nem copiar inventário completo para cada amostra histórica.
- Não chamar amostra de “profissional” sem filtro comprovável.

## Phase 4 — Draft Advisor

**How this serves the primary goal:** oferece planejamento de picks e bans fora da ação, com cada recomendação explicada por dados públicos ou por heurística declarada.

### What to implement

1. Criar domínio puro `src/core/draft-advisor.ts` com cenários All Pick, Turbo e Captain's Mode; validar duplicidade e conflito pick/ban.
2. Copiar dados do catálogo local para heróis, roles e `captainMode`; usar o endpoint de matchups já existente para counters com amostra.
3. Rotular cobertura de função como heurística. Exibir sinergia estatística como indisponível até existir fonte pública definida, ou implementar somente após documentar consulta, patch, amostra e cache.
4. Criar store local versionado/atômico para cenários seguindo notification store.
5. Criar página “Draft”, seletor manual de aliados/inimigos/bans/posição/modo, ranking explicado e link para a ficha na biblioteca.
6. Adicionar IPC/preload mínimo e smoke completo seleção → recomendação → persistência.

### Documentation references

- `dota-library-pack/scripts/serve-library.cjs`: rota `matchups`, proxy/cache/timeout
- `src/data/catalog.ts`: catálogos locais
- `src/components/LibraryExplorer.tsx`: seleção, URL da biblioteca e ficha
- `electron/notification-store.ts`: persistência atômica versionada
- `src/components/NotificationPage.tsx`: padrão de página

### Verification checklist

- Duplicidade e conflito ban/pick falham fechados.
- Captain's Mode exclui heróis fora do pool.
- Corte mínimo de amostra, confiança e ordenação estável são testados.
- Toda linha informa origem e se é estatística ou heurística.
- Build, suíte completa e smoke Electron passam com app fechado; app reabre pelo VBS.

### Anti-pattern guards

- Não apresentar cobertura de roles como sinergia estatística.
- Não prometer vitória nem esconder amostra/origem.
- Não detectar draft por memória ou captura nesta fase.
- Não inserir requests externos diretamente no renderer do overlay.

## Phase 5 — Wards, dispel e movimento

**How this serves the primary goal:** acrescenta ajuda defensiva e de suporte baseada no inventário próprio e em estados confirmados, falhando fechado quando algo não for observável.

### What to implement

1. Ampliar a normalização GSI defensiva com contadores próprios de wards e condições de herói (`silenced`, `stunned`, `disarmed`, `break`, `hexed`, `muted`, `has_debuff`), sempre `boolean | null`/`number | null`.
2. Criar `src/core/ward-tracker.ts`: quantidades observadas e deltas de contadores; uso/colocação permanece “provável” se a fonte não confirmar o evento.
3. Criar catálogo autoral mínimo/versionado de fontes de dispel com fonte e confiança; não deduzir por texto de descrição.
4. Criar `src/core/dispel-advisor.ts`: matriz explícita de condições, inventário, cooldown/can-cast, mute/stun e fail closed.
5. Criar `src/core/movement-estimate.ts`: base de herói + allowlist de bônus de itens, separando flat/percentual e marcando modificadores ausentes.
6. Adicionar página “Assistência” e módulos textuais no overlay, sem destaque/calibração sobre o jogo.
7. Adicionar demo/fixtures e smoke sem revelar wards inimigas ou afirmar velocidade atual exata.

### Documentation references

- Inventário normalizado entregue na Phase 3
- `src/data/catalog.ts`: `HeroRecord.base.moveSpeed`, itens e habilidades
- `docs/DATA_SOURCES.md`: limites de dados legítimos
- `src/components/Overlay.tsx`: módulos independentes e estados explícitos
- Stores/IPC seguros já usados nas fases anteriores

### Verification checklist

- Matriz de silence/stun/disarm/break/hex/mute/debuff com valores ausentes.
- Ward tests cobrem observer/sentry/dispenser, campo ausente e zero observado; nunca há posição inimiga.
- Movimento cobre base ausente, bônus flat, percentual, item desconhecido e modificador não observado.
- Todas as regras informam patch/fonte/confiança.
- Build, suíte completa e smoke passam com app fechado; app reabre pelo VBS.

### Anti-pattern guards

- Desconhecido nunca vira recomendação positiva.
- Não sugerir item utilizável durante mute/stun ou cooldown confirmado.
- Não inferir fonte de dispel por palavras em descrição.
- Não exibir visão/posição de wards inimigas nem velocidade “exata” sem todos os modificadores.

## Phase 6 — Verification integrada e babysit local

**How this serves the primary goal:** prova que os três módulos funcionam juntos, preservam os recursos anteriores e não introduzem alegações ou dados indevidos.

### What to implement

1. Para cada fase, executar implementação, verificação independente, busca de anti-padrões e revisão de qualidade antes de avançar.
2. Corrigir achados materiais e repetir o ciclo até ficar limpo.
3. Rodar `npm.cmd test` e `npm.cmd run test:library` com o app fechado; executar smokes específicos.
4. Atualizar `FULL_PARITY_CHECKLIST.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `PARIDADE_DOTA2BRASIL.md`, arquitetura e documento de cada fase.
5. Reabrir pelo `ABRIR-DOTA-IACOACH.vbs` e registrar uma checklist visual por fase.

### Documentation references

- `package.json`: scripts suportados
- `docs/PHASE_1_OVERLAY_EDITOR.md`, `docs/PHASE_2_NOTIFICATIONS.md`: padrão de handoff
- `tests/electron-*.test.cjs`: smokes existentes

### Verification checklist

- Zero falhas em build/testes/smokes.
- Zero achado material pendente nas três revisões locais.
- Processo Electron responde ao final.
- Lacunas reais do Dota permanecem declaradas como não validadas.

### Anti-pattern guards

- Não avançar com teste quebrado.
- Não chamar demo de validação real.
- Não fazer commit, push ou PR sem autorização explícita.
