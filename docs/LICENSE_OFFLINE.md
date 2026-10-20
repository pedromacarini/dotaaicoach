# Licença offline

O app funciona gratuitamente sem licença. Uma licença premium é um JSON assinado com Ed25519 e validado localmente pela chave pública embutida no app.

A chave privada de desenvolvimento fica fora do repositório em:

```text
C:\Users\User\.dota-iacoach\license-private.pem
```

Para emitir uma licença:

```powershell
$env:DOTAIACOACH_LICENSE_PRIVATE_KEY = Get-Content 'C:\Users\User\.dota-iacoach\license-private.pem' -Raw
npm.cmd run license:issue -- usuario@local 2027-12-31T23:59:59.000Z > license.json
```

Depois importe `license.json` em Configurações → Licença offline. Nunca commite a chave privada.
