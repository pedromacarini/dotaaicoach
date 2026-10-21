# Checklist completa de paridade funcional

Atualizado em 2026-10-20. Este documento é a fonte rastreável da paridade entre o DotaIACoach e o produto de referência analisado estaticamente.

## Auditoria complementar do overlay público

Em 2026-10-20 foi revisada a página pública do produto de referência: [dota2brasil.com/overlay](https://dota2brasil.com/overlay). Ela descreve Flash Farm, Meta Items, Power Spike, Skill Certa com talentos, notificações por voz e cronograma editável, MiniMapa Tracker de última posição, Counter Pick 5v5 com confiança/medalha, auto-accept e onboarding/conta. A mesma página marca como “em breve” rota de farme, treinador por voz, conferência dos times e aviso de sumiço. Isso é evidência de funcionalidade declarada, não autorização para copiar código, ativos ou dados privados.

## Como ler

- `✅ Feito`: implementado e coberto por teste automatizado local.
- `🟡 Parcial`: existe uma entrega útil, mas ainda falta parte observada na referência ou validação real.
- `🔵 Planejado`: confirmado no plano, ainda não implementado.
- `🟠 Bloqueado por dados/política`: depende de fixture real, fonte pública defensável ou decisão de segurança.
- `⚪ Evidência somente`: o artefato da referência contém nomes/arquivos, mas não prova funcionamento nem fórmula.

A referência é evidência de produto, não fonte de código, ativos, coordenadas, fórmulas ou bancos proprietários. Dados ausentes continuam desconhecidos; demo, fixture e inferência devem ser rotulados.

## Fundação e desktop

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| ✅ | Electron/React, instância única e inicialização local | Manter suíte verde | Base |
| ✅ | GSI local autenticado, instalação e diagnóstico do CFG | Validar em lobby/bots | Base |
| ✅ | Overlay transparente, always-on-top e click-through | Validar janela sem borda/fullscreen e drivers | Base |
| ✅ | Editor: posição, escala proporcional, opacidade, cadeado, módulos e reset | Validar DPI 100/125/150% e múltiplos monitores | 1 |
| 🟡 | Atalhos globais | Tornar configuráveis e documentar conflitos | 8 |
| 🔵 | Perfis de overlay por função/modo | UX e migração de preferências | 8 |
| 🔵 | Foreground detector e recuperação do renderer | Testes Windows, crash e retomada | 9 |
| 🔵 | Configuração/compatibilidade de vídeo e transparência | Matriz de GPUs, resolução e modo janela | 8/12 |
| 🔵 | Controle de uso de recursos | Orçamento CPU/RAM e medição | 9/12 |

## Biblioteca, guias e recomendações

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| ✅ | Biblioteca local de heróis, itens, habilidades, talentos e facetas | Atualizar por patch | Base |
| ✅ | Itens populares por fase | Fonte/amostra sempre visíveis | Base |
| 🟡 | Builds de partidas recentes analisadas pela OpenDota | Corrigir rótulo “profissional” onde a consulta não filtra liga/jogador | 3 |
| ✅ | Próximo up de habilidade por posição | Validar com mais amostras e patch | Base |
| ✅ | Guia local editável | Perfis/importação futura | Base |
| 🟡 | Talentos e inatas recomendados junto da skill build | Fonte autoral/versionada; destaque calibrado depende de captura opt-in | 7 |

## Partida, estatísticas e alertas

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| ✅ | Benchmark experimental de last hits por posição | Calibrar com partidas reais | Base |
| 🟡 | Patrimônio esperado e resumo pós-partida | Fonte/amostra e sessão real | 6/9 |
| 🔵 | Patrimônio comparado à meta por minuto | Fonte pública/versionada e fórmula explicável | 6 |
| ✅ | Cronograma, presets Normal/Turbo, repetição, tags, som e import/export | Validação manual dos diálogos e jogo real | 2 |
| 🟡 | Inventário próprio normalizado e estado desconhecido explícito | Fixture real dos slots GSI | 3 |
| 🟡 | Primeira observação de itens e histórico da build | Validar cargas, combinação e reconexão no Dota real | 3 |
| 🟡 | Comparação de timing com benchmark rotulado | Substituir a fixture sintética por amostra pública; diferença semântica já documentada | 3 |
| 🟡 | Notificações de objetivos e cronograma de gameplay | Tela/regras locais prontas; falta voz/TTS e presets por função | 6/8 |

## Draft e modos

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| ✅ | Confrontos OpenDota na biblioteca | Manter cache e tratamento de indisponibilidade | 4 |
| ✅ | Draft Advisor manual com aliados, inimigos e bans | Validar UX com jogadores | 4 |
| ✅ | All Pick, Turbo e Captain's Mode | Endpoint não separa Turbo/All Pick; limitação documentada | 4 |
| 🟡 | Counters explicáveis com fonte, amostra e confiança | Endpoint agregado não fornece patch | 4 |
| ✅ | Cobertura de funções | Implementada e rotulada como heurística de catálogo | 4 |
| 🟠 | Sinergia estatística entre aliados | Definir fonte pública/licenciada; não inventar score | 4+ |
| 🟠 | Detecção automática de picks/bans | Captura futura; entrada manual é a entrega atual | 7+ |

## Suporte: wards, dispel e movimento

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🟡 | Quantidade própria de observer/sentry/dispenser observada | Cartão de inventário entregue; falta validar cargas no GSI real | 5 |
| 🔵 | Contadores próprios comprados/colocados/destruídos | Confirmar disponibilidade no payload real | 5 |
| 🔵 | Ritmo de ward com inferências rotuladas | Não inferir posição nem visão | 5 |
| 🔵 | Condições: silence, stun, disarm, break, hex, mute e debuff | Fixtures reais; ausência não é falso | 5 |
| 🔵 | Catálogo autoral/versionado de fontes de dispel | Fonte pública e revisão manual | 5 |
| 🔵 | Sugestão conservadora de dispel | Fail closed, cooldown/can-cast/mute/stun | 5 |
| 🔵 | Estimativa de velocidade base + itens | Allowlist de bônus e regras de stacking | 5 |
| 🟠 | Velocidade atual exata | Buffs, terreno e debuffs não são sempre observáveis | 5+ |
| 🚫 | Ward/visão inimiga oculta | Proibido por escopo e legitimidade | Nunca |

## Farm, lane e mapa

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🔵 | Banco autoral de camps/pontos por patch e lado | Fonte aberta/licenciada | 6 |
| 🟡 | Rotas de farm explicadas e editáveis | Simulador offline autoral entregue; falta calibração de mapa | 6 |
| 🔵 | Scout/evolução/proximidade dos camps | Delimitar apenas estado observável | 6 |
| 🔵 | Coleta e comparação de ouro dos camps | Catálogo/versionamento próprio | 6 |
| 🔵 | Classificação e atribuição de lane | Definir entradas legítimas e confiança | 6 |
| 🔵 | Rastreamento/agrupamento de waves | Modelo próprio e validação | 6 |
| 🔵 | MiniMapa Tracker de última posição legítima | Implementar somente com evento GSI/captura permitido; sem visão oculta | 6/7 |
| 🟠 | “Ghost creeps”/memória de visão | Somente se entrada legítima e política permitirem | Futuro |

## Captura, calibração e automação

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🔵 | Captura local opt-in com indicador e preview | API Electron oficial e threat model | 7 |
| 🔵 | Calibração de inventário, skills, talentos e botão Ready | Perfis por resolução/DPI | 7 |
| 🔵 | Diagnóstico visual com fixtures anonimizadas | Zero persistência/envio por padrão | 7 |
| 🟠 | Auto-accept opcional | Gate de política Valve/Steam e revisão humana; não iniciar automaticamente | 8 |
| 🚫 | Memória, DLL, driver, interceptação ou bypass | Fora do escopo | Nunca |

## Histórico, grupos, lobby e campeonato

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🟡 | Histórico local de sessões | Checkpoint, retomada e resumo enriquecido | 9 |
| 🔵 | Grupos real/demo e regras compartilhadas | Modelo de permissão e sincronização | 9+ |
| 🔵 | Lobby, serviço/socket e sincronização de configuração | Backend e threat model | 9+ |
| 🔵 | Dossiê/scouting de campeonato | Fonte pública, licenças e UX | 9+ |

## Experiência, atualização e operação

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🔵 | Onboarding de posição, som, GSI e preferências | Fluxo de primeira execução | 8 |
| 🔵 | Tutorial, ajuda inicial e vídeos | Conteúdo autoral/acessível | 8 |
| 🔵 | Novidades/changelog no app | Fonte versionada | 8/12 |
| 🔵 | Atualização automática, rollout e estado | Canal, assinatura e rollback | 12 |
| 🔵 | Auto-restart e takeover de instância | Testes de recuperação | 9/12 |
| ⚪ | Elevação de processo e merge/rename observados na referência | Só implementar mediante necessidade comprovada | — |

## Backend, conta e comercial

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🔵 | Backend de partidas/sincronização opcional | Provedor, contrato e política de dados | 10 |
| 🔵 | Login seguro via navegador | ADR de provedor + PKCE/device flow | 10 |
| 🔵 | Licença/entitlement assinado com grace offline | Backend e modelo comercial | 10 |
| 🔵 | Área gratuita e assinatura/portal | Definir exatamente o que é premium | 10 |
| 🔵 | Exclusão/exportação de conta e suporte | LGPD, retenção e operação | 10 |

## Privacidade, observabilidade e release

| Status | Recurso | Próxima evidência necessária | Ordem |
|---|---|---|---:|
| 🔵 | Logs rotativos com redaction e diagnóstico local | Testes de token/e-mail/path | 9 |
| 🔵 | Telemetria consentida e separada de crash reports | Política, schema e opt-in | 11 |
| 🔵 | Sentry main/renderer com scrubber obrigatório | SDK oficial e DSN por build | 11 |
| 🔵 | Empacotamento, updater, migração e rollback | Matriz Windows e release candidate | 12 |
| 🔵 | Validação real em lobby/bots, DPI, monitores e sleep/resume | Execução manual pelo usuário | 12 |

## Ordem consolidada

1. ✅ Editor do overlay.
2. ✅ Cronograma e notificações.
3. 🟡 Inventário e timing de itens (entrega offline concluída; validação e benchmark real pendentes).
4. 🟡 Draft Advisor (entrega manual concluída; patch/modo da amostra e sinergia estatística continuam indisponíveis).
5. 🔵 Wards, dispel e movimento.
6. 🔵 Rotas, camps, waves, lane e mapa.
7. 🔵 Captura e calibração.
8. 🔵 Onboarding, ajuda, atalhos, vídeo e auto-accept após gate.
9. 🔵 Histórico, checkpoint, recuperação, grupos/lobby e campeonato.
10. 🔵 Backend, conta, licença e assinatura.
11. 🔵 Telemetria e Sentry consentidos.
12. 🔵 Updater, empacotamento e validação final.

## Itens de evidência incerta

Os nomes `equilibrio.js`, `cadeado.js`, `merge-rename.js` e `cm-coluna.js` não recebem funcionalidades inventadas. Só entram no produto quando houver comportamento observável, necessidade real e fonte legítima.
