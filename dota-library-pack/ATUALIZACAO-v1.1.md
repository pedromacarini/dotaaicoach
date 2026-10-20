# Dota Open Library — atualização v1.1

Corrige a ligação entre as imagens dos catálogos e a interface independente, sem copiar dados proprietários do Aura.

## Mudanças

- Habilidades e talentos de cada herói agora recebem suas referências de ícones do catálogo `abilities`.
- Clique em uma habilidade/talento para abrir sua ficha técnica.
- `generic_hidden` deixa de ocupar espaço na lista principal de habilidades de heróis.
- Nomes da fonte com marcadores internos, como `-{s:bonus_AbilityCooldown}`, passam a usar uma representação legível derivada do identificador, sem inventar tradução.
- Seção de habilidades diferencia talentos técnicos das habilidades normais e permite exibir técnicos explicitamente.
- As habilidades neutras recebem campos descritivos apenas quando esses dados existem no catálogo geral.
- O visualizador usa o `image-manifest.json` para mostrar placeholders para imagens não coletadas, evitando repetir indefinidamente downloads malsucedidos.
- O gerador confirma assinaturas de arquivos de imagem, preserva arquivos válidos já baixados e registra falhas em `data/reports/download-summary.json`.
- O baixador tenta a referência fornecida pela base e, quando plausível, um caminho alternativo nos CDNs do Dota 2. **Não há garantia de disponibilidade de todas as imagens.**

## Instalação no Windows (PowerShell)

1. **Pare** o servidor de visualização atual pressionando `Ctrl+C` no terminal.
2. Faça uma cópia dos scripts e da interface atual antes de substituir.
3. Extraia o ZIP desta atualização em `C:\Projetos\dota-open-overlay`, mesclando a pasta `dota-library-pack`.

**O ZIP não contém nem altera `dota-library-pack/data`** — as imagens salvas permanecem na mesma pasta.

### Atualizar catálogos sem baixar nada novamente

```powershell
cd C:\Projetos\dota-open-overlay
node .\dota-library-pack\scripts\build-library.cjs
```

Isso atualiza os catálogos, relaciona ícones e habilidades e identifica as imagens locais já existentes (`cached`).

### Abrir o visualizador

```powershell
node .\dota-library-pack\scripts\serve-library.cjs
```

Acesse `http://127.0.0.1:3198/` e pressione `Ctrl+F5` para ignorar o cache do navegador.

### Tentar recuperar as imagens que faltam (opcional)

Pare o servidor ou abra outro terminal e execute:

```powershell
node .\dota-library-pack\scripts\build-library.cjs --retry-missing --timeout=8000 --concurrency=3
```

Este comando respeita os arquivos existentes. Pode levar vários minutos e algumas URLs podem continuar indisponíveis (HTTP 404, conteúdo ausente ou limites da rede). Para conferir os motivos das falhas, veja `data/reports/download-summary.json` e `data/reports/missing-images.json`.

### Testes do gerador

```powershell
node --test .\dota-library-pack\tests\smoke.test.cjs
```

Os testes utilizam amostras artificiais de dados e uma simulação de download, sem ler ou alterar sua biblioteca instalada.

## Fonte e direitos

A implementação usa os dados publicados pela biblioteca `odota/dotaconstants` instalada localmente. Dados e imagens do jogo podem estar desatualizados, e imagens/conteúdo do Dota 2 permanecem sujeitos aos direitos dos respectivos titulares. Os testes automatizados não comprovam o download real de todas as imagens nem substituem uma validação visual no Windows.
