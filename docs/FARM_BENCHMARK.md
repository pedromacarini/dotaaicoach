# Benchmark experimental de farm

O painel de Estatísticas usa um perfil autoral chamado `experimental-v1`. Ele serve para testar a experiência do produto antes da calibração com partidas reais e não afirma representar a média de jogadores profissionais.

## Como funciona

- Cada posição possui pontos de referência transparentes em 0, 5, 10, 15, 20, 30, 40 e 60 minutos.
- Entre dois pontos, a meta é interpolada linearmente.
- Depois de 60 minutos, a última taxa observada é prolongada.
- A faixa “dentro da meta” é o maior valor entre 3 LH e 8% da meta atual.
- Campos não enviados pelo GSI permanecem ausentes; o app não estima LH, patrimônio, GPM ou KDA do jogador.

As constantes estão exportadas em `src/core/farm-benchmark.ts`, com testes unitários. Elas devem ser revistas após coleta consentida e testes em partidas reais, considerando modo, patch e nível de habilidade.

## Histórico local

Sessões reais começam somente quando o GSI informa atividade `playing` nos estados `DOTA_GAMERULES_STATE_PRE_GAME` ou `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`. Isso evita registrar menus, seleção de herói e observação sem jogador local. A posição pode mudar durante o pré-jogo e é congelada ao entrar em `GAME_IN_PROGRESS`.

As sessões são amostradas no máximo a cada cinco segundos de tempo de jogo, salvo mudança numérica de K/D/A. Transições entre campo ausente (`null`) e número não furam esse intervalo. Cada sessão mantém no máximo 900 amostras; ao compactar, preserva início, maior tempo, fim e eventos K/D/A, distribuindo os demais pontos pelo período. Elas são finalizadas quando o GSI informa pós-jogo ou quando há uma regressão forte no relógio, indicando nova partida. Até 30 sessões finalizadas ficam em `match-sessions.json` dentro de `userData` do Electron.

O histórico concluído é persistido atomicamente. A sessão ainda ativa permanece somente em memória: se o aplicativo for encerrado abruptamente durante a partida, essa sessão incompleta não é recuperada. Checkpoint e recuperação da sessão ativa são uma pendência deliberada para uma fase posterior.

Durante uma partida, os eventos enviados ao painel carregam somente a sessão ativa; as até 30 sessões históricas não são clonadas nem serializadas a cada amostra. O histórico completo é lido na abertura do painel e novamente apenas quando uma partida é finalizada. O overlay não consulta nem recebe esse histórico.
