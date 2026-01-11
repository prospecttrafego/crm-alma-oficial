# CLAUDE.md - Documentacao Tecnica Completa

Este documento contem todas as informacoes necessarias para entender, desenvolver e fazer deploy do Alma CRM.

---

## Visao Geral do Projeto

**Alma CRM** e uma aplicacao SaaS de gestao de relacionamento com clientes desenvolvida para a agencia digital Alma. O sistema combina duas funcionalidades principais:

1. **Pipeline de Vendas (Kanban)**: Gestao visual de oportunidades de negocio
2. **Inbox Unificado**: Central de comunicacoes multicanal

### Caracteristicas Tecnicas
- Monorepo: Frontend e Backend no mesmo repositorio
- Type-safe: TypeScript em toda a stack
- Real-time: WebSockets para atualizacoes ao vivo
- Multi-tenant (parcial): schema suporta multiplas organizacoes, mas a implementacao atual roda em modo single-tenant por instalacao (via DEFAULT_ORGANIZATION_ID)

---

## Arquitetura do Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Pages   │  │Components│  │  Hooks   │  │  TanStack Query  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  Wouter (Routing) │ shadcn/ui │ Tailwind CSS 4 │ Framer Motion  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/REST │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Routes  │  │   Auth   │  │ Storage  │  │    AI Scoring    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  Passport.js │ express-session │ Drizzle ORM │ WebSocket (ws)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICOS EXTERNOS                           │
├────────────────┬────────────────┬────────────────────────────────┤
│   PostgreSQL   │    Supabase    │           OpenAI               │
│   (Database)   │   (Storage)    │      (Lead Scoring)            │
└────────────────┴────────────────┴────────────────────────────────┘
```

Obs: alem do trio principal acima, o backend possui integracoes opcionais com:
- **Evolution API** (WhatsApp)
- **Google Calendar** (OAuth + sincronizacao)
- **Upstash Redis** (presenca/online e base para cache/rate limit)
- **Firebase Cloud Messaging (FCM)** (push notifications)

### Fluxo de Dados

1. **Requisicao HTTP**: Cliente → Express → Drizzle → PostgreSQL
2. **Upload de Arquivo**: Cliente → Express → Supabase Storage
3. **Real-time**: Express → WebSocket → Todos os clientes conectados
4. **AI Scoring**: Express → OpenAI API → Calculo de score → Banco
5. **WhatsApp**: Evolution API → Webhook → Express → Banco → WebSocket → Auto-criacao de Deal
6. **Google Calendar**: OAuth + Google API → Sincronizacao → Banco → WebSocket
7. **Push**: Express → Firebase → Notificacao no dispositivo (quando usuario estiver offline)

### Comportamentos Automatizados

#### Auto-criacao de Empresa (Contatos)
Ao criar um contato via formulario, o usuario pode digitar o nome da empresa em um campo de texto livre. O backend:
1. Busca empresa existente pelo nome (case-insensitive)
2. Se nao existir, cria automaticamente uma nova empresa
3. Vincula o contato a empresa encontrada ou criada

#### Auto-criacao de Deal (WhatsApp)
Quando uma mensagem chega via WhatsApp (Evolution API), o sistema automaticamente:
1. Cria/atualiza o contato pelo numero de telefone
2. Verifica se o contato possui deals abertos
3. Se NAO houver deal aberto, cria um novo deal automaticamente:
   - Usa o pipeline default da organizacao
   - Se nao houver pipeline default, cria um "Pipeline Padrao" com stage "Novo Lead"
   - Deal eh criado no primeiro stage (menor `order`)
   - Titulo: "Lead WhatsApp: {nome ou telefone}"
   - Source: "whatsapp", Probability: 10%, Status: "open"

#### Modulos Desabilitados (Reversiveis)
- **Companies**: O modulo de empresas esta temporariamente desabilitado no menu e rotas.
  Para reativar, descomentar as linhas marcadas em:
  - `client/src/components/app-sidebar.tsx` (menu)
  - `client/src/App.tsx` (rota)
  - `client/src/components/command-palette.tsx` (paleta de comandos)

---

## Versoes das Bibliotecas Principais

### Frontend

| Pacote | Versao | Funcao |
|--------|--------|--------|
| react | 19.2.3 | Framework UI |
| react-dom | 19.2.3 | Renderizacao DOM |
| vite | 7.3.0 | Build tool / Dev server |
| typescript | 5.9.3 | Tipagem estatica |
| tailwindcss | 4.1.18 | Estilizacao utility-first |
| @tanstack/react-query | 5.60.5 | Gerenciamento de estado servidor |
| wouter | 3.3.5 | Roteamento client-side |
| framer-motion | 12.23.26 | Animacoes |
| react-hook-form | 7.55.0 | Formularios |
| lucide-react | 0.453.0 | Icones |
| recharts | 2.15.2 | Graficos |
| date-fns | 3.6.0 | Manipulacao de datas |

### Backend

| Pacote | Versao | Funcao |
|--------|--------|--------|
| express | 4.21.2 | Framework HTTP |
| drizzle-orm | 0.39.3 | ORM type-safe |
| drizzle-zod | 0.8.1 | Integracao Drizzle + Zod |
| zod | 4.1.13 | Validacao de schemas |
| passport | 0.7.0 | Autenticacao |
| passport-local | 1.0.0 | Strategy email/senha |
| bcryptjs | 3.0.3 | Hash de senhas |
| express-session | 1.18.1 | Gestao de sessoes |
| connect-pg-simple | 10.0.0 | Sessoes no PostgreSQL |
| ws | 8.18.0 | WebSocket |
| pg | 8.16.3 | Driver PostgreSQL |
| @supabase/supabase-js | 2.87.3 | Cliente Supabase |
| openai | 6.10.0 | API OpenAI |
| googleapis | 169.0.0 | Google Calendar API |
| firebase-admin | 13.6.0 | Push notifications (FCM) |
| @upstash/redis | 1.35.8 | Redis (Upstash REST) |
| @upstash/ratelimit | 2.0.7 | Rate limiting (opcional) |

### UI Components (Radix UI)

Todos os componentes Radix UI estao na versao ~1.1.x a ~2.1.x:
- dialog, dropdown-menu, select, popover, tabs, toast
- accordion, checkbox, radio-group, switch, slider
- avatar, tooltip, hover-card, context-menu

---

## Estrutura de Pastas Detalhada

```
CRM_Oficial/
├── client/
│   ├── public/                  # Assets publicos (favicon, logo, SW do Firebase)
│   └── src/
│       ├── components/          # Componentes (features) + UI (shadcn)
│       │   └── ui/              # shadcn/ui (button, input, card, etc)
│       ├── contexts/            # Contextos (ex.: idioma)
│       ├── hooks/               # Hooks (auth, websocket, push, toast…)
│       ├── lib/                 # Infra do frontend (query client, firebase, utils)
│       │   └── validation/      # Schemas Zod (importa de @shared/schema)
│       ├── locales/             # Traducoes (pt-BR/en)
│       └── pages/               # Paginas (dashboard, pipeline, inbox, settings…)
├── server/
│   ├── index.ts                 # Entry point, inicia servidor
│   ├── env.ts                   # Loader de .env (staging/prod) com fallback
│   ├── routes.ts                # Agregador (auth + rate limit + API + WebSocket)
│   ├── middleware.ts            # Middlewares padronizados (asyncHandler, validate*)
│   ├── response.ts              # Helpers de resposta (sendSuccess, sendError, toSafeUser)
│   ├── validation/              # Schemas Zod centralizados
│   │   ├── index.ts             # Re-exports
│   │   ├── schemas.ts           # Schemas de validação
│   │   └── factory.ts           # Factory drizzle-zod
│   ├── api/                     # Rotas HTTP por domínio (módulos) - TODOS padronizados
│   │   ├── index.ts             # Registra todos os módulos de API
│   │   ├── contacts.ts          # Contatos
│   │   ├── companies.ts         # Empresas
│   │   ├── deals.ts             # Deals
│   │   ├── pipelines.ts         # Pipelines/estágios
│   │   ├── conversations.ts     # Inbox (conversas/mensagens)
│   │   ├── files.ts             # Upload/download + transcrição
│   │   ├── lgpd.ts              # LGPD compliance (export/delete)
│   │   ├── jobs.ts              # Status de background jobs
│   │   └── ...                  # Demais domínios (activities, notifications, etc.)
│   ├── ws/                      # WebSocket (/ws) + broadcast
│   │   └── index.ts             # Upgrade handler + presença + "typing"
│   ├── jobs/                    # Background jobs (tarefas assíncronas)
│   │   ├── index.ts             # Exports do módulo
│   │   ├── queue.ts             # Fila Redis (Upstash) com fallback em memoria
│   │   └── handlers.ts          # Handlers: transcricao, lead score, sync
│   ├── logger.ts                # Logs estruturados (requestId + loggers de integrações)
│   ├── health.ts                # Health check (DB + integrações opcionais)
│   ├── storage.ts               # Camada de acesso ao banco (DAL)
│   ├── auth.ts                  # Passport.js + sessoes
│   ├── db.ts                    # Drizzle + conexao Postgres (Pool)
│   ├── tenant.ts                # Single-tenant (organizacao da instalacao)
│   ├── storage.supabase.ts      # Upload/download de arquivos
│   ├── aiScoring.ts             # Lead scoring com OpenAI
│   ├── whisper.ts               # Transcricao de audio (OpenAI Whisper)
│   ├── evolution-api.ts         # Cliente Evolution API (WhatsApp)
│   ├── evolution-message-handler.ts # Webhook handler (WhatsApp)
│   ├── google-calendar.ts       # Integracao Google Calendar (OAuth + sync)
│   ├── notifications.ts         # Push notifications (Firebase Admin)
│   ├── redis.ts                 # Upstash Redis (presenca + base cache/rate-limit)
│   ├── static.ts                # Servir frontend em producao (dist/public)
│   └── vite.ts                  # Integracao Vite em dev
├── shared/                      # Fonte unica de verdade (tipos e enums)
│   ├── schema.ts                # Schema Drizzle + enums + tipos inferidos
│   └── types/                   # Tipos compartilhados frontend/backend
│       ├── api.ts               # ApiResponse, ErrorCodes, PaginationMeta
│       └── dto.ts               # DTOs para transferencia de dados
├── scripts/
│   └── migrate-users.ts         # Script de migracao de usuarios
├── script/
│   └── build.ts                 # Script de build customizado
├── migrations/                  # Migracoes Drizzle (se houver)
├── dist/                        # Build de producao (gerado)
├── eslint.config.js             # Lint (ESLint)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── components.json              # Configuracao shadcn/ui
├── .env.example
├── README.md
└── CLAUDE.md                    # Este arquivo
```

---

## Schema do Banco de Dados

### Tabelas Principais

#### users
```typescript
{
  id: string (UUID, PK),
  email: string (unique),
  passwordHash: string,
  firstName: string,
  lastName: string,
  profileImageUrl: string,
  role: 'admin' | 'sales' | 'cs' | 'support',
  organizationId: number (FK),
  preferences: jsonb (ex.: { language: 'pt-BR' | 'en' }),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### organizations
```typescript
{
  id: number (PK, auto),
  name: string,
  domain: string,
  logo: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### contacts
```typescript
{
  id: number (PK, auto),
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  jobTitle: string,
  companyId: number (FK),
  organizationId: number (FK),
  ownerId: string (FK users),
  tags: string[],
  source: string,
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### companies
```typescript
{
  id: number (PK, auto),
  name: string,
  domain: string,
  website: string,
  segment: string,
  size: string,
  industry: string,
  organizationId: number (FK),
  ownerId: string (FK users),
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### pipelines
```typescript
{
  id: number (PK, auto),
  name: string,
  organizationId: number (FK),
  isDefault: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### pipeline_stages
```typescript
{
  id: number (PK, auto),
  name: string,
  pipelineId: number (FK),
  order: number,
  color: string (#RRGGBB),
  isWon: boolean,
  isLost: boolean,
  createdAt: timestamp
}
```

#### deals
```typescript
{
  id: number (PK, auto),
  title: string,
  value: decimal(15,2),
  currency: string (default 'BRL'),
  pipelineId: number (FK),
  stageId: number (FK),
  contactId: number (FK),
  companyId: number (FK),
  organizationId: number (FK),
  ownerId: string (FK users),
  probability: number (0-100),
  expectedCloseDate: timestamp,
  status: 'open' | 'won' | 'lost',
  lostReason: string,
  source: string,
  notes: text,
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### conversations
```typescript
{
  id: number (PK, auto),
  subject: string,
  channel: 'email' | 'whatsapp' | 'sms' | 'internal' | 'phone',
  status: 'open' | 'closed' | 'pending',
  contactId: number (FK),
  dealId: number (FK),
  organizationId: number (FK),
  assignedToId: string (FK users),
  lastMessageAt: timestamp,
  unreadCount: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### messages
```typescript
{
  id: number (PK, auto),
  conversationId: number (FK),
  senderId: string (FK users),
  senderType: 'user' | 'contact' | 'system',
  content: text,
  contentType: 'text' | 'audio' | 'image' | 'file' | 'video',
  isInternal: boolean,
  attachments: jsonb[] (ex.: [{ name, url, type }]),
  metadata: jsonb (ex.: { transcription, duration, waveform }),
  mentions: string[],
  readBy: string[],
  createdAt: timestamp
}
```

#### activities
```typescript
{
  id: number (PK, auto),
  type: 'call' | 'email' | 'meeting' | 'note' | 'task',
  title: string,
  description: text,
  contactId: number (FK),
  dealId: number (FK),
  organizationId: number (FK),
  userId: string (FK users),
  dueDate: timestamp,
  completedAt: timestamp,
  status: 'pending' | 'completed' | 'cancelled',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Tabelas Auxiliares

- **sessions**: Armazenamento de sessoes (connect-pg-simple)
- **notifications**: Notificacoes do sistema
- **push_tokens**: Tokens para push notifications (FCM)
- **saved_views**: Views salvas pelos usuarios
- **email_templates**: Templates de email
- **audit_logs**: Logs de auditoria
- **files**: Metadados de arquivos
- **lead_scores**: Historico de scores de IA
- **calendar_events**: Eventos do calendario
- **google_oauth_tokens**: Tokens OAuth (Google Calendar)
- **channel_configs**: Configuracoes de canais (IMAP/SMTP, WhatsApp)

---

## API Endpoints

### Autenticacao e Usuario

```
POST   /api/login          # Login com email/senha
POST   /api/logout         # Encerrar sessao
POST   /api/register       # Registro (se habilitado)
GET    /api/auth/me        # Usuario atual
GET    /api/auth/user      # Usuario atual (alias usado no frontend)
PATCH  /api/users/me       # Atualizar perfil/preferencias do usuario atual
GET    /api/users          # Listar usuarios (para dropdown/filtros; requer login)
```

### Observabilidade

```
GET    /api/health         # Health check (DB + integrações opcionais)
```

### Regras de organizationId (single-tenant)

- organizationId e gerenciado pelo backend (DEFAULT_ORGANIZATION_ID)
- Requests de criacao nao devem enviar organizationId; o backend injeta automaticamente
- Requests de atualizacao nao podem alterar organizationId; qualquer valor enviado e ignorado

### Background Jobs

```
GET    /api/jobs/:id           # Status completo do job
GET    /api/jobs/:id/status    # Status resumido (lightweight)
GET    /api/jobs/stats         # Estatísticas da fila (admin)
POST   /api/jobs/cleanup       # Limpar jobs antigos (admin)
```

Endpoints que suportam modo assíncrono (`?async=true`):
- `POST /api/lead-scores/:entityType/:entityId/calculate?async=true`
- `POST /api/audio/transcribe?async=true`
- `POST /api/files/:id/transcribe?async=true`
- `POST /api/integrations/google-calendar/sync?async=true`
- `POST /api/channel-configs/:id/email/sync?async=true`

### Contatos

```
GET    /api/contacts                    # Listar contatos
POST   /api/contacts                    # Criar contato
GET    /api/contacts/:id                # Detalhes do contato
PATCH  /api/contacts/:id                # Atualizar contato
DELETE /api/contacts/:id                # Excluir contato
```

### Empresas

```
GET    /api/companies                   # Listar empresas
POST   /api/companies                   # Criar empresa
GET    /api/companies/:id               # Detalhes da empresa
PATCH  /api/companies/:id               # Atualizar empresa
DELETE /api/companies/:id               # Excluir empresa
```

### Pipelines, Estagios e Deals

```
GET    /api/pipelines                   # Listar pipelines
POST   /api/pipelines                   # Criar pipeline
PATCH  /api/pipelines/:id               # Atualizar pipeline
DELETE /api/pipelines/:id               # Excluir pipeline
POST   /api/pipelines/:id/set-default   # Definir pipeline default
POST   /api/pipelines/:id/stages        # Criar estagio
PATCH  /api/pipelines/:pipelineId/stages/:id  # Atualizar estagio
DELETE /api/pipelines/:pipelineId/stages/:id  # Excluir estagio

GET    /api/deals                       # Listar deals
POST   /api/deals                       # Criar deal
GET    /api/deals/:id                   # Detalhes do deal
PATCH  /api/deals/:id                   # Atualizar deal
DELETE /api/deals/:id                   # Excluir deal
PATCH  /api/deals/:id/stage             # Mover deal de stage
```

### Conversas e Mensagens

```
GET    /api/conversations               # Listar conversas
POST   /api/conversations               # Criar conversa
GET    /api/conversations/:id           # Detalhes da conversa
PATCH  /api/conversations/:id           # Atualizar conversa

GET    /api/conversations/:id/messages  # Listar mensagens (paginado)
POST   /api/conversations/:id/messages  # Enviar mensagem
POST   /api/conversations/:id/read      # Marcar mensagens como lidas
```

### Atividades

```
GET    /api/activities                  # Listar atividades
POST   /api/activities                  # Criar atividade
PATCH  /api/activities/:id              # Atualizar atividade
DELETE /api/activities/:id              # Excluir atividade
```

### Arquivos e Midia (Supabase Storage)

```
POST   /api/files/upload-url            # Gerar URL de upload assinada
POST   /api/files                       # Registrar arquivo enviado no banco
GET    /api/files/:entityType/:entityId # Listar arquivos de uma entidade
DELETE /api/files/:id                   # Remover registro e tentar deletar do storage
GET    /objects/:path                   # Baixar arquivo (rota protegida)
POST   /api/audio/transcribe            # Transcricao por URL (Whisper/OpenAI)
POST   /api/files/:id/transcribe        # Transcricao de arquivo de audio registrado
```

### Notificacoes, Calendario, Auditoria e Relatorios

```
GET    /api/notifications               # Listar notificacoes
GET    /api/notifications/unread-count  # Contagem de nao lidas
PATCH  /api/notifications/:id/read      # Marcar notificacao como lida
POST   /api/notifications/mark-all-read # Marcar todas como lidas

GET    /api/calendar-events             # Listar eventos
POST   /api/calendar-events             # Criar evento
PATCH  /api/calendar-events/:id         # Atualizar evento
DELETE /api/calendar-events/:id         # Excluir evento

GET    /api/audit-logs                  # Logs de auditoria
GET    /api/audit-logs/entity/:entityType/:entityId # Auditoria por entidade

GET    /api/reports                     # Relatorios
```

### Views salvas e Email templates

```
GET    /api/saved-views                 # Listar views salvas
POST   /api/saved-views                 # Criar view salva
PATCH  /api/saved-views/:id             # Atualizar view salva
DELETE /api/saved-views/:id             # Excluir view salva

GET    /api/email-templates             # Listar templates de email
POST   /api/email-templates             # Criar template
PATCH  /api/email-templates/:id         # Atualizar template
DELETE /api/email-templates/:id         # Excluir template
```

### Integracoes (WhatsApp, Google Calendar, Push)

```
# Evolution API (WhatsApp)
GET    /api/evolution/status
POST   /api/channel-configs/:id/whatsapp/connect
GET    /api/channel-configs/:id/whatsapp/status
POST   /api/channel-configs/:id/whatsapp/disconnect
POST   /api/channel-configs/:id/whatsapp/send
POST   /api/webhooks/evolution                  # Webhook publico (sem auth)

# Google Calendar
GET    /api/integrations/google-calendar/configured
GET    /api/integrations/google-calendar/status
GET    /api/auth/google/authorize
GET    /api/auth/google/callback
POST   /api/integrations/google-calendar/sync
POST   /api/integrations/google-calendar/disconnect

# Push tokens (Firebase)
POST   /api/push-tokens
DELETE /api/push-tokens

# WebSocket
GET    /ws
```

---

## Comandos NPM

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento (frontend + backend)
npm run dev

# Verificar tipos TypeScript
npm run check

# Rodar linter (ESLint)
npm run lint
# (Opcional) aplicar correcoes automaticas
npm run lint:fix
```

### Banco de Dados

```bash
# Aplicar schema no banco (criar/atualizar tabelas)
npm run db:push

# Ajustes pontuais (dados legados PT-BR)
npm run db:migrate-ptbr

# Gerar migracoes (se necessario)
npx drizzle-kit generate
```

### Producao

```bash
# Build de producao (frontend + backend)
npm run build

# Iniciar servidor de producao
npm start
# ou
NODE_ENV=production node dist/index.cjs
```

---

## Configuracao de Ambiente

### Arquivos .env (.env.staging / .env.production)

O backend carrega primeiro `.env.{APP_ENV}` (ou `.env.{NODE_ENV}`) quando existir e depois `.env` como fallback.  
Para staging, use `APP_ENV=staging`. Para produção, `NODE_ENV=production` já aponta para `.env.production`.  
Se precisar forçar um arquivo, use `ENV_FILE=/caminho/para/.env`.

```bash
# ====== MINIMO PARA RODAR (OBRIGATORIAS) ======

# Conexao com PostgreSQL
DATABASE_URL=postgresql://usuario:senha@host:5432/database

# Chave para criptografia de sessoes (gerar com: openssl rand -base64 32)
SESSION_SECRET=chave-secreta-de-pelo-menos-32-caracteres

# Ambiente
NODE_ENV=production
PORT=3000

# ====== RECOMENDADAS (SINGLE-TENANT) ======

# URL publica da aplicacao (usada em webhooks e callbacks OAuth)
APP_URL=https://crm.seudominio.com

# ID da organizacao (single-tenant)
DEFAULT_ORGANIZATION_ID=1

# Permitir registro de novos usuarios
ALLOW_REGISTRATION=false
VITE_ALLOW_REGISTRATION=false

# ====== SUPABASE (UPLOADS) ======

SUPABASE_URL=https://xxxxx.supabase.co
# Opcional (nao usado diretamente hoje pelo backend, mas util para futuros fluxos/cliente)
SUPABASE_ANON_KEY=sua-anon-key-aqui
# Necessario para assinar uploads e acessar storage de forma administrativa
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# ====== OPENAI (IA) ======

# Lead scoring (recomendacoes) e transcricao Whisper
OPENAI_API_KEY=sk-...

# ====== UPSTASH REDIS (OPCIONAL) ======

UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ====== FIREBASE CLOUD MESSAGING (OPCIONAL) ======

# Backend (Firebase Admin)
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-projeto.iam.gserviceaccount.com

# Frontend (Firebase Web SDK)
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_VAPID_KEY=sua-vapid-key-aqui

# ====== EVOLUTION API (WHATSAPP) - OPCIONAL ======

EVOLUTION_API_URL=https://seu-evolution-api.com
EVOLUTION_API_KEY=sua-api-key-aqui
# Prefixo opcional (unico por deploy) para evitar colisao de instanceName quando multiplos CRMs usam a mesma Evolution API
# Ex.: alma-crm-a, alma-crm-b
EVOLUTION_INSTANCE_PREFIX=alma-crm-a
# Recomendado em producao (o backend valida o webhook quando setado)
EVOLUTION_WEBHOOK_SECRET=sua-webhook-secret-aqui

# ====== GOOGLE CALENDAR OAUTH - OPCIONAL ======

GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-google-client-secret
GOOGLE_REDIRECT_URI=https://crm.seudominio.com/api/auth/google/callback
# Chave base64 de 32 bytes para criptografar tokens (obrigatoria em producao)
# (gerar com: openssl rand -base64 32)
GOOGLE_TOKEN_ENCRYPTION_KEY=sua-chave-base64-aqui
```

### Gerando SESSION_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Deploy em Producao

### Pre-requisitos

- **Node.js**: 20.x ou superior
- **PostgreSQL**: 14.x ou superior (ou Supabase)
- **Supabase**: Projeto com bucket "uploads" criado
- **VPS**: Ubuntu 22.04 ou similar

### Passo a Passo Completo

#### 1. Preparar Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalacao
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 2. Clonar e Configurar

```bash
# Clonar repositorio
cd /var/www
git clone https://github.com/prospecttrafego/crm-alma-oficial.git
cd crm-alma-oficial

# Instalar dependencias
npm install

# Criar arquivo de ambiente
cp .env.example .env.production
nano .env.production  # Editar com credenciais reais
```

#### 3. Configurar Banco de Dados

```bash
# Aplicar schema
npm run db:push

# Verificar tabelas criadas
# (conectar no banco e listar tabelas)
```

#### 4. Build de Producao

```bash
npm run build
```

#### 5. Configurar PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicacao
pm2 start dist/index.cjs --name "crm-alma"

# Verificar status
pm2 status

# Ver logs
pm2 logs crm-alma

# Configurar auto-start no boot
pm2 save
pm2 startup
# (executar o comando que aparecer)
```

#### 6. Configurar Nginx

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuracao
sudo nano /etc/nginx/sites-available/crm-alma
```

Conteudo do arquivo:

```nginx
server {
    listen 80;
    server_name crm.seudominio.com;

    # Tamanho maximo de upload
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/crm-alma /etc/nginx/sites-enabled/

# Testar configuracao
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### 7. Configurar SSL (Certbot)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d crm.seudominio.com

# Auto-renovacao
sudo certbot renew --dry-run
```

#### 8. Criar Primeiro Usuario

Com `ALLOW_REGISTRATION=true`, acesse a aplicacao e crie uma conta. Depois, altere para `false` no .env.production e reinicie:

```bash
pm2 restart crm-alma
```

---

## Troubleshooting

### Erro: "Cannot find module"

```bash
rm -rf node_modules
npm install
```

### Erro: "ECONNREFUSED" no banco

Verificar se DATABASE_URL esta correta e se o banco aceita conexoes externas.

### WebSocket nao conecta

Verificar se Nginx esta configurado com os headers de upgrade.

### Upload nao funciona

1. Verificar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
2. Verificar se bucket "uploads" existe no Supabase
3. Verificar politicas de acesso do bucket

### Sessao expira rapido

Verificar se SESSION_SECRET esta configurado corretamente.

---

## Atualizacoes e Manutencao

### Atualizar Aplicacao

```bash
cd /var/www/crm-alma-oficial
git pull
npm install
npm run build
pm2 restart crm-alma
```

### Backup do Banco

```bash
pg_dump -U usuario -h host -d database > backup_$(date +%Y%m%d).sql
```

### Monitoramento

```bash
# Status PM2
pm2 status

# Monitoramento em tempo real
pm2 monit

# Logs
pm2 logs crm-alma --lines 100
```

---

## Consideracoes de Seguranca

1. **SESSION_SECRET**: Use uma chave forte de pelo menos 32 caracteres
2. **ALLOW_REGISTRATION**: Mantenha `false` em producao
3. **HTTPS**: Sempre use SSL em producao
4. **Firewall**: Libere apenas portas 80, 443 e SSH
5. **Senhas**: bcrypt com cost 12 (padrao)
6. **Sessoes**: Armazenadas no PostgreSQL, nao em memoria

---

## Contato e Suporte

- **Repositorio**: github.com/prospecttrafego/crm-alma-oficial
- **Desenvolvido para**: Alma Digital Agency
