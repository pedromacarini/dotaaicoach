# Fase 1 — Editor completo do overlay

Implementado em 2026-10-19 sobre Electron 37.x.

## Decisões

- `AppPreferences` usa schema 2. A migração preserva `position` de arquivos antigos e recupera campos inválidos individualmente.
- `electron/overlay-window.ts` é o módulo profundo do layout nativo. A interface do renderer contém apenas intenções tipadas; bounds, área útil, opacidade, resize, foco e click-through permanecem no processo main. A transformação visual de escala fica isolada no elemento raiz do renderer do overlay.
- A escala proporcional vai de 75% a 175%, mantendo a razão fixa de `430:314`; largura e altura independentes não fazem parte desta fase. A opacidade vai de 35% a 100%. Coordenadas usam pixels lógicos (DIP) do Electron.
- Se uma área útil sintética for menor que 75%, o módulo usa uma escala efetiva transitória para caber sem sobrescrever a preferência válida; ao voltar a um monitor normal, a escala escolhida retorna.
- Mudanças são aplicadas incrementalmente e persistidas de forma atômica após debounce. Posição/tamanho vindos do arrasto também passam pela mesma validação.
- O modo de edição é transitório e nunca persiste. Ao concluir ou reiniciar, o overlay volta a ser não focável e click-through.
- A documentação oficial informa que janelas transparentes não suportam resize nativo de forma confiável. Por isso a edição usa uma alça própria que envia somente a escala validada ao módulo nativo; não habilitamos o resize de borda incompatível.
- `locked` bloqueia arrasto e resize durante a edição; não muda a garantia de click-through fora dela.
- A janela é contida na `workArea` do monitor correspondente e reconciliada em adição, remoção ou mudança de métricas de displays.
- Ocultar pelo painel ou `Ctrl+Shift+F9` encerra a edição antes de esconder. Saída/crash do renderer também força estado não focável, click-through e invisível.
- Escala visual é aplicada somente no elemento raiz do overlay via CSS. Não usamos `webContents.setZoomFactor`, evitando compartilhar zoom com outra página da mesma origem/session.

## Electron consultado

As assinaturas foram verificadas no `electron/electron.d.ts` instalado (37.x) e correspondem à documentação oficial:

- [`BrowserWindow.setBounds`](https://www.electronjs.org/docs/latest/api/browser-window#winsetboundsbounds-animate-macos)
- [`BrowserWindow.setOpacity`](https://www.electronjs.org/docs/latest/api/browser-window#winsetopacityopacity-windows-macos)
- [`BrowserWindow.setIgnoreMouseEvents`](https://www.electronjs.org/docs/latest/api/browser-window#winsetignoremouseeventsignore-options)
- [`BrowserWindow.setFocusable` e `setResizable`](https://www.electronjs.org/docs/latest/api/browser-window)
- [Limitações oficiais de janelas transparentes](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles#limitations)
- [`screen.getDisplayMatching` e eventos de display`](https://www.electronjs.org/docs/latest/api/screen)

Limitação conhecida: overlays transparentes podem não aparecer sobre fullscreen exclusivo. Para teste real, usar janela sem bordas.

## Verificação

- Testes puros: migração tolerante, validação, debounce e clamp por área útil.
- Smoke Electron em duas execuções: aplica posição/escala/opacidade/módulos, alterna edição, testa hide e saída do renderer, conclui em estado não focável e confirma restauração após reinício.
- Smoke de módulos ocultos confirma zero catálogos dinâmicos, zero requests de recomendação e documento/root realmente transparentes.
- Inspeção manual recomendada em escala do Windows 100%, 125% e 150%, incluindo mover entre monitores quando disponível.
