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
3. Voz local em português.
4. Narrador de stack, pull, runas, Lotus e Roshan.
5. Perfil/conta local.
6. Licença offline.
7. Telemetria local opt-in.
8. Decisão sobre servidor próprio.

Ao concluir um item, atualizar esta lista com status e parar para o próximo pedido do usuário.

## Validação

Rodar `npm.cmd test` quando possível. Para mudanças rápidas: `npm.cmd run build` e testes focados. Abrir o app e dizer exatamente o que o usuário deve observar. Falhas por porta GSI ocupada devem ser separadas de falhas de código.

## Guardrails

Não copiar código/ativos/dados privados de outros overlays. Não inferir visão inimiga. Não chamar backend externo para telemetria sem consentimento. Não tratar `net_worth` ausente como zero.
