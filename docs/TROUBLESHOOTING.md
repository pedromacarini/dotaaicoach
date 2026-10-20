# Diagnóstico

## Janela não aparece

- Verifique `node -v`, `npm -v`; execute `npm.cmd install`, `npm.cmd run build`.
- Execute `npm.cmd run dev` numa única janela PowerShell e procure erros na saída.
- Para overlay sobreposto ao jogo, utilize janela sem bordas em vez de fullscreen exclusivo.
- `Ctrl + Shift + F9` alterna a visibilidade da janela auxiliar.

## GSI fica desconectado

1. Abra o painel e confira `Servidor local: 127.0.0.1:3199`.
2. Use **Salvar configuração GSI** e confira que colocou o arquivo em `.../game/dota/cfg/gamestate_integration/`.
3. Certifique-se de que o Dota 2 está fechado enquanto cria/move o arquivo; inicie-o depois.
4. Abra uma partida de teste. Fora da partida, campos podem estar ausentes.
5. Verifique se a porta está ocupada: `Get-NetTCPConnection -LocalPort 3199 -ErrorAction SilentlyContinue`.
6. **Não compartilhe o conteúdo do CFG publicamente:** ele contém o token de autenticação.
7. Se houver várias bibliotecas Steam, confira o caminho verdadeiro da instalação em Propriedades do Dota 2 > Arquivos instalados > Procurar.

## Payload faltando campos

Campos ausentes aparecem como `—`. As propriedades disponibilizadas pelo jogo dependem da fase/modo/versão e não podem ser presumidas. Replays e partidas assistidas podem expor esquemas diferentes dos de um jogador ativo.

## Segurança

O servidor recebe JSON apenas em `127.0.0.1:3199/gsi`. Não altere o bind para `0.0.0.0` e não exponha a porta ao roteador, VPN ou Internet. Não envie logs contendo token, arquivos de configuração pessoais ou outros dados privados.

## Janelas em branco no Windows (v0.2.1)

O painel e o overlay devem renderizar mesmo sem o Dota 2 aberto.
Se não aparecerem:

1. Pare o terminal com Ctrl+C e confira a versão de Node (`node -v`).
   A versão 0.2.1 declara Node >=22.12.0; preferencialmente use uma LTS atual.
2. Rode `npm.cmd install` e `npm.cmd run dev`.
3. As linhas `[dashboard] Ponte Electron: OK` e `[overlay] Ponte Electron: OK`
   confirmam que o preload foi carregado.
4. Para abrir automaticamente DevTools no painel, use CMD:
   `set DOTA_OVERLAY_DEBUG=1 && npm.cmd run dev`
   Ou PowerShell: `$env:DOTA_OVERLAY_DEBUG='1'; npm.cmd run dev`
5. Na aba Console, compartilhe somente as mensagens de erro, sem tokens/credenciais.
6. Abra `http://127.0.0.1:5173/?mode=dashboard` no navegador enquanto o Vite roda.
   Fora do Electron, a interface informará que a ponte está indisponível (esperado).
7. Não é necessário abrir Dota 2 nem configurar GSI para testar as janelas.

Esta versão torna o preload autocontido, não permite navegação externa,
mantém contextIsolation e sandbox ativos e desabilita os controles quando
a ponte não está disponível.
