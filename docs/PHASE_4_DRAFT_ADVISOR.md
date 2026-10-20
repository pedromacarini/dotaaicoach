# Fase 4 — Draft Advisor

Implementado em 2026-10-20 sobre Electron 37.x.

## Entrega

- Cenário manual com aliados, inimigos, bans, posição e modos All Pick, Turbo e Captain's Mode.
- Validação fechada para duplicidade, herói nos dois times, conflito pick/ban, limites e herói fora do pool de Captain's Mode.
- Recomendações determinísticas com ordenação estável.
- Counters consultados pelo endpoint local já existente `heroes/:id/matchups`, usando o cache de 30 minutos do servidor da biblioteca.
- Corte mínimo de 20 confrontos por adversário. Cada resultado mostra OpenDota, horário de coleta/frescor, amostra, inimigos cobertos e confiança baixa/média/alta.
- Cobertura de funções e adequação à posição são rotuladas como **heurística de catálogo**.
- Sinergia estatística entre aliados permanece explicitamente indisponível; nenhum score foi inventado.
- Store `draft-scenarios.json`, schema 1, até 20 cenários, validação integral e escrita atômica antes de publicação.
- Evidências são aceitas somente quando `focalEnemyId` pertence ao cenário atual. Duplicatas de focal/oponente não inflam amostra e respostas assíncronas de um cenário anterior são descartadas por revisão de request.
- Cenários Captain salvos são reconciliados ao carregar o catálogo; heróis inexistentes ou fora do pool são removidos com aviso visível e a correção é persistida.
- Uma resposta atrasada ao salvar não sobrescreve edições iniciadas depois do request. Exclusão exige confirmação e informa cancelamento/falha.
- Link da recomendação abre diretamente a ficha do herói na biblioteca incorporada.
- Se a OpenDota falhar, a página continua operando com as heurísticas locais e exibe o motivo.

## Semântica dos dados

O endpoint de confrontos retorna, para cada inimigo consultado, partidas e vitórias daquele inimigo contra o candidato. O domínio inverte somente essa contagem (`partidas - vitórias do inimigo`) para apresentar a taxa do candidato no confronto. Linhas abaixo da amostra mínima são descartadas.

All Pick e Turbo usam o mesmo endpoint porque essa consulta não expõe filtro de modo. A UI informa essa limitação. Captain's Mode filtra o campo `captainMode` do catálogo local, mas não tenta reproduzir automaticamente ordem de picks/bans por patch.

O endpoint também não informa patch da amostra agregada. Por isso a fonte, data da consulta, amostra e confiança são exibidas, mas o app não inventa um patch. A checklist mantém essa parte como parcial.

## Arquitetura

- `src/core/draft-advisor.ts`: validação, estatística de confronto, heurística e ranking puro.
- `electron/draft-store.ts`: persistência versionada e atômica.
- `src/components/DraftPage.tsx`: seleção manual, estado offline, salvos e explicações.
- `electron/main.ts`, `electron/preload.ts`, `src/shared/contracts.ts`: IPC mínimo e restrito ao painel.
- `dota-library-pack/viewer/app.js`: aceita `?hero=` apenas para abrir uma ficha local existente.

Nenhum dado é lido da memória ou detectado automaticamente na tela. O renderer consulta somente o servidor loopback da biblioteca; o servidor controla endpoint, timeout e cache.

## Verificação automatizada

- Domínio: duplicidade, conflitos, Captain's Mode, reconciliação do catálogo, amostra mínima, deduplicação da evidência, cenário trocado, frescor, confiança, ordem estável, heurística e sinergia indisponível.
- Store: leitura, update/save/delete, schema inválido, gravação atômica e falha de disco sem publicar candidato.
- Smoke Electron: abre Draft pela UI, carrega cenário demo, recebe counter controlado, salva, comprova cache e abre Crystal Maiden na biblioteca.

## Checklist visual

1. Abra **Draft Advisor**.
2. Clique **Carregar demo**.
3. Confira Axe aliado, Anti-Mage inimigo, Pudge banido e posição 5.
4. Aguarde Crystal Maiden com estatística OpenDota, amostra e confiança.
5. Confira as linhas separadas **ESTATÍSTICA**, **HEURÍSTICA** e **INDISPONÍVEL**.
6. Troque entre All Pick, Turbo e Captain's Mode; no último, heróis fora do pool devem desaparecer.
7. Tente colocar o mesmo herói em dois grupos e confirme que a UI impede o conflito.
8. Salve, abra outro cenário e recarregue o salvo.
9. Clique **Abrir na biblioteca** e confirme a ficha do herói recomendado.

## Pendências reais

- O endpoint agregado não fornece patch nem separação Turbo/All Pick.
- Sinergia estatística exige uma fonte pública/licenciada ainda não definida.
- Detecção automática de draft fica para captura opt-in futura; esta fase é exclusivamente manual.
