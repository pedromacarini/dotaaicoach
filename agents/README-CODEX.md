# Playbooks do DotaIACoach

O contexto específico deste produto está em [`DOTA-IACOACH-CONTEXT.md`](DOTA-IACOACH-CONTEXT.md). Os playbooks abaixo são checklists adaptáveis; instruções de Vercel, Supabase, engenharia civil e site comercial não se aplicam a este repositório.

Os arquivos desta pasta nasceram como agentes separados para uma esteira de criação de sites. No Codex, eles devem ser usados como checklists especializados, não como uma obrigação de trocar de agente a cada etapa.

## Mapa rapido

- Playbooks desta pasta: `agents/`
- Metodo global de coding: [`00-coding-method-agent.md`](00-coding-method-agent.md)
- Skills locais do projeto: [`.agents/skills/README.md`](../.agents/skills/README.md)
- Config local Ruflo/Codex: [`.agents/config.toml`](../.agents/config.toml)

## Comunicação curta

Usar skill `caveman` para falar com o usuário:

- respostas curtas;
- sem filler;
- sem explicar demais;
- resumo do que foi feito;
- links/arquivos só quando úteis.

Não usar esse estilo nos materiais finais dos clientes. Proposta, contrato, briefing, copy e página publicada continuam com linguagem profissional completa.

Skill local:

- [`.agents/skills/caveman/README.md`](../.agents/skills/caveman/README.md)

## Modo recomendado

1. Abra `00-coding-method-agent.md` e defina escopo, criterios de aceite, arquivos protegidos e loop de validacao.
2. Identifique a etapa do pedido do usuario.
3. Abra o playbook correspondente.
4. Use as regras e o formato de entrega como checklist.
5. Execute a tarefa diretamente no workspace.
6. Revise por padrao e especificacao, valide e entregue um resumo curto.

## Regras obrigatórias de execução

- Todo pedido do usuário deve começar com consulta ao playbook/agente aplicável em `agents/`.
- Para alteração simples, usar o playbook direto da área: frontend, integração, deploy, QA etc.
- Para alteração em 3+ arquivos, banco/API/admin/deploy, fluxo operacional ou risco visual, consultar também `10-qa-review-agent.md`.
- Não mudar padrão por iniciativa própria. Proibido alterar visualização, layout, agrupamento de dados, nomes de botões, fluxo, cálculo, permissões ou ordem de tela sem pedido explícito.
- Não remover botão, campo, seção, modo manual ou controle existente sem pedido explícito.
- Se algo parecer redundante ou melhor de outro jeito, manter como está e perguntar antes.
- Se a tarefa pedir lógica/cálculo, não redesenhar tela sem solicitação.
- Se a tarefa pedir visual, não mudar regra de cálculo sem solicitação.
- Em calculadoras, antes de mexer em cards, colunas, tabelas, botões ou painel lateral, comparar com uma calculadora já aprovada e preservar `calc-shell`, `calc-editor`, `calc-results`, `form-card`, `result-card`, `quick-actions`, modais e memoriais.
- O primeiro bloco da coluna direita deve seguir `engenharia/paredes/calculadora-paredes.js::renderSummary`: `form-card blue`, `Resumo`, `Resultados gerais`, `result-grid` e `result-card`.
- Para qualquer tarefa em `/engenharia`, usar os agentes específicos quando couber:
  - `12-engenharia-memorial-a4-agent.md` para `Memorial A4`, impressão, PDF, logo/fundo A4 e textos de memorial;
  - `13-engenharia-ajuda-agent.md` para botão `Ajuda`, importação, imagens de referência e lightbox;
  - `14-engenharia-calculadora-agent.md` para criação/ajuste de calculadora, colunas, cards, tabelas, botões, quantitativos, orçamento e Supabase;
  - `15-engenharia-qa-agent.md` como conferência final antes de entregar qualquer mudança em `/engenharia`.
- Tabela larga não deve ser jogada em coluna lateral estreita. Conferir overflow, largura de cards, sticky e sobreposição visual antes de entregar.

## Modo Ruflo sem instalar às cegas

Adotar o modelo mental do Ruflo:

```txt
Ruflo/claude-flow = coordenação, memória, roteamento e swarm.
Codex = execução real: editar arquivo, rodar teste, commitar, publicar.
```

Se Ruflo estiver disponível, ele pode ajudar antes de tarefas grandes:

```powershell
npx ruflo@latest hooks route --task "descreva a tarefa"
npx ruflo@latest swarm init --topology hierarchical --max-agents 8
npx ruflo@latest memory search --query "padrão parecido"
```

Não é obrigatório. Não rodar `npx ruflo init`, não criar `.claude-flow/`, não instalar hooks globais e não alterar configuração global do Codex/Claude sem pedido explícito.

Use swarm quando:

- 3+ arquivos serão alterados;
- houver novo cliente/esteira completa;
- banco, Storage, API e admin entrarem juntos;
- tiver risco de segurança, deploy ou QA amplo;
- houver refatoração cruzada.

Ignore swarm quando:

- ajuste for em um único arquivo;
- for texto simples;
- for correção pequena;
- for pergunta/diagnóstico sem implementação.

## Mapa Ruflo dos playbooks

| Playbook | Papel Ruflo equivalente |
|---|---|
| `00-coding-method-agent.md` | coding method / verification gate |
| `01-briefing-diagnostico-agent.md` | researcher |
| `02-estrategia-escopo-agent.md` | planner |
| `03-referencias-mercado-agent.md` | researcher |
| `04-copy-seo-agent.md` | content strategist |
| `05-ux-ui-agent.md` | architect |
| `06-frontend-agent.md` | coder |
| `07-integracoes-agent.md` | integration engineer |
| `08-git-github-agent.md` | release manager |
| `09-vercel-deploy-agent.md` | deployment engineer |
| `10-qa-review-agent.md` | reviewer |
| `11-entrega-cliente-agent.md` | delivery manager |
| `12-engenharia-memorial-a4-agent.md` | engineering memorial reviewer |
| `13-engenharia-ajuda-agent.md` | engineering help reviewer |
| `14-engenharia-calculadora-agent.md` | engineering calculator architect |
| `15-engenharia-qa-agent.md` | engineering QA gate |
| `17-arquitetura-agent.md` | architecture mapping and change evidence, when needed |

## Autonomia já autorizada

Para `C:\projetos\site-nick\devpedrao-site`, o usuário autorizou o Codex a executar o fluxo completo de publicação sem nova pergunta de rotina:

- editar arquivos;
- commitar;
- dar push em `main`;
- deixar o auto deploy GitHub -> Vercel seguir como padrão;
- rodar deploy manual pela CLI só quando o usuário pedir explicitamente ou quando o auto deploy falhar.

Dados operacionais:

```txt
GitHub: pedromacarini/devpedrao-site
Vercel: pedromacarini / devpedrao-site-ullz
Domínio: https://pedrao.dev.br
```

Essa autorização não inclui ações destrutivas, force push, alteração de DNS, remoção de projeto/domínio ou publicação de segredos.

## Padrão novo cliente

Quando o usuário disser `novo cliente: nome`, criar uma pasta com o slug do cliente dentro de `devpedrao-site/`.

Exemplo para `novo cliente: nick`:

```txt
devpedrao-site/
  nick/
    proposta-nick/
    contrato-nick/
    briefing-nick/
    upload-nick/
    assets/
    docs/
```

Não criar `proposta-nick`, `contrato-nick`, `briefing-nick` ou `upload-nick` soltos na raiz do `devpedrao-site`.

Usar a estrutura `admin-cliente/`, `briefing-cliente/`, `contrato-cliente/`, `proposta-cliente/`, `upload-cliente/` (ver `/proposta`, `/contrato`, `/briefing`, `/upload` genéricos) como modelo base.

Toda esteira comercial deve ter estas páginas:

- `proposta-cliente`: oferta comercial.
- `contrato-cliente`: coleta de dados para minuta.
- `briefing-cliente`: coleta de informações do projeto.
- `upload-cliente`: envio de materiais.
- Admin geral: `/admin` ou `/admin?client=cliente`, para copiar contrato + proposta, briefing e uploads.

Não criar admin individual por cliente. O admin geral deve ler dados por API backend protegida por senha e service role key em env da Vercel. Nunca expor service role no HTML/JS público.

Padrão de contrato para novos clientes:

- CPF/CNPJ com máscara automática.
- WhatsApp com máscara automática.
- E-mail obrigatório com `@` e domínio.
- Endereço em campos separados: CEP, Endereço, Número, Complemento, Cidade e Estado.
- Condição de pagamento fixa: `No ato da assinatura do contrato`.
- Campo de observações mantido.
- Valor aprovado, escopo e condição de pagamento editáveis pelo admin geral, não pela cliente.
- Valor aprovado da admin deve aparecer automaticamente na proposta e no contrato.
- Prévia com contrato completo, não apenas resumo.
- Botão de aceite operacional que salva aceite/data/texto no Supabase.
- PDF gerado no aceite, a partir do template interno.
- Cliente não deve conseguir editar cláusulas do contrato antes do PDF; a prévia é somente visualização.
- Salvar hash do contrato aceito quando possível.

Padrão do formulário principal do site DEV Pedrão:

- enviar por rota interna `/api/contact`;
- preservar o limite de 12 funções Serverless da Vercel Hobby: preferir dispatch em `api/contact.js`/`api/admin.js` e implementação em `lib/`, conforme `09-vercel-deploy-agent.md`;
- destinatário via env privada `CONTACT_EMAIL`, nunca no frontend;
- e-mail por `RESEND_API_KEY`;
- salvar cada solicitação na tabela `site_contacts`;
- mostrar leads recebidos no admin geral `/admin`, com botão de copiar lead;
- não expor service role, e-mail privado ou chaves no HTML/JS público.

## Exemplo

Se o usuário pedir uma landing page:

- use `01` para organizar dados;
- use `02` para definir escopo;
- use `04` para copy;
- use `05` para direção visual;
- use `06` para implementação;
- use `07` para links e integrações;
- use `10` para QA antes de responder.

Nem toda tarefa precisa passar por todos os arquivos. Manutenção, ajuste visual, texto para cliente ou deploy podem usar apenas os playbooks necessários.

Se a tarefa for em `/engenharia`, o mínimo é:

- calculadora: `14` + `15`;
- memorial A4: `12` + `15`;
- ajuda/importação/imagens: `13` + `15`;
- calculadora nova com ajuda e memorial: `14` + `13` + `12` + `15`.

Fontes de verdade rápidas:

- layout, colunas, botões e hover: `engenharia/core/styles.css` + `engenharia/calhas-pluviais/index.html`;
- Memorial A4: `engenharia/calhas-pluviais/calculadora-calhas-pluviais.js`, função `gerarHtmlMemorialA4`;
- Memorial A4 com orçamento: `engenharia/muro-de-alvenaria/calculadora-muro-de-alvenaria.js`;
- Ajuda/importação/lightbox: `engenharia/esquadrias/ajuda-importacao.html` e `engenharia/paredes/ajuda-importacao.html`;
- importação com conflito: `engenharia/esquadrias/calculadora-esquadrias.js`, função `renderImportModal`;
- importação BIM e paredes: `engenharia/paredes/calcular-paredes.mjs` + `engenharia/paredes/calculadora-paredes.js`;
- orçamento administrável: `engenharia/muro-de-alvenaria/orcamento-muro-de-alvenaria.mjs` e `engenharia/muro-para-gradil/orcamento-muro-para-gradil.mjs`.

## Diferença principal

No Claude, esses arquivos podem funcionar como agentes independentes. No Codex, o melhor uso é como uma bancada de referência para executar com mais precisão, mantendo foco em arquivo real, validação e entrega objetiva.
