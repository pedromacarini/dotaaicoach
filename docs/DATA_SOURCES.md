# Fontes de dados e licenciamento

## Catálogos públicos

- **OpenDota / dotaconstants** — fonte para heróis, itens, habilidades, vínculos herói-habilidade, talentos, habilidades neutras e auxiliares (https://github.com/odota/dotaconstants). A implementação do pacote é licenciada sob MIT: consulte https://github.com/odota/dotaconstants/blob/master/LICENSE e preserve os avisos de copyright aplicáveis.
- O programa usa a dependência `dotaconstants` instalada via npm para gerar os próprios índices com `npm run data:sync`. O ZIP do projeto **não carrega o banco completo pré-gerado**. A sincronização local cria os JSONs (sem necessitar de credencial de API).
- As descrições, personagens, nomes comerciais, imagens e demais materiais do **Dota 2 pertencem aos respectivos titulares**. Uma licença MIT do código de coleta não autoriza uso irrestrito de toda a propriedade intelectual do jogo. Não incluímos as imagens oficiais no pacote.
- Os dados OpenDota podem estar defasados em relação a um patch recente. `manifest.json` registra a versão do pacote e o último patch anunciado na própria fonte, sem alegar que seja o patch atual.
- Não importamos fontes que exigem login, assinatura, tokens privados ou cópia de conteúdo de outro overlay.

## Comandos

```powershell
npm.cmd install
npm.cmd run data:sync
npm.cmd run data:check
npm.cmd run dev
```

Para buscar nova versão publicada da fonte:

```powershell
npm.cmd run data:update
```

Verifique as mudanças de patch e a qualidade dos dados após cada atualização; a fonte nem sempre acompanha a atualização do jogo imediatamente. Os JSONs gerados não devem ser tratados como informações ocultas da partida.

## GSI de partida

Os dados de estado de jogo são fornecidos por **Dota 2 Game State Integration**, via HTTP local, separados dos catálogos estáticos. O aplicativo não extrai dados de memória, intercepta o tráfego do Dota nem controla o personagem.

Exemplo da API GSI de terceiros (não é um serviço de coleta a ser embutido): https://github.com/xzion/dota2-gsi

## Limites funcionais

- *Itens / habilidades / heróis*: catálogo geral disponível após sincronizar a fonte, com condições de patch.
- *Contador de farm / patrimônio*: calculado/exibido somente quando o GSI realmente fornece os campos para o jogador local.
- *Itens populares e confrontos*: consultados automaticamente na API pública OpenDota e mantidos em cache local por 30 minutos. Se uma atualização falhar, o servidor pode servir o último valor expirado com aviso explícito de indisponibilidade, em vez de apagar o guia.
- *Builds e skills por posição*: amostra de partidas profissionais recentes obtida pelo Explorer do OpenDota; inventários vêm das partidas e sequências de habilidades somente de replays detalhados. A interface sempre mostra tamanho da amostra, patch e origem.
- As rotas de skills/build e itens são independentes: falha ou timeout em uma delas preserva a resposta da outra e o último payload válido em memória. O proxy usa timeout de 20 segundos por chamada; recomendações podem envolver uma consulta Explorer seguida de detalhes de replays.
- *Ward inimiga não revelada, farm de inimigos ocultos, posição de jogadores sem visão*: não estão disponíveis legitimamente pelo GSI de jogador local. Não serão inferidos nem adicionados como informação oculta.
