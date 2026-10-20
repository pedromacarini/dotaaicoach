# Dota Open Library v1.5 — Enciclopédia + planejador de builds

Atualização **independente, offline-first** para a biblioteca do projeto `dota-open-overlay`. Não reutiliza código do Aura e não acessa memória ou informações ocultas do Dota 2.

## O que mudou de verdade

- Interface renovada em HTML/CSS/JS (sem instalar React, Vite ou dependências novas).
- A ficha do herói abre **automaticamente** ao escolher a aba Heróis. Inclui retrato, atributos, papéis, habilidades, talentos, facetas, Scepter, Shard e história **quando presentes nos catálogos**.
- Habilidades mostram **ícone local, descrição, recarga, mana e atributos** quando disponíveis. Clicar abre a ficha individual; há opção para reencontrar o herói relacionado.
- Itens mostram receita e componentes clicáveis; neutros mostram os detalhes disponíveis no catálogo.
- Busca e filtros de imagens ausentes; suporte aos ícones extraídos localmente do VPK.
- **Minha build:** seis espaços de inventário e até 18 níveis de habilidades; perfis independentes para Carry, Mid, Offlane, Suporte 4 e Suporte 5. As escolhas são **manuais**, não recomendações calculadas. Salvas em `localStorage` do navegador usado em `127.0.0.1:3198` e exportáveis como texto via botão **Copiar meu guia**.
- **Itens populares:** consulta explícita, sob demanda, à API pública do OpenDota. Retorna frequências por fase (inicial, início, meio e fim) agregadas de partidas profissionais analisadas pela fonte. **Não** segmentadas por posição.
- **Confrontos:** consulta sob demanda ao OpenDota, filtragem por amostra mínima e classificação de confrontos difíceis/favoráveis.
- **Dota2ProTracker:** ligação direta para a ficha de cada herói. **Nenhum dado do Dota2ProTracker é copiado/importado.**
- Proxy de API só de leitura, com cache por 30 minutos, timeout de 11 segundos e aviso de erro/limite.

## Instalação — Windows PowerShell

1. No PowerShell em que a biblioteca está rodando, tecle `Ctrl+C`.
2. Opcionalmente faça cópia da interface anterior:

   ```powershell
   Copy-Item 'C:\Projetos\dota-open-overlay\dota-library-pack\viewer' "$env:USERPROFILE\Desktop\dota-viewer-backup" -Recurse -Force
   ```

3. Extraia `dota-open-library-v1.5-completa.zip` em **`C:\Projetos\dota-open-overlay`**, confirmando a substituição dos arquivos **dentro** de `dota-library-pack`. O ZIP **não inclui a pasta `data`** e não apaga as imagens VPK já recuperadas.
4. Execute:

   ```powershell
   cd C:\Projetos\dota-open-overlay
   node .\dota-library-pack\scripts\consolidate-library.cjs
   node .\dota-library-pack\scripts\serve-library.cjs
   ```

5. Abra `http://127.0.0.1:3198/` e aperte `Ctrl+F5`. Verifique o rodapé `v1.5`.

## Navegação

- **Heróis → Visão geral:** habilidades, talentos, facetas e atributos.
- **Heróis → Itens populares:** clicar em **Carregar OpenDota**; requer internet, retorna frequência de itens, **não uma build por posição**.
- **Heróis → Confrontos:** clicar em **Carregar OpenDota**; requer internet.
- **Heróis → Minha build:** escolher posição, clicar num item para adicionar até seis, escolher a habilidade e clicar num nível, copiar o guia se desejar. Clicar num item ocupado o remove; clicar de novo na habilidade do nível limpa a seleção.
- **Dota2ProTracker:** abre no navegador a página do herói; pesquisa avançada e builds automáticas por posição permanecem lá, não são dados importados.

## Diagnóstico

```powershell
node .\dota-library-pack\scripts\test-v1.5.cjs
```

Se faltar imagem, confira `data\reports\image-health.json` e rode o consolidator. **Não execute o `build-library.cjs` sem necessidade**: ele reconstrói catálogos e pode mudar manifestos, embora preserve PNGs.

Se o servidor disser que a porta está ocupada, encerre a janela anterior; a v1.5 mantém por padrão `127.0.0.1:3198`.

## Fontes e limites

- Catálogos: `odota/dotaconstants`, versão local (`10.8.0` no último registro do projeto). Podem divergir do patch corrente.
- Dados de partidas: endpoints oficiais e públicos `heroes/{id}/itemPopularity` e `heroes/{id}/matchups`, consultados **somente ao clicar**. Podem sofrer limites, indisponibilidade ou mudanças; o site exibe quando foram consultados.
- Dota2ProTracker: **somente links** de consulta manual. Nenhuma coleta automatizada ou replicação de dados.
- Imagens Dota 2 são materiais de seus titulares. Licenças de código aberto de ferramentas ou dados **não** licenciam as artes da Valve.

Projeto independente, sem afiliação com Valve, OpenDota ou Dota2ProTracker.
