# Testes a realizar (checklist) — validação pós-ajustes

Este documento lista **o que deve ser testado** após aplicar os ajustes do `PLANO_DE_ACAO.md`, para validar funcionalidade, consistência e performance.

> Objetivo: reduzir risco de regressão e confirmar que as mudanças realmente melhoram **eficiência** e **coerência arquitetural**.

---

## 1) Smoke tests gerais

- [x] `npm run check` (TypeScript) sem erros — verificado em 2025-01-20
- [ ] `npm run lint` sem erros
- [x] `npm run build` completa com sucesso — verificado em 2025-01-20
- [ ] Login/logout funcionam (sessão e cookies OK)
- [ ] WebSocket conecta após login (presença online/offline aparece)

---

## 2) Real-time vs Polling (Milestone 1 + 8)

### 2.1 Notificações (WS-first)

- [ ] Criar uma notificação (ex.: marcar deal como won/lost) e validar:
  - [ ] badge de unread atualiza sem necessidade de refresh manual
  - [ ] lista de notificações atualiza corretamente
- [ ] Desconectar o WebSocket (simular offline / aba sem WS) e validar:
  - [ ] fallback (polling condicional) mantém unread coerente
  - [ ] quando WS volta, não há duplicação (unread não “pula” incorretamente)

### 2.2 Google Calendar (redução de polling + contrato WS)

- [ ] Conectar Google Calendar via OAuth
- [ ] Rodar “Sync now” e validar:
  - [ ] status (`/api/integrations/google-calendar/status`) atualiza após o sync (via WS ou invalidate)
  - [ ] lista de eventos (`/api/calendar-events`) reflete mudanças
- [ ] Simular falha de sync (token inválido ou desconectar) e validar:
  - [ ] `syncStatus=error` e `syncError` aparecem
  - [ ] UI não fica “presa” em syncing

### 2.3 WhatsApp (QR + status)

- [ ] Abrir modal de QR e validar:
  - [ ] QR aparece
  - [ ] status muda para connected quando escanear
  - [ ] a lista `/api/channel-configs` atualiza (sem depender de refresh manual)
- [ ] Reconectar e desconectar e validar:
  - [ ] estados `connecting/qr_pending/connected/disconnected` coerentes
  - [ ] não existe “duas fontes” (WS vs polling) causando flicker

---

## 3) Email ingest/sync (Milestone 8.3)

- [ ] Rodar sync de email em modo síncrono e validar:
  - [ ] emails novos geram `contact` se necessário
  - [ ] conversa email é criada/reutilizada corretamente
  - [ ] mensagem é criada com `externalId=email:<messageId>` (idempotência)
- [ ] Rodar sync duas vezes seguidas e validar:
  - [ ] não duplica mensagens (idempotência)
- [ ] Rodar sync em modo async (job) e validar:
  - [ ] job é criado e o status reflete `pending → processing → completed/failed`
  - [ ] resultado esperado aparece na inbox (conversa/mensagens)

---

## 4) Unread/mensagens (Milestone 7)

- [ ] Receber mensagem de contato (WhatsApp/email) e validar:
  - [ ] `unreadCount` na lista de conversas incrementa (se esta for a regra escolhida)
  - [ ] ao abrir conversa e marcar como lida, unread zera conforme regra
- [ ] Cenário multi-usuário (dois usuários na mesma conversa), validar:
  - [ ] regra de unread definida no plano se mantém consistente (não “globaliza” indevidamente)
- [ ] Performance: conversa com muitas mensagens
  - [ ] marcar como lida não causa travamento perceptível no backend (evitar N updates)

---

## 5) Jobs/Queue (Milestone 9)

- [ ] Produção (ou staging): validar comportamento quando Redis está configurado
  - [ ] jobs sobrevivem a restart do app (persistência)
- [ ] Produção (ou staging): validar comportamento quando Redis NÃO está configurado (conforme política definida)
  - [ ] fail fast **ou** endpoints async bloqueados com erro claro
- [ ] DLQ: forçar falha de job e validar:
  - [ ] entrada aparece no DLQ
  - [ ] retry do DLQ cria novo job e marca `retriedAt`

---

## 6) Bundling / performance (Milestone 0 + 4 + 6)

- [ ] Comparar build “antes vs depois”:
  - [ ] quantidade de chunks
  - [ ] tamanho de `vendor-*` grandes
  - [ ] tempo de carregamento da rota Inbox e Reports (observação qualitativa)
- [ ] Validar que validação Zod (se ajustada) não quebrou contratos:
  - [ ] endpoints críticos continuam com runtime validation (se essa foi a decisão)

