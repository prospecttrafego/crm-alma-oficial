# Bug: Loop Infinito de Reconexao WebSocket

## Informacoes Basicas

| Campo | Valor |
|-------|-------|
| **ID** | 002-WS-LOOP |
| **Severidade** | CRITICO |
| **Area** | WebSocket / Frontend |
| **Data Identificado** | 2026-01-22 |
| **Reportado por** | Mateus + Claude (IA) |
| **Status** | Corrigido (aguardando validacao em staging) |

---

## Descricao do Problema

### O que deveria acontecer (esperado)

1. WebSocket conecta ao servidor (status 101 Switching Protocols)
2. Conexao permanece aberta indefinidamente
3. Mensagens sao trocadas normalmente (eventos real-time)
4. Apenas uma conexao ativa por aba do navegador

### O que acontece (atual)

1. WebSocket conecta ao servidor (status 101) ✅
2. Algumas mensagens sao recebidas (`user:online`)
3. Conexao fecha apos alguns segundos
4. Frontend tenta reconectar imediatamente
5. **Loop infinito**: conecta → fecha → reconecta → fecha...
6. Navegador exibe erro: **"Insufficient resources"**
7. Centenas de conexoes "Finished" aparecem no DevTools

---

## Passos para Reproduzir

1. Acessar `https://crm-staging.almaagencia.com.br`
2. Fazer login
3. Abrir DevTools (F12)
4. Ir para aba Network > filtrar por "Socket"
5. Observar multiplas conexoes `ws` sendo criadas
6. Ir para aba Console
7. Observar erros de "Insufficient resources" se acumulando

---

## Frequencia

- [x] Sempre (100% das vezes)
- [ ] Frequente (>50%)
- [ ] As vezes (<50%)
- [ ] Raro (dificil de reproduzir)

**Nota:** Acontece em TODAS as paginas do CRM, nao apenas em uma especifica.

---

## Ambiente

| Campo | Valor |
|-------|-------|
| **Navegador** | Chrome 137 |
| **Sistema** | macOS |
| **Dispositivo** | Desktop |
| **URL** | https://crm-staging.almaagencia.com.br |

---

## Evidencias

### Screenshots

Referencia aos prints enviados durante a sessao de debug (2026-01-22):

1. **Coolify Proxy Config** - Configuracao do Traefik com timeouts corretos
2. **DevTools Network (Socket)** - Lista de conexoes WebSocket mostrando:
   - ~25+ conexoes `ws` com status "Finished"
   - Todas com 0.0 kB transferidos
   - 775/1075 requests no total
3. **DevTools Headers** - Mostrando que a conexao inicial funciona:
   - Status Code: 101 Switching Protocols ✅
   - Connection: Upgrade ✅
   - Upgrade: websocket ✅
4. **DevTools Messages** - Mensagens `user:online` sendo recebidas
5. **DevTools Console** - Erros em loop:
   - "WebSocket connection failed: Insufficient resources"
   - "[WebSocket] Erro: Event {isTrusted: true, type: 'error'...}"
   - "[WebSocket] Desconectado"

### Logs

**Console do navegador (padrao repetitivo):**
```
WebSocket connection to 'wss://crm-staging.almaagencia.com.br/ws' failed: Insufficient resources
[WebSocket] Erro:
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, ...}
[WebSocket] Desconectado

WebSocket connection to 'wss://crm-staging.almaagencia.com.br/ws' failed: Insufficient resources
[WebSocket] Erro:
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, ...}
[WebSocket] Desconectado

(repete centenas de vezes)
```

**Network (Headers de uma conexao):**
```
Request Method: GET
Status Code: 101 Switching Protocols

Response Headers:
  Alt-Svc: h3=":443"; ma=2592000
  Connection: Upgrade
  Sec-Websocket-Accept: nT0p3c/qfqaj7N2f2lP+webpCCs=
  Upgrade: websocket
  Vary: Accept-Encoding

Request Headers:
  Connection: Upgrade
  Host: crm-staging.almaagencia.com.br
  Origin: https://crm-staging.almaagencia.com.br
  Sec-Websocket-Extensions: permessage-deflate; client_max_window_bits
  Sec-Websocket-Key: Gm2SB1WKllvOa0h4DK3Sbg==
  Sec-Websocket-Version: 13
  Upgrade: websocket
```

---

## Diagnostico

### O que FUNCIONA

| Item | Status | Observacao |
|------|--------|------------|
| Configuracao Traefik | ✅ OK | Timeouts de 5 minutos configurados |
| Handshake WebSocket | ✅ OK | Status 101 Switching Protocols |
| Headers de upgrade | ✅ OK | Connection: Upgrade, Upgrade: websocket |
| Troca de mensagens | ✅ OK | Mensagens `user:online` chegam |

### O que NAO FUNCIONA

| Item | Status | Observacao |
|------|--------|------------|
| Persistencia da conexao | ❌ FALHA | Conexao fecha apos alguns segundos |
| Reconexao controlada | ❌ FALHA | Loop infinito de tentativas |
| Controle de recursos | ❌ FALHA | Centenas de conexoes criadas |

### Conclusao

**O problema NAO e do Traefik/proxy.** A conexao WebSocket e estabelecida corretamente (101).

**O problema ESTA no frontend** - especificamente na logica de reconexao do WebSocket que:
1. Tenta reconectar muito rapido (sem backoff exponencial)
2. Nao limita numero de tentativas
3. Nao limpa conexoes anteriores antes de criar novas
4. Cria conexoes ate esgotar recursos do navegador

---

## Hipoteses / Suspeitas

### Arquivos suspeitos:
- `client/src/hooks/useWebSocket.ts` - Hook principal de WebSocket
- `client/src/contexts/WebSocketContext.tsx` - Contexto que gerencia conexao compartilhada

### Funcoes suspeitas:
- Funcao de reconnect/retry
- Cleanup de conexoes no useEffect
- Event handlers que podem estar duplicados

### Possiveis causas:
1. **Reconexao sem delay** - Tenta reconectar imediatamente apos desconexao
2. **Listeners duplicados** - Cada reconexao adiciona novos listeners sem remover os antigos
3. **Cleanup incompleto** - useEffect nao limpa conexao anterior corretamente
4. **Race condition** - Multiplas conexoes sendo criadas simultaneamente

---

## CAUSA RAIZ IDENTIFICADA (2026-01-22)

### Problema: Multiplas Conexoes WebSocket Independentes

A investigacao do codigo revelou que **3 componentes estao criando conexoes WebSocket independentes** ao inves de usar o contexto compartilhado:

| Arquivo | Import Atual | Deveria Ser |
|---------|-------------|-------------|
| `client/src/contexts/WebSocketContext.tsx` | `useWebSocket` (hook) | ✅ Correto (e o provider) |
| `client/src/pages/inbox/InboxContent.tsx` | `useWebSocketContext` | ✅ Correto |
| `client/src/pages/settings/integrations/calendar.tsx` | `useWebSocket` (hook) | ❌ Deveria usar `useWebSocketContext` |
| `client/src/pages/settings/channels/index.tsx` | `useWebSocket` (hook) | ❌ Deveria usar `useWebSocketContext` |
| `client/src/components/notification-bell.tsx` | `useWebSocket` (hook) | ❌ Deveria usar `useWebSocketContext` |

### Por que isso causa o problema

1. O `WebSocketProvider` cria uma conexao compartilhada (correto)
2. Mas `notification-bell.tsx` importa o hook diretamente e cria OUTRA conexao
3. Quando o usuario navega para `/settings/channels`, OUTRA conexao e criada
4. Quando navega para `/settings/integrations/calendar`, OUTRA conexao e criada
5. **Cada vez que esses componentes re-renderizam, podem criar novas conexoes**
6. Resultado: centenas de conexoes ate esgotar recursos do navegador

### Evidencia no codigo

```typescript
// ERRADO - calendar.tsx linha 13
import { useWebSocket } from "@/hooks/useWebSocket";

// ERRADO - channels/index.tsx linha 12
import { useWebSocket } from "@/hooks/useWebSocket";

// ERRADO - notification-bell.tsx linha 29
import { useWebSocket } from "@/hooks/useWebSocket";

// CORRETO - InboxContent.tsx linha 13
import { useWebSocketContext } from "@/contexts/WebSocketContext";
```

### Correcao Necessaria

Alterar os 3 arquivos para usar `useWebSocketContext` ao inves de `useWebSocket`:

```typescript
// ANTES (errado)
import { useWebSocket } from "@/hooks/useWebSocket";
const { isConnected } = useWebSocket();

// DEPOIS (correto)
import { useWebSocketContext } from "@/contexts/WebSocketContext";
const { isConnected } = useWebSocketContext();
```

---

## Tentativas de Correcao

### 1. Configuracao de Timeout no Traefik (2026-01-22)

**O que foi feito:**
Adicionado timeouts de 5 minutos no Traefik via Coolify:
```yaml
command:
  - "--entrypoints.https.transport.respondingTimeouts.readTimeout=5m"
  - "--entrypoints.https.transport.respondingTimeouts.writeTimeout=5m"
  - "--entrypoints.https.transport.respondingTimeouts.idleTimeout=5m"
```

**Resultado:** Conexao inicial passou a funcionar (101), mas problema de reconexao persiste.

**Conclusao:** Configuracao correta, mas nao resolve o problema do frontend.

---

## Proximos Passos

1. [ ] Investigar codigo do `useWebSocket.ts`
2. [ ] Verificar logica de reconnect/backoff
3. [ ] Verificar cleanup de conexoes no useEffect
4. [ ] Verificar se ha listeners duplicados
5. [ ] Implementar correcao com:
   - Backoff exponencial (1s, 2s, 4s, 8s...)
   - Limite maximo de tentativas
   - Cleanup adequado de conexoes anteriores
   - Single connection guarantee

---

## Relacao com Outros Problemas

Este bug esta relacionado aos problemas ja documentados em `descricao.md`:

- **1.2 Race Condition na Autenticacao** - Pode estar causando desconexoes
- **1.3 Memory Leak - Listeners nao removidos** - Contribui para o loop
- **1.4 Typing Timeout nao limpo** - Memory leak relacionado
- **1.5 Heartbeat nao resiliente** - Pode estar fechando conexoes

---

## Notas Adicionais

- O erro "Insufficient resources" e do navegador, nao do servidor
- Chrome limita conexoes WebSocket por origem
- O loop consome recursos ate o limite do navegador
- Problema afeta TODAS as paginas do CRM, nao apenas inbox/whatsapp

---

## Resolucao

| Campo | Valor |
|-------|-------|
| **Data Corrigido** | 2026-01-22 |
| **Corrigido por** | Claude (IA) |
| **Commit** | PENDENTE (aguardando deploy para validacao) |
| **Arquivos Alterados** | `calendar.tsx`, `channels/index.tsx`, `notification-bell.tsx` |

### O que foi feito

Alterado o import de `useWebSocket` (hook direto) para `useWebSocketContext` (contexto compartilhado) em 3 arquivos:

**1. `client/src/pages/settings/integrations/calendar.tsx`**
```typescript
// ANTES
import { useWebSocket } from "@/hooks/useWebSocket";
const { isConnected: wsConnected } = useWebSocket();

// DEPOIS
import { useWebSocketContext } from "@/contexts/WebSocketContext";
const { isConnected: wsConnected } = useWebSocketContext();
```

**2. `client/src/pages/settings/channels/index.tsx`**
```typescript
// ANTES
import { useWebSocket } from "@/hooks/useWebSocket";
const { isConnected } = useWebSocket();

// DEPOIS
import { useWebSocketContext } from "@/contexts/WebSocketContext";
const { isConnected } = useWebSocketContext();
```

**3. `client/src/components/notification-bell.tsx`**
```typescript
// ANTES
import { useWebSocket } from "@/hooks/useWebSocket";
const { isConnected } = useWebSocket();

// DEPOIS
import { useWebSocketContext } from "@/contexts/WebSocketContext";
const { isConnected } = useWebSocketContext();
```

### Por que isso resolve o problema

1. Antes: Cada componente criava sua propria conexao WebSocket
2. Depois: Todos os componentes compartilham a mesma conexao via contexto
3. Resultado: Apenas 1 conexao WebSocket por aba do navegador

### Como testar a correcao

1. Fazer deploy das alteracoes para staging
2. Acessar `https://crm-staging.almaagencia.com.br`
3. Abrir DevTools > Network > filtrar por "Socket"
4. Verificar que apenas **1 conexao `ws`** permanece aberta
5. Navegar entre paginas (Dashboard, Inbox, Settings)
6. A mesma conexao deve permanecer aberta (nao deve criar novas)
7. Aguardar 2+ minutos
8. Conexao deve permanecer estavel (nao "Finished")
9. Console **NAO** deve mostrar erros "Insufficient resources"

### Validacao esperada

| Antes | Depois |
|-------|--------|
| Centenas de conexoes "Finished" | 1 conexao ativa |
| Erro "Insufficient resources" | Sem erros |
| 775+ requests WebSocket | 1 request WebSocket |
| Loop de reconexao infinito | Conexao estavel |
