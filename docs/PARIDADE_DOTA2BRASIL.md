# Paridade funcional com o app de referência

Atualizado em 2026-10-19.

## Método e limites

Esta matriz compara o Dota Open Overlay com o artefato instalado do app de referência. A análise foi estática: inventário de arquivos, HTML, nomes de módulos e fluxos observáveis no pacote. O código e os ativos proprietários não são copiados.

- Artefato analisado: `dota2brasil-overlay/resources/app.asar`
- SHA-256 conferido: `40557c426109657126a74c7248bcdf5d07b5ea4e46e29dd57b0e207942366c46`
- Evidência adicional: `dota2brasil-analise.json`
- Limitação: nomes de módulos indicam intenção e arquitetura, mas não provam que todos os recursos funcionem em produção.

## Estado atual

| Área | Dota Open Overlay | Referência observada | Lacuna |
|---|---|---|---|
| GSI local | Recebe estado autenticado e exibe herói, nível, LH, denies, patrimônio, GPM e KDA | Servidor, instalação automática e diagnóstico de campos implementados; validação com o Dota real pendente | Parcial |
| Overlay | Janela transparente, sempre no topo e click-through | Painéis por função e vários widgets | Parcial |
| Biblioteca | Heróis, itens, habilidades, talentos, facetas e imagens locais | Não é o foco principal do artefato | Nosso app está mais completo nessa área |
| Itens populares | OpenDota, pré-carregado ao selecionar herói | Build recomendada por herói/posição | Implementado como estatística agregada |
| Builds profissionais | Partidas profissionais recentes na biblioteca; itens da fase atual no overlay | `itemBuild` buscada automaticamente | Implementado; falta ampliar apresentação e cache persistente |
| Ordem de skills | Sequências reais por posição e próximo up no overlay | `abilityBuild`, fallback e advisor calibrado | Implementado sem destaque por coordenadas; calibração ainda falta |
| Confrontos e draft | Draft Advisor manual, modos, picks/bans, counters OpenDota, confiança e cobertura heurística | Draft Advisor com vantagem de confronto | Implementado manualmente; faltam patch/modo da amostra, sinergia estatística e detecção futura |
| Meu guia | Editor local de itens e níveis por posição | Builds e recomendações automáticas | Recurso próprio, não equivalente |
| Configuração GSI | Localiza bibliotecas Steam, instala/atualiza o CFG com confirmação e mantém salvamento manual | Validar caminhos reais e permissões em instalações variadas | Implementado, a validar |
| Estatísticas de farm | Meta experimental aberta por posição, delta, gráfico, sessão demo e histórico local | Benchmark de LH/patrimônio observado no artefato | Primeira versão implementada; falta calibração real e patrimônio esperado |
| Inventário e timing | Inventário próprio defensivo, primeira observação, histórico e comparação com fixture sintética rotulada | Timing/itemBuild observado no artefato | Entrega offline implementada; falta payload real e benchmark público |

## O que ainda falta para uma cópia funcional fiel

### Prioridade 1 — recomendações na partida

1. ✅ Detectar o herói atual pelo GSI e associá-lo ao ID do catálogo.
2. ✅ Persistir a posição escolhida entre sessões.
3. ✅ Mostrar no overlay itens populares da fase atual.
4. ✅ Mostrar o próximo up de habilidade em um cartão simples.
5. 🔜 Adicionar calibração opcional para destacar a skill na barra do Dota e os talentos. O artefato de referência possui fluxos separados para calibrar barra de skills e árvore de talentos.

### Prioridade 2 — painel e personalização

- Onboarding de posição, sons e preferências.
- Perfis de overlay por função.
- Posição, tamanho, opacidade e bloqueio do overlay.
- Diagnóstico de conexão com o Dota e instruções guiadas.
- Atalhos configuráveis, não apenas o atalho global atual.

### Prioridade 3 — assistência durante a partida

- 🟡 Timing por primeira observação comparado com benchmark demonstrativo. Não afirma compra; faltam validação GSI real e amostra pública.
- Cronograma de alertas com tags, função, repetição, som e backup/importação.
- ✅ Benchmark experimental de last hits por posição, gráfico e histórico local. Ainda faltam patrimônio esperado, calibração real e rotas por fase.
- Contagem de wards baseada somente em dados legitimamente observáveis.
- Sugestão de dispel/item defensivo com calibração opcional do inventário.
- Timers de objetivos e runas, com regras versionadas por patch.

### Prioridade 4 — draft e modos

- ✅ Draft Advisor fora da ação de jogo, com aliados, inimigos, bans e explicação do cálculo.
- ✅ Fluxos manuais para All Pick, Turbo e Modo de Capitães; a amostra OpenDota não separa os dois primeiros.
- ✅ Seleção de função por cenário.
- 🟡 Comparação de confrontos com amostra, confiança e origem explícitas; o endpoint não fornece patch.

### Prioridade 5 — ecossistema

- Tutorial e ajuda inicial.
- Histórico e resumo pós-partida.
- Grupos/lobby e regras compartilhadas.
- Dossiê e scouting de campeonato.
- Atualização automática e diagnóstico de versão.

## Fora do escopo ou dependente de decisão

- Login, assinatura e paywall do app de referência não são necessários para um app comunitário aberto.
- Auto-accept e automação de inputs precisam de revisão separada de segurança e regras; não entram por padrão.
- Informação inimiga oculta, leitura de memória, injeção e bypass anticheat continuam proibidos.
- “Ghost creeps” e memória de visão só podem ser considerados se a entrada for legítima e a política de uso estiver documentada.

## Próximo bloco recomendado

Implementar wards, dispel e estimativa de movimento (Fase 5), mantendo em paralelo a validação do GSI, inventário e encerramento de sessão em lobby ou partida contra bots.
