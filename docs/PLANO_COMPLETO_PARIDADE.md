# Plano completo de paridade do DotaIACoach

Atualizado em 2026-10-20. Este é o plano de execução dos recursos que ainda faltam para aproximar o DotaIACoach do produto de referência, sem copiar código, ativos, fórmulas ou dados privados.

## Objetivo principal

Entregar um overlay local que acompanhe cada fase legítima da partida — draft, jogo, farm, itens, objetivos e pós-jogo — com recomendações explicáveis, privacidade por padrão, instalador atualizável e nenhuma leitura de memória ou visão inimiga oculta.

## Estado atual

- Fundação Electron/React, GSI autenticado, biblioteca, builds, skills, talentos, cronograma, draft manual, estatísticas, inventário/timing, perfil, licença offline, telemetria local e instalador versionado já existem.
- `npm.cmd test` deve continuar verde antes e depois de cada fase.
- O GSI atual publica apenas o jogador local. Não há coordenadas, inimigos, wards inimigas ou visão oculta disponíveis.
- O endpoint OpenDota local fornece `itemPopularity`, `matchups` e `recommendations`, com cache e fallback stale; não fornece diretamente rotas, sinergia ou benchmark completo.
- O instalador atual pede um código de 20 caracteres e usa o mesmo `appId` para atualização por cima.

### Bloqueios encontrados antes de distribuir

- **Licença:** o carregamento de uma ativação persistida deve validar a expiração somente contra a allowlist embutida, nunca contra `raw.expiresAt` editável no JSON. Corrigir antes de tratar o código como controle de acesso.
- **Instalador:** a página NSIS exige 20 caracteres e não oferece “pular”; isso é incompatível com o modo gratuito documentado. Decidir explicitamente entre instalação de teste obrigatória ou botão “usar grátis”.
- **Atualizador:** ainda não existe `electron-updater`, feed, assinatura Authenticode, rollout ou rollback. O instalador por cima é atualização manual, não atualização automática.
- **Distribuição:** o release script precisa restaurar a versão se o empacotamento falhar e registrar artefato/hash/notas antes de publicar.

## Phase 0 — Descoberta, evidências e gates

**Como serve ao objetivo principal:** impede que uma aparência semelhante seja confundida com uma implementação legítima e evita construir em APIs inexistentes.

### Fontes e APIs permitidas

- Estado atual: `src/shared/contracts.ts`, `electron/gsi.ts`, `electron/main.ts`, `electron/preload.ts`.
- Stores atômicos: `electron/preferences.ts`, `electron/session-history.ts`, `electron/profile-store.ts`, `electron/telemetry-store.ts`.
- Recomendação: `src/core/advice.ts`, `src/core/builds.ts`, `src/core/advice-loader.ts`.
- Farm: `src/core/farm-benchmark.ts`, `docs/FARM_BENCHMARK.md`.
- Itens: `src/core/item-tracker.ts`, `src/core/item-timing.ts`, `docs/PHASE_3_ITEM_TIMING.md`.
- Draft: `src/core/draft-advisor.ts`, `electron/draft-store.ts`, `src/components/DraftPage.tsx`.
- Notificações: `src/core/notification-scheduler.ts`, `electron/notification-center.ts`, `electron/notification-store.ts`.
- Dados externos: `dota-library-pack/scripts/serve-library.cjs`, `src/core/opendota.ts`, `docs/DATA_SOURCES.md`.
- Paridade observada: `docs/FULL_PARITY_CHECKLIST.md`, `docs/PARIDADE_DOTA2BRASIL.md`, `dota2brasil-analise.json`.

### Gates obrigatórios

1. Ler a documentação oficial da versão instalada do Electron antes de `desktopCapturer`, global shortcuts, updater ou integração Windows.
2. Capturar somente o jogador local e fontes explicitamente escolhidas pelo usuário.
3. Campos ausentes permanecem `null`/`unknown`; nunca virar zero, falso ou “inimigo não visto”.
4. Toda estatística precisa de fonte, patch, amostra e rótulo de confiança.
6. Toda fase deve adicionar testes puros, smoke Electron quando aplicável, documentação e migração de schema.

### Verificação

- Registrar no início de cada fase as APIs usadas e as que não existem.
- Rodar `npm.cmd test` e `git diff --check`.
- Rejeitar qualquer implementação que dependa de memória, DLL, driver, injeção, interceptação ou dados ocultos.

## Phase 1 — Correção de dados reais e benchmark

**Como serve ao objetivo principal:** transforma as recomendações atuais, que já funcionam, em resultados mais confiáveis e honestos durante partidas reais.

### Implementar

1. Criar fixtures anonimizadas reais de GSI fornecidas pelo usuário para lobby, estratégia, jogo, reconexão, pós-jogo e inventário.
2. Versionar o schema GSI normalizado e validar mudanças sem quebrar payload antigo.
3. Separar `demo`, `gsi` e `public-sample` em todos os cards, gráficos e logs.
4. Alimentar timing de itens com partidas OpenDota analisadas e `purchase_log`, preservando a distinção “compra observada” versus “primeira observação GSI”.
5. Ampliar benchmarks de LH, patrimônio e GPM por posição, patch, modo e faixa de habilidade somente quando a amostra permitir.
6. Exibir `atual / média`, cor verde/vermelha e amostra; se não houver média, mostrar “sem amostra”.

### Referências copiáveis

- `normalizeGsi(input, timestamp)` e `createGsiSnapshotNormalizer()` em `electron/gsi.ts`.
- `evaluateEconomy`, `targetLastHits` e `evaluateFarm` em `src/core/farm-benchmark.ts`.
- `normalizeOpenDotaMatch` em `src/core/opendota.ts`.
- `generateBuilds` em `src/core/builds.ts`.

### Verificação

- Testes com campos ausentes, payload atrasado, patch diferente e sample size insuficiente.
- Smoke com duas partidas reais anonimizadas e uma demo.
- Nenhum card chama dado sintético de profissional/real.

## Phase 2 — Notificações contextuais e narrador

**Como serve ao objetivo principal:** faz o app reagir ao momento da partida, não apenas ao relógio.

### Implementar

1. Evoluir `NotificationRule` para schema versionado com `trigger`: relógio, transição de snapshot, inventário, nível, skill, objetivo e estado local.
2. Criar avaliador puro `evaluateNotificationTrigger(previous, current, rule)`; campo ausente falha fechado.
3. Deduplicar por identidade de partida, regra e ocorrência; tolerar pausa, reconexão e regressão.
4. Adicionar presets por posição e modo: runas, Lotus, Roshan, Tormentor, pulls, stacks, wards próprias, itens atrasados e skill/talento disponível.
5. Usar voz local PT-BR apenas quando a regra escolher `voice`; permitir silêncio, beep e prévia.
6. Criar fila de alertas com prioridade, expiração, cooldown e limite de falas simultâneas.

### Referências copiáveis

- `NotificationScheduler.advance(...)` em `src/core/notification-scheduler.ts`.
- `createNotificationCenter(...)` em `electron/notification-center.ts`.
- Presets em `src/core/notification-presets.ts`.

### Verificação

- Testes de transição única, payload duplicado, reconexão, áudio e ausência de dados.
- Smoke simulado para cada preset e dismiss de múltiplos banners.

## Phase 3 — Draft contextual e Counter Pick

**Como serve ao objetivo principal:** reduz trabalho manual no draft sem fingir que o GSI atual conhece picks/bans inimigos.

### Implementar

1. Manter entrada manual como caminho oficial e melhorar UX de sugestões por fase.
2. Adicionar snapshots de draft locais: fase, ordem, aliados, inimigos, bans e timestamp.
3. Separar estatísticas por patch/modo somente quando a fonte fornecer esses campos.
4. Criar sinergia aliada somente com fonte pública defensável; até lá exibir indisponível.
5. Adicionar pedido contextual “Quer ajuda no draft?” com opt-in, dismiss e cooldown.
6. Preparar adaptador de captura futura sem conectar ao GSI `allplayers` nem memória.

### Referências copiáveis

- `recommendDraft(...)`, `validateDraftScenario` e reconciliação em `src/core/draft-advisor.ts`.
- Store atômico em `electron/draft-store.ts`.
- UI em `src/components/DraftPage.tsx`.

### Verificação

- Testes de ordem, pick/ban, Captain’s Mode, amostra, confiança e ausência de sinergia.
- Smoke manual segue mostrando fonte e limitações.

## Phase 4 — Wards, dispel e movimento próprio

**Como serve ao objetivo principal:** adiciona assistência defensiva útil usando apenas inventário e estado do jogador local.

### Implementar

1. Modelar wards próprias observadas no inventário, cargas e primeira observação, sem afirmar colocação quando o GSI não confirma.
2. Criar catálogo autoral/versionado de silence, stun, disarm, break, hex, mute e debuffs.
3. Criar catálogo de fontes de dispel por patch, nível de confiança e itens/skills observáveis.
4. Motor `shouldSuggestDispel` fail-closed, considerando cooldown, mana, mute, stun, silêncio e item desconhecido.
5. Calcular velocidade base + bônus observáveis e mostrar decomposição; velocidade exata fica `unknown` quando buffs/terreno não forem recebidos.
6. Adicionar cartões de sugestão no overlay e explicação na página de itens.

### Verificação

- Matriz de estados ausentes/ativos, item sem carga, cooldown e debuff não confirmado.
- Nunca produzir posição ou visão de ward inimiga.

## Phase 5 — Rotas de farm, camps, waves e lane

**Como serve ao objetivo principal:** entrega o “Flash Farm” de forma explicável, editável e sem copiar coordenadas privadas.

### Implementar

1. Criar banco autoral/licenciado de camps, pontos, tier, lado, respawn, patch e confiança.
2. Criar editor/import/export de pontos e versão de mapa.
3. Modelar waves, objetivo da lane, fase e preferência de posição.
4. Criar pathfinder que considera posição inicial legítima ou posição manual, velocidade estimada, tempo e camps disponíveis.
5. Explicar cada rota: motivo, duração estimada, camps incluídos, incertezas e alternativa.
6. Renderizar minimapa próprio no overlay; não desenhar sobre o mapa do jogo nesta fase.
7. Adicionar simulação offline de rota para testes sem Dota.

### Bloqueios

- Não há coordenadas legítimas no GSI atual.
- Rotas do artefato de referência são evidência de existência, não fonte de coordenadas/fórmula.

### Verificação

- Testes Radiant/Dire, patch, camp ausente, respawn, rota vazia e mudança de posição.
- Desempenho do pathfinder com mapa completo.

## Phase 6 — Última posição legítima e minimapa tracker

**Como serve ao objetivo principal:** mostra uma memória de eventos que o jogador poderia legitimamente ter visto, sem transformar ausência de visão em informação inimiga.

### Implementar

1. Definir eventos permitidos: captura de tela consentida, evento local explicitamente revelado ou entrada manual.
2. Modelar `LastSeenEvent` com unidade/identidade permitida, posição, timestamp, fonte, confiança e expiração.
3. Mostrar “visto por último” com idade e incerteza; nunca “está aqui agora”.
4. Limpar eventos em reconexão, nova partida, expiração e perda de confiança.
5. Renderizar no minimapa próprio, com filtro e botão de apagar.

### Bloqueio explícito

O GSI atual não contém inimigos nem coordenadas. A fase não pode ser implementada com `allplayers`, memória ou inferência de fog.

### Verificação

- Testes de expiração, reconexão, fonte ilegítima, ausência e conflito de eventos.
- Fixtures de captura anonimizadas somente se o usuário fornecer e consentir.

## Phase 7 — Captura de tela local e calibração

**Como serve ao objetivo principal:** permite calibração visual e diagnóstico quando o GSI não expõe um campo, sem coletar imagens silenciosamente.

### Implementar

1. Ler documentação oficial da versão Electron instalada para `desktopCapturer`/captura Windows.
2. Criar serviço main isolado com seleção explícita de monitor/janela, consentimento e indicador persistente.
3. Processar frames localmente; não persistir nem enviar imagem por padrão.
4. Criar perfis de resolução, DPI, escala e posição para barra de skills, talentos, inventário, Ready e minimapa.
5. Começar com preview/diagnóstico; nenhum clique ou teclado nesta fase.
6. Criar fixtures sintéticas e ferramenta para anonimizar screenshots fornecidos.

### Verificação

- Iniciar/parar captura, múltiplos monitores, DPI 100/125/150%, fullscreen e janela sem borda.
- Confirmar que frames não entram em logs, telemetria ou Sentry.

## Phase 8 — Onboarding, atalhos, robustez e histórico

**Como serve ao objetivo principal:** transforma módulos técnicos em uma experiência instalável, recuperável e fácil de testar.

### Implementar

1. Onboarding: posição, voz, GSI, licença, telemetria, captura e tutorial.
2. Atalhos configuráveis com detecção de conflito e restauração.
3. Checkpoint atômico da partida ativa, retomada segura e resumo pós-jogo enriquecido.
4. Migrações centralizadas para preferências, notificações, histórico, rotas e calibração.
5. Logs rotativos com redaction de token, e-mail, caminho e payload.
6. Recuperação de renderer, porta ocupada, monitor removido, sleep/resume e janela fora da tela.
7. Perfis por função/modo e import/export de configuração.

### Verificação

- Corrupção de arquivo, crash no meio da partida, reinício, migração e restauração.
- Matriz Windows de DPI, monitores e Alt+Tab.

## Phase 10 — Conta, licença e assinatura online opcional

**Como serve ao objetivo principal:** permite distribuição maior sem abandonar a licença offline já funcional.

### Implementar somente se necessário

1. ADR de provedor, custos, LGPD, retenção e modelo premium.
2. Login no navegador com PKCE/device flow; nunca senha dentro do Electron.
3. Backend emite entitlement assinado; cliente mantém grace period offline.
4. Checkout/portal no navegador; webhook valida pagamento no servidor.
5. Revogação, limite de máquinas, renovação e suporte.
6. Migração compatível com códigos offline já distribuídos.

### Verificação

- Offline, relógio incorreto, assinatura inválida, webhook duplicado, logout, exclusão e revogação.
- Nenhum segredo de servidor no bundle/renderer.

## Phase 11 — Sentry e observabilidade remota separada

**Como serve ao objetivo principal:** permite diagnosticar falhas de versões distribuídas sem transformar telemetria local em coleta remota silenciosa.

### Implementar

1. Separar três controles: telemetria local, crash reports e analytics.
2. Provider nulo por padrão; consentimento separado e reversível.
3. Ler documentação do SDK Electron escolhido antes de integrar main/renderer.
4. Scrubber obrigatório para token GSI, e-mail, caminho, IDs, payload, inventário detalhado, screenshots e texto de partida.
5. Eventos limitados a versão, plataforma, feature flag, sucesso/falha técnica e duração aproximada.
6. Retenção, amostragem, exportação, exclusão e desligamento local.
7. Falha/rede indisponível nunca pode impedir GSI, overlay ou inicialização.

### Verificação

- Testes de scrubber com dados sintéticos.
- Opt-out impede inicialização/envio.
- DSN configurável por build e nunca tratado como segredo.

## Phase 12 — Atualização, release e distribuição

**Como serve ao objetivo principal:** permite que amigos testem versões novas sem reinstalação confusa nem perda de dados.

### Implementar

1. Manter `ATUALIZAR-INSTALADOR.cmd` como caminho local para bump `patch/minor/major`.
2. Manter `appId`, migrações e diretório de dados compatíveis.
3. Configurar canal de release, artefato assinado e `latest.yml` quando houver hospedagem.
4. Decidir entre atualização manual por instalador e `electron-updater` com GitHub Releases/servidor próprio.
5. Criar rollback, backup e verificação de integridade.
6. Gerar changelog, notas de teste e matriz de versão.

### Verificação

- Instalar 0.2.1, atualizar para 0.2.2+, preservar perfil/licença/notificações e desinstalar sem apagar dados sem confirmação.
- Testar versão inválida, download interrompido e rollback.

## Ordem executável

1. Phase 1 — dados reais e benchmarks.
2. Phase 2 — notificações contextuais.
3. Phase 3 — draft contextual.
4. Phase 4 — wards, dispel e movimento.
5. Phase 5 — rotas/camps/waves/lane.
6. Phase 6 — última posição legítima.
7. Phase 7 — captura e calibração.
8. Phase 8 — onboarding, robustez e histórico.
9. Phase 9 — conta/servidor somente se distribuição exigir.
10. Phase 10 — Sentry remoto opt-in.
11. Phase 11 — release candidate e validação final.

## Definition of done de cada fase

- Contratos e schema versionados.
- Módulo de domínio testável sem Electron.
- Testes de ausência/erro/reconexão.
- Smoke Electron ou simulador quando houver UI.
- Fonte, patch, amostra e confiança visíveis.
- Dados privados e secretos fora do bundle.
- Documentação e checklist atualizados.
- `npm.cmd test` verde.
- Durante os oito itens prioritários já concluídos, abrir o app apenas quando o usuário pedir; nos próximos blocos, abrir ao final apenas para checklist visual combinado.

## Anti-padrões proibidos

- Memória, DLL, driver, injeção, interceptação de tráfego ou bypass anticheat.
- GSI `allplayers` para obter informação não fornecida ao jogador local.
- Inferir visão, posição atual ou ward inimiga a partir de ausência.
- Chamar fixture sintética de benchmark profissional/real.
- Enviar screenshot, payload GSI, inventário ou histórico detalhado para servidor.
- Habilitar captura, voz, telemetria ou Sentry sem opt-in.
