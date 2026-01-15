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
  - `client/src/pages/pipeline/index.tsx`
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
- **Nota:** Implementacao usa busca dinamica com `to_tsvector('portuguese', content)` ao inves de coluna gerada, simplificando deploy sem necessidade de migration.

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

**Prioridade:** MEDIA-ALTA | **Status:** Pendente

### 3.1 Offline Message Queue

#### Setup
- [ ] Instalar dependencia `idb`
- [ ] Criar `client/src/lib/offlineDb.ts` (IndexedDB setup)

#### Implementacao
- [ ] Criar hook `useOfflineQueue.ts`
- [ ] Criar `client/src/lib/offlineSync.ts`
- [ ] Integrar com InboxContext
- [ ] Detectar reconexao e sincronizar fila
- [ ] Indicador visual de mensagem pendente
- [ ] **Arquivos:**
  - `client/src/lib/offlineDb.ts` (novo)
  - `client/src/hooks/useOfflineQueue.ts` (novo)
  - `client/src/lib/offlineSync.ts` (novo)
  - `client/src/contexts/InboxContext.tsx`
  - `client/src/hooks/useWebSocket.ts`

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

**Prioridade:** MEDIA | **Status:** Pendente

### 6.1 ARIA Labels em Botoes de Icone

- [ ] Auditar todos os botoes `size="icon"` no projeto
- [ ] Adicionar `aria-label` com traducao
- [ ] Adicionar `<span className="sr-only">` para screen readers
- [ ] **Componentes prioritarios:**
  - [ ] NotificationBell (sino)
  - [ ] CommandPalette (busca)
  - [ ] MessageComposer (microfone, enviar, anexar, emoji)
  - [ ] ThreadHeader (acoes)
  - [ ] Sidebar (toggle)
  - [ ] Pipeline (editar, excluir, mais opcoes)

### 6.2 Keyboard Navigation Completa

- [ ] Pipeline: Arrow keys para navegar cards, Enter para abrir
- [ ] Inbox: Tab/Shift+Tab para conversas, Escape para voltar
- [ ] Tabelas: Arrow keys para navegar celulas
- [ ] Verificar focus trap em todos os modais
- [ ] **Arquivos:**
  - `client/src/pages/pipeline/index.tsx`
  - `client/src/pages/contacts/contacts-table.tsx`
  - `client/src/pages/inbox.tsx`

### 6.3 Contraste de Cores WCAG AA

- [ ] Auditar variaveis CSS em `client/src/index.css`
- [ ] Verificar minimo 4.5:1 para texto normal
- [ ] Verificar minimo 3:1 para texto grande
- [ ] Usar Chrome DevTools > Lighthouse > Accessibility

---

## MILESTONE 7: Features Faltantes

**Prioridade:** BAIXA-MEDIA | **Status:** Pendente

### 7.1 Command Palette Expandido

- [ ] Criar endpoint `GET /api/search?q=termo`
- [ ] Buscar contacts, deals, conversations
- [ ] Adicionar acoes contextuais ("Criar deal para X")
- [ ] Historico de comandos recentes
- [ ] **Arquivos:**
  - `server/api/search.ts` (novo)
  - `client/src/lib/api/search.ts` (novo)
  - `client/src/components/command-palette.tsx`

### 7.2 Saved Views UI Expandido

- [ ] Adicionar Saved Views na pagina de Contacts
- [ ] Adicionar Saved Views na pagina de Audit Log
- [ ] Icones personalizados por view
- [ ] Cores/badges visuais
- [ ] **Arquivos:**
  - `client/src/pages/contacts/index.tsx`
  - `client/src/pages/audit-log.tsx`
  - `client/src/components/filter-panel.tsx`

### 7.3 Notifications Real-time

- [ ] Substituir polling por WebSocket real-time
- [ ] Incrementar badge instantaneamente ao receber `notification:new`
- [ ] Toast para notificacoes importantes (nova mensagem, deal ganho)
- [ ] Web Notifications API (quando aba inativa)
- [ ] **Arquivos:**
  - `client/src/components/notification-bell.tsx`
  - `client/src/hooks/useWebSocket.ts`
  - `client/src/hooks/useDesktopNotifications.ts` (novo)

### 7.4 Audit Log Filtros

#### Backend
- [ ] Expandir query com filtros: action, entityType, userId, dateFrom, dateTo
- [ ] Adicionar paginacao

#### Frontend
- [ ] Select para action (create/update/delete)
- [ ] Select para entityType
- [ ] Select para usuario
- [ ] DatePicker para range de datas
- [ ] Botao exportar CSV

- [ ] **Arquivos:**
  - `server/storage/auditLogs.ts`
  - `server/api/auditLogs.ts`
  - `client/src/pages/audit-log.tsx`

---

## MILESTONE 8: Performance e Otimizacoes

**Prioridade:** BAIXA | **Status:** Pendente

### 8.1 Lazy Loading de Graficos

- [ ] Usar `React.lazy()` para componentes de graficos
- [ ] Criar `ChartSkeleton.tsx` para fallback
- [ ] Envolver graficos em `<Suspense>`
- [ ] **Arquivos:**
  - `client/src/pages/reports.tsx`
  - `client/src/pages/reports/charts/*.tsx`
  - `client/src/components/skeletons/ChartSkeleton.tsx` (novo)

### 8.2 Virtualization Melhorias

- [ ] Contacts Table: implementar @tanstack/react-virtual
- [ ] Pipeline: virtualizar colunas longas
- [ ] Audit Log: infinite scroll com virtualizacao
- [ ] **Arquivos:**
  - `client/src/pages/contacts/contacts-table.tsx`
  - `client/src/pages/pipeline/index.tsx`
  - `client/src/pages/audit-log.tsx`

### 8.3 Bundle Size - Code Splitting

- [ ] Configurar manualChunks no vite.config.ts
- [ ] Lazy load de EmojiPicker
- [ ] Lazy load de DatePicker/Calendar
- [ ] Verificar tree shaking de date-fns
- [ ] Separar vendor chunks (recharts, etc.)
- [ ] **Arquivos:**
  - `vite.config.ts`
  - `client/src/App.tsx`
  - Componentes que usam libs pesadas

---

## MILESTONE 9: Qualidade de Codigo

**Prioridade:** BAIXA | **Status:** Pendente

### 9.1 Refatoracao de Arquivos Grandes

- [ ] MessageComposer: extrair RecordingUI.tsx (~60 linhas)
- [ ] MessageComposer: extrair MessageInput.tsx (~80 linhas)
- [ ] MessageComposer: extrair FileAttachments.tsx (~40 linhas)
- [ ] Auditar outros arquivos > 300 linhas
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
- [ ] Documentar funcoes de storage
- [ ] Documentar hooks
- [ ] Documentar utils

#### Storybook
- [ ] Setup Storybook para Vite
- [ ] Documentar Button (todos os variants)
- [ ] Documentar Input, Select, DatePicker
- [ ] Documentar FilterPanel
- [ ] Documentar NotificationBell
- [ ] Documentar CommandPalette

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
-- Milestone 2.1: Reply/Quote
ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);

-- Milestone 2.3: Busca
ALTER TABLE messages ADD COLUMN content_search tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED;
CREATE INDEX idx_messages_content_search ON messages USING GIN(content_search);

-- Milestone 3.3: Edit/Delete
ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN original_content TEXT;
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at);

-- Milestone 4.2: Calendar Bidi
ALTER TABLE calendar_events ADD COLUMN sync_direction VARCHAR(20) DEFAULT 'google';

-- Milestone 4.3: Firebase Rotation
ALTER TABLE push_tokens ADD COLUMN last_used_at TIMESTAMP;
```

---

## RESUMO

| Milestone | Prioridade | Status | Tarefas |
|-----------|------------|--------|---------|
| 1 - UX Criticas | ALTA | Em Andamento | 4 |
| 2 - Chat Features | ALTA | Pendente | 3 |
| 3 - Offline | MEDIA-ALTA | Pendente | 3 |
| 4 - Integracoes | MEDIA | Pendente | 3 |
| 5 - Mobile | MEDIA | STANDBY | 3 |
| 6 - A11Y | MEDIA | Pendente | 3 |
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
