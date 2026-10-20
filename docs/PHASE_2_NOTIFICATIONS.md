# Fase 2 — Cronograma e central de notificações

Implementado em 2026-10-20 sobre Electron 37.x.

## Decisões

- `NotificationRule` é um contrato explícito: instante, título, posição, tags, repetição, limite, duração e áudio. A posição é a função 1–5 escolhida no app ou `all`; não é coordenada de tela.
- O store `notification-rules.json` usa schema 1, gravação atômica e limite de 200 regras. Importação aceita somente JSON escolhido pelo usuário, com no máximo 1 MB, sem caminhos vindos do renderer e com validação integral antes de substituir o arquivo válido.
- Os presets são autorais, editáveis e identificados pelo modo e pelo patch do catálogo local. Essa etiqueta não afirma que o cliente do jogador esteja no mesmo patch. A interface pede revisão depois de cada atualização do Dota 2.
- O scheduler é puro e dirigido exclusivamente por `gameTime`. Pacotes duplicados, pausa e regressões curtas não repetem ocorrências; saltos cruzam os instantes intermediários; a primeira amostra usa somente três segundos de tolerância para não despejar alertas antigos. Um `advance` entrega no máximo 64 ocorrências, impedindo explosão combinatória com 200 regras.
- O `map.game_time` bruto inclui estratégia/pré-jogo. O receptor não alimenta relógio nem agenda antes de `GAME_IN_PROGRESS`; na transição, fixa um baseline por `matchId` e publica tempo normalizado a partir de zero. Reconexões da mesma partida preservam esse baseline. O diagnóstico mostra também o valor bruto.
- Se `game_state` estiver ausente, o fallback usa `map.clock_time`; se ambos estado e `clock_time` faltarem, mantém `map.game_time` sem calibração para não fingir um início de partida quando o app foi aberto no meio.
- Repetição sem `repeatUntilSeconds` permanece útil e segue até o teto global validado de `240:00`; a interface mostra esse limite efetivo.
- Banners expiram localmente, podem ser dispensados e só aparecem quando o módulo `alerts` está visível. O overlay continua click-through fora do editor, portanto o dismiss normal fica na tela Cronograma; no modo de edição também aparece no banner.
- O áudio inicial usa apenas `shell.beep()` do Electron. Não há arquivo remoto, upload nem TTS. O som automático só toca quando o módulo **Alertas** está visível; o botão explícito de prévia continua disponível. TTS ficou de fora até uma futura decisão explícita de API/voz.
- A simulação substitui temporariamente o relógio recebido e é encerrada pelo usuário. Ao encerrar, o GSI volta a ser a fonte; nenhuma mensagem sintética é gravada como partida.
- O runtime publica mudança quando o segundo do jogo muda, um banner aparece/expira ou a conexão é limpa; pacotes duplicados no mesmo segundo não geram tráfego de UI.
- A fronteira de partida usa `map.matchid`/`map.match_id` quando o GSI o fornece. Reconectar com o mesmo identificador preserva as ocorrências já disparadas. Somente sem identidade confiável o retorno de um relógio positivo ao pré-jogo e a reconexão após timeout funcionam como heurísticas conservadoras para remakes curtos e primeiro pacote tardio.
- Toda mutação do store grava e renomeia o candidato antes de publicá-lo em memória. Se o disco falhar, o estado anterior continua ativo. Aplicar preset exige confirmação; cancelar importação/exportação não relata sucesso.
- Objetivos são lembretes cronológicos, não detectores. O app não afirma morte, respawn ou disponibilidade de Roshan/Tormentor a partir de informação que o GSI não forneceu.

## APIs Electron consultadas

As assinaturas também foram conferidas em `node_modules/electron/electron.d.ts` da versão 37 instalada:

- [`shell.beep()`](https://www.electronjs.org/docs/latest/api/shell#shellbeep)
- [`dialog.showOpenDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options)
- [`dialog.showSaveDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options)
- IPC continua restrito pelo padrão documentado na Fase 1; nenhum filesystem é exposto no preload.

## Arquivos centrais

- `src/core/notification-scheduler.ts`: relógio e ocorrências determinísticas.
- `src/core/notification-presets.ts`: presets autorais por modo/patch.
- `electron/notification-store.ts`: validação, persistência e restauração.
- `electron/notification-center.ts`: estado ativo, expiração e áudio.
- `src/components/NotificationPage.tsx`: edição, filtros, simulação e backup.
- `src/components/Overlay.tsx`: banners do módulo de alertas.

## Verificação

- Unitários cobrem relógio normal, pausa/pacote duplicado, salto, regressão, repetição aberta, tetos de tempo/ocorrências, posição, expiração, relógio sem banner, nova partida por identidade/remake/reconexão, áudio oculto, falha de persistência, importação malformada e máximo de regras.
- Smoke Electron abre a tela Cronograma, comprova confirmação/cancelamento de preset, preserva formulário após save inválido, simula `06:00`, observa “Runa de poder” no DOM real do overlay, dispensa o banner e encerra a simulação.
- O preset padrão nasce com áudio desligado; “Testar som” é uma ação explícita do usuário.

## Limitações conhecidas

- Os tempos de mapa são conteúdo editável e precisam de revisão humana após patches.
- Alguns contextos do GSI podem omitir `matchid`; nesses casos a central usa as heurísticas conservadoras documentadas. A Fase 9 adicionará checkpoint persistente da sessão.
- Validação com o Dota aberto ainda é necessária para confirmar cadência de pacotes, pausa real e comportamento em Turbo.
