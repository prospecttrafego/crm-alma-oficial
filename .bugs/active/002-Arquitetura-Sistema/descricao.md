# Bug: Problemas Arquiteturais Sistemicos do CRM Alma

## Informacoes Basicas

| Campo | Valor |
|-------|-------|
| **ID** | 002 |
| **Severidade** | CRITICO |
| **Area** | WebSocket / API / Database / Frontend-Backend |
| **Data Identificado** | 2026-01-22 |
| **Reportado por** | Claude (IA) - Investigacao profunda |
| **Status** | Em Andamento |

---

## Descricao do Problema

### Contexto

Durante a investigacao do Bug #001 (QR Code WhatsApp), foi identificado que o problema vai muito alem da exibicao do QR Code. O sistema possui **33+ problemas arquiteturais** distribuidos em 3 camadas que causam instabilidade geral e impedem a integracao WhatsApp de funcionar completamente.

### Sintomas Observados

1. **WebSocket nao funciona em staging/producao** - Erro "Invalid frame header"
2. **Dados inconsistentes** - Cache desatualizado, race conditions
3. **Performance degradada** - Queries lentas, N+1 problems
4. **Bugs intermitentes** - Funciona as vezes, falha outras

---

## Investigacao Completa

### 1. PROBLEMAS DE WEBSOCKET (7 encontrados)

#### 1.1 Proxy/Nginx - Invalid Frame Header (CRITICO)
**Arquivo:** Configuracao externa (nginx/proxy)
**Sintoma:** Console mostra `Invalid frame header`
**Causa:** Proxy nao esta passando headers de upgrade WebSocket corretamente
**Impacto:** WebSocket nao funciona em producao/staging, apenas local

**Correcao necessaria no nginx:**
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

#### 1.2 Race Condition na Autenticacao (CRITICO)
**Arquivo:** `server/ws/index.ts:89-120`
**Problema:** Conexao WebSocket pode ser estabelecida antes da sessao estar validada
**Impacto:** Usuario pode receber/nao receber eventos dependendo do timing

#### 1.3 Memory Leak - Listeners nao removidos (MEDIO)
**Arquivo:** `client/src/hooks/useWebSocket.ts:200-250`
**Problema:** Listeners de eventos nao sao limpos corretamente no cleanup do useEffect
**Impacto:** Acumulo de listeners duplicados, eventos processados multiplas vezes

#### 1.4 Typing Timeout nao limpo (MEDIO)
**Arquivo:** `client/src/hooks/useWebSocket.ts:450-480`
**Problema:** setTimeout do indicador de typing nao e limpo no unmount
**Impacto:** Memory leak, possiveis updates em componentes unmounted

#### 1.5 Heartbeat nao resiliente (MEDIO)
**Arquivo:** `server/ws/index.ts:50-70`
**Problema:** Se pong nao chegar, conexao e terminada sem tentativa de reconexao
**Impacto:** Conexoes perdidas em redes instaveis

#### 1.6 Room system sem validacao (BAIXO)
**Arquivo:** `server/ws/index.ts:150-180`
**Problema:** Usuario pode se juntar a qualquer room sem validacao de permissao
**Impacto:** Potencial vazamento de dados entre organizacoes

#### 1.7 Broadcast sem rate limiting (BAIXO)
**Arquivo:** `server/ws/index.ts:200-230`
**Problema:** Sem limite de mensagens por segundo
**Impacto:** Possivel sobrecarga do servidor em cenarios de alta atividade

---

### 2. PROBLEMAS DE COMUNICACAO FRONTEND-BACKEND (13 encontrados)

#### 2.1 Dual Query Pattern - Codigo Legado vs Moderno (CRITICO)
**Arquivos:**
- `client/src/lib/queryClient.ts` (legado)
- `client/src/lib/api/` (moderno)

**Problema:** Existem DOIS padroes de fazer requisicoes:
```typescript
// LEGADO (queryClient.ts)
export async function getQueryFn<T>({ on401 }: QueryConfig = {}) {
  return async ({ queryKey }: QueryFunctionContext): Promise<T> => {
    const res = await fetch(`/api/${queryKey.join("/")}`);
    // Retorna dados diretamente
  };
}

// MODERNO (api/contacts.ts)
export async function getContacts(filters) {
  const res = await apiClient.get('/contacts', { params: filters });
  return res.data; // Espera { success, data }
}
```

**Impacto:** Inconsistencia no tratamento de respostas, bugs intermitentes

#### 2.2 Response Wrapper Inconsistente (CRITICO)
**Problema:** Backend as vezes retorna `{ success, data }`, as vezes retorna dados diretamente
**Impacto:** Frontend nao sabe qual formato esperar

#### 2.3 Query Keys Inconsistentes (CRITICO)
**Problema:** Diferentes partes do codigo usam query keys diferentes para os mesmos dados
```typescript
// Em alguns lugares:
queryKey: ['contacts']
// Em outros:
queryKey: ['contacts', filters]
// Em outros:
queryKey: ['/contacts']
```
**Impacto:** Invalidacao de cache nao funciona corretamente, dados stale

#### 2.4 Type Drift - Interfaces Inline vs Schema (CRITICO)
**Arquivos:** Varios hooks em `client/src/hooks/`
**Problema:** Interfaces definidas inline nos hooks nao correspondem aos tipos do schema compartilhado
```typescript
// No hook (ERRADO):
interface Contact {
  id: number;
  name: string;  // Nao existe no schema!
}

// No schema (CORRETO):
interface Contact {
  id: number;
  firstName: string;
  lastName: string;
}
```
**Impacto:** Erros de runtime, TypeScript nao ajuda

#### 2.5 Cache Invalidation Conflitante (CRITICO)
**Problema:** WebSocket faz `setQueryData` ao mesmo tempo que mutations fazem `invalidateQueries`
**Impacto:** Race conditions, dados inconsistentes, UI flickering

#### 2.6 Retry Logic Duplicada (MEDIO)
**Arquivos:** `client/src/lib/api/client.ts`, `client/src/lib/queryClient.ts`
**Problema:** Retry implementado em duas camadas (axios interceptor + react-query)
**Impacto:** Requisicoes podem ser tentadas 9x ao inves de 3x

#### 2.7 Error Handling Inconsistente (MEDIO)
**Problema:** Alguns endpoints retornam `{ error: string }`, outros `{ message: string }`, outros throw
**Impacto:** Frontend nao consegue mostrar mensagens de erro corretas

#### 2.8 Stale Time vs GC Time Desalinhados (MEDIO)
**Arquivo:** `client/src/lib/queryClient.ts`
```typescript
staleTime: 5 * 60 * 1000,  // 5 min
gcTime: 30 * 60 * 1000,    // 30 min
```
**Problema:** Dados podem ficar stale por muito tempo antes de serem refetched
**Impacto:** Usuario ve dados desatualizados

#### 2.9 Optimistic Updates Parciais (MEDIO)
**Arquivos:** Hooks de mutation
**Problema:** Alguns hooks fazem optimistic update, outros nao
**Impacto:** UX inconsistente, alguns lugares parecem lentos

#### 2.10 Prefetch nao utilizado (BAIXO)
**Problema:** React Query suporta prefetch mas nao e usado
**Impacto:** Navegacao mais lenta do que poderia ser

#### 2.11 Suspense nao configurado (BAIXO)
**Problema:** React Query pode usar Suspense mas nao esta configurado
**Impacto:** Loading states manuais em todo lugar

#### 2.12 Mutation Callbacks Inconsistentes (BAIXO)
**Problema:** Algumas mutations usam onSuccess, outras onSettled, outras nenhum
**Impacto:** Side effects inconsistentes

#### 2.13 API Versioning Ausente (BAIXO)
**Problema:** Endpoints nao tem versionamento (/api/v1/)
**Impacto:** Dificil fazer mudancas breaking no futuro

---

### 3. PROBLEMAS DE DATABASE/DRIZZLE (13+ encontrados)

#### 3.1 N+1 Queries em Lead Scores (CRITICO)
**Arquivo:** `server/storage/leadScores.ts:103-143, 253-289`
```typescript
// PROBLEMA: Loop com queries individuais
for (const contact of contacts) {
  const score = await db.query.leadScores.findFirst({
    where: eq(leadScores.contactId, contact.id)
  });
}
```
**Impacto:** 100 contatos = 100 queries ao inves de 1

#### 3.2 Race Condition no Tenant Cache (CRITICO)
**Arquivo:** `server/tenant.ts`
**Problema:** Cache de organizationId pode ser lido antes de ser setado
**Impacto:** Queries podem retornar dados da organizacao errada

#### 3.3 Connection Pool Agressivo (CRITICO)
**Arquivo:** `server/db.ts`
```typescript
connectionTimeoutMillis: 2000  // Muito curto!
```
**Impacto:** Conexoes falham em momentos de alta carga

#### 3.4 Transacoes Ausentes (CRITICO)
**Arquivos:** Varios em `server/storage/`
**Problema:** Operacoes que deveriam ser atomicas nao usam transacao
```typescript
// Deveria ser uma transacao:
await db.insert(deals).values(dealData);
await db.insert(activities).values(activityData);
// Se a segunda falhar, a primeira ja foi commitada!
```
**Impacto:** Dados inconsistentes em caso de erro

#### 3.5 Indices Faltando (CRITICO)
**Arquivo:** `shared/schema.ts`
**Problema:** Colunas frequentemente filtradas nao tem indice
- `contacts.phone` (usado em busca WhatsApp)
- `conversations.lastMessageAt` (usado em ordenacao)
- `deals.status` (usado em filtros)
**Impacto:** Queries lentas em tabelas grandes

#### 3.6 Soft Delete Inconsistente (CRITICO)
**Problema:** Algumas tabelas tem `deletedAt`, outras fazem hard delete
**Impacto:** Dados perdidos permanentemente, auditoria incompleta

#### 3.7 Joins Manuais vs Relations (MEDIO)
**Problema:** Codigo mistura raw joins com Drizzle relations
**Impacto:** Inconsistencia, mais dificil de manter

#### 3.8 Select * Implicito (MEDIO)
**Problema:** Muitas queries nao especificam colunas, trazendo tudo
**Impacto:** Mais dados transferidos do que necessario

#### 3.9 Prepared Statements nao usados (MEDIO)
**Problema:** Drizzle suporta prepared statements mas nao sao usados
**Impacto:** Queries recompiladas a cada execucao

#### 3.10 Migrations nao versionadas (MEDIO)
**Problema:** Migracoes geradas pelo Drizzle nao tem controle de versao adequado
**Impacto:** Dificil fazer rollback

#### 3.11 Enum Drift (MEDIO)
**Problema:** Enums TypeScript podem divergir dos enums no banco
**Impacto:** Erros de runtime quando valor nao existe

#### 3.12 Timestamps Inconsistentes (BAIXO)
**Problema:** Algumas tabelas usam `createdAt`, outras `created_at`
**Impacto:** Codigo confuso, queries inconsistentes

#### 3.13 JSON Fields sem Validacao (BAIXO)
**Problema:** Campos JSONB como `preferences`, `metadata` nao tem schema
**Impacto:** Dados podem ter formato inesperado

---

## Resumo de Impacto

| Camada | Problemas Criticos | Problemas Medios | Problemas Baixos | Total |
|--------|-------------------|------------------|------------------|-------|
| WebSocket | 2 | 3 | 2 | 7 |
| Frontend-Backend API | 5 | 4 | 4 | 13 |
| Database/Drizzle | 6 | 5 | 2 | 13+ |
| **Total** | **13** | **12** | **8** | **33+** |

---

## Relacao com Outros Bugs

- **Bug #001**: A correcao do QR Code (Zod schema) foi aplicada, mas a integracao WhatsApp nao funciona completamente porque:
  1. WebSocket nao funciona em staging/producao (problema 1.1)
  2. Eventos de conexao podem nao chegar (problema 1.2)
  3. Cache pode ficar desatualizado (problemas 2.3, 2.5)

---

## Arquivos Principais Afetados

### WebSocket
- `server/ws/index.ts`
- `client/src/hooks/useWebSocket.ts`

### API Flow
- `client/src/lib/queryClient.ts`
- `client/src/lib/api/client.ts`
- `client/src/lib/api/*.ts`
- Todos os hooks em `client/src/hooks/`

### Database
- `server/db.ts`
- `server/tenant.ts`
- `server/storage/*.ts`
- `shared/schema.ts`

---

## Proximos Passos

Ver arquivo `plano-correcao.md` para o plano de acao detalhado com checkboxes.
