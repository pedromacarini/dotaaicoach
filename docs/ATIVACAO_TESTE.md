# Ativação de teste

Código inicial para os testers:

```text
AXE-BLINK-LOTUS-7F2C
```

Ele libera o plano premium de teste até `2027-12-31` neste computador. O código usa nomes do Dota e tem 20 caracteres.

Para gerar outro código:

```powershell
npm.cmd run license:code -- jugger bkb
```

O script informa o hash. Antes de distribuir, adicione esse hash à lista de `electron/license-store.ts` e gere uma nova versão do instalador.
