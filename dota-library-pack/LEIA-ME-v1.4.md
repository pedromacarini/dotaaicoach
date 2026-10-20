# Dota Open Library — v1.4 (Consolidação + Visual)

## O que este pacote altera

- Substitui **somente** `dota-library-pack/viewer/index.html`.
- Acrescenta `dota-library-pack/scripts/consolidate-library.cjs`.
- Não altera `build-library.cjs`, `recover-vpk-icons.cjs`, `audit-images.cjs` ou `serve-library.cjs`.
- Não contém nem apaga `data/`, imagens recuperadas do VPK ou arquivos do Dota 2.

## Instalar (Windows / PowerShell)

1. Encerre o servidor anterior com Ctrl+C. Faça um backup da pasta `dota-library-pack/viewer` se já a personalizou.
2. Extraia este ZIP em `C:\Projetos\dota-open-overlay`, preservando a estrutura `dota-library-pack/` e permitindo substituir `viewer/index.html`.
3. Rode:

```powershell
cd C:\Projetos\dota-open-overlay
node .\dota-library-pack\scripts\consolidate-library.cjs
node .\dota-library-pack\scripts\serve-library.cjs
```

4. Abra `http://127.0.0.1:3198/` e pressione Ctrl+F5 para evitar cache do navegador.

## Saídas da consolidação

Em `dota-library-pack/data/reports/`:

- `image-health.json`: situação de **cada arquivo** após conferir assinatura e tamanho do arquivo existente.
- `missing-images-current.json`: arquivos que ainda não estão disponíveis, incluindo registros inválidos.
- `missing-images-current.csv`: lista para abrir no Excel, com categoria, heróis associados e erro anterior.

Os relatórios são atualizados; imagens e manifestos originais permanecem intactos.

**Importante:** o total pode não ser simplesmente 1.805 + 51. Um mesmo ícone pode ser referenciado duas vezes, por exemplo em `abilities/` e `neutral-abilities/`. A auditoria conta **arquivos/referências do manifesto** efetivamente presentes.

## Novidades no visualizador

- Indicadores de heróis, itens, habilidades, neutros e cobertura local de imagens;
- Filtros para mostrar todos os registros, apenas os que têm ícone, ou os que ainda não têm;
- Paginação incremental (100 registros por vez) para evitar travamentos com mais de 3 mil habilidades;
- Cartões com imagem, recarga, mana e resumo das habilidades; talentos e facetas organizados;
- Link manual para a ficha de cada herói no Dota2ProTracker;
- Melhor tratamento de ícones não disponíveis, sem downloads automáticos pelo navegador;
- Voltar à ficha do herói depois de abrir uma habilidade.

## Fonte e licenças

- Dados estáticos: `odota/dotaconstants`, versão que já está instalada no projeto.
- Imagens: conteúdo do Dota 2; a licença MIT do código desta ferramenta não atribui licença às imagens da Valve.
- Dota2ProTracker: o visualizador apenas abre o site em uma nova aba; **não faz scraping, API calls, cópias nem redistribuição de estatísticas**. O uso automatizado dos dados para construir aplicações é proibido pelos termos públicos do site sem autorização. Consulte https://dota2protracker.com/terms-of-service.
- Este visualizador ainda não é overlay; o catálogo funciona sem o jogo aberto e sem consultar memória/processos do Dota 2.

## Se precisar atualizar depois de novos ícones VPK

Execute `node .\dota-library-pack\scripts\consolidate-library.cjs` novamente. Não é necessário refazer downloads ou rodar o gerador da biblioteca.
