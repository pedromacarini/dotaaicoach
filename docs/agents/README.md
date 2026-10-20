# Agent handoffs

Agentes não permanecem vivos entre sessões. Estes arquivos guardam contexto mínimo para retomar trabalho sem nova discovery.

## Regra de custo

- Reutilizar agentes existentes quando disponíveis.
- Relatórios curtos: arquivos, testes, bloqueios.
- Não repetir leitura de `dota2brasil-analise.json`.
- Plano principal: `../PARITY_PHASES_3_5_PLAN.md`.

## Papéis

- `phase3_impl`: implementação Fases 3–5.
- `phase2_verify`: verificação independente.
- `phase2_antipattern`: anti-patterns.
- `phase2_quality`: revisão de qualidade.

