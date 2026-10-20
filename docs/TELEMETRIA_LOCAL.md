# Telemetria local

A telemetria do DotaIACoach é opcional e fica desligada por padrão.

Quando ativada em **Configurações**, o app grava no computador até 500 eventos técnicos, como início de partida e versão do app. Não envia dados para a internet e não registra chat, conta Steam ou `match_id`.

Na mesma tela é possível exportar o JSON para diagnóstico ou apagar todo o histórico. Desativar a opção impede novos registros; apagar remove os eventos já salvos.

O arquivo fica no diretório de dados do Electron, normalmente em `%APPDATA%/dota-iacoach/telemetry.json`.
