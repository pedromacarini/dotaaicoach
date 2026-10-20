# Dota Open Library — auditoria e recuperacao seletiva de imagens (v1.2)

Esta atualizacao **nao substitui** o gerador `build-library.cjs`, nem o visualizador. Ela acrescenta uma ferramenta complementar para investigar o relatorio `data/reports/missing-images.json`.

## Diagnostico do arquivo enviado

- 358 referencias de imagem falharam; sao **332 chaves unicas**.
- 332 estao em `abilities`; 26 referencias extras estao em `neutral-abilities` — **todas as 26 chaves dos neutros aparecem tambem em abilities**.
- O ultimo erro registrado em todas as entradas e **HTTP 404**, nao timeout.
- Nenhuma falha esta nas categorias de herois ou itens.
- `generic_hidden`, habilidades de eventos, acoes internas e muitas habilidades de personagens requerem tratamentos diferentes; nem sempre existe um icone exclusivo.

## Instalar

Copie o conteudo do ZIP para `C:\Projetos\dota-open-overlay`, preservando a pasta `dota-library-pack\data`.

Em PowerShell:

```powershell
cd C:\Projetos\dota-open-overlay
node .\dota-library-pack\scripts\audit-images.cjs
```

O comando nao acessa a internet e gera:

- `dota-library-pack/data/reports/image-audit.csv` — 332 habilidades unicas classificadas por prioridade, com os nomes dos herois relacionados.
- `dota-library-pack/data/reports/image-audit.json` — mesmas informacoes e resumo numerico.

A ferramenta cruza o relatorio com **a versao instalada** `dota-library-pack/data/raw/hero_abilities.json`, logo reflete as relacoes do teu pacote e nao um patch arbitrario da internet.

## Recuperacao experimental, sem repetir o download geral

O comando abaixo tenta **somente 20 habilidades prioritarias** usando formatos historicos de imagens da Valve (`_md.png`, `_lg.png`, `_hp2.png`). E possivel que essas URLs tambem retornem 404; trata-se de uma tentativa, nao garantia de recuperacao.

```powershell
node .\dota-library-pack\scripts\audit-images.cjs --recover --limit=20
```

Os resultados serao exibidos no terminal e salvos em `data/reports/image-recovery.json`.

Se recuperar algo, a ferramenta atualiza os manifestos e salva os PNGs na estrutura existente **sem apagar os 1.805 arquivos originais**. Quando uma imagem recuperada se aplica tanto a `abilities` quanto a `neutral-abilities`, grava as duas referencias locais.

Para continuar com mais casos:

```powershell
node .\dota-library-pack\scripts\audit-images.cjs --recover --limit=80
```

**Observacao:** o comando de limite 80 inclui novamente os primeiros 20, mas cada arquivo encontrado e preservado; evite repeticao frequente de consultas que retornaram 404. O script nao modifica o `dotaconstants` nem inspeciona o Aura.

## Instrucoes posteriores

Quando concluir, atualize o navegador do visualizador com `Ctrl+F5`, sem executar o gerador `build-library.cjs` outra vez. Se o gerador for executado, imagens validas recuperadas continuam no cache e serao reconhecidas.

Arte e conteudo visual da Valve permanecem sujeitos aos direitos dos seus titulares e nao sao sublicenciados pelo MIT do codigo da ferramenta.
