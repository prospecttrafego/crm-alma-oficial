# Plano de Correcao: Bug #002 - Problemas Arquiteturais Sistemicos

**Data:** 2026-01-22
**Status:** FASE 1 e 2 PARCIALMENTE CONCLUIDAS
**Severidade:** CRITICO
**Ultima Atualizacao:** 2026-01-22

---

## Resumo do Bug

O sistema possui 33+ problemas arquiteturais distribuidos em 3 camadas (WebSocket, API, Database) que causam instabilidade geral e impedem a integracao WhatsApp de funcionar completamente.

---

## FASE 1: Correcoes Criticas (Bloqueiam WhatsApp)

### 1.1 Configurar Nginx/Coolify para WebSocket
**Prioridade:** CRITICA
**Tipo:** Configuracao externa
**Responsavel:** Usuario (infraestrutura)

- [ ] Acessar configuracao do Coolify/Nginx
- [ ] Adicionar configuracao de proxy WebSocket:
```nginx
location /ws {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```
- [ ] Reiniciar servico
- [ ] Testar conexao WebSocket em staging

### 1.2 Corrigir Race Condition no Tenant (CONCLUIDO)
**Prioridade:** CRITICA
**Arquivo:** `server/tenant.ts`

- [x] Ler arquivo `server/tenant.ts`
- [x] Identificar cache sincrono problematico
- [x] Refatorar para usar Promise com await
- [x] Executar `npm run check`
- [ ] Testar mudanca de organizacao

**Correcao aplicada:** Refatorado para usar Promise-based caching. Multiplas chamadas concorrentes agora aguardam a mesma Promise ao inves de fazer queries paralelas.

### 1.3 Adicionar Indices Criticos no Banco (JA EXISTIAM)
**Prioridade:** CRITICA
**Arquivo:** `shared/schema.ts` + migration

- [x] Verificar indice em `contacts.phone` - **JA EXISTE** (`idx_contacts_phone`)
- [x] Verificar indice em `conversations.lastMessageAt` - **JA EXISTE** (`idx_conversations_last_message`)
- [x] Verificar indice em `deals.status` - **JA EXISTE** (`idx_deals_status`)
- [N/A] Gerar migration - Nao necessario
- [N/A] Aplicar migration - Nao necessario

**Nota:** Os indices ja existiam no schema. A investigacao inicial estava incorreta.

---

## FASE 2: Estabilidade do Sistema

### 2.1 Unificar Query Pattern
**Prioridade:** ALTA
**Arquivos:** `client/src/lib/queryClient.ts`, todos os hooks

- [ ] Auditar todos os hooks que usam `getQueryFn` legado
- [ ] Lista de hooks a migrar:
  - [ ] `useContacts`
  - [ ] `useDeals`
  - [ ] `usePipelines`
  - [ ] `useConversations`
  - [ ] (outros a identificar)
- [ ] Migrar cada hook para usar API modules modernos
- [ ] Remover `getQueryFn` quando nao houver mais uso
- [ ] Executar `npm run check`

### 2.2 Padronizar Query Keys
**Prioridade:** ALTA
**Arquivo:** Criar `client/src/lib/queryKeys.ts`

- [ ] Criar arquivo centralizando query keys:
```typescript
export const queryKeys = {
  contacts: {
    all: ['contacts'] as const,
    list: (filters: ContactFilters) => ['contacts', 'list', filters] as const,
    detail: (id: number) => ['contacts', 'detail', id] as const,
  },
  deals: {
    all: ['deals'] as const,
    list: (filters: DealFilters) => ['deals', 'list', filters] as const,
    detail: (id: number) => ['deals', 'detail', id] as const,
  },
  // ...
};
```
- [ ] Migrar todos os hooks para usar `queryKeys`
- [ ] Atualizar mutations para invalidar keys corretas
- [ ] Atualizar WebSocket handlers para usar keys corretas

### 2.3 Corrigir N+1 em Lead Scores (CONCLUIDO)
**Prioridade:** ALTA
**Arquivo:** `server/storage/leadScores.ts`

- [x] Ler arquivo `server/storage/leadScores.ts`
- [x] Identificar loops com queries individuais (linhas 134-143, 280-289)
- [x] Refatorar para usar `inArray` clause
- [x] Executar `npm run check`
- [ ] Testar listagem de contatos

**Correcao aplicada:** Refatorados os loops em `getContactScoringData` e `getDealScoringData` para usar uma unica query com `inArray` ao inves de queries individuais por conversa.

### 2.4 Adicionar Transacoes em Operacoes Criticas
**Prioridade:** ALTA
**Arquivos:** `server/storage/*.ts`

- [ ] Identificar operacoes multi-tabela:
  - [ ] Criacao de deal + activity
  - [ ] Criacao de contato + empresa
  - [ ] Atualizacao de conversation + messages
- [ ] Envolver em `db.transaction()`:
```typescript
await db.transaction(async (tx) => {
  const deal = await tx.insert(deals).values(dealData).returning();
  await tx.insert(activities).values({...activityData, dealId: deal[0].id});
});
```
- [ ] Executar `npm run check`

---

## FASE 3: Qualidade e Manutenibilidade

### 3.1 Unificar Response Format
**Prioridade:** MEDIA
**Arquivos:** Todos os routes em `server/routes/`

- [ ] Auditar endpoints que nao retornam `{ success, data }`
- [ ] Criar helper:
```typescript
export const successResponse = <T>(data: T) => ({ success: true, data });
export const errorResponse = (message: string) => ({ success: false, error: message });
```
- [ ] Migrar endpoints para usar helpers
- [ ] Atualizar schemas Zod de resposta

### 3.2 Limpar Memory Leaks no WebSocket Hook
**Prioridade:** MEDIA
**Arquivo:** `client/src/hooks/useWebSocket.ts`

- [ ] Ler arquivo completo
- [ ] Identificar listeners que nao sao removidos no cleanup
- [ ] Identificar timeouts que nao sao limpos no cleanup
- [ ] Adicionar cleanup correto:
```typescript
useEffect(() => {
  const handler = (event) => {...};
  socket.on('event', handler);
  return () => {
    socket.off('event', handler);
    clearTimeout(typingTimeoutRef.current);
  };
}, []);
```
- [ ] Executar `npm run check`

### 3.3 Alinhar Types com Schema
**Prioridade:** MEDIA
**Arquivos:** Hooks que definem interfaces inline

- [ ] Identificar hooks com interfaces inline
- [ ] Substituir por imports de `shared/schema.ts`:
```typescript
// ANTES:
interface Contact { id: number; name: string; }

// DEPOIS:
import type { Contact } from "@shared/schema";
```
- [ ] Executar `npm run check`

### 3.4 Ajustar Connection Pool (CONCLUIDO)
**Prioridade:** MEDIA
**Arquivo:** `server/constants.ts`

- [x] Ler arquivo `server/constants.ts` (configuracoes estao la)
- [x] Aumentar `DB_POOL_CONNECTION_TIMEOUT_MS` de 2000 para 10000
- [x] Verificar outras configuracoes de pool
- [x] Executar `npm run check`

**Correcao aplicada:** Alterado `DB_POOL_CONNECTION_TIMEOUT_MS` de 2000ms para 10000ms para maior resiliencia sob carga.

---

## FASE 4: Otimizacoes (Futuro)

### 4.1 Implementar Prepared Statements
- [ ] Identificar queries frequentes
- [ ] Converter para prepared statements

### 4.2 Adicionar Prefetch em Navegacao
- [ ] Identificar rotas principais
- [ ] Adicionar prefetch em hover/focus

### 4.3 Configurar Suspense Boundaries
- [ ] Habilitar Suspense no QueryClient
- [ ] Adicionar Suspense boundaries nos componentes

### 4.4 Adicionar Rate Limiting no WebSocket
- [ ] Implementar rate limiting por conexao
- [ ] Configurar limites por tipo de evento

---

## Verificacao Pos-Correcao

### Teste WhatsApp End-to-End
- [ ] Acessar `/settings/integrations/whatsapp`
- [ ] Clicar em "Gerar QR Code"
- [ ] QR Code aparece em ~3 segundos
- [ ] Escanear com WhatsApp no celular
- [ ] Status muda para "Conectado" automaticamente (via WebSocket)
- [ ] Enviar mensagem para o numero conectado
- [ ] Mensagem aparece na Inbox em tempo real

### Teste WebSocket
- [ ] Abrir DevTools > Network > WS
- [ ] Verificar conexao estabelecida sem erros "Invalid frame header"
- [ ] Criar um deal em outra aba
- [ ] Deal aparece em tempo real na primeira aba

### Teste de Consistencia de Cache
- [ ] Criar contato
- [ ] Verificar que aparece na lista sem refresh
- [ ] Editar contato em outra aba
- [ ] Verificar que atualiza na primeira aba

### Teste de Performance
- [ ] Acessar listagem de contatos com 100+ registros
- [ ] Tempo de carregamento < 2s
- [ ] Console nao mostra N+1 warnings

---

## Historico

| Data | Acao | Por |
|------|------|-----|
| 2026-01-22 | Bug identificado e investigado | Claude |
| 2026-01-22 | Plano de correcao criado | Claude |
| 2026-01-22 | Fase 1.1 - Documentacao Nginx criada | Claude |
| 2026-01-22 | Fase 1.2 - Race condition tenant CORRIGIDO | Claude |
| 2026-01-22 | Fase 1.3 - Indices verificados (ja existiam) | Claude |
| 2026-01-22 | Fase 2.3 - N+1 queries leadScores CORRIGIDO | Claude |
| 2026-01-22 | Fase 3.4 - Connection pool timeout CORRIGIDO | Claude |
| YYYY-MM-DD | Configuracao Nginx aplicada (usuario) | - |
| YYYY-MM-DD | Testes em staging | - |
| YYYY-MM-DD | Bug movido para resolved | - |

---

## Notas Importantes

1. **A Fase 1.1 (Nginx) depende de configuracao externa** - nao pode ser feita pelo codigo
2. **As Fases devem ser executadas em ordem** - cada uma depende das anteriores
3. **Testar apos cada correcao** - nao acumular mudancas sem teste
4. **Fazer backup antes de migrations** - indices podem afetar performance temporariamente
