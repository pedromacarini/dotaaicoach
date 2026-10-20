# 13 - Engenharia Ajuda Agent

Padroniza botoes e paginas de ajuda das calculadoras em `/engenharia`.

---

## Quando usar

Use sempre que o pedido envolver:

- botao `Ajuda`;
- pagina `ajuda-importacao.html`;
- instrucoes de importacao por Excel, Archicad ou tabela copiada;
- imagens de referencia, criterios de exportacao ou mapa de componentes;
- lightbox/pop-up para ampliar imagens de ajuda.

Se a ajuda estiver dentro de uma calculadora nova, use junto com `14-engenharia-calculadora-agent.md`.
Antes de entregar, use `15-engenharia-qa-agent.md`.

---

## Objetivo

Garantir que todas as ajudas tenham o mesmo padrao de abertura, visual, imagens e explicacao. O conteudo muda por calculadora; a experiencia nao.

---

## Referencias aprovadas obrigatorias

Use estes arquivos como fonte de verdade antes de criar ou alterar ajuda:

- Ajuda de importação com imagens, lightbox e `Fechar aba`: `engenharia/esquadrias/ajuda-importacao.html`.
- Ajuda de importação BIM/Archicad para paredes: `engenharia/paredes/ajuda-importacao.html`.
- Modal de importação com botão `Ajuda` dentro do fluxo: `engenharia/esquadrias/calculadora-esquadrias.js`, função/renderização do modal de importação.
- Modal de importação de paredes: `engenharia/paredes/calculadora-paredes.js`, função `openImportModal`.
- Estilo global de lightbox aprovado: `engenharia/core/styles.css`, seletores `.image-lightbox`, `.image-lightbox-dialog`, `.image-lightbox-close`, `.image-lightbox-backdrop`.
- Assets obrigatorios de identidade: `engenharia/core/logo-calculadora.png` e `engenharia/core/fundo.png`.

Regra de escolha:

- ajuda de tabela/Excel/Archicad: partir de `engenharia/esquadrias/ajuda-importacao.html`;
- ajuda BIM com critérios técnicos extensos: partir de `engenharia/paredes/ajuda-importacao.html`;
- lightbox em calculadora: reaproveitar padrão de `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, funções `ensureLightbox`, `openLightbox`, `closeLightbox`.

---

## Padrao obrigatorio

- Botao `Ajuda` fica dentro do modal ou fluxo ao qual se refere.
- Quando for ajuda de importacao, o botao fica dentro de `Importar tabela`.
- Abrir em nova aba HTML.
- Header deve seguir identidade de `/engenharia/core`.
- Usar `/engenharia/core/logo-calculadora.png` quando couber.
- Usar `/engenharia/core/fundo.png` como marca d'agua discreta quando couber.
- Botao `Fechar aba` deve ficar no topo direito da folha/conteudo, nao perdido no canto da tela.
- Botao `Fechar aba` usa `window.close()`.
- Nao mostrar botao `Imprimir / Salvar PDF` na ajuda, salvo pedido explicito.
- Imagens de ajuda devem abrir ampliadas em lightbox quando clicadas.
- Imagens devem ter legenda curta e util.
- Nao deixar imagens pequenas demais quando sao referencia operacional.
- Nao gerar barra de rolagem interna desnecessaria em modal.

---

## Estrutura recomendada

- Titulo da ajuda.
- Resumo do que a pessoa vai fazer.
- Criterios no software de origem, quando houver.
- Imagem dos criterios.
- Dados a copiar.
- Dados a colar.
- Modos de importacao.
- Alertas comuns.
- Conferencia apos importar.

### Ajuda BIM / IFC

- Ajuda de IFC deve explicar a fase atual com precisão: diagnóstico do arquivo `.ifc`, entidades reconhecidas, propriedades/quantidades encontradas e limites da conversão automática.
- Não prometer cálculo automático de geometria IFC sem validação com arquivos reais.
- Quando houver importação por tabela e leitura IFC na mesma calculadora, separar visualmente:
  - `IFC`: diagnóstico, GUIDs, entidades, propriedades e quantidades disponíveis;
  - `Tabelas`: caminho conferido para adicionar sapatas, blocos, vigas e lajes ao cálculo.
- Se houver imagens de exportação BIM/Archicad, manter uma seção por tipo de estrutura e lightbox em todas as imagens.
- Botão `Ajuda` do modal de importação estrutural deve abrir a página da própria calculadora, por exemplo `/engenharia/bim-estruturas/ajuda-importacao-estrutura.html`.

---

## Imagens

- Imagens da calculadora ficam em `engenharia/<slug>/imagem/` ou `engenharia/<slug>/imagens/`, respeitando a pasta ja usada pela calculadora.
- Nao mover imagens existentes sem atualizar todos os caminhos.
- Para imagem nova, conferir nome exato, extensao e caixa alta/baixa.
- Lightbox deve funcionar para todas as imagens de referencia da ajuda.

---

## Comparar antes de editar

```powershell
rg -n "ajuda-importacao|data-lightbox-image|helpImageLightbox|image-lightbox|Fechar aba|Importar tabela|Ajuda" engenharia
```

Comparar com ajudas ja aprovadas antes de alterar:

- `engenharia/esquadrias/ajuda-importacao.html`;
- `engenharia/paredes/ajuda-importacao.html`;
- outras que vierem depois.

Se o pedido nao for para redesenhar ajuda, manter estrutura visual e trocar apenas conteudo, imagens e textos especificos.

---

## Checklist de entrega

- [ ] Ajuda abre em nova aba.
- [ ] `Fechar aba` funciona.
- [ ] Botao esta no lugar certo do fluxo.
- [ ] Imagens carregam.
- [ ] Imagens ampliam em lightbox.
- [ ] Textos explicam copiar/colar/importar sem linguagem de briefing.
- [ ] Nao houve mudanca no calculo da calculadora.
- [ ] Layout sem barra interna feia ou corte de botoes.
> Contexto DotaIACoach: leia agents/DOTA-IACOACH-CONTEXT.md antes de executar este playbook.

