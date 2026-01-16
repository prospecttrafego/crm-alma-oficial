# Estrutura de pastas (atual) — Alma CRM

Este documento explica, em linguagem simples, **o que existe em cada pasta do projeto** e **para que serve**.
O foco aqui é **100% estrutura de pastas** (organização do repositório).

---

## Visão rápida (mapa do projeto)

Pense no projeto como uma “casa” com cômodos separados:
- `client/` é a parte que **você vê** (telas do sistema no navegador).
- `server/` é a parte que **faz acontecer** (login, regras, banco, integrações).
- `shared/` é a “área compartilhada” (tipos e schema do banco usados por ambos).

Estrutura atual (nível alto):

```
/
  .storybook/      # Storybook (documentação de UI) + mocks de API
  client/
  server/
    api/            # Rotas HTTP por domínio
    ws/             # WebSocket
    validation/     # Schemas Zod centralizados (shared/contracts)
    storage/        # DAL por domínio (contacts, deals, etc.)
    integrations/   # Integrações externas
    services/       # Lógica de negócio reutilizável
    jobs/           # Background jobs
    lib/            # Bibliotecas internas (sentry, circuit-breaker)
    constants.ts    # Constantes centralizadas
    middleware.ts   # Middlewares padronizados
    response.ts     # Helpers de resposta API
  shared/
    schema.ts       # Drizzle schema + enums
    contracts.ts    # Schemas Zod + DTOs gerados do schema
    apiSchemas.ts   # Schemas Zod das respostas da API (runtime contract)
    apiSchemas.integrations.ts # Schemas de integrações (payloads/redactions)
    types/          # Tipos compartilhados
  migrations/       # Migrações do banco (Drizzle)
  scripts/
  script/
  dist/
  node_modules/
  .claude/
  .git/
  DESIGN_SYSTEM.md   # Sistema de design (Frontend - tokens/padrões)
  README.md          # Visao geral + como rodar
  RODAR_LOCAL.md     # Guia didatico: rodar local (Postgres + .env.local + seed)
  CLAUDE.md          # Documentacao tecnica completa (backend + frontend + deploy)
  DEPLOY_COOLIFY_HOSTINGER.md # Guia de deploy (Coolify v4 na Hostinger)
  ESTRUTURA_DE_PASTAS.md # Este documento (estrutura do repo)
```

---

## `/client/` — O “site” do CRM (Frontend)

Aqui fica tudo que aparece para o usuário: páginas, botões, telas, formulários e a “cara” do CRM.

O que você encontra:

```
client/
  public/
  src/
    components/
      ui/
    contexts/
    hooks/
    lib/
    locales/
    pages/
```

### `client/public/`
- O que é: arquivos “públicos” que o navegador pode pegar direto (ícone, logo, assets).
- Quando mexer: para trocar ícones, imagens públicas e arquivos estáticos simples.
- O que evitar: colocar aqui coisas sensíveis (chaves, configs privadas).

### `client/src/`
- O que é: o “código das telas”.
- Quando mexer: quase sempre que você for criar/ajustar telas, componentes e comportamentos do frontend.

#### `client/src/pages/`
- O que é: as “páginas” do sistema (ex.: pipeline, inbox, contatos, settings).
- Como usar: quando você quer criar uma nova tela principal, geralmente nasce aqui.
- O que pode mudar: dividir páginas muito grandes, criar novas páginas, reorganizar navegação (mantendo rotas consistentes).
- Observação: páginas grandes podem ser organizadas de duas formas (ambas usadas no projeto):
  - **Pasta com `index.tsx`** (entrada da rota) + componentes locais: ex. `client/src/pages/pipeline/`, `client/src/pages/contacts/`, `client/src/pages/audit-log/`.
  - **Arquivo `.tsx`** (entrada da rota) + **subpasta** ao lado com componentes/utilitários: ex. `client/src/pages/inbox.tsx` + `client/src/pages/inbox/`, `client/src/pages/reports.tsx` + `client/src/pages/reports/`.

#### `client/src/components/`
- O que é: peças reutilizáveis das páginas (cards, listas, modais, componentes de feature).
- Como usar: quando um pedaço de UI aparece em mais de uma tela, ele costuma virar um componente aqui.

##### `client/src/components/ui/`
- O que é: biblioteca de componentes básicos (botão, input, card…), normalmente vinda do padrão shadcn/ui.
- O que pode mudar: estilos, variantes e pequenos ajustes visuais.
- O que evitar: mudar a “API” dos componentes (props) sem checar onde eles são usados, porque isso quebra telas.

#### `client/src/hooks/`
- O que é: "atalhos" de lógica do frontend (ex.: autenticação, WebSocket, notificações, push).
- Hooks principais:
  - `useAuth.ts`: autenticação e sessão
  - `useWebSocket.ts`: conexão WebSocket e eventos real-time
  - `useDesktopNotifications.ts`: Web Notifications API (notificações desktop)
  - `usePushNotifications.ts`: Firebase Cloud Messaging (push)
  - `useToast.ts`: notificações toast in-app
- O que pode mudar: melhorar organização, separar hooks por tema, adicionar novos hooks para features.

#### `client/src/lib/`
- O que é: utilitários e configurações do frontend (ex.: cliente de API, helpers, formatações).
- Subpastas principais:
  - `lib/api/`: clientes de API tipados (contacts, deals, conversations, search, auditLogs, etc.)
  - `lib/firebase.ts`: configuração Firebase (push)
  - `lib/queryClient.ts`: configuração TanStack Query
  - `lib/utils.ts`: utilitários gerais (cn, formatters)
- O que pode mudar: centralizar chamadas HTTP, melhorar helpers, configurar libs.

#### `client/src/contexts/`
- O que é: “configurações globais” do app no frontend (ex.: idioma, tema, estado global simples).
- O que pode mudar: adicionar contextos globais quando fizer sentido (com moderação).

#### `client/src/locales/`
- O que é: traduções (ex.: pt-BR/en) e textos usados pelo frontend.
- O que pode mudar: adicionar idiomas, corrigir textos, padronizar labels.

---

## `/server/` — O “cérebro” do CRM (Backend)

Aqui ficam as regras de negócio, autenticação, comunicação com banco de dados e integrações externas.
É a parte que garante que o CRM funcione de forma consistente e segura.

O que você encontra (pastas e arquivos principais):

```
server/
  api/                # Rotas HTTP por domínio
  ws/                 # WebSocket
  validation/         # Schemas Zod centralizados (a partir de shared/contracts)
  storage/            # DAL por domínio (contacts, deals, etc.)
  integrations/       # Integrações externas
  services/           # Serviços de negócio (deal-auto-creator, whatsapp-config, email-ingest)
  jobs/               # Background jobs (queue, handlers, DLQ, storage)
  lib/                # Bibliotecas internas (sentry, circuit-breaker)
  types/              # Type augmentations (Express, etc.)
  constants.ts        # Constantes centralizadas (limites, TTLs, timeouts)
  middleware.ts       # Middlewares (asyncHandler, validate*, getCurrentUser)
  response.ts         # Helpers de resposta (sendSuccess, sendError, toSafeUser)
```

E também existem arquivos importantes "soltos" dentro de `server/` (por exemplo: autenticação, banco, storage/DAL e `server/env.ts` para carregar `.env.staging`/`.env.production`).

### Arquivos de infraestrutura importantes

- `server/middleware.ts`: Middlewares padronizados como `asyncHandler` (captura erros automaticamente), `validateBody`, `validateParams`, `validateQuery` (validação Zod), e `getCurrentUser` (helper type-safe para acessar usuário autenticado).
- `server/response.ts`: Funções helper para respostas HTTP padronizadas (`sendSuccess`, `sendError`, `sendNotFound`, `sendValidationError`, `toSafeUser`, etc.).
- `server/validation/`: Pasta com schemas Zod centralizados para validação de entrada (importa de `shared/contracts`).
- `server/storage.ts`: Facade que re-exporta os módulos do `server/storage/` (DAL por domínio).
- `server/types/`: Type augmentations para Express (Request interface com validatedBody/Query/Params e User).

### `server/api/` — Rotas HTTP do sistema (endpoints `/api/...`)
- O que é: aqui estão as “portas de entrada” do backend (as URLs que o frontend chama).
- Como funciona: cada arquivo agrupa rotas por assunto (ex.: deals, contatos, conversas).
- Onde registrar tudo: `server/api/index.ts` é o “catálogo” que liga todos os módulos no Express.

O que você encontra aqui (exemplos reais):
- `server/api/contacts.ts`: tudo de contatos (`/api/contacts`)
- `server/api/deals.ts`: deals (`/api/deals`)
- `server/api/conversations.ts`: inbox (conversas/mensagens)
- `server/api/files.ts`: arquivos (upload/download/transcrição)
- `server/api/search.ts`: busca global (contacts, deals, conversations)
- `server/api/auditLogs.ts`: logs de auditoria (com filtros e paginação)
- `server/api/channelConfigs.ts`: configurações de canais (email/whatsapp)
- `server/api/googleCalendar.ts`: rotas da integração do Google Calendar
- `server/api/evolution.ts`: status + webhook do WhatsApp (Evolution API)

O que pode ser mudado/alterado com segurança:
- Criar um novo arquivo de rotas para um novo “domínio” (ex.: `tasks.ts`) e registrar no `server/api/index.ts`.
- Dividir um arquivo grande em módulos menores (desde que você mantenha as URLs `/api/...` iguais, se o frontend já usa).

O que evitar:
- Renomear URLs sem atualizar o frontend.
- Duplicar rotas em dois lugares (o ideal é cada endpoint existir em um único módulo).

### `server/ws/` — WebSocket (tempo real) em `/ws`
- O que é: canal “ao vivo” (sem precisar dar F5) para atualizar telas em tempo real.
- Como funciona: o navegador mantém uma conexão aberta e o servidor “empurra” eventos (ex.: nova mensagem, deal movido).
- Onde mexer: `server/ws/index.ts` (upgrade, presença online/offline, evento “digitando”, broadcast).

O que pode ser mudado/alterado:
- Criar novos tipos de eventos (ex.: `deal:assigned`, `conversation:closed`) e disparar com `broadcast(...)`.
- Ajustar regras de presença/online, ou melhorar tratamento de múltiplas abas.

O que evitar:
- Quebrar o caminho `/ws` (o frontend depende dele).
- Enviar eventos com formatos inconsistentes sem coordenar com o frontend.

### `server/integrations/` — Conexões com serviços externos
- O que é: código que “fala” com serviços de fora do CRM (WhatsApp/Evolution, Google, OpenAI, Supabase, Firebase, Email).
- Por que existe: separar integração do resto do backend deixa o projeto mais fácil de manter e crescer.

Estrutura atual:

```
server/integrations/
  email/
  evolution/
  firebase/
  google/
  openai/
  supabase/
  index.ts
```

O que você encontra:
- `email/`: peças para IMAP/SMTP (integração de e-mail)
- `evolution/`: Evolution API (WhatsApp)
- `firebase/`: push notifications
- `google/`: Google APIs (ex.: calendar)
- `openai/`: scoring e transcrição (Whisper)
- `supabase/`: storage/arquivos

O que pode ser mudado/alterado:
- Trocar provedor (ex.: outro serviço de WhatsApp) criando um novo módulo e mantendo as “interfaces” internas.
- Padronizar logs, retries e timeouts por integração.

O que evitar:
- Misturar “regra de negócio” com código de integração: o ideal é a integração só se preocupar em “conectar e trazer dados”.

### `server/services/` — Lógica de negócio reutilizável
- O que é: serviços que encapsulam regras de negócio reutilizáveis por múltiplos handlers.
- Por que existe: evita duplicação de código e mantém handlers/rotas mais enxutos.

Estrutura atual:

```
server/services/
  index.ts              # Re-exports
  deal-auto-creator.ts  # Auto-criação de deal (WhatsApp/email)
  whatsapp-config.ts    # Configuração WhatsApp (connect/disconnect/send)
  email-ingest.ts       # Processamento de emails recebidos
```

O que pode ser mudado/alterado:
- Criar novos serviços para lógica de negócio complexa.
- Mover lógica repetida de handlers para cá.

O que evitar:
- Colocar lógica de integração pura aqui (isso vai em `integrations/`).

---

### `server/jobs/` — Tarefas em background (para coisas pesadas)
- O que é: um lugar para tarefas que não deveriam travar uma requisição (ex.: transcrever áudio, calcular score, sincronizar calendário).
- Por que existe: melhora a experiência do usuário e reduz risco de timeouts.
- Nota: usa Redis (Upstash) quando configurado; caso contrário faz fallback em memória.

Estrutura atual:

```
server/jobs/
  index.ts        # Re-exports
  types.ts        # Tipos e interfaces (Job, JobStatus, JobHandler, etc.)
  storage.ts      # Persistência Redis/in-memory (saveJob, loadJob, etc.)
  queue.ts        # Processamento da fila (enqueueJob, processQueue, etc.)
  handlers.ts     # Handlers específicos (transcrição, scoring, sync)
  dead-letter.ts  # Dead Letter Queue para jobs falhos
  file-cleanup.ts # Cleanup de arquivos órfãos
```

O que pode ser mudado/alterado:
- Adicionar novos tipos de job e handlers.
- Separar um processo de worker dedicado quando escalar para múltiplas instâncias.

O que evitar:
- Rodar sem Redis em produção quando precisar de jobs duráveis (o fallback em memória é para dev/ambientes simples).

---

### `server/lib/` — Bibliotecas internas reutilizáveis
- O que é: módulos internos que encapsulam funcionalidades transversais (cross-cutting concerns).
- Por que existe: centraliza código de infraestrutura que pode ser usado em múltiplos lugares.

Estrutura atual:

```
server/lib/
  sentry.ts         # Integração Sentry (error tracking, middleware, helpers)
  circuit-breaker.ts # Circuit breaker pattern para integrações externas
```

O que você encontra:
- `sentry.ts`: inicialização do Sentry, middleware de request/error, helpers para captura manual de erros
- `circuit-breaker.ts`: implementação do padrão circuit breaker para proteger contra falhas em cascata

O que pode ser mudado/alterado:
- Adicionar novas bibliotecas internas (ex.: retry, cache, rate-limiter).
- Configurar thresholds dos circuit breakers por integração.

O que evitar:
- Colocar lógica de negócio aqui (isso vai em `services/`).
- Duplicar funcionalidades já existentes em outras libs.

---

### `server/constants.ts` — Constantes centralizadas
- O que é: arquivo único com todas as "magic numbers" e configurações do backend.
- Por que existe: facilita manutenção e evita valores hardcoded espalhados pelo código.

Categorias de constantes:
- Autenticação (TTLs, limites de tentativas)
- Database pool (min/max conexões, timeouts)
- Cache/Redis (TTLs, limites)
- Background jobs (limites, intervalos)
- API/Paginação (defaults, limites)
- Serviços externos (timeouts, thresholds)
- Upload de arquivos (tamanho máximo: 50MB)

O que pode ser mudado/alterado:
- Ajustar valores conforme necessidade de performance/segurança.
- Adicionar novas constantes para features.

O que evitar:
- Colocar secrets/credenciais aqui (use variáveis de ambiente).

---

### `server/types/` — Type augmentations e definições
- O que é: arquivos de definição de tipos que estendem bibliotecas externas.
- Por que existe: permite que o TypeScript entenda extensões customizadas (ex.: propriedades adicionais no Request do Express).

Estrutura atual:

```
server/types/
  express.d.ts    # Augmenta Express.Request com validatedBody/Query/Params e User
```

O que pode ser mudado/alterado:
- Adicionar novas augmentações para outras bibliotecas quando necessário.

O que evitar:
- Colocar tipos de negócio aqui (esses vão em `shared/`).

---

## `/shared/` — Tipos e schema compartilhados (Frontend + Backend)

```
shared/
  schema.ts                   # Drizzle schema + enums + tipos inferidos
  contracts.ts                # Zod schemas/DTOs derivados do schema (validação de entrada)
  apiSchemas.ts               # Zod schemas de resposta (entidades e payloads compostos)
  apiSchemas.integrations.ts  # Zod schemas de integrações (payloads/redactions)
  types/
    api.ts                    # ApiResponse, ErrorCodes, PaginationMeta
    dto.ts                    # DTOs para transferência de dados
```

- O que é: a **fonte única de verdade** para tipos, enums e schema do banco.
- Por que existe: evita duplicação de definições entre frontend e backend, reduz bugs e garante consistência.

### `shared/schema.ts`
- Contém todas as tabelas Drizzle (users, contacts, deals, etc.)
- Contém todos os **enums** do sistema (channelTypes, activityTypes, savedViewTypes, etc.)
- Exporta tipos inferidos (Contact, InsertContact, Deal, etc.)

### `shared/contracts.ts`
- Schemas Zod e DTOs **de entrada** (validação de body/query/params) gerados automaticamente via `drizzle-zod` a partir do schema.
- Usado pelo backend (via `server/validation/`).

### `shared/apiSchemas*.ts`
- Schemas Zod **de resposta** (contrato runtime) usados no frontend para validar payloads recebidos da API.
- Evita dessincronização silenciosa entre backend/frontend quando o schema ou responses mudam.

### `shared/types/`
- `api.ts`: Tipos de resposta da API (`ApiResponse`, `PaginatedResponse`, `ErrorCodes`, `PaginationMeta`)
- `dto.ts`: DTOs (Data Transfer Objects) para transferência entre frontend e backend

O que pode mudar: quando você cria/altera tabelas/campos, isso normalmente passa por `shared/schema.ts`.
O que evitar: mudanças sem atualizar o banco (migração/push), porque o backend vai tentar usar algo que não existe.

---

## `/migrations/` — Migrações do banco de dados (Drizzle)

```
migrations/
  0000_great_hammerhead.sql   # Migração inicial
  0001_mute_cargill.sql       # ...
  0002_colorful_la_nuit.sql   # ...
  0003_adorable_forgotten_one.sql # ...
  0004_audit_logs_immutable.sql  # Trigger para logs imutáveis
  0005_special_joseph.sql     # CHECK constraints e indexes
  0006_woozy_devos.sql        # Deals: adiciona tags (text[])
  0007_neat_freak.sql         # Messages: reply/edit/delete + indice de busca
  meta/
    _journal.json             # Histórico de migrações aplicadas
    0000_snapshot.json        # Snapshots de schema
    0007_snapshot.json        # Snapshot mais recente (exemplo)
```

- O que é: arquivos SQL gerados pelo Drizzle (ou manuais) para alterar o schema do banco.
- Como funciona: `npm run db:migrate` aplica as migrações pendentes.
- Migrações especiais:
  - `0004_audit_logs_immutable.sql`: trigger PostgreSQL que impede UPDATE/DELETE na tabela audit_logs
  - `0005_special_joseph.sql`: adiciona CHECK constraints e indexes LOWER(email)
  - `0006_woozy_devos.sql`: adiciona `deals.tags`
  - `0007_neat_freak.sql`: adiciona campos de reply/edit/delete em `messages` e indice GIN para busca

O que pode ser mudado/alterado:
- Criar migrações manuais para triggers, functions, ou alterações que o Drizzle não gera automaticamente.

O que evitar:
- Editar migrações já aplicadas em produção (crie uma nova migração para corrigir).
- Deletar migrações sem atualizar o journal.

---

## `/scripts/` — Scripts utilitários (tarefas manuais)

```
scripts/
  migrate.ts            # Runner de migrations (Drizzle) para dev/prod
  seed.ts               # Seed local (cria organizacao + admin + pipeline)
  migrate-ptbr-data.ts  # Ajustes pontuais (dados legados PT-BR)
  migrate-users.ts      # Script de migracao de usuarios (legado)
```

- O que é: scripts para migrações, correções pontuais, importação/exportação de dados.
- Quando mexer: quando você precisa rodar uma tarefa "de manutenção" (ex.: migrar dados antigos).
- O que evitar: usar scripts como "solução permanente" para lógica do sistema (o lugar disso é o backend).
 - Dica (dev local): use `ENV_FILE=.env.local` para garantir que os scripts usem o seu arquivo de ambiente local.

---

## `/script/` — Build e automações do projeto

```
script/
  build.ts
```

- O que é: automações internas do projeto, principalmente build (gerar `dist/`).
- Quando mexer: se você quiser mudar como o projeto compila/empacota.
- O que evitar: colocar regras de negócio aqui.

---

## `/dist/` — Saída do build (gerado automaticamente)

```
dist/
  public/
  index.cjs
```

- O que é: a versão “pronta para rodar” do sistema (frontend compilado + backend bundle).
- Importante: esta pasta é gerada por `npm run build`.
- O que pode mudar: nada “na mão”. Sempre gere de novo pelo build.
- Pode apagar? sim (vai ser recriada no próximo build).

---

## `/node_modules/` — Dependências (gerado automaticamente)

- O que é: bibliotecas instaladas via `npm install`.
- O que pode mudar: nada manualmente (o npm gerencia).
- Se estiver dando problema: normalmente resolve com `rm -rf node_modules` + `npm install` (em último caso).

---

## `/.claude/` — Configuração local de assistente (não é “runtime” do CRM)

```
.claude/
  settings.json
  settings.local.json
```

- O que é: configurações locais para ferramentas/assistentes (não é necessário para o CRM funcionar).
- O que pode mudar: preferências locais (especialmente em `settings.local.json`).
- O que evitar: colocar segredos aqui se esse arquivo for versionado no Git.

---

## `/.git/` — Histórico do projeto (controle de versão)

- O que é: onde o Git guarda o histórico de commits, branches, etc.
- O que evitar: mexer manualmente aqui (só use comandos do Git).
