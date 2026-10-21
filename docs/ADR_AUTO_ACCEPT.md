# ADR: auto-accept seguro

## Decisão

O DotaIACoach não executará clique, tecla, macro, injeção ou comando automático para aceitar partidas. O módulo entrega apenas alerta de partida encontrada, estado armado, confirmação manual, cooldown e botão de pânico.

## Motivo

O Steam Subscriber Agreement proíbe scripts, bots, macros e outros sistemas não controlados por humanos para interagir com o Steam. A implementação de clique automático poderia expor a conta do usuário a restrição ou encerramento.

## Limites técnicos

- O GSI não informa a tela de busca/aceite antes da partida.
- Captura de tela, se adicionada, será somente local, opt-in e sem clique.
- O estado `actionsTaken` permanece sempre zero neste módulo.
- Qualquer futura mudança exige autorização expressa da Valve e revisão humana.
