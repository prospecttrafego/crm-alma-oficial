# CLAUDE.md - Instrucoes e Regras de Desenvolvimento

Este documento foca em **instrucoes obrigatorias** e **regras de desenvolvimento**. Detalhes tecnicos estao nos documentos especializados referenciados abaixo.

---

## Mapa de Documentacao

| Documento | Consultar para |
|-----------|---------------|
| `README.md` | Visao geral, stack tecnologica, comandos npm, quick start |
| `ESTRUTURA_DE_PASTAS.md` | Onde esta cada arquivo/pasta, responsabilidades de cada modulo |
| `DESIGN_SYSTEM.md` | Tokens CSS, cores, componentes UI, padroes de layout |
| `RODAR_LOCAL.md` | Configurar ambiente de desenvolvimento (Docker, .env.local) |
| `DEPLOY_COOLIFY_HOSTINGER.md` | Deploy em producao (Coolify v4, variaveis, troubleshooting) |
| `PLANO_DE_ACAO.md` | Melhorias arquiteturais planejadas |
| `TESTES_A_REALIZAR.md` | Checklist de testes para validar mudancas |

---

## Bugs e Erros Conhecidos

**IMPORTANTE:** Antes de iniciar qualquer tarefa de correcao, verificar a pasta `.bugs/`:

```
.bugs/
├── README.md          # Indice e instrucoes
├── active/            # Bugs pendentes (NAO RESOLVIDOS)
├── resolved/          # Bugs ja corrigidos (historico)
└── templates/         # Template para novos bugs
```

- **Leia `.bugs/README.md`** para entender a estrutura
- **Verifique `.bugs/active/`** para bugs pendentes com screenshots, logs e descricoes detalhadas
- **Apos corrigir**, mova a pasta do bug para `resolved/` e adicione notas da correcao

---

## Diretrizes de Desenvolvimento (OBRIGATORIO)

**Regras que DEVEM ser seguidas em TODA alteracao:**

1. **NUNCA seguir padrao ruim**: Se o arquivo ja esta grande/desorganizado, NAO adicionar mais codigo nele. Propor refatoracao ANTES de implementar.

2. **Pensar na arquitetura, nao so na tarefa**: Antes de implementar qualquer feature, avaliar: "Onde isso deveria morar? Faz sentido criar um modulo separado?" A qualidade arquitetural e tao importante quanto a funcionalidade.

3. **Refatorar quando necessario, mesmo sem ser pedido**: Se uma refatoracao beneficia o projeto, PROPOR ao usuario. Expandir escopo para melhorar estrutura e VALIDO.

4. **Estrutura > velocidade**: Criar arquivos/pastas novos quando fizer sentido, mesmo que de mais trabalho. Codigo bem organizado economiza tempo no futuro. Exemplos:
   - `storage.ts` grande → dividir em `storage/contacts.ts`, `storage/deals.ts`, etc.
   - Logica de automacao → criar `automations/` ou `services/`
   - Handlers complexos → separar em arquivos por responsabilidade

5. **Arquivos pequenos e focados**: Limite sugerido de ~300 linhas por arquivo. Acima disso, considerar dividir.

6. **Documentacao alinhada**: Sempre atualizar TODOS os arquivos .md relevantes quando houver mudancas estruturais.

7. **Contratos compartilhados (sem drift)**:
   - Schema do banco e enums: `shared/schema.ts` (entrypoint) + `shared/schema/` (modulos)
   - Validacao de entrada: schemas derivados via `drizzle-zod` em `shared/contracts.ts` (consumidos via `server/validation/`)
   - Validacao de respostas: `shared/apiSchemas*.ts` (consumidos via `client/src/lib/api/`)

8. **Schemas Zod para APIs externas**:
   - Usar `.nullish()` ao inves de `.optional()` para campos que podem vir como `null` de APIs externas (ex: Evolution API)
   - Normalizar campos no backend antes de retornar (`value ?? undefined`) para garantir consistencia
   - Motivo: APIs externas frequentemente retornam `null` ao inves de omitir campos, e `.optional()` nao aceita `null`

9. **Evitar N+1 queries**:
   - NUNCA fazer queries dentro de loops (for, forEach, map)
   - Usar `inArray()` do Drizzle para buscar multiplos registros de uma vez
   - Exemplo correto:
     ```typescript
     const ids = items.map(i => i.id);
     const results = await db.select().from(table).where(inArray(table.id, ids));
     const resultMap = new Map(results.map(r => [r.id, r]));
     ```

10. **Caching com Promise (evitar race conditions)**:
    - Para valores calculados uma vez e cacheados, usar Promise-based caching
    - Isso garante que multiplas chamadas concorrentes aguardem a mesma Promise
    - Exemplo: `server/tenant.ts` usa este padrao para organizationId

---

## Visao Geral do Projeto

**Alma CRM** e uma aplicacao SaaS de gestao de relacionamento com clientes para a agencia Alma, combinando:
- **Pipeline de Vendas (Kanban)**: Gestao visual de oportunidades
- **Inbox Unificado**: Central de comunicacoes multicanal (WhatsApp, email, interno)

### Caracteristicas Tecnicas
- **Monorepo**: Frontend (React 19) e Backend (Express) no mesmo repositorio
- **Type-safe**: TypeScript em toda a stack com Drizzle ORM
- **Real-time**: WebSockets para atualizacoes ao vivo
- **Single-tenant**: Schema suporta multi-org, mas roda em modo single-tenant por instalacao

> Detalhes da stack e comandos: ver `README.md`

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
│  Wouter │ TanStack Query │ shadcn/ui │ Tailwind CSS 4            │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/REST │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                          │
│  Passport.js │ Drizzle ORM │ WebSocket (ws)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICOS EXTERNOS                           │
│  PostgreSQL │ Supabase Storage │ OpenAI │ Evolution API (WA)     │
│  Google Calendar │ Upstash Redis │ Firebase (FCM)                │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados
1. **HTTP**: Cliente → Express → Drizzle → PostgreSQL
2. **Upload**: Cliente → Express → Supabase Storage
3. **Real-time**: Express → WebSocket → Clientes conectados
4. **AI Scoring**: Express → OpenAI API → Banco
5. **WhatsApp**: Evolution API → Webhook → Express → Banco → WebSocket
6. **Google Calendar**: OAuth → Google API → Banco → WebSocket
7. **Push**: Express → Firebase → Dispositivo

> Estrutura de pastas detalhada: ver `ESTRUTURA_DE_PASTAS.md`

---

## Comportamentos Automatizados

### Auto-criacao de Empresa (Contatos)
Ao criar contato com `companyName`:
1. Backend busca empresa existente pelo nome (case-insensitive)
2. Se nao existir, cria automaticamente
3. Vincula contato a empresa

**Nota:** Empresas nao possuem rotas/paginas dedicadas - sao gerenciadas automaticamente.

### Auto-criacao de Deal (WhatsApp)
Quando mensagem chega via Evolution API:
1. Cria/atualiza contato pelo telefone
2. Verifica se contato possui deals abertos
3. Se NAO houver deal aberto, cria automaticamente:
   - Pipeline: default da org (ou cria "Pipeline Padrao")
   - Stage: primeiro (menor `order`)
   - Titulo: "Lead WhatsApp: {nome ou telefone}"
   - Source: "whatsapp", Probability: 10%, Status: "open"

---

## Schema do Banco de Dados

### Tabelas Principais

**users**: id (UUID), email, passwordHash, firstName, lastName, role ('admin'|'sales'|'cs'|'support'), organizationId, preferences (jsonb)

**organizations**: id, name, domain, logo

**contacts**: id, firstName, lastName, email, phone, companyId, organizationId, ownerId, tags[], source, customFields

**companies**: id, name, domain, website, segment, industry, organizationId

**pipelines**: id, name, organizationId, isDefault

**pipeline_stages**: id, name, pipelineId, order, color, isWon, isLost

**deals**: id, title, value, currency, pipelineId, stageId, contactId, companyId, organizationId, ownerId, probability, expectedCloseDate, status ('open'|'won'|'lost'), lostReason, source, notes

**conversations**: id, subject, channel ('email'|'whatsapp'|'sms'|'internal'|'phone'), status ('open'|'closed'|'pending'), contactId, dealId, assignedToId, lastMessageAt, unreadCount

**messages**: id, conversationId, senderId, senderType ('user'|'contact'|'system'), content, contentType ('text'|'audio'|'image'|'file'|'video'), isInternal, attachments[], metadata, readBy[]

**activities**: id, type ('call'|'email'|'meeting'|'note'|'task'), title, description, contactId, dealId, userId, dueDate, completedAt, status

### Tabelas Auxiliares
sessions, notifications, push_tokens, saved_views, email_templates, audit_logs, files, lead_scores, calendar_events, google_oauth_tokens, channel_configs

---

## API Endpoints

**Padrao de resposta:** `{ success, data }` para JSON, `204` sem corpo.

### Autenticacao
```
POST   /api/login, /api/logout, /api/register
GET    /api/auth/me, /api/auth/user
PATCH  /api/users/me
GET    /api/users
```

### Health e Jobs
```
GET    /api/healthz (publico), /api/health (admin)
GET    /api/jobs/:id, /api/jobs/:id/status, /api/jobs/stats
POST   /api/jobs/cleanup
```

### CRUD Principal
```
# Contacts
GET/POST /api/contacts | GET/PATCH/DELETE /api/contacts/:id

# Pipelines e Stages
GET/POST /api/pipelines | PATCH/DELETE /api/pipelines/:id
POST /api/pipelines/:id/set-default
POST /api/pipelines/:id/stages | PATCH/DELETE /api/pipelines/:pipelineId/stages/:id

# Deals
GET/POST /api/deals | GET/PATCH/DELETE /api/deals/:id
PATCH /api/deals/:id/stage

# Conversations e Messages
GET/POST /api/conversations | GET/PATCH /api/conversations/:id
GET/POST /api/conversations/:id/messages
POST /api/conversations/:id/read

# Activities
GET/POST /api/activities | PATCH/DELETE /api/activities/:id
GET /api/contacts/:id/activities
```

### Arquivos
```
POST /api/files/upload-url, /api/files
GET  /api/files/:entityType/:entityId | DELETE /api/files/:id
GET  /api/files/:id/signed-url
POST /api/audio/transcribe, /api/files/:id/transcribe
```

### Outros
```
GET /api/search?q=termo
GET /api/notifications, /api/notifications/unread-count
GET /api/calendar-events, /api/audit-logs, /api/reports
GET /api/saved-views, /api/email-templates
```

### Integracoes
```
# WhatsApp (Evolution)
GET/POST /api/channel-configs/:id/whatsapp/*
POST /api/webhooks/evolution

# Google Calendar
GET /api/integrations/google-calendar/*
GET /api/auth/google/*

# WebSocket
GET /ws
```

---

## Variaveis de Ambiente

### Obrigatorias
```bash
DATABASE_URL=postgresql://...       # Conexao PostgreSQL
SESSION_SECRET=...                   # Chave 32+ caracteres
NODE_ENV=production
PORT=3000
```

### Recomendadas
```bash
APP_URL=https://crm.seudominio.com  # URL publica
DEFAULT_ORGANIZATION_ID=1            # Single-tenant
SUPABASE_URL=...                     # Storage
SUPABASE_SERVICE_ROLE_KEY=...
```

> Configuracao completa: ver `RODAR_LOCAL.md` (dev) ou `DEPLOY_COOLIFY_HOSTINGER.md` (prod)

---

## Estrategia Real-time (WebSocket)

### Principio
**WebSocket e a fonte primaria.** Polling (`refetchInterval`) apenas como fallback quando WS desconectado.

### Eventos WebSocket (Backend → Frontend)

| Evento | Estrategia | Descricao |
|--------|------------|-----------|
| `pipeline:*` | **setQueryData** | Atualiza cache diretamente (sem refetch) |
| `pipeline:stage:*` | **setQueryData** | Atualiza stages dentro do pipeline no cache |
| `deal:*` | **setQueryData** | Atualiza cache diretamente (sem refetch) |
| `channel:config:*` | **setQueryData** | Atualiza cache diretamente (sem refetch) |
| `message:created/updated/deleted` | **setQueryData** | Append/update/mark no cache de mensagens |
| `conversation:created` | **invalidate** | Invalida lista de conversas |
| `conversation:updated` | **setQueryData** | Atualiza lastMessageAt/unreadCount no cache |
| `notification:new` | **setQueryData + invalidate** | Atualiza unreadCount direto, invalida lista |
| `calendar:event:*` | **invalidate** | Invalida `/api/calendar-events` |
| `google_calendar:sync_complete` | **invalidate** | Invalida status e eventos |
| `typing`, `user:online/offline` | **estado local** | Nao afeta cache do React Query |

### Mutations com Updates Otimistas (onMutate)

Os hooks de mutation usam `onMutate` para updates otimistas com rollback automatico em caso de erro:

| Hook | Mutations Otimistas |
|------|---------------------|
| `usePipelineMutations` | update, delete, setDefault |
| `useDealMutations` | update, delete, move |
| `useChannelConfigMutations` | update, delete, disconnect |

**Beneficio:** UI atualiza instantaneamente, sem esperar resposta do servidor.

### Polling Permitido (somente fallback)
- `notification-bell.tsx`: 60s quando WS desconectado
- `whatsapp-qr-modal.tsx`: 3s durante pareamento QR
- `calendar.tsx`, `channels/index.tsx`: 30s quando WS desconectado

**Regra:** Novos componentes NAO devem usar `refetchInterval` fixo.

### Configuracao de Cache (React Query)

```typescript
// client/src/lib/queryClient.ts
staleTime: 5 * 60 * 1000,  // 5 minutos - dados ficam "fresh" por mais tempo
gcTime: 30 * 60 * 1000,    // 30 minutos - dados permanecem em cache
```

### Preferencias de Usuario
- **Backend** (`user.preferences`): fonte de verdade quando autenticado
- **localStorage**: cache para UI instantanea e fallback pre-login
- **Fluxo**: Ao alterar, salva em localStorage (UI instantanea) + PATCH `/api/users/me` se autenticado
- **Ao login**: backend sobrescreve localStorage

**Preferencias sincronizadas:**
- `language`: "pt-BR" | "en"
- `theme`: "light" | "dark" | "system"
- `soundEnabled`: boolean

---

## Regras de organizationId (Single-tenant)

- `organizationId` e gerenciado pelo backend (`DEFAULT_ORGANIZATION_ID`)
- Requests de criacao NAO devem enviar organizationId
- Requests de atualizacao NAO podem alterar organizationId

---

## Debitos Tecnicos

### Email de Reset de Senha
**Status:** ADIADO

Token e gerado e armazenado, mas email NAO e enviado automaticamente. Para implementar:
1. Criar `server/services/email.ts` com SMTP ou servico (SendGrid, SES)
2. Criar template de email
3. Conectar no fluxo de forgot-password
4. Adicionar variaveis SMTP

---

## Contato

- **Repositorio**: github.com/prospecttrafego/crm-alma-oficial
- **Desenvolvido para**: Alma Digital Agency
