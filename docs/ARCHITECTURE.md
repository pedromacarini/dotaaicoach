# Arquitetura técnica — 0.1.0

## 1. Contexto e origem do escopo

Estudo técnico baseado em uma análise de grafo do aplicativo Electron de referência. O artefato original inclui inúmeros módulos de terceiros e nós de análise; seu inventário mostrou caminhos como `gsi-server`, `overlay-visibility`, `match-tracker`, `notification-engine`, `overlay-settings`, `item-tracker` e `farm-route`. **A existência de tais nomes não comprova a funcionalidade, o algoritmo nem a conformidade das operações**. O desenvolvimento aqui descrito foi realizado de modo independente, sem incorporar arquivos ou código de terceiros.

## 2. Domínios

| Camada | Responsabilidade | Implementação atual |
|---|---|---|
| Entrada | Receber mensagens GSI locais autenticadas | `electron/gsi.ts` |
| Normalização | Dados incompletos/faltantes sem inferir observações ocultas | `normalizeGsi` |
| Sessão | Guardar última amostra e sinalizar timeout | `electron/main.ts` |
| Segurança | Renderer isolado, IPC explícito, nenhuma API Node genérica | `electron/preload.ts` |
| Desktop | Aplicação, clamp e interação da janela de overlay | `electron/overlay-window.ts` |
| Cronograma | Regras locais, scheduler por relógio, banners e áudio | `src/core/notification-scheduler.ts`, `electron/notification-center.ts` |
| Renderização | Painel, overlay, demonstração | `src/components/` |

## 3. Fluxos

```text
Dota 2 -> POST /gsi -> [limite 1 MB] -> [token] -> [normalização]
                                                 -> Snapshot tipado
                                                 -> main Electron
                                                 -> IPC somente do main para a UI
                                                 -> painel + overlay
```

`GameSnapshot` contém campos explicitamente disponíveis ao usuário local, com `null` para ausência. A análise não lê memória, não injeta módulos e não captura tráfego de terceiros.

## 4. Separação de confiança

- Serviço HTTP **local e autenticado**. A origem de qualquer campo é o JSON postado ao endpoint; não se supõe integridade contra outros programas na mesma máquina.
- API do preload tipada expõe somente operações explícitas. Preferências de layout atravessam IPC validado; nenhum renderer recebe `BrowserWindow`, filesystem ou Electron genérico.
- Comandos mutáveis de controle passam por verificação de origem **da janela do painel**.
- A janela de overlay ignora eventos de mouse por padrão. Ela recebe foco/mouse somente durante o modo transitório de edição e volta ao click-through ao concluir.
- O token permanece no perfil do usuário; nunca armazená-lo em issue ou commit.

## 5. Decisões de implementação e limitações

- Usamos `http` do Node nativo para evitar dependências externas no listener.
- `BrowserWindow` transparente no Windows pode **não** sobrepor um jogo em fullscreen exclusivo; preferir modo janela sem bordas. Composição e comportamento variam conforme driver/versão.
- O GSI pode disponibilizar campos diferentes em lobby, jogo, replay ou modo espectador; ausência de campo **não** é valor zero.
- Este MVP não detecta morte de Roshan, visão inimiga, posicionamento de wards, rotas perfeitas de farm ou recomendações automáticas em partida.
- A opção `allplayers` não é solicitada; fontes públicas e estatísticas pós-partida serão avaliadas separadamente.

## 6. Módulos futuros (ainda não implementados)

`core/post-match`: análise de dados de partidas encerradas; `core/builds`: catálogo independente e versões por patch; `core/adapters`: adaptadores para fontes oficiais/publicamente licenciadas; `core/replay`: captura de snapshots de teste apenas com opt-in, sem dados privados. O cronograma e o editor de overlay já deixaram esta lista e possuem módulos próprios.
