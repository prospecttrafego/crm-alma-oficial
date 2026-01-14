Este documento contém TODOS os pontos identificados na análise crítica, organizados em milestones com checkboxes para acompanhamento.

---

## Sumário Executivo

- **Total de Issues Identificadas:** 78
- **Estimativa Total:** ~180 horas
- **Milestones:** 8
- **Sprints Recomendados:** 6-8 (2 semanas cada)

### Progresso Atual

| Milestone | Status | Commit |
|-----------|--------|--------|
| 1 - Segurança e Integridade | ✅ CONCLUÍDO | `a297941` |
| 2 - Confiabilidade Integrações | ✅ CONCLUÍDO | `77c6c9f` |
| 3 - Refatoração Frontend | ✅ CONCLUÍDO | (pendente commit) |
| 4 - Refatoração Backend | ✅ CONCLUÍDO | (pendente commit) |
| 5 - Performance | ⏳ PENDENTE | - |
| 6 - Qualidade de Código | ⏳ PENDENTE | - |
| 7 - Segurança Adicional | ⏳ PENDENTE | - |
| 8 - Observabilidade e DevOps | ⏳ PENDENTE | - |

---

## Milestone 1: Segurança e Integridade de Dados (CRÍTICO) ✅ CONCLUÍDO

**Prioridade:** P0 - Resolver IMEDIATAMENTE **Estimativa:** 32 horas **Risco se não resolver:** Perda de dados, vulnerabilidades de segurança

**Status:** Implementado em commit `a297941` (feat(security): Milestone 1 - Security and Data Integrity improvements)

### 1.1 Foreign Keys no Banco de Dados

**Arquivos:** `shared/schema.ts`

- [x] **1.1.1** Adicionar FK `deals.pipelineId` → `pipelines.id` com `ON DELETE CASCADE`
- [x] **1.1.2** Adicionar FK `deals.stageId` → `pipeline_stages.id` com `ON DELETE CASCADE`
- [x] **1.1.3** Adicionar FK `deals.contactId` → `contacts.id` com `ON DELETE SET NULL`
- [x] **1.1.4** Adicionar FK `deals.companyId` → `companies.id` com `ON DELETE SET NULL`
- [x] **1.1.5** Adicionar FK `deals.ownerId` → `users.id` com `ON DELETE SET NULL`
- [x] **1.1.6** Adicionar FK `contacts.companyId` → `companies.id` com `ON DELETE SET NULL`
- [x] **1.1.7** Adicionar FK `contacts.ownerId` → `users.id` com `ON DELETE SET NULL`
- [x] **1.1.8** Adicionar FK `conversations.contactId` → `contacts.id` com `ON DELETE CASCADE`
- [x] **1.1.9** Adicionar FK `conversations.dealId` → `deals.id` com `ON DELETE SET NULL`
- [x] **1.1.10** Adicionar FK `conversations.assignedToId` → `users.id` com `ON DELETE SET NULL`
- [x] **1.1.11** Adicionar FK `messages.conversationId` → `conversations.id` com `ON DELETE CASCADE`
- [x] **1.1.12** Adicionar FK `activities.contactId` → `contacts.id` com `ON DELETE CASCADE`
- [x] **1.1.13** Adicionar FK `activities.dealId` → `deals.id` com `ON DELETE SET NULL`
- [x] **1.1.14** Adicionar FK `pipeline_stages.pipelineId` → `pipelines.id` com `ON DELETE CASCADE`
- [x] **1.1.15** Gerar migration com `npm run db:generate`
- [x] **1.1.16** Testar migration em ambiente de staging
- [ ] **1.1.17** Aplicar migration em produção

**Código de referência (Drizzle ORM):**

typescript

```typescript
// Exemplo de como adicionar FK com CASCADE:
pipelineId: integer("pipeline_id")
  .references(() => pipelines.id, { onDelete: 'cascade', onUpdate: 'cascade' })
  .notNull(),
```

### 1.2 Validação de Webhook WhatsApp

**Arquivos:** `server/api/evolution.ts`

- [x] **1.2.1** Tornar `EVOLUTION_WEBHOOK_SECRET` OBRIGATÓRIO em produção
- [x] **1.2.2** Retornar 401 (não 200) quando token inválido
- [x] **1.2.3** Logar tentativas de acesso inválidas com IP
- [x] **1.2.4** Adicionar rate limiting específico para webhook

### 1.3 Transação em LGPD Delete

**Arquivos:** `server/api/lgpd.ts`

- [x] **1.3.1** Envolver todas as operações de delete em `db.transaction()`
- [x] **1.3.2** Implementar rollback em caso de falha
- [x] **1.3.3** Adicionar logging estruturado de cada step
- [x] **1.3.4** Testar cenário de falha parcial

### 1.4 Race Condition na Auto-Criação de Deal

**Arquivos:** `server/integrations/evolution/handler.ts`

- [x] **1.4.1** Implementar lock pessimista com `SELECT FOR UPDATE`
- [x] **1.4.2** Ou usar upsert idempotente com constraint unique
- [ ] **1.4.3** Adicionar testes para cenário de mensagens simultâneas

### 1.5 Password Reset Token

**Arquivos:** `server/auth.ts`

- [x] **1.5.1** Invalidar token ANTES de processar reset (não depois)
- [x] **1.5.2** Usar transação para atomicidade
- [x] **1.5.3** Reduzir TTL de 1 hora para 15 minutos

---

## Milestone 2: Confiabilidade das Integrações ✅ CONCLUÍDO

**Prioridade:** P0 **Estimativa:** 28 horas **Risco se não resolver:** Perda silenciosa de dados, falhas em cascata

**Status:** Implementado em commit `77c6c9f` (feat(reliability): Milestone 2 - Integration Reliability improvements)

### 2.1 Circuit Breaker Pattern

**Arquivos:** Criar `server/lib/circuit-breaker.ts`

- [x] **2.1.1** Criar classe `CircuitBreaker` genérica
- [x] **2.1.2** Aplicar em Evolution API client
- [x] **2.1.3** Aplicar em OpenAI client
- [x] **2.1.4** Aplicar em Google Calendar client
- [x] **2.1.5** Aplicar em Supabase Storage client
- [x] **2.1.6** Configurar thresholds (5 falhas → open, 30s → half-open)
- [x] **2.1.7** Adicionar métricas de circuit state

### 2.2 Persistência de Jobs

**Arquivos:** `server/jobs/queue.ts`

- [x] **2.2.1** Remover fallback em memória (ou torná-lo explícito)
- [x] **2.2.2** Tornar Redis OBRIGATÓRIO para jobs em produção
- [x] **2.2.3** Implementar persistência de jobs pending em startup
- [x] **2.2.4** Adicionar health check para fila de jobs

### 2.3 Dead Letter Queue

**Arquivos:** `server/jobs/queue.ts`, criar `server/jobs/dead-letter.ts`

- [x] **2.3.1** Criar tabela `dead_letter_jobs` no schema
- [x] **2.3.2** Mover jobs falhos para DLQ após max retries
- [x] **2.3.3** Criar endpoint admin para visualizar DLQ
- [x] **2.3.4** Criar endpoint admin para retry manual de job
- [x] **2.3.5** Adicionar alerta (log estruturado) quando job vai para DLQ

### 2.4 Webhook Response Correta

**Arquivos:** `server/api/evolution.ts`

- [x] **2.4.1** Retornar 500 quando processamento falha (não 200)
- [x] **2.4.2** Implementar acknowledgment pattern (200 imediato, processamento async)
- [x] **2.4.3** Adicionar idempotency key no response

### 2.5 Google Calendar Token Refresh

**Arquivos:** `server/jobs/handlers.ts`, `server/integrations/google/calendar.ts`

- [x] **2.5.1** Verificar se resposta de refresh contém novo refresh_token
- [x] **2.5.2** Atualizar refresh_token quando Google retornar novo
- [x] **2.5.3** Adicionar retry em caso de falha de refresh
- [x] **2.5.4** Corrigir perda de syncToken em full sync

### 2.6 OpenAI Rate Limiting

**Arquivos:** `server/integrations/openai/scoring.ts`

- [x] **2.6.1** Implementar rate limiter para chamadas OpenAI
- [x] **2.6.2** Adicionar queue de prioridade para scoring
- [x] **2.6.3** Implementar retry com backoff exponencial para 429
- [x] **2.6.4** Adicionar limite diário de chamadas (custo)
- [x] **2.6.5** Implementar cache de scores recentes

### 2.7 Cleanup de Arquivos Órfãos

**Arquivos:** Criar `server/jobs/file-cleanup.ts`

- [x] **2.7.1** Criar job periódico para identificar arquivos órfãos
- [x] **2.7.2** Implementar soft-delete com período de graça (7 dias)
- [x] **2.7.3** Deletar do Supabase após período de graça
- [x] **2.7.4** Adicionar endpoint admin para forçar cleanup

---

## Milestone 3: Refatoração do Frontend (Manutenibilidade) ✅ CONCLUÍDO

**Prioridade:** P1 **Estimativa:** 48 horas **Risco se não resolver:** Velocidade de desenvolvimento reduzida, bugs difíceis de encontrar

**Status:** Implementado (pendente commit)

### 3.1 Quebrar settings.tsx (2.348 linhas)

**Arquivos:** `client/src/pages/settings.tsx` → `client/src/pages/settings/`

- [x] **3.1.1** Criar estrutura de pastas `settings/components/`
- [x] **3.1.2** Extrair `PipelineSection.tsx` (~150 linhas)
- [x] **3.1.3** Extrair `PipelineDialog.tsx` (~150 linhas)
- [x] **3.1.4** Extrair `StageDialog.tsx` (~150 linhas)
- [x] **3.1.5** Extrair `ChannelSection.tsx` (~150 linhas)
- [x] **3.1.6** Extrair `ChannelEmailDialog.tsx` (~200 linhas)
- [x] **3.1.7** Extrair `ChannelWhatsAppDialog.tsx` (~200 linhas)
- [x] **3.1.8** Extrair `WhatsAppQRCode.tsx` (~100 linhas)
- [x] **3.1.9** Extrair `UserSection.tsx` (~150 linhas)
- [x] **3.1.10** Extrair `OrganizationSection.tsx` (~150 linhas)
- [x] **3.1.11** Criar `settings/index.tsx` como orquestrador (~150 linhas)
- [x] **3.1.12** Criar `settings/hooks/useSettingsState.ts`

### 3.2 Refatorar Inbox (Props Drilling → Context)

**Arquivos:** `client/src/pages/inbox.tsx`, criar `client/src/contexts/InboxContext.tsx`

- [x] **3.2.1** Criar `InboxContext` com estado compartilhado
- [x] **3.2.2** Mover useState de conversation selection para context
- [x] **3.2.3** Mover useState de filters para context
- [x] **3.2.4** Mover useState de message composition para context
- [x] **3.2.5** Mover useState de audio recording para context
- [x] **3.2.6** Mover useState de file upload para context
- [x] **3.2.7** Criar hook `useInbox()` para consumir context
- [x] **3.2.8** Refatorar `ConversationListPanel` para usar context
- [x] **3.2.9** Refatorar `ThreadPanel` para usar context
- [x] **3.2.10** Refatorar `ContextPanel` para usar context

### 3.3 Extrair Hooks de Mutação Reutilizáveis

**Arquivos:** Criar `client/src/hooks/mutations/`

- [x] **3.3.1** Criar `usePipelineMutations.ts`
- [x] **3.3.2** Criar `useStageMutations.ts`
- [x] **3.3.3** Criar `useChannelConfigMutations.ts`
- [x] **3.3.4** Criar `useCalendarEventMutations.ts`
- [x] **3.3.5** Criar `useActivityMutations.ts`
- [x] **3.3.6** Padronizar onSuccess/onError entre todos os hooks
- [x] **3.3.7** Migrar uso em settings.tsx para hooks extraídos
- [x] **3.3.8** Migrar uso em calendar.tsx para hooks extraídos

### 3.4 Implementar Lazy Loading de Páginas

**Arquivos:** `client/src/App.tsx` ou arquivo de rotas

- [x] **3.4.1** Converter import de `PipelinePage` para `lazy()`
- [x] **3.4.2** Converter import de `InboxPage` para `lazy()`
- [x] **3.4.3** Converter import de `SettingsPage` para `lazy()`
- [x] **3.4.4** Converter import de `CalendarPage` para `lazy()`
- [x] **3.4.5** Converter import de `ReportsPage` para `lazy()`
- [x] **3.4.6** Converter import de `ContactsPage` para `lazy()`
- [x] **3.4.7** Adicionar `<Suspense>` com fallback de loading
- [x] **3.4.8** Criar componente `PageLoader.tsx` para fallback consistente

**Código de referência (React 19):**

typescript

```typescript
import { lazy, Suspense } from 'react';
const PipelinePage = lazy(() => import('./pages/pipeline'));

// No render:
<Suspense fallback={<PageLoader />}>
  <PipelinePage />
</Suspense>
```

### 3.5 Memoização Estratégica

**Arquivos:** `client/src/pages/inbox.tsx`, `client/src/pages/pipeline.tsx`

- [x] **3.5.1** Adicionar `useMemo` para `filteredConversations`
- [x] **3.5.2** Adicionar `useMemo` para `filteredDeals`
- [x] **3.5.3** Adicionar `useCallback` para handlers de click
- [x] **3.5.4** Adicionar `useCallback` para `onSelectConversation`
- [x] **3.5.5** Adicionar `React.memo` em `ConversationListItem`
- [x] **3.5.6** Adicionar `React.memo` em `DealCard`
- [x] **3.5.7** Configurar `notifyOnChangeProps` em queries críticas

**Código de referência (TanStack Query):**

typescript

```typescript
const { data } = useQuery({
  queryKey: ['deals'],
  queryFn: dealsApi.list,
  notifyOnChangeProps: ['data', 'isLoading'], // Otimização
});
```

---

## Milestone 4: Refatoração do Backend (Manutenibilidade) ✅ CONCLUÍDO

**Prioridade:** P1 **Estimativa:** 24 horas

**Status:** Implementado (pendente commit)

### 4.1 Quebrar Arquivos Grandes

**Arquivos:** `server/api/channelConfigs.ts` (714 linhas)

- [x] **4.1.1** Extrair `EmailConfigService` para `server/services/email-config.ts`
- [x] **4.1.2** Extrair `WhatsAppConfigService` para `server/services/whatsapp-config.ts`
- [x] **4.1.3** Extrair `processIncomingEmail` para `server/services/email-ingest.ts`
- [x] **4.1.4** Reduzir `channelConfigs.ts` para ~200 linhas (apenas rotas)

**Arquivos:** `server/integrations/evolution/handler.ts` (538 linhas)

- [x] **4.1.5** Extrair `ContactResolver` para `server/services/contact-resolver.ts`
- [x] **4.1.6** Extrair `ConversationResolver` para `server/services/conversation-resolver.ts`
- [x] **4.1.7** Extrair `DealAutoCreator` para `server/services/deal-auto-creator.ts`
- [x] **4.1.8** Extrair `MediaDownloader` para `server/services/media-downloader.ts`
- [x] **4.1.9** Reduzir `handler.ts` para ~150 linhas (apenas orquestração)

**Arquivos:** `server/jobs/queue.ts` (476 linhas)

- [x] **4.1.10** Extrair `JobSerializer` para `server/jobs/types.ts`
- [x] **4.1.11** Extrair `JobWorker` para `server/jobs/queue.ts` (refatorado)
- [x] **4.1.12** Extrair `RedisJobStore` para `server/jobs/storage.ts`
- [x] **4.1.13** Reduzir `queue.ts` para ~150 linhas (API pública)

### 4.2 Remover Type Assertions (75x `as any`)

**Arquivos:** Diversos no backend

- [x] **4.2.1** Criar tipos específicos para `req.user` em `server/types/express.d.ts`
- [x] **4.2.2** Remover `as any` de `getCurrentUser()` em middleware.ts
- [x] **4.2.3** Remover `as any` de response.ts
- [x] **4.2.4** Remover `as any` de auth.ts
- [x] **4.2.5** Auditar e corrigir restantes (18 arquivos API atualizados)

### 4.3 Substituir console.log por Logger

**Arquivos:** `server/redis.ts`, `server/ws/index.ts`, diversos

- [x] **4.3.1** Criar instâncias de logger por módulo
- [x] **4.3.2** Substituir `console.log` em redis.ts (20+ ocorrências)
- [x] **4.3.3** Substituir `console.error` em ws/index.ts
- [x] **4.3.4** Substituir em auth.ts
- [x] **4.3.5** Substituir em jobs/queue.ts
- [x] **4.3.6** Configurar log levels por ambiente

### 4.4 Unificar Rate Limiting

**Arquivos:** `server/auth.ts`

- [x] **4.4.1** Remover implementação local (Map) de rate limiting
- [x] **4.4.2** Usar apenas Redis para rate limiting
- [x] **4.4.3** Implementar fallback gracioso quando Redis indisponível
- [ ] **4.4.4** Adicionar testes para rate limiting

---

## Milestone 5: Performance

**Prioridade:** P2 **Estimativa:** 20 horas

### 5.1 Consolidar Queries do Dashboard

**Arquivos:** `server/storage/reports.ts`

- **5.1.1** Reescrever `getDashboardStats` com uma única query usando CTEs
- **5.1.2** Ou usar subqueries para reduzir round-trips
- **5.1.3** Adicionar índices necessários para as queries
- **5.1.4** Implementar cache de stats (5 minutos)

### 5.2 Corrigir N+1 em LGPD Export

**Arquivos:** `server/api/lgpd.ts`

- **5.2.1** Reescrever para usar uma query com JOIN
- **5.2.2** Usar `inArray()` para buscar mensagens em batch
- **5.2.3** Adicionar paginação no export (chunked)

### 5.3 Adicionar Índices Composite

**Arquivos:** `shared/schema.ts`

- **5.3.1** Adicionar índice `(organizationId, email)` em users
- **5.3.2** Adicionar índice `(conversationId, createdAt)` em messages
- **5.3.3** Adicionar índice `(contactId, channel)` em conversations
- **5.3.4** Adicionar índice `(entityType, entityId)` em files
- **5.3.5** Adicionar índice `(organizationId, status)` em conversations
- **5.3.6** Gerar e aplicar migration

### 5.4 Configurar Pool de Conexões

**Arquivos:** `server/db.ts`

- **5.4.1** Configurar `max: 20` conexões
- **5.4.2** Configurar `min: 5` conexões
- **5.4.3** Configurar `idleTimeoutMillis: 30000`
- **5.4.4** Configurar `connectionTimeoutMillis: 2000`
- **5.4.5** Adicionar health check do pool

### 5.5 Cache de Mensagens com Validação

**Arquivos:** `server/redis.ts`

- **5.5.1** Adicionar validação Zod no cache read
- **5.5.2** Invalidar cache em caso de schema mismatch
- **5.5.3** Adicionar versionamento de cache

---

## Milestone 6: Qualidade de Código

**Prioridade:** P2 **Estimativa:** 16 horas

### 6.1 Extrair Magic Numbers/Strings

**Arquivos:** Diversos

- **6.1.1** Criar `server/constants.ts` com todas as constantes
- **6.1.2** Mover `PASSWORD_RESET_TOKEN_LENGTH` para constants
- **6.1.3** Mover `MESSAGES_CACHE_TTL_SECONDS` para constants
- **6.1.4** Mover `MAX_CACHED_MESSAGES` para constants
- **6.1.5** Mover `LOGIN_WINDOW_MS` para constants
- **6.1.6** Mover `PROCESSING_STALE_MS` para constants

### 6.2 Corrigir Keyboard Shortcuts

**Arquivos:** `client/src/pages/inbox.tsx`

- **6.2.1** Usar `useRef` para armazenar handler
- **6.2.2** Evitar recriar listener a cada mudança de dependência
- **6.2.3** Adicionar debounce para keypresses rápidos
- **6.2.4** Limpar listeners corretamente no unmount

### 6.3 Corrigir Refs e Intervalos

**Arquivos:** `client/src/pages/inbox.tsx`

- **6.3.1** Adicionar cleanup de `recordingIntervalRef` em useEffect
- **6.3.2** Garantir que gravação para se componente desmontar
- **6.3.3** Organizar refs em grupos lógicos

### 6.4 Documentação Inline

**Arquivos:** Diversos

- **6.4.1** Adicionar JSDoc em funções públicas de storage
- **6.4.2** Documentar parâmetros e retornos
- **6.4.3** Adicionar exemplos de uso onde apropriado

### 6.5 Implementar Email de Reset de Senha

**Status:** ADIADO (implementar em fase posterior)

**Arquivos:** `server/auth.ts`, criar `server/services/email.ts`

- **6.5.1** ~~Criar serviço de email (SMTP ou provider)~~ - ADIADO
- **6.5.2** ~~Implementar template de reset de senha~~ - ADIADO
- **6.5.3** ~~Conectar no fluxo de forgot-password~~ - ADIADO
- **6.5.4** Documentar TODO no CLAUDE.md como débito conhecido

---

## Milestone 7: Segurança Adicional

**Prioridade:** P2 **Estimativa:** 8 horas

### 7.1 organizationId - Feedback Explícito

**Arquivos:** `server/middleware.ts`

- **7.1.1** Retornar erro 400 quando cliente tentar modificar organizationId
- **7.1.2** Adicionar mensagem explicativa no erro

### 7.2 Email Case-Insensitive

**Arquivos:** `shared/schema.ts`

- **7.2.1** Adicionar índice `LOWER(email)` em users
- **7.2.2** Adicionar índice `LOWER(email)` em contacts
- **7.2.3** Garantir que todas as queries usem LOWER

### 7.3 CHECK Constraints

**Arquivos:** `shared/schema.ts`

- **7.3.1** Adicionar CHECK `probability >= 0 AND probability <= 100`
- **7.3.2** Adicionar CHECK `value >= 0` em deals
- **7.3.3** Adicionar CHECK `order >= 0` em pipeline_stages

### 7.4 Audit Logs Imutáveis

**Arquivos:** `shared/schema.ts`, storage

- **7.4.1** Remover capacidade de UPDATE/DELETE em audit_logs
- **7.4.2** Criar trigger para impedir modificações
- **7.4.3** Documentar política de retenção

---

## Milestone 8: Observabilidade e DevOps

**Prioridade:** P3 **Estimativa:** 12 horas

### 8.1 Migrations Versionadas

**Arquivos:** `migrations/`

- **8.1.1** Gerar todas as migrations pendentes
- **8.1.2** Commitar migrations no repositório
- **8.1.3** Documentar processo de rollback
- **8.1.4** Criar script de validação de migrations

### 8.2 Health Checks Aprimorados

**Arquivos:** `server/health.ts`

- **8.2.1** Adicionar health check do pool de conexões
- **8.2.2** Adicionar health check da fila de jobs
- **8.2.3** Adicionar health check de circuit breakers
- **8.2.4** Expor métricas para monitoring

### 8.3 Alertas Estruturados (Sentry)

**Arquivos:** `server/logger.ts`, criar `server/lib/sentry.ts`

- **8.3.1** Instalar `@sentry/node` no backend
- **8.3.2** Configurar Sentry DSN via variável de ambiente
- **8.3.3** Criar wrapper para captura de erros
- **8.3.4** Integrar Sentry no error handler global
- **8.3.5** Configurar alertas para jobs falhos (via Sentry.captureException)
- **8.3.6** Configurar alertas para circuit breakers abertos
- **8.3.7** Adicionar breadcrumbs em operações críticas

### 8.4 Limite de Upload de Arquivos

**Arquivos:** `server/api/files.ts`, `server/integrations/supabase/storage.ts`

- **8.4.1** Adicionar validação de tamanho máximo (50MB)
- **8.4.2** Retornar erro 413 para arquivos muito grandes
- **8.4.3** Documentar limites no CLAUDE.md

### 8.5 URLs de Arquivos Temporárias

**Arquivos:** `server/integrations/supabase/storage.ts`

- **8.5.1** Usar signed URLs com expiração para arquivos sensíveis
- **8.5.2** Configurar TTL de 1 hora para URLs
- **8.5.3** Manter URLs públicas apenas para assets estáticos

---

## Cronograma Sugerido (Execução Sequencial)

**Modo:** Sequencial (um milestone por vez para maior controle)

| **Sprint** | **Milestone** | **Foco**                     | **Horas** | **Dependências**    |
| ---------- | ------------- | ---------------------------- | --------- | ------------------- |
| 1          | 1             | Segurança e Integridade      | 32h       | Nenhuma             |
| 2          | 2             | Confiabilidade Integrações   | 28h       | M1 (FK necessárias) |
| 3          | 3.1-3.2       | Frontend (settings, inbox)   | 24h       | Nenhuma             |
| 4          | 3.3-3.5       | Frontend (hooks, lazy, memo) | 24h       | M3.1-3.2            |
| 5          | 4             | Backend (refatoração)        | 24h       | M1, M2              |
| 6          | 5-6           | Performance + Qualidade      | 36h       | M4                  |
| 7          | 7-8           | Segurança + DevOps (Sentry)  | 20h       | M5, M6              |

**Nota:** Email de reset de senha ADIADO para fase posterior.

---

## Configurações de Bibliotecas

### Sentry (Milestone 8.3)

**Instalação:**

bash

```bash
npm install @sentry/node
```

**Configuração básica (`server/lib/sentry.ts`):**

typescript

```typescript
import * as Sentry from '@sentry/node';

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('[Sentry] DSN não configurado, alertas desabilitados');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% das transações
    beforeSend(event) {
      // Remover dados sensíveis
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}

export { Sentry };
```

**Variável de ambiente necessária:**

bash

```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Drizzle ORM - Foreign Keys (Milestone 1.1)

**Sintaxe para adicionar FK com CASCADE:**

typescript

```typescript
// Método 1: Inline com references()
pipelineId: integer("pipeline_id")
  .references(() => pipelines.id, { onDelete: 'cascade', onUpdate: 'cascade' })
  .notNull(),

// Método 2: Table-level com foreignKey()
import { foreignKey } from 'drizzle-orm/pg-core';

export const deals = pgTable('deals', {
  // ... columns
}, (table) => [
  foreignKey({
    name: "deals_pipeline_fk",
    columns: [table.pipelineId],
    foreignColumns: [pipelines.id],
  }).onDelete('cascade').onUpdate('cascade'),
]);
```

### React Lazy Loading (Milestone 3.4)

**Sintaxe React 19:**

typescript

```typescript
import { lazy, Suspense } from 'react';

// Declarar componentes lazy
const PipelinePage = lazy(() => import('./pages/pipeline'));
const InboxPage = lazy(() => import('./pages/inbox'));
const SettingsPage = lazy(() => import('./pages/settings'));

// Usar com Suspense
<Suspense fallback={<PageLoader />}>
  <Route path="/pipeline" component={PipelinePage} />
</Suspense>
```

### TanStack Query - Otimização (Milestone 3.5)

**Configurar notifyOnChangeProps:**

typescript

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['deals'],
  queryFn: dealsApi.list,
  notifyOnChangeProps: ['data', 'isLoading'], // Só re-render nesses casos
});
```

**Memoizar select function:**

typescript

```typescript
const { data } = useQuery({
  queryKey: ['deals'],
  queryFn: dealsApi.list,
  select: useCallback((data) => data.filter(d => d.status === 'open'), []),
});
```

---

## Arquivos Críticos a Modificar

### Backend

- `shared/schema.ts` - Foreign keys, índices, constraints
- `server/api/evolution.ts` - Validação webhook
- `server/api/lgpd.ts` - Transações
- `server/integrations/evolution/handler.ts` - Race condition, refatoração
- `server/jobs/queue.ts` - Persistência, DLQ
- `server/auth.ts` - Rate limiting, password reset
- `server/db.ts` - Pool de conexões
- `server/redis.ts` - Logger
- `server/middleware.ts` - Types

### Frontend

- `client/src/pages/settings.tsx` - Quebrar em módulos
- `client/src/pages/inbox.tsx` - Context, memoização
- `client/src/pages/pipeline.tsx` - Memoização
- `client/src/App.tsx` - Lazy loading

### Novos Arquivos (Criados)

**Backend:**
- [x] `server/lib/circuit-breaker.ts` - Circuit breaker genérico
- [x] `server/jobs/dead-letter.ts` - Dead Letter Queue
- [x] `server/jobs/types.ts` - Tipos e interfaces de jobs
- [x] `server/jobs/storage.ts` - Persistência Redis/in-memory
- [x] `server/jobs/file-cleanup.ts` - Cleanup de arquivos órfãos
- [x] `server/services/deal-auto-creator.ts` - Auto-criação de deals
- [x] `server/services/whatsapp-config.ts` - Configuração WhatsApp
- [x] `server/services/email-ingest.ts` - Processamento de emails
- [x] `server/types/express.d.ts` - Type augmentation Express
- [ ] `server/constants.ts` - Constantes (pendente Milestone 6)
- [ ] `server/lib/sentry.ts` - Integração Sentry (pendente Milestone 8)

**Frontend:**
- [x] `client/src/contexts/InboxContext.tsx` - Contexto do Inbox
- [x] `client/src/pages/settings/` - Pasta com componentes Settings
- [x] `client/src/pages/settings/index.tsx` - Orquestrador Settings
- [x] `client/src/pages/settings/components/` - Componentes extraídos
- [x] `client/src/hooks/mutations/` - Pasta com hooks de mutação
- [x] `client/src/hooks/mutations/usePipelineMutations.ts`
- [x] `client/src/hooks/mutations/useStageMutations.ts`
- [x] `client/src/hooks/mutations/useChannelConfigMutations.ts`
- [x] `client/src/hooks/mutations/useEmailTemplateMutations.ts`

---

## Métricas de Sucesso

### Após Milestone 1 ✅ ALCANÇADO

- [x] Zero orphan records possíveis via SQL direto
- [x] Webhooks inválidos retornam 401
- [x] LGPD delete é atômico

### Após Milestone 2 ✅ ALCANÇADO

- [x] Jobs não são perdidos em restart
- [x] Circuit breakers protegem contra falhas em cascata
- [x] Dead letter queue captura falhas permanentes

### Após Milestone 3 ✅ ALCANÇADO

- [x] settings.tsx < 200 linhas (refatorado para pasta settings/)
- [x] inbox.tsx < 300 linhas (usa InboxContext)
- [x] Bundle inicial reduzido via lazy loading

### Após Milestone 4 ✅ ALCANÇADO

- [x] Arquivos grandes refatorados em módulos menores
- [x] Type assertions (`as any`) removidos dos arquivos API
- [x] Logs estruturados via logger em vez de console.log

### Após Milestone 5 (PENDENTE)

- [ ] Dashboard carrega com 1 query (não 6)
- [ ] LGPD export não faz N+1

### Final (PENDENTE)

- [ ] Zero `as any` no código (maioria removida)
- [ ] 100% das funções públicas documentadas
- [ ] Todos os logs estruturados