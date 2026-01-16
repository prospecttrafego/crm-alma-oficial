# PLANO DE ACAO COMPLETO - CONVERT CRM

> **Fonte da verdade** para todos os ajustes e melhorias do sistema.
> Atualizar checkboxes conforme tarefas forem concluidas.

---

## JA IMPLEMENTADO

- [x] Optimistic updates para mensagens
- [x] Sistema de rooms WebSocket (broadcast direcionado)
- [x] Cache update direto (sem refetch)
- [x] Deduplicacao de mensagens (externalId)
- [x] Status indicators (sending/sent/delivered/read/error)
- [x] Evolution API v2.3.7 fix (webhook integrado na criacao)

---

## MILESTONE 1: Correcoes Criticas de UX

**Prioridade:** ALTA | **Status:** ✅ Concluido (1.2, 1.3, 1.4) | 🔍 Pendente verificacao (1.1)

### 1.1 Google Calendar Status
- [ ] Verificar se status esta sendo buscado corretamente da API
- [ ] Testar fluxo de conexao/desconexao
- [ ] **Arquivos:** `client/src/pages/settings/integrations/calendar.tsx`
- **Nota:** Requer verificacao manual. A API parece estar funcionando corretamente.

### 1.2 Textos Nao Traduzidos no ContextPanel ✅
- [x] Adicionar chaves i18n em `pt-BR.json` (inbox.contextPanel.*)
- [x] Adicionar chaves i18n em `en.json`
- [x] Atualizar `ContextPanel.tsx` para usar `useTranslation()`
- [x] **Arquivos:**
  - `client/src/pages/inbox/components/ContextPanel.tsx`
  - `client/src/locales/pt-BR.json`
  - `client/src/locales/en.json`

### 1.3 Paginacao de Contatos (Server-side) ✅
- [x] Criar funcao `getContactsPaginatedWithStats()` no storage
- [x] Atualizar API client com `listPaginatedWithStats()`
- [x] Implementar controles de paginacao na tabela
- [x] Remover busca client-side (usar server-side)
- [x] **Arquivos:**
  - `server/storage/contacts.ts`
  - `server/storage.ts` (interface atualizada)
  - `server/api/contacts.ts` (rota atualizada)
  - `client/src/lib/api/contacts.ts`
  - `client/src/pages/contacts/index.tsx`
  - `client/src/pages/contacts/contacts-table.tsx`

### 1.4 Validacao de Lost Reason ✅
- [x] Adicionar validacao obrigatoria quando status = "lost"
- [x] Desabilitar botao confirmar se campo vazio
- [x] Adicionar traducao para mensagem de erro
- [x] **Arquivos:**
  - `client/src/pages/pipeline/PipelinePage.tsx`
  - `client/src/pages/pipeline/components/LostReasonDialog.tsx`
  - `client/src/locales/pt-BR.json`
  - `client/src/locales/en.json`

### 1.5 Branding Landing Page
- [x] ~~Substituir "Convert.CRM" por branding correto~~ (CANCELADO - manter Convert.CRM)

---

## MILESTONE 2: Features de Chat Modernas

**Prioridade:** ALTA | **Status:** ✅ Concluido

### 2.1 Reply/Quote de Mensagens ✅

#### Database Migration
- [x] Adicionar coluna `reply_to_id` na tabela `messages`
- [x] Criar indice para `reply_to_id`

#### Backend
- [x] Atualizar schema em `shared/schema.ts`
- [x] Atualizar contracts em `shared/contracts.ts`
- [x] Atualizar apiSchemas em `shared/apiSchemas.ts` (quotedMessageSchema, messageWithSenderSchema)
- [x] Modificar `getMessages()` para incluir mensagem citada (join)
- [x] Atualizar `createMessage()` para aceitar `replyToId`
- [x] **Arquivos:**
  - `shared/schema.ts`
  - `shared/contracts.ts`
  - `shared/apiSchemas.ts`
  - `server/storage/conversations.ts`
  - `server/api/conversations.ts`

#### Frontend
- [x] Adicionar estado `replyingTo` no InboxContext
- [x] Criar componente `QuotedMessage.tsx`
- [x] Criar componente `ReplyPreview.tsx` (preview no composer)
- [x] Adicionar botao "Responder" no menu de mensagem
- [x] Renderizar quote acima da mensagem quando `replyToId` existe
- [x] **Arquivos:**
  - `client/src/contexts/InboxContext.tsx`
  - `client/src/pages/inbox.tsx`
  - `client/src/pages/inbox/components/MessageList.tsx`
  - `client/src/pages/inbox/components/MessageComposer.tsx`
  - `client/src/pages/inbox/components/QuotedMessage.tsx` (novo)
  - `client/src/pages/inbox/components/ReplyPreview.tsx` (novo)

### 2.2 @Mentions de Usuarios ✅

#### Frontend
- [x] Criar componente `MentionAutocomplete.tsx`
- [x] Criar hook `useMentionAutocomplete.ts`
- [x] Detectar `@` no texto e mostrar popup
- [x] Keyboard navigation (setas, Enter, Escape)
- [x] Inserir mention no formato `@[Nome](userId)`
- [x] Highlight de mentions no texto da mensagem

#### Backend
- [x] Extrair mentions do texto ao criar mensagem
- [x] Criar notificacoes para usuarios mencionados
- [x] Broadcast `notification:new` via WebSocket
- [x] Send push notification para usuarios offline

- [x] **Arquivos:**
  - `client/src/pages/inbox/components/MentionAutocomplete.tsx` (novo)
  - `client/src/hooks/useMentionAutocomplete.ts` (novo)
  - `client/src/pages/inbox/components/MessageComposer.tsx`
  - `client/src/pages/inbox/components/MessageList.tsx`
  - `server/api/conversations.ts`

### 2.3 Busca de Mensagens ✅

#### Database Migration
- [x] Full-text search usando `to_tsvector` on-the-fly (sem necessidade de coluna tsvector)
- **Nota:** Nao precisa de coluna `tsvector` STORED, mas e recomendado criar um indice GIN na expressao (ja incluido em `migrations/0007_neat_freak.sql`).

#### Backend
- [x] Implementar `searchMessages()` no storage com PostgreSQL full-text search
- [x] Criar endpoint `GET /api/messages/search`
- [x] Adicionar schemas Zod para validacao (messageSearchResponseSchema, messageSearchResultSchema)
- [x] **Arquivos:**
  - `server/storage/conversations.ts`
  - `server/api/conversations.ts`
  - `client/src/lib/api/conversations.ts`

#### Frontend
- [x] Criar componente `MessageSearchModal.tsx`
- [x] Criar hook `useMessageSearch.ts`
- [x] Handler para Cmd+F na pagina de inbox
- [x] Botao de busca no ThreadHeader
- [x] Navegacao para conversa da mensagem encontrada
- [x] Adicionar chaves i18n para busca
- [x] **Arquivos:**
  - `client/src/pages/inbox/components/MessageSearchModal.tsx` (novo)
  - `client/src/pages/inbox/components/ThreadHeader.tsx`
  - `client/src/hooks/useMessageSearch.ts` (novo)
  - `client/src/pages/inbox.tsx`
  - `client/src/locales/pt-BR.json`
  - `client/src/locales/en.json`

---

## MILESTONE 3: Resiliencia e Offline

**Prioridade:** MEDIA-ALTA | **Status:** ✅ Concluido

### 3.1 Offline Message Queue ✅

#### Setup
- [x] Instalar dependencia `idb`
- [x] Criar `client/src/lib/offlineDb.ts` (IndexedDB setup)

#### Implementacao
- [x] Criar hook `useOfflineQueue.ts`
- [x] Criar `client/src/lib/offlineSync.ts`
- [x] Integrar com inbox.tsx (detectar offline e enfileirar mensagens)
- [x] Detectar reconexao WebSocket e sincronizar fila automaticamente
- [x] Indicador visual de mensagem pendente (CloudOff icon para "queued", RefreshCw spinning para "syncing")
- [x] Adicionar i18n para status de mensagens offline
- [x] **Arquivos:**
  - `client/src/lib/offlineDb.ts` (novo)
  - `client/src/hooks/useOfflineQueue.ts` (novo)
  - `client/src/lib/offlineSync.ts` (novo)
  - `client/src/pages/inbox.tsx`
  - `client/src/pages/inbox/types.ts` (status "queued", "syncing")
  - `client/src/pages/inbox/components/MessageBubble.tsx`
  - `client/src/hooks/useWebSocket.ts`
  - `client/src/locales/pt-BR.json`
  - `client/src/locales/en.json`

### 3.2 Message Grouping by Time ✅

- [x] Criar funcao `groupMessages()` em utils
- [x] Criar componente `MessageGroup.tsx`
- [x] Criar componente `MessageBubble.tsx` (extrair de MessageList)
- [x] Avatar apenas na primeira mensagem do grupo
- [x] Timestamp no grupo (nao em cada mensagem)
- [x] Regra: agrupar se mesmo autor e < 5 minutos entre mensagens
- [x] Border radius inteligente (conectado visualmente)
- [x] **Arquivos:**
  - `client/src/pages/inbox/utils/groupMessages.ts` (novo)
  - `client/src/pages/inbox/components/MessageGroup.tsx` (novo)
  - `client/src/pages/inbox/components/MessageBubble.tsx` (novo)
  - `client/src/pages/inbox/components/MessageList.tsx`

### 3.3 Edit/Delete Messages ✅

#### Database Migration
- [x] Adicionar coluna `edited_at` na tabela `messages`
- [x] Adicionar coluna `deleted_at` na tabela `messages`
- [x] Adicionar coluna `original_content` na tabela `messages`

#### Backend
- [x] Atualizar schema com novos campos
- [x] Implementar `updateMessage()` no storage
- [x] Implementar `softDeleteMessage()` no storage
- [x] Criar endpoint `PATCH /api/messages/:id`
- [x] Criar endpoint `DELETE /api/messages/:id`
- [x] Broadcast `message:updated` e `message:deleted` via WebSocket
- [x] Validar janela de 15 minutos para edicao
- [x] **Arquivos:**
  - `shared/schema.ts`
  - `shared/contracts.ts`
  - `server/storage/conversations.ts`
  - `server/api/conversations.ts`
  - `server/ws/index.ts`

#### Frontend
- [x] Criar componente `MessageActions.tsx` (menu de contexto)
- [x] Criar componente `EditMessageModal.tsx`
- [x] Handler para eventos WebSocket de edit/delete
- [x] Badge "editado" quando `editedAt` existe
- [x] UI de mensagem deletada (texto cinza, italico)
- [x] API client: `editMessage()`, `deleteMessage()`
- [x] **Arquivos:**
  - `client/src/pages/inbox/components/MessageActions.tsx` (novo)
  - `client/src/pages/inbox/components/EditMessageModal.tsx` (novo)
  - `client/src/pages/inbox/components/MessageList.tsx`
  - `client/src/hooks/useWebSocket.ts`
  - `client/src/lib/api/conversations.ts`

---

## MILESTONE 4: Melhorias de Integracoes

**Prioridade:** MEDIA | **Status:** Pendente

### 4.1 Email Reset de Senha (DEBITO TECNICO)

- [ ] Criar `server/services/email.ts`
- [ ] Configurar nodemailer com variaveis de ambiente
- [ ] Criar template HTML responsivo para reset
- [ ] Integrar em `server/auth.ts` (linha ~528)
- [ ] Adicionar variaveis SMTP no `.env.example`
- [ ] Tratar erros sem bloquear fluxo
- [ ] **Arquivos:**
  - `server/services/email.ts` (novo)
  - `server/auth.ts`
  - `.env.example`

### 4.2 Google Calendar Bidirectional Sync

- [ ] Adicionar campo `syncDirection` em `calendar_events`
- [ ] Criar endpoint `POST /api/calendar-events/:id/sync-to-google`
- [ ] Implementar logica: se tem googleEventId atualiza, senao cria
- [ ] Hook no CRUD para enfileirar sync automatico
- [ ] Deteccao de conflitos (ultimo a modificar ganha)
- [ ] **Arquivos:**
  - `shared/schema.ts`
  - `server/storage/calendarEvents.ts`
  - `server/api/calendar.ts`
  - `server/integrations/google/calendar.ts`

### 4.3 Firebase Token Rotation

- [ ] Adicionar campo `lastUsedAt` em `push_tokens`
- [ ] Criar endpoint `POST /api/push-tokens/validate`
- [ ] Hook no frontend para detectar mudanca de token FCM
- [ ] Background job para cleanup de tokens antigos (> 30 dias)
- [ ] Atualizar `lastUsedAt` a cada envio bem-sucedido
- [ ] **Arquivos:**
  - `shared/schema.ts`
  - `server/storage/pushTokens.ts`
  - `server/integrations/firebase/notifications.ts`
  - `client/src/hooks/usePushNotifications.ts`

---

## MILESTONE 5: Responsividade e Mobile

**Prioridade:** MEDIA | **Status:** EM STANDBY

> Este milestone esta em standby conforme solicitado.

- [ ] 5.1 Inbox Mobile - Botao voltar, swipe gestures
- [ ] 5.2 Pipeline Mobile - Horizontal scroll, touch-friendly
- [ ] 5.3 Settings Mobile - Hamburger menu, drawer

---

## MILESTONE 6: Acessibilidade (A11Y)

**Prioridade:** MEDIA | **Status:** ✅ Concluido

### 6.1 ARIA Labels em Botoes de Icone ✅

- [x] Auditar todos os botoes `size="icon"` no projeto
- [x] Adicionar `aria-label` com traducao
- [x] Adicionar `<span className="sr-only">` para screen readers
- [x] **Componentes atualizados:**
  - [x] NotificationBell (sino)
  - [x] CommandPalette (busca)
  - [x] MessageComposer (microfone, enviar, anexar, emoji, cancelar gravacao, parar gravacao)
  - [x] ThreadHeader (voltar, expandir/recolher paineis, buscar mensagens)
  - [x] ThemeToggle (alternar tema)
  - [x] ConversationListPanel (expandir painel)
- [x] **Arquivos:**
  - `client/src/components/notification-bell.tsx`
  - `client/src/components/command-palette.tsx`
  - `client/src/components/theme-toggle.tsx`
  - `client/src/pages/inbox/components/MessageComposer.tsx`
  - `client/src/pages/inbox/components/ThreadHeader.tsx`
  - `client/src/pages/inbox/components/ConversationListPanel.tsx`
  - `client/src/locales/pt-BR.json` (secao a11y)
  - `client/src/locales/en.json` (secao a11y)

### 6.2 Keyboard Navigation Completa ✅

- [x] Inbox: Escape para deselecionar conversa
- [x] Inbox: role="option" e aria-selected para acessibilidade de lista
- [x] Focus trap: shadcn/ui Dialog ja implementa corretamente
- [x] **Arquivos:**
  - `client/src/pages/inbox.tsx`
  - `client/src/pages/inbox/components/ConversationListPanel.tsx`

### 6.3 Contraste de Cores WCAG AA ✅

- [x] Auditar variaveis CSS em `client/src/index.css`
- [x] Verificar minimo 4.5:1 para texto normal
- [x] Verificar minimo 3:1 para texto grande
- **Resultado da auditoria:**
  - Light mode: foreground (#041E42 Navy) em background (branco) = ~12.5:1 ✅
  - Light mode: muted-foreground em branco = ~4.7:1 ✅
  - Dark mode: foreground (#F5F5F5) em background (azul escuro) = ~15:1 ✅
  - Dark mode: muted-foreground em background = ~9:1 ✅
  - Todas as combinacoes passam WCAG AA

---

## MILESTONE 7: Features Faltantes

**Prioridade:** BAIXA-MEDIA | **Status:** ✅ Concluido

### 7.1 Command Palette Expandido ✅

- [x] Criar endpoint `GET /api/search?q=termo`
- [x] Buscar contacts, deals, conversations
- [x] Adicionar acoes contextuais ("Criar deal para X")
- [x] Historico de comandos recentes (localStorage)
- [x] Debounced search (300ms)
- [x] **Arquivos:**
  - `server/api/search.ts` (novo)
  - `client/src/lib/api/search.ts` (novo)
  - `client/src/components/command-palette.tsx`

### 7.2 Saved Views UI Expandido ✅

- [x] Adicionar Saved Views na pagina de Contacts
- [x] Adicionar Saved Views na pagina de Audit Log
- [x] Icones personalizados por view
- [x] Cores/badges visuais
- [x] Contador de filtros ativos
- [x] **Arquivos:**
  - `client/src/pages/contacts/index.tsx`
  - `client/src/pages/audit-log/AuditLogPage.tsx`
  - `client/src/components/filter-panel.tsx`
  - `shared/schema.ts` (adicionado "auditLog" em savedViewTypes)

### 7.3 Notifications Real-time ✅

- [x] Reduzir polling (WebSocket e a fonte primaria de atualizacoes)
- [x] Incrementar badge instantaneamente ao receber `notification:new`
- [x] Toast para notificacoes importantes (deal_won, deal_lost, mention, task_due)
- [x] Web Notifications API (quando aba inativa)
- [x] Animacao de sino (BellRing) quando ha notificacoes
- [x] Solicitar permissao de notificacoes desktop no primeiro clique
- [x] **Arquivos:**
  - `client/src/components/notification-bell.tsx`
  - `client/src/hooks/useDesktopNotifications.ts` (novo)

### 7.4 Audit Log Filtros ✅

#### Backend
- [x] Expandir query com filtros: action, entityType, userId, dateFrom, dateTo
- [x] Adicionar paginacao com metadados (page, limit, total, totalPages, hasMore)

#### Frontend
- [x] Select para action (create/update/delete/lgpd_export/lgpd_delete)
- [x] Select para entityType (deal, contact, company, etc.)
- [x] Select para usuario
- [x] DatePicker para range de datas
- [x] Botao exportar CSV
- [x] Contador de resultados ("Mostrando X-Y de Z registros")
- [x] Lista navegavel (paginacao/infinite scroll)

- [x] **Arquivos:**
  - `server/storage/auditLogs.ts` (getAuditLogsPaginated)
  - `server/api/auditLogs.ts`
  - `client/src/lib/api/auditLogs.ts` (novo)
  - `client/src/pages/audit-log/AuditLogPage.tsx`

---

## MILESTONE 8: Performance e Otimizacoes

**Prioridade:** BAIXA | **Status:** ✅ Completo (8.1, 8.2, 8.3)

### 8.1 Lazy Loading de Graficos

- [x] Usar `React.lazy()` para componentes de graficos
- [x] Criar `ChartSkeleton.tsx` para fallback
- [x] Envolver graficos em `<Suspense>`
- [ ] **Arquivos:**
  - `client/src/pages/reports.tsx`
  - `client/src/pages/reports/charts/*.tsx`
  - `client/src/pages/reports/components/ChartSkeleton.tsx` (novo)

### 8.2 Virtualization Melhorias

- [x] Contacts Table: virtualizar linhas (usando `react-virtuoso`)
- [x] Pipeline: refatorar e virtualizar colunas longas (usando `react-virtuoso`)
- [x] Audit Log: infinite scroll + virtualizacao (usando `react-virtuoso` + `useInfiniteQuery`)
- [ ] **Arquivos:**
  - `client/src/pages/contacts/contacts-table.tsx`
  - `client/src/pages/contacts/contacts-table-virtualized.tsx`
  - `client/src/pages/contacts/contacts-pagination-controls.tsx`
  - `client/src/pages/pipeline/PipelinePage.tsx`
  - `client/src/pages/audit-log/AuditLogPage.tsx`

### 8.3 Bundle Size - Code Splitting

- [x] Configurar manualChunks no vite.config.ts
- [x] Lazy load de EmojiPicker
- [x] Lazy load de DatePicker/Calendar
- [x] Verificar tree shaking de date-fns (evitar `date-fns/locale` no caminho critico)
- [x] Separar vendor chunks (recharts, etc.)
- [ ] **Arquivos:**
  - `vite.config.ts`
  - `client/src/App.tsx`
  - Componentes que usam libs pesadas

---

## MILESTONE 9: Qualidade de Codigo

**Prioridade:** BAIXA | **Status:** 🔄 Em progresso (9.1 ✅, 9.3 ✅ | 9.2 pendente)

### 9.1 Refatoracao de Arquivos Grandes

- [x] MessageComposer: extrair RecordingUI.tsx (~60 linhas)
- [x] MessageComposer: extrair MessageInput.tsx (~80 linhas)
- [x] MessageComposer: extrair FileAttachments.tsx (~40 linhas)
- [x] Auditar outros arquivos > 300 linhas (ex.: shared/schema.ts, client/src/pages/inbox.tsx, client/src/pages/calendar.tsx, server/storage/conversations.ts, server/auth.ts...)
- [ ] **Arquivos:**
  - `client/src/pages/inbox/components/MessageComposer.tsx`
  - `client/src/pages/inbox/components/RecordingUI.tsx` (novo)
  - `client/src/pages/inbox/components/MessageInput.tsx` (novo)
  - `client/src/pages/inbox/components/FileAttachments.tsx` (novo)

### 9.2 Testes

#### Setup
- [ ] Configurar vitest
- [ ] Instalar @testing-library/react
- [ ] Configurar MSW para mocking
- [ ] Configurar Playwright para E2E

#### Testes Prioritarios
- [ ] Unit: hooks (useWebSocket, useAuth)
- [ ] Unit: storage functions (contacts, deals)
- [ ] Integration: auth endpoints
- [ ] E2E: login flow
- [ ] E2E: criar deal
- [ ] E2E: enviar mensagem

### 9.3 Documentacao

#### JSDoc
- [x] Documentar funcoes de storage
- [x] Documentar hooks
- [x] Documentar utils

#### Storybook
- [x] Setup Storybook para Vite
- [x] Documentar Button (todos os variants)
- [x] Documentar Input, Select, DatePicker
- [x] Documentar FilterPanel
- [x] Documentar NotificationBell
- [x] Documentar CommandPalette

---

## ORDEM DE EXECUCAO RECOMENDADA

### Fase 1: Fundacoes
1. Milestone 1 (UX Criticas)
2. Milestone 2.1 (Reply/Quote)
3. Milestone 3.2 (Message Grouping)

### Fase 2: Chat Completo
4. Milestone 2.2 (Mentions)
5. Milestone 2.3 (Busca)
6. Milestone 3.3 (Edit/Delete)

### Fase 3: Integracao
7. Milestone 4.1 (Email Reset - OBRIGATORIO PARA PRODUCAO)
8. Milestone 4.2 (Google Calendar Bidi)
9. Milestone 4.3 (Firebase Rotation)

### Fase 4: Qualidade
10. Milestone 3.1 (Offline Queue)
11. Milestone 6 (Acessibilidade)
12. Milestone 7 (Features Faltantes)

### Fase 5: Otimizacao
13. Milestone 8 (Performance)
14. Milestone 9 (Qualidade de Codigo)

---

## MIGRATIONS NECESSARIAS

```sql
-- Milestones 2.1 / 2.3 / 3.3 (Reply/Quote + Busca + Edit/Delete)
-- Ja incluido em `migrations/0007_neat_freak.sql` (recomendado: `npm run db:migrate`)
ALTER TABLE messages ADD COLUMN reply_to_id INTEGER;
ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN original_content TEXT;
ALTER TABLE messages ADD CONSTRAINT messages_reply_to_id_messages_id_fk
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at);
CREATE INDEX idx_messages_content_search ON messages USING GIN (
  to_tsvector('portuguese', coalesce(content, ''))
);

-- Milestone 4.2: Calendar Bidi
ALTER TABLE calendar_events ADD COLUMN sync_direction VARCHAR(20) DEFAULT 'google';

-- Milestone 4.3: Firebase Rotation
ALTER TABLE push_tokens ADD COLUMN last_used_at TIMESTAMP;
```

---

## RESUMO

| Milestone | Prioridade | Status | Tarefas |
|-----------|------------|--------|---------|
| 1 - UX Criticas | ALTA | ✅ Concluido | 4 |
| 2 - Chat Features | ALTA | ✅ Concluido | 3 |
| 3 - Offline | MEDIA-ALTA | ✅ Concluido | 3 |
| 4 - Integracoes | MEDIA | Pendente | 3 |
| 5 - Mobile | MEDIA | STANDBY | 3 |
| 6 - A11Y | MEDIA | ✅ Concluido | 3 |
| 7 - Features | BAIXA-MEDIA | Pendente | 4 |
| 8 - Performance | BAIXA | Pendente | 3 |
| 9 - Qualidade | BAIXA | Pendente | 3 |

---

## VERIFICACAO POS-IMPLEMENTACAO

Apos cada milestone completo:
1. Rodar agente `code-reviewer` para revisao de codigo
2. Testar manualmente os fluxos afetados
3. Verificar se nao quebrou funcionalidades existentes
4. Atualizar checkboxes neste arquivo
5. Commit com mensagem descritiva do milestone
