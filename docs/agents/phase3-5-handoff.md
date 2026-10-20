# Handoff Fases 3–5

## Estado

- Fase 3 inventário/timing: implementada e aprovada.
- Fase 4 Draft Advisor: implementada; correções pendentes da revisão.
- Fase 5 wards/dispel/movimento: ainda não iniciada.

## Última validação Fase 3

- `npm.cmd test`: 67/67
- biblioteca: 2/2
- smokes: 4/4
- app aberto via VBS

## Correções Draft pendentes

1. Filtrar/deduplicar evidência por `focalEnemyId` do cenário atual.
2. Ignorar resultados assíncronos obsoletos.
3. Exibir `fetchedAt`.
4. Revalidar cenário Captain após catálogo carregar.
5. Proteger save contra race.
6. Mostrar erro de catálogo.
7. Confirmar exclusão, estado busy e erro.
8. Adicionar `aria-live` para loading/resultados/erros.

## Segurança

- GSI somente jogador local.
- Campo ausente permanece `unknown`.
- Sem inventário/visão inimiga.
- Sem memória, DLL, input automation ou catálogo proprietário.

