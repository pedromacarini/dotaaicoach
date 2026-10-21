# Plano mestre de implementação

Atualizado em 2026-10-19. Este documento foi escrito para ser retomado em uma nova sessão sem depender do histórico da conversa.

## Primary goal

Entregar um assistente de Dota 2 completo e testável, com overlay personalizável, alertas, análise de desempenho, draft, assistência contextual e serviços de conta opcionais, preservando privacidade, transparência e compatibilidade segura com o jogo.

## Estado de partida

- Já existem painel Electron/React, overlay transparente, biblioteca local, GSI autenticado, diagnóstico/instalação do CFG, recomendações de skill/itens, posição persistida e estatísticas locais.
- `npm.cmd test` possui 39 testes aprovados; a biblioteca possui mais 4 smokes aprovados.
- O overlay atual é uma única janela fixa de `430x314`, click-through e always-on-top (`electron/main.ts:263-274`).
- Preferências persistem atomicamente, mas contêm apenas posição (`electron/preferences.ts:6-31`).
- Contratos IPC ficam em `src/shared/contracts.ts:72-125`; a ponte segura fica em `electron/preload.ts:11-49`.
- O modo demonstração e os smokes Electron são a base para desenvolver sem abrir o Dota (`electron/main.ts:199-219`).
- O artefato de referência é somente evidência de produto. Não copiar código, ativos, fórmulas ou bases proprietárias (`docs/ARCHITECTURE.md:3-7`).

## Phase 0 — Documentation discovery e decisões de segurança

**How this serves the primary goal:** impede que recursos sensíveis sejam construídos sobre APIs inventadas, regras antigas ou integrações inseguras.

### What to implement

1. Antes de cada fase, conferir a versão instalada do Electron em `package.json` e ler a documentação oficial correspondente.
2. Registrar em uma nota da fase as APIs permitidas, assinaturas usadas, limitações de Windows e links oficiais.
3. Para integração com o Dota, revisar as regras atuais da Valve/Steam e separar claramente:
   - leitura de GSI oficialmente fornecida;
   - captura de tela local e consentida;
   - automação de clique/entrada, que exige um gate explícito antes de implementação e distribuição.
4. Para serviços externos, decidir provedor antes de escrever código. Recomendação inicial: Supabase Auth + Stripe Checkout/webhooks; confirmar custo, região, LGPD e manutenção.
5. Definir uma política de dados: evento, finalidade, retenção, opt-in, exclusão e campos proibidos.

### Allowed APIs atuais

- IPC restrito por `assertDashboard` em `electron/main.ts:286-290` e handlers em `electron/main.ts:294-380`.
- `contextBridge`/`ipcRenderer.invoke` e listeners removíveis em `electron/preload.ts:11-49`.
- `BrowserWindow`, `screen`, `globalShortcut` e diálogos já usados em `electron/main.ts:1,250-275`.
- Persistência local atômica pelo padrão `.tmp` + `renameSync` em `electron/preferences.ts:23-31` e `electron/session-history.ts:29-41`.
- Dados de partida somente pelo GSI local em `electron/gsi.ts:20-106`.

### Documentation references

- `package.json:1-65`
- `docs/ARCHITECTURE.md:1-45`
- `docs/DATA_SOURCES.md:1-43`
- `docs/ROADMAP.md:1-33`

### Verification checklist

- Cada fase começa com lista curta de documentação oficial consultada.
- Nenhuma dependência nova entra sem justificativa e teste.
- Recursos sensíveis têm threat model e comportamento desligado por padrão.

### Anti-pattern guards

- Não inferir permissão a partir do fato de outro overlay possuir um recurso.
- Não usar leitura/injeção de memória, driver, DLL injection ou interceptação de tráfego.
- Não colocar segredo de backend, chave Stripe ou DSN privado no renderer.

## Phase 1 — Editor completo do overlay

**Status em 2026-10-19:** ✅ implementado. Decisões, APIs e verificação em [`PHASE_1_OVERLAY_EDITOR.md`](PHASE_1_OVERLAY_EDITOR.md).

O redimensionamento desta fase é proporcional, por escala fixa de 75% a 175%; não há largura/altura independentes. Essa decisão preserva a composição do guia e contorna a limitação oficial de resize nativo em janelas transparentes.

**How this serves the primary goal:** permite ao jogador adaptar o overlay à própria tela sem editar arquivos ou reiniciar o aplicativo.

### What to implement

1. Expandir `AppPreferences` com versão de schema e `overlayLayout`: posição, escala proporcional, opacidade, bloqueio e módulos visíveis.
2. Migrar o store atual preservando instalações existentes; valores inválidos devem voltar ao padrão por campo, não apagar tudo.
3. Criar um serviço Electron responsável por aplicar bounds/opacidade/click-through à janela; UI nunca chama `BrowserWindow` diretamente.
4. Adicionar modo de edição: overlay focável, arrastável e redimensionável; “Concluir edição” restaura click-through.
5. Adicionar controles no painel para opacidade, escala, posição numérica, bloquear, visibilidade de stats/skill/itens/alertas e “Restaurar padrão”.
6. Conter a janela na `workArea` do monitor atual e reajustar quando resolução/monitor mudar.
7. Persistir somente depois de validação e debounce; enviar atualização incremental ao overlay.

### Documentation references

- Janela atual: `electron/main.ts:263-275`
- Store a aprofundar: `electron/preferences.ts:6-31`
- Contrato/preload: `src/shared/contracts.ts:72-125`, `electron/preload.ts:11-49`
- Configurações atuais: `src/components/Dashboard.tsx:85-93`
- Overlay atual: `src/components/Overlay.tsx:5-32`, `src/style.css:1,9`

### Verification checklist

- Testes puros de validação/migração/layout por monitor.
- Smoke Electron altera posição, escala proporcional e opacidade, reinicia e confirma persistência.
- Testar editar → bloquear → click-through → reset.
- Ao final, abrir o app e pedir inspeção visual em 100%, 125% e 150% de escala do Windows quando possível.

### Anti-pattern guards

- Não persistir coordenadas fora da tela.
- Não deixar overlay capturando mouse depois de concluir edição.
- Não misturar preferências de layout com lógica de recomendação.

## Phase 2 — Cronograma e central de notificações

**Status em 2026-10-20:** ✅ implementado. Decisões, APIs, limitações e verificação em [`PHASE_2_NOTIFICATIONS.md`](PHASE_2_NOTIFICATIONS.md).

**How this serves the primary goal:** transforma o relógio da partida em lembretes úteis e configuráveis sem depender de informação oculta.

### What to implement

1. Criar domínio puro `NotificationRule` com tempo, título, posição, tags, repetição, limite, duração e modo de áudio.
2. Criar store local versionado, importação/exportação validada e presets autorais para runas, stacks e objetivos por patch/modo.
3. Criar scheduler determinístico dirigido por `gameTime`, tolerante a pausa, regressão e pacotes duplicados.
4. Mostrar banners em um módulo independente do overlay e permitir testar tudo com relógio simulado.
5. Implementar som local primeiro; TTS apenas depois de conferir a API oficial e com botão de prévia.
6. Criar tela de cronograma, tags, filtros, ativar/desativar e backup/restauração.

### Documentation references

- Snapshot/relógio: `src/shared/contracts.ts:1-21`
- Fluxo de snapshot: `electron/main.ts:68-80`
- Demonstração: `electron/main.ts:45-50`
- Padrão de store: `electron/preferences.ts:13-33`

### Verification checklist

- Testes com relógio normal, pausa, salto, regressão, Turbo e repetição.
- Teste de importação malformada e limite de regras.
- Smoke Electron confirma banner, som desativado e dismiss.

### Anti-pattern guards

- Não inferir morte de objetivo sem fonte observável.
- Não disparar o mesmo alerta duas vezes após pacote duplicado.
- Não permitir arquivo importado executar código ou acessar caminhos arbitrários.

## Phase 3 — Inventário e timing de itens

**Status em 2026-10-20:** entrega offline concluída. Inventário defensivo, tracker, página, overlay, IPC, testes e smoke estão implementados. A validação com payload real e o benchmark público substituindo a fixture sintética permanecem pendentes; ver `docs/PHASE_3_ITEM_TIMING.md`.

**How this serves the primary goal:** mostra se uma compra importante veio cedo ou tarde e melhora a recomendação durante a partida.

### What to implement

1. ✅ Ampliar `makeGsiConfig`, normalização e contrato sem transformar slot ausente em vazio; a confirmação final depende de fixture real.
2. ✅ Modelar inventário ativo, mochila, baú, TP e neutro com estados `present`, `empty` e `unknown`.
3. ✅ Criar tracker de primeira observação que deduplica troca de slot, reaparição e reconexão sem alegar compra.
4. 🟡 Benchmark autoral sintético e versionado entregue; amostra pública OpenDota continua pendente.
5. ✅ Exibir página, cartão do overlay, fonte/confiança e demo offline.

### Documentation references

- GSI atual: `electron/gsi.ts:20-64`
- Catálogo de itens: `src/data/catalog.ts:1-25`
- Recomendações OpenDota: `src/core/opendota.ts:1-220`
- Conselho atual: `src/core/advice.ts:1-150`

### Verification checklist

- Fixtures para compra, venda, troca de slot, item desconhecido e campo ausente.
- Testes de cache/amostra/patch.
- Validar com Dota real somente depois; manter estado “não validado” até isso ocorrer.

### Anti-pattern guards

- Não contar inventário inimigo oculto.
- Não transformar ausência de campo em slot vazio confirmado.
- Não chamar recomendação de “profissional” sem fonte e amostra.

## Phase 4 — Draft Advisor

**Status em 2026-10-20:** entrega manual concluída. Domínio puro, validação, modos, counters OpenDota com cache, heurísticas rotuladas, persistência, página, link para biblioteca e smoke estão implementados. Patch/modo da amostra e sinergia estatística permanecem indisponíveis; ver `docs/PHASE_4_DRAFT_ADVISOR.md`.

**How this serves the primary goal:** ajuda a planejar picks e bans com counters e sinergias explicáveis antes da partida.

### What to implement

1. ✅ Tela manual para aliados, inimigos, bans, posição e modo (All Pick, Turbo, Captain’s Mode).
2. 🟡 Counters explicáveis com fonte, amostra e confiança; endpoint sem patch/modo explícito. Sinergia estatística não foi inventada.
3. ✅ Entrada exclusivamente manual, separada de detecção automática futura.
4. ✅ Cenários locais versionados e link direto para ficha do herói.
5. 🟠 Presets de ordem aguardam fonte documentada por modo/patch.

### Documentation references

- Matchups existentes: `dota-library-pack/scripts/serve-library.cjs`
- Catálogo e tela incorporada: `src/components/LibraryExplorer.tsx:1-30`
- Política de fontes: `docs/DATA_SOURCES.md:1-43`

### Verification checklist

- Testes de duplicidade, ban/pick conflitante, amostra mínima e ordenação estável.
- Smoke da seleção manual até recomendação explicada.

### Anti-pattern guards

- Não esconder origem/amostra.
- Não apresentar correlação como garantia de vitória.
- Não detectar picks por memória do jogo.

## Phase 5 — Wards, dispel e movimento

**How this serves the primary goal:** oferece assistência defensiva e de suporte baseada apenas no estado legítimo do jogador.

### What to implement

1. Ward tracker do inventário próprio: quantidade, aquisição/uso provável e ritmo; marcar inferências como inferências.
2. Catálogo aberto de dispels por patch, com nível de confiança e revisão manual.
3. Motor conservador: se o estado ou a cura não forem confirmados, não recomendar.
4. Exibir sugestão textual no overlay antes de qualquer destaque visual calibrado.
5. Calcular velocidade de movimento com base pública, itens e modificadores observáveis; mostrar decomposição.

### Documentation references

- Regras de dados permitidos: `docs/DATA_SOURCES.md:28-43`
- Inventário da biblioteca: `docs/ROADMAP_DATA.md:3-16`
- Overlay modular após Phase 1: `src/components/Overlay.tsx:5-32`

### Verification checklist

- Matriz de testes para silence/disarm/break/hex/mute e item ausente.
- Ward tests não podem gerar posição de ward inimiga.
- Cada regra informa patch e fonte.

### Anti-pattern guards

- Fail closed: desconhecido nunca acende recomendação.
- Não sugerir item acionável durante estado que impeça uso.
- Não incluir mapa de visão ou wards inimigas não reveladas.

## Phase 6 — Rotas de farm e mapa

**How this serves the primary goal:** orienta deslocamentos de farm de forma visual e ajustável sem prometer uma rota universal perfeita.

### What to implement

1. Criar banco autoral versionado de pontos do mapa, camps, tier, lado e patch.
2. Criar editor/calibrador manual e import/export de pontos.
3. Motor de rota considera posição, fase, lado, velocidade, tempo de respawn e preferências; resultado sempre explicado.
4. Oferecer rotas sugeridas e edição manual por posição/fase.
5. Renderizar minimapa próprio no overlay; não desenhar sobre o mapa do jogo nesta fase.
6. Usar simulador de posição para testes offline; validação real vira checklist posterior.

### Documentation references

- Escopo atual: `docs/ROADMAP_DATA.md:9-13`
- Limites arquiteturais: `docs/ARCHITECTURE.md:35-43`
- Benchmark existente: `docs/FARM_BENCHMARK.md:1-25`

### Verification checklist

- Testes de rota vazia, camp indisponível, mudança de patch e espelhamento Radiant/Dire.
- Benchmark de desempenho do pathfinder.
- Teste visual do minimapa em demo.

### Anti-pattern guards

- Não copiar coordenadas/rotas proprietárias.
- Não chamar placeholder de rota pronta.
- Não inferir unidades inimigas sem visão.

## Phase 7 — Captura de tela local e calibração

**How this serves the primary goal:** habilita calibração visual e recursos opt-in sem acesso à memória do jogo.

### What to implement

1. Após ler docs oficiais do Electron, criar serviço isolado sobre `desktopCapturer`/captura Windows permitida.
2. Mostrar consentimento, preview da fonte e indicador persistente enquanto captura estiver ativa.
3. Processar frames localmente; não persistir imagem por padrão e nunca enviar imagem à nuvem.
4. Adicionar calibração de regiões (inventário, barra de skills e botão Ready) com perfis por resolução/escala.
5. Começar com detecção/diagnóstico, sem clicar ou enviar teclas.
6. Criar testes sobre fixtures de imagem sintéticas e versões anonimizadas fornecidas pelo usuário.

### Documentation references

- Restrição de segurança atual: `docs/ARCHITECTURE.md:28-43`
- Janela e preload sandboxed: `electron/main.ts:250-275`, `electron/preload.ts:1-49`
- CSP: `index.html:1-20`

### Verification checklist

- Captura inicia somente após ação explícita e termina ao desligar/fechar.
- Nenhum frame aparece em logs, histórico ou Sentry.
- Testes com múltiplos monitores, DPI e janela sem bordas.

### Anti-pattern guards

- Não capturar desktop inteiro silenciosamente.
- Não persistir screenshots automaticamente.
- Não expor frame bruto ao renderer sem necessidade e limite.

## Phase 8 — Checkpoint, recuperação e robustez desktop

**How this serves the primary goal:** evita perda de configuração e histórico quando o app ou o jogo fecha inesperadamente.

### What to implement

1. Checkpoint atômico da sessão ativa, retomada segura e descarte de sessão obsoleta.
2. Schema migrations centralizadas para preferências, alertas, layouts, histórico e rotas.
3. Backup local e restauração validada.
4. Logs locais com rotação e redaction de token GSI, e-mail, IDs e caminhos privados.
5. Recuperação de janela fora da tela, porta ocupada e renderer crashado.

### Documentation references

- Pendência declarada: `docs/FARM_BENCHMARK.md:21-23`
- Stores atuais: `electron/preferences.ts`, `electron/session-history.ts`
- Diagnóstico: `src/components/Dashboard.tsx:61-84`

### Verification checklist

- Testes de corrupção, migração, crash simulado, encerramento no meio da partida e restauração.
- Logs não contêm token nem payload completo.

### Anti-pattern guards

- Não sobrescrever arquivo válido antes de validar migração.
- Não acumular logs sem limite.

## Phase 10 — Conta, licença e assinatura

**How this serves the primary goal:** permite oferecer recursos pagos sem tornar o overlay inseguro ou inutilizável offline.

### What to implement

1. Decision record do provedor e modelo comercial antes do código; recomendação inicial Supabase Auth + Stripe.
2. Login por navegador do sistema com PKCE/deep link ou device flow documentado; nunca coletar senha dentro do Electron.
3. Sessão armazenada com `safeStorage` quando disponível; fallback explícito e seguro.
4. Checkout e portal no navegador; webhooks validam assinatura no servidor, nunca no cliente.
5. Backend emite entitlement/licença assinada e curta; cliente verifica assinatura pública e mantém grace period offline.
6. Recursos essenciais locais continuam funcionando sem login; definir exatamente o que é premium antes de implementar gates.
7. Tela de conta, status, renovar, sair, excluir conta e política de reembolso/suporte.

### Documentation references

- App ID e empacotamento: `package.json:39-65`
- Bloqueio de navegação atual: `electron/main.ts:126-129`
- Token local existente como exemplo do que não deve ir ao renderer: `electron/main.ts:278-285`

### Verification checklist

- Testes de login cancelado, token expirado, offline, relógio incorreto, webhook duplicado e assinatura inválida.
- Segredos ausentes do bundle e do renderer.
- Threat model e revisão manual antes de produção.

### Anti-pattern guards

- Não validar pagamento apenas no Electron.
- Não embutir service-role key/Stripe secret.
- Não bloquear dados locais do usuário atrás de paywall retroativo.

## Phase 11 — Telemetria e Sentry consentidos

**How this serves the primary goal:** permite corrigir falhas reais sem transformar o app em coleta silenciosa de dados.

### What to implement

1. Criar interface interna de observabilidade com provider nulo como padrão.
2. Tela de consentimento separa crash reports de analytics; ambos começam desligados.
3. Integrar SDK oficial Electron somente após ler documentação da versão escolhida.
4. `beforeSend`/scrubber obrigatório remove token GSI, e-mail, IDs, paths, payloads, screenshots e dados de partida detalhados.
5. Eventos permitidos usam enum e schema: versão, plataforma, feature flag, sucesso/falha técnica e duração aproximada.
6. Implementar retenção, amostragem, desligar coleta, exportar/excluir dados e modo de diagnóstico local.
7. Sentry no main e renderer com DSN público configurável por build; erros offline não impedem o app.

### Documentation references

- Política atual sem telemetria: `src/components/Dashboard.tsx:103-105`
- Erros atuais em console: `electron/main.ts:223-231`
- Contratos compartilhados: `src/shared/contracts.ts`

### Verification checklist

- Teste de scrubber com tokens/e-mail/path/payload sintéticos.
- Opt-out impede inicialização e envio.
- Falha de rede/Sentry não afeta GSI, overlay ou inicialização.
- Revisão de privacidade e texto de consentimento antes de release.

### Anti-pattern guards

- Não anexar screenshot, payload GSI, inventário ou histórico de partida.
- Não usar fingerprint persistente do dispositivo.
- Não misturar consentimento de crash com marketing/analytics.

## Phase 12 — Final verification e release candidate

**How this serves the primary goal:** prova que o conjunto funciona como produto, não apenas como módulos isolados.

### What to implement

1. Executar revisão de padrões, segurança, privacidade, acessibilidade e desempenho.
2. Rodar build, testes unitários, smokes Electron, biblioteca e empacotamento NSIS.
3. Criar matriz manual Windows: resoluções/DPI, múltiplos monitores, janela sem bordas, Alt+Tab, sleep/resume e Dota reiniciado.
4. Validar GSI real em lobby/bots antes de ranqueada.
5. Testar atualização/migração a partir da versão atual com backup.
6. Produzir changelog, política de privacidade, termos, troubleshooting e checklist de rollback.

### Documentation references

- Scripts: `package.json:8-22`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Marcos atuais: `docs/ROADMAP.md:24-33`

### Verification checklist

- `npm.cmd test` sem falhas.
- `node --test dota-library-pack/tests/smoke.test.cjs` sem falhas.
- Instalador abre, atualiza e desinstala sem remover dados sem confirmação.
- Nenhum segredo ou dado sensível em bundle/log/telemetria.
- Cada bloco termina abrindo o app e fornecendo ao usuário uma lista objetiva do que conferir.

### Anti-pattern guards

- Não chamar de pronto o que só passou em demo.
- Não habilitar captura ou telemetria por padrão.
- Não publicar sem rollback e backup testados.

## Ordem de execução resumida

1. Editor do overlay.
2. Notificações.
3. Timing de itens — entrega offline concluída; benchmark público e validação real pendentes.
4. Draft Advisor — entrega manual concluída; fontes adicionais permanecem pendentes.
5. Wards, dispel e movimento.
6. Rotas de farm e mapa.
7. Captura/calibração.
8. Robustez/checkpoint.
9. Conta/licença/assinatura.
10. Telemetria/Sentry.
11. Release candidate e validação real completa.

## Definition of done por bloco

- Implementação isolada em módulo profundo, contrato explícito e sem acoplamento desnecessário à UI.
- Testes novos e toda a suíte anterior passando.
- Dados ausentes continuam ausentes; inferências são rotuladas.
- Documentação/roadmap atualizados.
- Revisão independente de qualidade e anti-padrões.
- App aberto ao final com checklist visual para o usuário.
