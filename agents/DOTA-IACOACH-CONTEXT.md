# Contexto operacional do DotaIACoach

## Produto

Electron + React + TypeScript para overlay local do Dota 2. Repositório: `pedromacarini/dotaaicoach`. Entrada rápida: `ABRIR-DOTA-IACOACH.vbs`.

## Fonte de estado

- GSI local autenticado em `127.0.0.1:3199/gsi`.
- O renderer recebe somente o jogador local, herói, relógio, inventário, LH, denies, GPM e campos que o Dota realmente enviar.
- OpenDota é fonte complementar para builds e confrontos; falha de rede deve preservar cache válido e exibir aviso.
- Catálogo local vem de `odota/dotaconstants`.

## Bloco atual de execução

1. ✅ Detecção real das skills upadas — GSI publica `abilities`; recomendação procura o próximo ponto ainda não aprendido.
2. ✅ Talentos dinâmicos — próximo talento por nível, escolha já feita e recomendação da build.
3. ✅ Voz local em português — modo `voice`, idioma pt-BR e síntese local do Windows via SpeechSynthesis.
4. ✅ Narrador de stack, pull, runas, Lotus e Roshan — regras Normal/Turbo usando voz pt-BR.
5. ✅ Perfil/conta local — perfil JSON local com ID, nome e posição; sem login ou nuvem.
6. ✅ Licença offline — payload Ed25519, validade opcional, importação local e modo gratuito sem servidor.
7. ✅ Telemetria local opt-in — desligada por padrão, eventos técnicos limitados ao computador, exportação e apagamento manuais.
8. ✅ Decisão sobre servidor próprio — fase de testes usa códigos offline assinados/allowlist local; servidor fica para revogação, limite de máquinas e renovação futura.

Ao concluir um item, atualizar esta lista com status e parar para o próximo pedido do usuário.

## Validação

Rodar `npm.cmd test` quando possível. Para mudanças rápidas: `npm.cmd run build` e testes focados. Abrir o app e dizer exatamente o que o usuário deve observar. Falhas por porta GSI ocupada devem ser separadas de falhas de código.

Durante a execução dos oito itens prioritários, não abrir o app entre blocos; validar somente por build/testes. Reabrir apenas quando os oito itens estiverem concluídos ou quando o usuário pedir explicitamente.

## Guardrails

Não copiar código/ativos/dados privados de outros overlays. Não inferir visão inimiga. Não chamar backend externo para telemetria sem consentimento. Não tratar `net_worth` ausente como zero.
