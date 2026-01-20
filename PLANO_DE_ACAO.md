# Plano de Ação — Eficiência e Coerência Arquitetural (Alma CRM)

Este documento organiza os ajustes identificados na auditoria com **milestones** e **tarefas** (checkbox) para acompanhar execução.

> Nota: a auditoria foi **concluída** e este plano está **congelado**. Ele só deve ser alterado se os testes (ou produção) revelarem novos achados.

---

## Milestone 0 — Baseline (medição e inventário antes de mudar)

**Por que é necessário:** sem um baseline, a gente corre o risco de "otimizar no escuro" e trocar um problema por outro. A ideia é fechar a auditoria com uma visão completa (frontend, backend e integração) e anexar sinais objetivos (bundle/chunks, hotspots de refetch, fluxo WS vs polling).

- [x] Mapear todos os `refetchInterval` no frontend e justificar cada um (ou remover).
- [x] Mapear todos os eventos WebSocket emitidos no backend e sua estratégia no frontend (invalidate vs cache update).
- [x] Garantir que o contrato de eventos WS esteja alinhado (tipos emitidos no backend = tipos tratados no frontend).
- [x] Rodar build e registrar tamanho/quantidade de chunks (antes) para guiar mudanças no code splitting.
- [ ] Revisar "double source of truth" em preferências (backend `user.preferences` vs `localStorage`) e documentar regra oficial.
- [x] Registrar baseline de chunks grandes:
  - [x] `vendor-tSQUg4m7.js` (~565kb) — chunk genérico com core vendors (React, etc.)
  - [x] `vendor-recharts`, `vendor-emoji`, `vendor-zod`, `vendor-ui` (splits confirmados e funcionando)

---

## Milestone 1 — Unificar estratégia de real-time (WS) vs polling/refetch

**Por que é necessário:** hoje há pontos onde **dois mecanismos fazem o mesmo trabalho** (WS invalidando queries e polling periódico). Isso aumenta custo (rede/DB), cria "flapping" (estado oscilando) e torna o sistema mais difícil de debugar.

### 1.1 Notificações: remover concorrência WS + polling fixo

- [x] Tornar `refetchInterval` do unread count **condicional** (somente quando WS estiver desconectado), ou remover polling.
- [x] Padronizar atualização: escolher entre
  - [x] **WS → update otimista** (unreadCount) + refetch sob demanda — IMPLEMENTADO
  - [ ] ~~WS → invalidate (refetch) sem update otimista duplicado~~
- [x] Definir e documentar "fonte de verdade" para `unreadCount`. — Backend é fonte de verdade, WS envia unreadCount no payload

**Justificativa técnica:** WebSocket já invalida `/api/notifications` e `/api/notifications/unread-count`; o polling fixo vira redundância e custo recorrente.

### 1.2 Consolidar estratégia de cache update (quando possível) vs invalidation

- [x] Listar eventos que já fazem **cache update** (ex.: `message:created`) e manter consistência. — Documentado em CLAUDE.md
- [x] Evitar invalidar listas grandes quando o payload do evento permite update incremental. — Implementado para notification:new

---

## Milestone 2 — Unificar "data layer" do frontend (HTTP + erros + contratos)

**Por que é necessário:** existem **dois caminhos paralelos** de request/unwrap/erro: o `ApiClient` (com validação Zod de resposta) e o default `queryFn` do React Query baseado em `queryKey.join("/")`. Isso cria duplicação, inconsistência e riscos de URLs inválidas.

- [x] Decidir padrão oficial:
  - [x] **Opção A (recomendada)**: `ApiClient` como única forma de request (React Query sempre chama `api.get/post/...`). — ADOTADO
  - [ ] ~~Opção B: default `queryFn` delega ao `ApiClient` com contrato explícito de `queryKey`~~
- [x] Remover/aposentar `getQueryFn` baseado em `queryKey.join("/")` (ou restringir fortemente o formato de `queryKey`). — Adicionado @deprecated JSDoc
- [ ] Padronizar shape de `queryKey` (strings/params) para evitar objetos acidentais. — Trabalho futuro (migração gradual)

---

## Milestone 3 — Eliminar redundâncias e sobreposição de responsabilidade no frontend

**Por que é necessário:** código duplicado tende a divergir ("drift"), aumentando bugs e custo de manutenção.

### 3.1 Idioma: manter um único API público

- [x] Remover `client/src/hooks/useLanguage.ts` (ou transformar em wrapper fino do `LanguageContext`). — DELETADO
- [x] Garantir que apenas `LanguageContext` faça: prioridade `user.preferences` → `localStorage` → default. — Confirmado

### 3.2 Preferências (tema/som/outros): definir contrato "server-first"

- [ ] Documentar regra: quando autenticado, backend é fonte de verdade; `localStorage` apenas cache/fallback pré-login.
- [ ] Evitar lógica duplicada em múltiplos hooks/componentes.

---

## Milestone 4 — Reavaliar code splitting (evitar overengineering de chunks)

**Por que é necessário:** combinar `React.lazy()` por rotas com um `manualChunks()` muito granular pode criar muitos chunks pequenos (overhead de requests/parse). O objetivo é manter split apenas para libs realmente pesadas e rotas grandes.

- [x] Medir bundle/chunks "antes" e registrar no baseline (Milestone 0). — Registrado (build 2024-01-20)
- [x] Revisar `manualChunks()` para evitar granularidade excessiva. — Configuração atual é adequada
- [x] Manter splits "high impact" (ex.: charts/emoji/firebase) e simplificar o restante. — Confirmado

---

## Milestone 5 — Otimizações no backend para reduzir refetch desnecessário

**Por que é necessário:** alguns eventos WS saem com payload vazio (`{}`), forçando o cliente a refetch e elevando carga de DB em cenários de volume.

- [x] Para `notification:new`, considerar enviar payload mínimo útil:
  - [x] `unreadCount` atualizado e/ou — IMPLEMENTADO
  - [ ] ~~a própria notificação recém-criada (quando aplicável)~~
- [x] Garantir que o payload não inclua PII sensível desnecessária. — Apenas unreadCount é enviado

---

## Milestone 6 — Validação de contratos: segurança sem "jank" em payloads grandes

**Por que é necessário:** validação runtime com Zod é excelente para segurança/contrato, mas pode ter custo perceptível em payloads grandes (especialmente em mobile).

- [ ] Definir política: validação estrita em dev/staging; em produção, considerar:
  - [ ] amostragem, ou
  - [ ] validação apenas em endpoints críticos, ou
  - [ ] validação com limites/tamanhos.

> **Nota:** Adiado — comportamento atual (validação em dev) é aceitável para o momento.

---

## Milestone 7 — Consistência de "unread" e mensagens (modelo + performance)

**Por que é necessário:** hoje existe um mix de abordagens para "unread":
- `messages.readBy` é **por usuário** (correto para multi-user),
- `conversations.unreadCount` é **um único número por conversa** (tende a divergir em cenários com múltiplos usuários),
- e existe um conjunto de funções de cache em Redis para mensagens/unread que, no estado atual, parecem **não estar integradas** ao fluxo principal (código "morto"/overengineering).

Isso gera risco de **inconsistência** (fontes de verdade concorrentes) e gargalos de performance (ex.: marcar mensagens como lidas com updates por mensagem).

- [ ] Definir regra oficial para "unread":
  - [ ] **Opção A (recomendada)**: unread "por usuário" deriva de `readBy` (e `unreadCount` vira derivado/viewport específico ou é removido).
  - [ ] Opção B: manter `unreadCount` como campo "rápido", mas então ele precisa ser **por usuário** (modelagem muda).
- [x] Otimizar `markMessagesAsRead` para evitar loop N updates (usar update em lote/SQL). — IMPLEMENTADO (single query com array_append)
- [ ] Decidir sobre cache Redis de mensagens/unread:
  - [ ] Integrar de verdade (com invalidação clara e sem drift), ou
  - [ ] Remover código de cache não utilizado para reduzir complexidade.
- [ ] Validar contrato do endpoint `GET /api/conversations/:id` (shape de `messages`) para evitar payload inconsistente no frontend.

---

## Milestone 8 — Integrações: reduzir polling e eliminar "drift" de contratos

**Por que é necessário:** hoje existem integrações que dependem de **polling periódico** (ex.: Google Calendar status a cada 30s; WhatsApp status a cada 3s durante conexão) mesmo existindo infra de WebSocket. Além disso, há eventos emitidos no backend que **não existem no contrato do frontend**, o que vira custo sem benefício e comportamento confuso.

### 8.1 Google Calendar: evento WS emitido, mas frontend não trata

- [x] Alinhar o contrato do evento `google_calendar:sync_complete` no frontend (tipos + tratamento). — IMPLEMENTADO
- [x] Decidir estratégia:
  - [x] **Preferida**: WS dispara invalidation de `["/api/integrations/google-calendar/status"]` e `["/api/calendar-events"]` — IMPLEMENTADO
  - [x] e o polling (`refetchInterval: 30000`) vira fallback **somente quando WS estiver offline** — IMPLEMENTADO

### 8.2 WhatsApp: conexão/QR e atualização de status

- [ ] Decidir contrato canônico de real-time para WhatsApp:
  - [ ] **Preferida**: backend emite `channel:config:updated` (com payload redacted) sempre que `connectionStatus/qrCode` mudar
  - [ ] e remover eventos "custom" (`whatsapp_status`, `whatsapp_qr`) se o frontend não consumir
- [x] Tornar polling do QR modal (`refetchInterval: 3000`) "bounded" (somente enquanto `qr_pending/connecting`) — já é assim, validado

### 8.3 Email: eliminar duplicação de lógica entre sync imediato e job async

**Achado:** existe um service (`processIncomingEmail`) e, ao mesmo tempo, o handler de job `SYNC_EMAIL` contém lógica duplicada (comentada como "same logic as channelConfigs.ts").

- [x] Extrair um `EmailSyncService` (ou função) único que:
  - [x] chama `syncEmails(...)` e delega cada email para `processIncomingEmail(...)` — JÁ EXISTE
  - [x] atualiza `lastSyncUid/lastSyncAt` — IMPLEMENTADO
- [x] Fazer o endpoint sync (imediato) e o job async usarem o mesmo serviço (DRY). — IMPLEMENTADO (handlers.ts usa processIncomingEmail)

---

## Milestone 9 — Jobs/Queue: reduzir overengineering e aumentar previsibilidade em produção

**Por que é necessário:** o projeto tem fila com Redis (Upstash) e fallback em memória. Isso é útil em dev, mas em produção pode virar "falha silenciosa" (jobs perdidos em restart) e duplicação de caminhos (sync vs async).

- [x] Definir política de produção:
  - [x] se `NODE_ENV=production` e Redis não está disponível: **fail fast** (ou bloquear endpoints `?async=true`) para evitar job "sumir" — IMPLEMENTADO (isQueueHealthyForAsync)
- [x] Padronizar endpoints async:
  - [x] listar quais endpoints suportam `?async=true` e garantir UX consistente (jobId/status/erros) — Documentado em CLAUDE.md
- [ ] Revisar `load retries/backoff` da fila para não causar latência em cascata em situações de Redis instável


