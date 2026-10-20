# Levantamento arquitetural do Aura (metadados do REA)

O usuário forneceu um relatório estático de **311,8 MiB** do `app.asar` de um aplicativo local Dota2Brasil Overlay, com **25.390 nós** do grafo. O projeto encontrou **123 caminhos não associados a dependências de terceiros**, armazenados **somente como inventário de caminhos** em `research/aura-file-inventory.json`. O relatório original e qualquer código proprietário **não são distribuídos neste ZIP**.

## Organização observada no relatório

- Núcleo Electron: `dist/main/main.js`, `dist/main/preload.js`.
- Dados do Dota e GSI: `dist/main/server/gsi-server.js`, `dist/main/services/gsi-config.js`.
- Janelas: `src/renderer/index.html`, `src/renderer/overlay.html`, `src/renderer/js/overlay.js`.
- Domínios sugeridos pelos nomes: `item-tracker.js`, `ward-tracker.js`, `farm-route.js`, `skill-advisor-logic.js`, `notification-engine.js`.
- Dados próprios sugeridos pelos nomes: `dota-items.js`, `dota-hero-names.js`, `map-points.js`, `dispel-catalog.js`, `talent-slots.js`.

Esses nomes comprovam **presença de arquivos**, mas não comprovam algoritmos, resultado em partida, procedência dos dados nem direitos de redistribuição. Alguns nós tiveram análise semântica parcial por limite de recursos do REA.

## Como a arquitetura orienta nossa implementação

| Domínio observado | Implementação independente | Dados de origem permitida |
|---|---|---|
| GSI | Servidor HTTP local com token | Estado da própria partida via GSI |
| Overlay | Janela transparente Electron | Eventos locais do nosso processo |
| Itens/heróis/habilidades | Gerador de catálogos | OpenDota `dotaconstants` MIT |
| Relacionamentos herói-talentos | Índice aberto de vínculos | OpenDota `hero_abilities` |
| Rotas de farm/mapa | Futuro módulo próprio | Regras públicas e configuração voluntária |
| Alertas | Futuro mecanismo original | Tempos e eventos disponíveis no GSI |

**Fora do escopo:** copiar JS, UI, imagens, credenciais, regras privadas de ativação ou esquemas proprietários do Aura; contornar assinaturas/licenciamento; usar dados ocultos do jogo.
