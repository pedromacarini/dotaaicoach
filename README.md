## Biblioteca aberta do Dota 2 (v0.2.1)

Esta versão acrescenta uma biblioteca pesquisável de **heróis, itens, habilidades, talentos, habilidades neutras e patches**, alimentada pelo projeto MIT `odota/dotaconstants` instalado via npm. Os arquivos `src/data/generated/*.json` incluídos no ZIP são placeholders; **o catálogo é preenchido no seu computador** por `npm install` + `npm run data:sync` (ou automaticamente antes de `npm run dev`). Não há cópia de datasets do aplicativo Aura.

Para abrir depois da preparação inicial, dê duplo clique em
`ABRIR-DOTA-IACOACH.vbs`. O lançador abre o Electron sem terminal. Há
também `ABRIR-DOTA-IACOACH.cmd` como alternativa de diagnóstico. Os lançadores
com o nome antigo permanecem como compatibilidade local. Arquivos
`.ini` armazenam configuração no Windows e não são executáveis, por isso o
atalho usa o formato `.vbs`.

Comandos Windows:

```powershell
npm.cmd install
npm.cmd run data:sync
npm.cmd run data:check
npm.cmd run dev
```

No aplicativo, clique em **Biblioteca Dota 2** no menu lateral. A interface
completa da **Dota Open Library v1.5** é servida apenas em `127.0.0.1`, numa
porta escolhida automaticamente, e incorporada ao painel com seus catálogos,
imagens, fichas e planejador. A atualização pública pode atrasar em relação ao
patch do jogo. Para obter a última publicação da fonte, execute
`npm.cmd run data:update`.

Leia [FONTES](docs/DATA_SOURCES.md), [MAPA DA REFERÊNCIA AURA](docs/REFERENCE_AURA.md) e [ESCOPO](docs/ROADMAP_DATA.md). Não há automação de gameplay ou acesso a dados ocultos. Direitos do jogo pertencem à Valve e demais titulares.

---

# DotaIACoach

> **MVP experimental — projeto independente, gratuito e de código aberto.**
> Não afiliado à Valve, Dota 2, Steam, Dota2Brasil ou Aura.

Aplicativo Windows com Electron, interface React/TypeScript e recepção local de dados do **Dota 2 Game State Integration (GSI)**. Esta é a **primeira etapa** da alternativa comunitária proposta; não replica todos os recursos de aplicativos comerciais.

## Entregas da versão 0.2.1

- Painel desktop, com aparência escura e indicadores da partida.
- Janela transparente, always-on-top e **click-through** (não intercepta os cliques do jogo).
- Atalho global **Ctrl + Shift + F9** para mostrar/ocultar o overlay.
- Servidor HTTP GSI escutando **exclusivamente `127.0.0.1:3199`**, rota `POST /gsi`.
- Token de autenticação gerado localmente e gravado na pasta de dados do aplicativo.
- Exportação assistida do arquivo `gamestate_integration_dota_open_overlay.cfg`.
- Exibição dos **dados da própria partida/jogador** quando presentes: herói, nível, tempo, last hits, denies, net worth, GPM e K/D/A.
- Modo de demonstração com números fictícios identificados como tal.
- Sem telemetria própria, sem contas, sem nuvem e sem leitura da memória do Dota.

## Pré-requisitos

1. Windows 10/11 (x64 recomendado).
2. Node.js 22 LTS ou superior, e npm.
3. VS Code (opcional) e Dota 2 instalado (somente para integração real).

## Iniciar no VS Code

Abra o PowerShell na pasta descompactada:

```powershell
npm.cmd install
npm.cmd run dev
```

Se o PowerShell bloquear `npm.ps1`, use os comandos `npm.cmd` acima.

O aplicativo abre duas janelas: **painel** e **overlay transparente**. Na primeira execução, selecione **Modo demonstração** para testar com dados fictícios. Ative/desative a janela com **Ctrl + Shift + F9**.

Alternativamente, para verificar compilação e abrir o programa pronto:

```powershell
npm.cmd run build
npm.cmd start
```

Para rodar testes locais:

```powershell
npm.cmd test
```

Para gerar instalador do Windows (etapa opcional; pode baixar componentes do Electron Builder):

```powershell
npm.cmd run package:win
```

## Conectar ao Dota 2 (GSI)

1. No painel, abra **GSI local** e pressione **Localizar e instalar configuração**.
2. Confirme o destino encontrado. Se o Steam não for localizado, escolha a pasta `dota 2 beta` ou a biblioteca Steam quando solicitado.
3. O arquivo `gamestate_integration_dota_open_overlay.cfg` será instalado em:

   ```text
   <Sua biblioteca Steam>\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
   ```

   A pasta da biblioteca Steam **pode variar**. O app cria somente sua própria configuração e não substitui integrações de outros softwares.
4. Reinicie o Dota 2, se já estiver aberto. Inicie uma partida de teste ou lobby, mantendo o DotaIACoach aberto.
5. Volte ao diagnóstico para conferir o último pacote e os campos recebidos. O botão **Salvar CFG manualmente** permanece disponível como alternativa.

Se não receber dados, consulte [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

**Atenção:** a integração GSI é uma API de publicação local de estado, não autoriza usar ferramentas que forneçam vantagens indevidas. O comportamento do jogo, a disponibilidade dos campos e as políticas da Valve podem mudar. Não há promessa de compatibilidade com partidas competitivas ou anti-cheat. Teste inicialmente fora de partidas ranqueadas.

## Arquitetura

```text
Dota 2 (publica GSI por HTTP)
  -> 127.0.0.1:3199/gsi
  -> electron/gsi.ts (validação de token, normalização)
  -> electron/main.ts (estado de sessão + janela e IPC autorizados)
      -> electron/preload.ts (contextBridge restrito)
          -> src/components/Dashboard.tsx (painel)
          -> src/components/Overlay.tsx (janela transparente)
```

Mais detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [docs/ROADMAP.md](docs/ROADMAP.md).

## Segurança e privacidade

- O serviço GSI aceita **apenas conexões de loopback** (`127.0.0.1`) e `POST /gsi`.
- Autenticação por token de 48 caracteres hexadecimais. O token não deve ser publicado no GitHub.
- Limite de entrada de 1 MB por payload; nenhum pedido executa código do jogo.
- Electron configurado com `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` e APIs IPC explícitas.
- O botão para salvar config usa seletor de arquivo e não altera instalações do Dota automaticamente.
- Não existe coleta de informações de outros jogadores em gameplay nem `allplayers` na configuração fornecida.

## Direitos e integridade competitiva

Implementação original e independente, baseada em documentação pública e em requisitos funcionais observáveis. O projeto **não inclui** código, imagens, sons, marcas ou elementos proprietários de terceiros. Não contorna licenças, DRM, mecanismos anticheat, mecanismos de jogo nem autenticação. Não há integrações para leitura de memória, visão de wards ocultas, automação, input injection ou dados indisponíveis ao jogador.

**Open source não equivale a aprovação da Valve**. Antes de distribuir ou utilizar durante partidas competitivas, valide a política atual do Dota 2/Steam e as restrições do modo em questão. [Valve: Fair play/cheats](https://www.dota2.com/newsentry/3677788723152833273) · [Steam VAC](https://help.steampowered.com/en/faqs/view/571A-97DA-70E9-FF74)

## Licença

MIT para o código original deste repositório: veja [LICENSE](LICENSE). Licenças das dependências de terceiros continuam válidas. O Dota 2 e seus ativos pertencem aos seus respectivos titulares.
