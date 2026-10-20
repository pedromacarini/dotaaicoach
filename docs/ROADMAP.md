# Roteiro de desenvolvimento

O plano executável completo para as próximas fases está em [`MASTER_IMPLEMENTATION_PLAN.md`](MASTER_IMPLEMENTATION_PLAN.md).

Legenda: ✅ implementado; 🔜 projetado; ⚠️ depende de dados/regras; ❌ fora do escopo.

| Recurso | Fase | Situação |
|---|---|---|
| Janela transparente, always-on-top e click-through | MVP | ✅ implementado; validar Windows+Dota |
| Painel de controle e demonstração | MVP | ✅ implementado |
| Servidor local GSI autenticado | MVP | ✅ implementado; validar com cliente real |
| Herói, nível, LH, denies, net worth, GPM e KDA | MVP | ✅ campos tratados; dependem do payload recebido |
| Configuração GSI gerada pelo aplicativo | MVP | ✅ detecção Steam, instalação confirmada e alternativa manual |
| Editor do overlay | v0.2 | ✅ posição, escala, opacidade, lock, módulos, reset, clamp por monitor e click-through após edição |
| Perfis de layout nomeados | v0.2 | 🔜 base versionada pronta; perfis ficam para uma fase posterior |
| Histórico local de partidas | v0.2 | ✅ até 30 sessões reais, somente em userData; validar término com Dota real |
| Resumo pós-partida e evolução de farm | v0.2 | ✅ benchmark experimental + gráfico + demonstração; calibrar com partidas reais |
| Guia de habilidades e itens por posição | v0.3 | ✅ biblioteca + próximo up e fase atual no overlay; validar com Dota real |
| Cronogramas de objetivos | v0.3 | ⚠️ revisar regras e observabilidade |
| Comparações de patches e recomendações pós-jogo | v0.4 | 🔜 |
| Counter-pick em tela de planejamento fora da partida | v0.4 | ⚠️ verificar regras por modo |
| Mapa de wards inimigas ocultas ou outras informações não reveladas ao jogador | — | ❌ proibido no projeto |
| Controle automático de inputs do jogo / scripts de execução de combos | — | ❌ proibido no projeto |
| Captura/injeção de memória do Dota 2 e bypass anticheat | — | ❌ proibido no projeto |
| Cópia/republicação do código ou ativos do Aura | — | ❌ proibido no projeto |

## Marcos de aceitação para MVP

1. `npm install`, `npm run build` e `npm test` passam.
2. `npm run dev` abre painel e overlay no Windows.
3. Demonstração apresenta dados fictícios com etiqueta clara.
4. O botão de exportação grava CFG com token, somente após confirmação do usuário.
5. Dota em modo de teste envia `POST` autenticado ao listener local; campos reais são exibidos quando presentes.
6. Alternância Ctrl+Shift+F9 não intercepta comandos dentro do jogo.

**Não é seguro alegar conformidade anticheat sem avaliação e testes adicionais.** O suporte GSI, isoladamente, não garante aprovação para qualquer overlay em ambiente competitivo.
