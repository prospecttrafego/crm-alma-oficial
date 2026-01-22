# TESTES COMPLETOS - Alma CRM

Este documento contém todos os testes necessários para validar o funcionamento do CRM Alma. A IA deve executar cada teste e documentar os resultados.

---

## INSTRUÇÕES PARA A IA

1. **Execute cada teste na ordem apresentada**
2. **Documente o resultado de CADA teste** (PASSOU/FALHOU + observações)
3. **Não pule testes** - mesmo que pareçam simples
4. **Ao encontrar falha**, documente:
   - O que deveria acontecer
   - O que realmente aconteceu
   - Arquivo/linha suspeita (se identificável)
5. **Ao final**, gere um relatório consolidado com todos os problemas encontrados

---

## PARTE 1: TESTES DE INFRAESTRUTURA

### 1.1 Health Check

**Objetivo:** Verificar se o servidor está respondendo e todas as dependências estão ok.

```bash
curl -s http://localhost:3000/api/health | jq
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    ...
  }
}
```

**O que testar:**
- [ ] Resposta HTTP 200
- [ ] `success: true`
- [ ] `database: "connected"`
- [ ] Tempo de resposta < 500ms

**Por que importa:** Se o health check falhar, o sistema inteiro está comprometido.

---

### 1.2 Conexão com Banco de Dados

**Objetivo:** Verificar se queries básicas funcionam.

**Teste de leitura:**
```bash
# Via API - buscar usuários (deve retornar array, mesmo vazio)
curl -s http://localhost:3000/api/users -H "Cookie: <session_cookie>" | jq
```

**O que testar:**
- [ ] Query não trava (timeout < 5s)
- [ ] Retorna estrutura válida (array ou objeto com data)
- [ ] Não há erro de conexão

**Por que importa:** Problemas de conexão com DB causam 500 aleatórios.

---

### 1.3 WebSocket Conexão

**Objetivo:** Verificar se WebSocket conecta e mantém conexão.

**Teste manual (ou via código):**
```javascript
// Conectar ao WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => console.log('CONECTADO');
ws.onclose = (e) => console.log('FECHOU:', e.code, e.reason);
ws.onerror = (e) => console.log('ERRO:', e);

// Após 30 segundos, verificar se ainda está conectado
setTimeout(() => {
  console.log('Estado após 30s:', ws.readyState === 1 ? 'ABERTO' : 'FECHADO');
}, 30000);
```

**O que testar:**
- [ ] Conexão estabelecida com sucesso
- [ ] Conexão persiste por pelo menos 30 segundos
- [ ] Heartbeat (ping/pong) funciona
- [ ] Conexão só fecha se usuário não autenticado

**Por que importa:** WebSocket instável causa "inbox não atualiza".

---

## PARTE 2: TESTES DE AUTENTICAÇÃO

### 2.1 Login Válido

**Objetivo:** Verificar fluxo de login completo.

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123"}' \
  -c cookies.txt \
  -v
```

**O que testar:**
- [ ] HTTP 200 em credenciais válidas
- [ ] Cookie de sessão é setado (`Set-Cookie` header)
- [ ] Resposta contém dados do usuário (sem senha)
- [ ] Sessão persiste em requests subsequentes

**Por que importa:** Login quebrado = sistema inacessível.

---

### 2.2 Sessão Persistente

**Objetivo:** Verificar se sessão não expira prematuramente.

```bash
# Login
curl -X POST http://localhost:3000/api/login -d '...' -c cookies.txt

# Esperar 5 minutos

# Verificar se ainda autenticado
curl http://localhost:3000/api/auth/me -b cookies.txt
```

**O que testar:**
- [ ] Sessão válida após 5 minutos de inatividade
- [ ] Sessão válida após 15 minutos de inatividade
- [ ] `/api/auth/me` retorna usuário correto

**Por que importa:** Sessão expirando = usuário precisa re-logar constantemente.

---

### 2.3 Proteção de Rotas

**Objetivo:** Verificar se rotas protegidas realmente exigem auth.

```bash
# Sem cookie - deve retornar 401
curl -s http://localhost:3000/api/contacts
curl -s http://localhost:3000/api/deals
curl -s http://localhost:3000/api/conversations
```

**O que testar:**
- [ ] Todas retornam 401 sem autenticação
- [ ] Nenhuma retorna dados sensíveis
- [ ] Mensagem de erro é consistente

**Por que importa:** Falha de segurança = vazamento de dados.

---

## PARTE 3: TESTES DE CONTATOS

### 3.1 Criar Contato - Básico

**Objetivo:** Verificar criação de contato simples.

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "Teste",
    "lastName": "Automatizado",
    "email": "teste@exemplo.com",
    "phone": "11999999999"
  }'
```

**O que testar:**
- [ ] HTTP 201 Created
- [ ] Retorna contato com ID gerado
- [ ] Campos estão corretos
- [ ] `createdAt` e `updatedAt` preenchidos
- [ ] Tempo de resposta < 2 segundos

**Por que importa:** "Criação de contato demora muito ou falha" - sintoma reportado.

---

### 3.2 Criar Contato - Com Empresa Nova

**Objetivo:** Verificar auto-criação de empresa.

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "Teste",
    "lastName": "ComEmpresa",
    "email": "teste2@exemplo.com",
    "companyName": "Empresa Nova Teste"
  }'
```

**O que testar:**
- [ ] Contato criado com `companyId` preenchido
- [ ] Empresa "Empresa Nova Teste" foi criada automaticamente
- [ ] Tempo de resposta < 3 segundos
- [ ] Nenhum erro 500

**Por que importa:** A lógica de "buscar ou criar empresa" pode ter race condition.

---

### 3.3 Criar Contato - Com Empresa Existente

**Objetivo:** Verificar que não duplica empresa.

```bash
# Criar segundo contato com mesma empresa
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "Segundo",
    "lastName": "Contato",
    "email": "teste3@exemplo.com",
    "companyName": "Empresa Nova Teste"
  }'
```

**O que testar:**
- [ ] Contato criado com MESMO `companyId` do teste anterior
- [ ] NÃO foi criada empresa duplicada
- [ ] Busca case-insensitive funciona ("empresa nova teste" = "Empresa Nova Teste")

**Por que importa:** "Dados aparecem duplicados" - sintoma reportado.

---

### 3.4 Criar Contatos em Paralelo (Race Condition)

**Objetivo:** Verificar se criação simultânea não causa problemas.

```bash
# Executar em paralelo (3 requests simultâneos)
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/contacts \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d "{
      \"firstName\": \"Paralelo$i\",
      \"lastName\": \"Teste\",
      \"email\": \"paralelo$i@exemplo.com\",
      \"companyName\": \"Empresa Paralela\"
    }" &
done
wait
```

**O que testar:**
- [ ] Todos os 3 contatos foram criados
- [ ] APENAS UMA empresa "Empresa Paralela" existe
- [ ] Nenhum erro 500
- [ ] Nenhum deadlock (todas requests completam)

**Por que importa:** Race condition na criação de empresa pode causar duplicados.

---

### 3.5 Listar Contatos

**Objetivo:** Verificar listagem e performance.

```bash
curl -s http://localhost:3000/api/contacts -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna array de contatos
- [ ] Contatos criados anteriormente aparecem
- [ ] Tempo de resposta < 2 segundos (com <1000 contatos)
- [ ] Dados do contato estão completos

**Por que importa:** Listagem lenta indica query N+1 ou falta de índice.

---

### 3.6 Listar Contatos com Stats

**Objetivo:** Verificar agregações (potencial N+1).

```bash
time curl -s "http://localhost:3000/api/contacts?withStats=true" -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna contatos com `totalDealsValue`, `openDealsCount`, `lastActivityAt`
- [ ] Tempo de resposta < 3 segundos
- [ ] Não há erro 500

**Por que importa:** `withStats=true` pode ter query N+1 (uma query por contato).

---

### 3.7 Buscar Contato por ID

**Objetivo:** Verificar busca individual.

```bash
curl -s http://localhost:3000/api/contacts/1 -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna contato correto
- [ ] HTTP 404 para ID inexistente
- [ ] Tempo < 500ms

---

### 3.8 Atualizar Contato

**Objetivo:** Verificar update.

```bash
curl -X PATCH http://localhost:3000/api/contacts/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"firstName": "NomeAtualizado"}'
```

**O que testar:**
- [ ] Retorna contato atualizado
- [ ] `updatedAt` foi alterado
- [ ] Outros campos não foram afetados
- [ ] Audit log foi criado

---

### 3.9 Deletar Contato

**Objetivo:** Verificar deleção.

```bash
curl -X DELETE http://localhost:3000/api/contacts/999 -b cookies.txt -v
```

**O que testar:**
- [ ] HTTP 204 No Content
- [ ] Contato não existe mais ao buscar
- [ ] Audit log foi criado
- [ ] Relacionamentos (deals, conversations) tratados corretamente

---

## PARTE 4: TESTES DE DEALS

### 4.1 Criar Deal Básico

**Objetivo:** Verificar criação de deal.

```bash
curl -X POST http://localhost:3000/api/deals \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Deal Teste",
    "value": 10000,
    "pipelineId": 1,
    "stageId": 1,
    "contactId": 1
  }'
```

**O que testar:**
- [ ] HTTP 201 Created
- [ ] Deal criado com campos corretos
- [ ] `status` default é "open"
- [ ] `probability` default é aplicado

---

### 4.2 Mover Deal de Stage

**Objetivo:** Verificar movimentação no Kanban.

```bash
curl -X PATCH http://localhost:3000/api/deals/1/stage \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"stageId": 2}'
```

**O que testar:**
- [ ] Deal movido corretamente
- [ ] `stageId` atualizado
- [ ] WebSocket broadcast enviado (se houver cliente conectado)

---

### 4.3 Marcar Deal como Won

**Objetivo:** Verificar fechamento positivo.

```bash
curl -X PATCH http://localhost:3000/api/deals/1/stage \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"stageId": 5, "status": "won"}'
```

**O que testar:**
- [ ] `status` = "won"
- [ ] Deal ainda aparece na listagem (filtrado por status)

---

### 4.4 Marcar Deal como Lost

**Objetivo:** Verificar fechamento negativo.

```bash
curl -X PATCH http://localhost:3000/api/deals/1/stage \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"stageId": 6, "status": "lost", "lostReason": "Preço alto"}'
```

**O que testar:**
- [ ] `status` = "lost"
- [ ] `lostReason` preenchido

---

### 4.5 Listar Deals por Pipeline

**Objetivo:** Verificar listagem filtrada.

```bash
curl -s "http://localhost:3000/api/deals?pipelineId=1" -b cookies.txt | jq
```

**O que testar:**
- [ ] Somente deals do pipeline 1
- [ ] Dados do stage incluídos
- [ ] Performance < 2s

---

## PARTE 5: TESTES DE CONVERSAS (INBOX)

### 5.1 Criar Conversa

**Objetivo:** Verificar criação de conversa.

```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "subject": "Conversa Teste",
    "channel": "whatsapp",
    "status": "open",
    "contactId": 1
  }'
```

**O que testar:**
- [ ] HTTP 201 Created
- [ ] WebSocket broadcast `conversation:created` enviado

---

### 5.2 Listar Conversas

**Objetivo:** Verificar listagem com enriquecimento.

```bash
time curl -s http://localhost:3000/api/conversations -b cookies.txt | jq
```

**O que testar:**
- [ ] Conversas retornadas com `contact`, `company`, `deal` enriquecidos
- [ ] Tempo de resposta < 3 segundos
- [ ] Não há erro 500

**Por que importa:** O código atual faz N+1 queries (loop com awaits individuais).
Verificar arquivo: `server/api/conversations.ts` linhas 65-98.

---

### 5.3 Criar Mensagem

**Objetivo:** Verificar envio de mensagem.

```bash
curl -X POST http://localhost:3000/api/conversations/1/messages \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "content": "Mensagem de teste",
    "contentType": "text"
  }'
```

**O que testar:**
- [ ] HTTP 201 Created
- [ ] Mensagem tem `senderId` do usuário logado
- [ ] `senderType` = "user"
- [ ] WebSocket `message:created` enviado para a room da conversa

---

### 5.4 Listar Mensagens (Paginação)

**Objetivo:** Verificar paginação cursor-based.

```bash
curl -s "http://localhost:3000/api/conversations/1/messages?limit=10" -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna até 10 mensagens
- [ ] Tem campo para próximo cursor
- [ ] Ordenação por data (mais recente primeiro ou último)

---

### 5.5 Marcar como Lido

**Objetivo:** Verificar marcação de leitura.

```bash
curl -X POST http://localhost:3000/api/conversations/1/read -b cookies.txt
```

**O que testar:**
- [ ] Retorna count de mensagens marcadas
- [ ] `unreadCount` da conversa zerado
- [ ] WebSocket `message:read` enviado

---

### 5.6 Real-time: Nova Mensagem (WebSocket)

**Objetivo:** Verificar se mensagem nova chega via WebSocket.

**Teste:**
1. Conectar WebSocket e fazer `room:join` para conversa 1
2. Em outro terminal, enviar mensagem para conversa 1
3. Verificar se WebSocket recebe evento `message:created`

**O que testar:**
- [ ] Evento recebido em < 1 segundo
- [ ] Dados da mensagem completos
- [ ] Somente clientes na room recebem (não broadcast global)

**Por que importa:** "Inbox às vezes não atualiza" - sintoma reportado.

---

### 5.7 Real-time: Typing Indicator

**Objetivo:** Verificar indicador de digitação.

**Teste:**
1. Conectar 2 WebSockets na mesma conversa
2. WS1 envia: `{"type": "typing", "payload": {"conversationId": 1}}`
3. WS2 deve receber evento "typing"

**O que testar:**
- [ ] WS2 recebe o evento
- [ ] Evento contém userId do digitador
- [ ] Evento vai somente para a room da conversa

---

## PARTE 6: TESTES DE WHATSAPP (Evolution API)

### 6.0 Conexao WhatsApp - QR Code (Bug #001 - Corrigido)

**Objetivo:** Verificar se o QR code e exibido corretamente no modal de conexao.

**Bug relacionado:** `.bugs/resolved/001-EvolutionAPI-Integracao/`

**Teste via UI:**
1. Acessar `/settings/integrations/whatsapp`
2. Criar nova configuracao ou usar existente
3. Clicar em "Escanear QR Code"
4. Verificar se QR code aparece em ~3 segundos

**O que testar:**
- [ ] QR code e exibido (nao mostra "Erro - Resposta invalida do servidor")
- [ ] Console do navegador NAO mostra erros de validacao Zod
- [ ] `pairingCode` pode ser `null` sem causar erro
- [ ] Escanear QR code muda status para "Conectado"

**Teste via API:**
```bash
curl -X POST http://localhost:3000/api/channel-configs/1/whatsapp/connect \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "instanceName": "...",
    "qrCode": "data:image/png;base64,...",
    "pairingCode": null,  // OK - pode ser null
    "status": "qr_pending"
  }
}
```

**Por que importa:** Bug critico que impedia conexao do WhatsApp. Causa raiz: schema Zod usava `.optional()` que nao aceita `null`.

---

### 6.1 Webhook: Mensagem Recebida

**Objetivo:** Simular recebimento de mensagem WhatsApp.

```bash
curl -X POST http://localhost:3000/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "alma-crm-1",
    "data": [{
      "key": {
        "remoteJid": "5511999998888@s.whatsapp.net",
        "fromMe": false,
        "id": "MSG123456"
      },
      "pushName": "Cliente Teste",
      "message": {
        "conversation": "Olá, quero saber mais sobre o produto"
      },
      "messageTimestamp": 1705000000
    }]
  }'
```

**O que testar:**
- [ ] HTTP 200 OK
- [ ] Contato criado/encontrado pelo telefone
- [ ] Conversa criada/encontrada (channel: whatsapp)
- [ ] Mensagem criada com `senderType: contact`
- [ ] Deal auto-criado se contato não tinha deal aberto
- [ ] WebSocket `message:created` enviado

**Por que importa:** Fluxo crítico de entrada de leads.

---

### 6.2 Webhook: Idempotência

**Objetivo:** Verificar que mensagem duplicada não é criada.

```bash
# Enviar mesma mensagem 2x (mesmo key.id)
curl -X POST http://localhost:3000/api/webhooks/evolution ... # MSG123456
curl -X POST http://localhost:3000/api/webhooks/evolution ... # MSG123456 (repetido)
```

**O que testar:**
- [ ] Somente UMA mensagem criada
- [ ] Segunda request retorna 200 mas não duplica
- [ ] Log indica "Skipping duplicate message"

---

### 6.3 Webhook: Race Condition (Auto-criar Deal)

**Objetivo:** Verificar que deals não são duplicados em rajadas.

```bash
# Enviar 3 mensagens simultâneas do mesmo contato (novo)
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/webhooks/evolution \
    -d "{...mensagem diferente...}" &
done
wait
```

**O que testar:**
- [ ] Somente UM deal criado
- [ ] Advisory lock funcionou (pg_advisory_xact_lock)
- [ ] Todas mensagens criadas corretamente

**Por que importa:** Sem lock, cada mensagem criaria um deal separado.

---

### 6.4 Enviar Mensagem WhatsApp

**Objetivo:** Verificar envio via Evolution API.

```bash
curl -X POST http://localhost:3000/api/channel-configs/1/whatsapp/send \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "to": "5511999998888",
    "message": "Resposta do CRM"
  }'
```

**O que testar:**
- [ ] Mensagem enviada para Evolution API
- [ ] Resposta indica sucesso
- [ ] Timeout configurado (não trava indefinidamente)

---

## PARTE 7: TESTES DE ARQUIVOS (Supabase)

### 7.1 Gerar URL de Upload

**Objetivo:** Verificar geração de URL assinada.

```bash
curl -X POST http://localhost:3000/api/files/upload-url \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fileName": "teste.pdf",
    "fileType": "application/pdf"
  }'
```

**O que testar:**
- [ ] Retorna URL assinada válida
- [ ] URL expira em tempo razoável (15 min)
- [ ] Path gerado é único

---

### 7.2 Registrar Arquivo

**Objetivo:** Verificar registro após upload.

```bash
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "documento.pdf",
    "objectPath": "/uploads/xxx/documento.pdf",
    "mimeType": "application/pdf",
    "size": 12345,
    "entityType": "deal",
    "entityId": 1
  }'
```

**O que testar:**
- [ ] Arquivo registrado no banco
- [ ] Metadados corretos
- [ ] `uploadedBy` preenchido com userId

---

### 7.3 Obter URL Assinada para Download

**Objetivo:** Verificar acesso protegido a arquivos.

```bash
curl -s http://localhost:3000/api/files/1/signed-url -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna URL assinada temporária
- [ ] URL funciona para download
- [ ] Expira após período (15 min)

---

## PARTE 8: TESTES DE PIPELINE

### 8.1 Criar Pipeline

```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Pipeline Teste"}'
```

**O que testar:**
- [ ] Pipeline criado
- [ ] `isDefault` = false (se já existe outro)

---

### 8.2 Criar Stage

```bash
curl -X POST http://localhost:3000/api/pipelines/1/stages \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Qualificação",
    "order": 1,
    "color": "#3B82F6"
  }'
```

**O que testar:**
- [ ] Stage criado
- [ ] Ordem respeitada
- [ ] Cor em formato válido

---

### 8.3 Reordenar Stages

**Objetivo:** Verificar drag-and-drop de stages.

```bash
curl -X PATCH http://localhost:3000/api/pipelines/1/stages/2 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"order": 0}'
```

**O que testar:**
- [ ] Stage movido para posição correta
- [ ] Outros stages reordenados automaticamente

---

### 8.4 Definir Pipeline Default

```bash
curl -X POST http://localhost:3000/api/pipelines/2/set-default -b cookies.txt
```

**O que testar:**
- [ ] Pipeline 2 agora é default
- [ ] Pipeline 1 não é mais default
- [ ] Somente UM default por organização

---

## PARTE 9: TESTES DE NOTIFICAÇÕES

### 9.1 Listar Notificações

```bash
curl -s http://localhost:3000/api/notifications -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna array de notificações
- [ ] Somente notificações do usuário logado

---

### 9.2 Contagem de Não Lidas

```bash
curl -s http://localhost:3000/api/notifications/unread-count -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna número inteiro
- [ ] Bate com contagem real

---

### 9.3 Marcar como Lida

```bash
curl -X PATCH http://localhost:3000/api/notifications/1/read -b cookies.txt
```

**O que testar:**
- [ ] Notificação marcada
- [ ] Contagem decrementada

---

### 9.4 Marcar Todas como Lidas

```bash
curl -X POST http://localhost:3000/api/notifications/mark-all-read -b cookies.txt
```

**O que testar:**
- [ ] Todas marcadas
- [ ] Contagem zerada

---

## PARTE 10: TESTES DE ATIVIDADES

### 10.1 Criar Atividade

```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "call",
    "title": "Ligação de acompanhamento",
    "contactId": 1,
    "dueDate": "2025-01-25T10:00:00Z"
  }'
```

**O que testar:**
- [ ] Atividade criada
- [ ] `status` default = "pending"

---

### 10.2 Completar Atividade

```bash
curl -X PATCH http://localhost:3000/api/activities/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status": "completed"}'
```

**O que testar:**
- [ ] `status` = "completed"
- [ ] `completedAt` preenchido automaticamente

---

### 10.3 Listar Atividades por Contato

```bash
curl -s http://localhost:3000/api/contacts/1/activities -b cookies.txt | jq
```

**O que testar:**
- [ ] Somente atividades do contato 1
- [ ] Ordenação por data

---

## PARTE 11: TESTES DE CALENDAR

### 11.1 Criar Evento

```bash
curl -X POST http://localhost:3000/api/calendar-events \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Reunião com cliente",
    "startTime": "2025-01-25T14:00:00Z",
    "endTime": "2025-01-25T15:00:00Z"
  }'
```

**O que testar:**
- [ ] Evento criado
- [ ] Datas em formato correto

---

### 11.2 Listar Eventos (Range)

```bash
curl -s "http://localhost:3000/api/calendar-events?start=2025-01-01&end=2025-01-31" \
  -b cookies.txt | jq
```

**O que testar:**
- [ ] Somente eventos no período
- [ ] Performance com muitos eventos

---

## PARTE 12: TESTES DE REPORTS/DASHBOARD

### 12.1 Dashboard Stats

```bash
curl -s http://localhost:3000/api/dashboard -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna métricas (total deals, valor, conversão)
- [ ] Números batem com dados reais
- [ ] Performance < 3s

---

### 12.2 Reports Agregados

```bash
curl -s http://localhost:3000/api/reports -b cookies.txt | jq
```

**O que testar:**
- [ ] Dados de deals por stage
- [ ] Deals over time
- [ ] Team performance
- [ ] Performance < 5s

**Por que importa:** Queries de agregação complexas podem travar.

---

## PARTE 13: TESTES DE LGPD

### 13.1 Exportar Dados de Contato

```bash
curl -s http://localhost:3000/api/lgpd/contacts/1/export -b cookies.txt
```

**O que testar:**
- [ ] Retorna todos os dados do contato
- [ ] Inclui conversas, atividades, deals relacionados

---

### 13.2 Deletar Dados de Contato (Right to be Forgotten)

```bash
curl -X DELETE http://localhost:3000/api/lgpd/contacts/999 -b cookies.txt
```

**O que testar:**
- [ ] Contato removido
- [ ] Dados relacionados anonimizados/removidos
- [ ] Audit log criado

---

## PARTE 14: TESTES DE JOBS (Background)

### 14.1 Status de Job

```bash
curl -s http://localhost:3000/api/jobs/job-123 -b cookies.txt | jq
```

**O que testar:**
- [ ] Retorna status (pending/running/completed/failed)
- [ ] Progress se disponível
- [ ] 404 para job inexistente

---

### 14.2 Estatísticas da Fila

```bash
curl -s http://localhost:3000/api/jobs/stats -b cookies.txt | jq
```

**O que testar:**
- [ ] Contagem por status
- [ ] Jobs em execução

---

## PARTE 15: TESTES DE STRESS E EDGE CASES

### 15.1 Request com Payload Grande

```bash
# Criar contato com customFields gigante
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"firstName\": \"Teste\",
    \"lastName\": \"Grande\",
    \"customFields\": $(python3 -c "import json; print(json.dumps({'campo'+str(i): 'valor'*100 for i in range(100)}))")
  }"
```

**O que testar:**
- [ ] Não causa erro 500
- [ ] Validação de tamanho funciona
- [ ] Ou aceita (com limite razoável)

---

### 15.2 Caracteres Especiais

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "José María",
    "lastName": "O'\''Connor",
    "email": "jose+teste@exemplo.com"
  }'
```

**O que testar:**
- [ ] Caracteres acentuados preservados
- [ ] Aspas escapadas corretamente
- [ ] Email com + funciona

---

### 15.3 SQL Injection (Segurança)

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "Robert'\''); DROP TABLE contacts;--",
    "lastName": "Tables"
  }'
```

**O que testar:**
- [ ] NÃO executa SQL malicioso
- [ ] Contato criado com nome literal
- [ ] Drizzle ORM protege parametrizado

---

### 15.4 XSS (Segurança)

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "firstName": "<script>alert('XSS')</script>",
    "lastName": "Test"
  }'
```

**O que testar:**
- [ ] Script armazenado como texto (não executado)
- [ ] Frontend escapa na renderização
- [ ] Não causa erro

---

### 15.5 Concurrent Requests (Load)

```bash
# 10 requests simultâneas
for i in {1..10}; do
  curl -s http://localhost:3000/api/contacts -b cookies.txt &
done
wait
```

**O que testar:**
- [ ] Todas completam com sucesso
- [ ] Nenhum erro de conexão com DB
- [ ] Tempo médio aceitável

---

### 15.6 Timeout de Integração Externa

**Objetivo:** Verificar comportamento quando Supabase/OpenAI está lento.

**Simular:** Modificar temporariamente timeout ou usar mock.

**O que testar:**
- [ ] Request não trava indefinidamente
- [ ] Erro retornado em tempo razoável (< 30s)
- [ ] Mensagem de erro útil

---

## PARTE 16: TESTES DE CONSISTÊNCIA DE DADOS

### 16.1 Integridade Referencial

```bash
# Verificar se há contatos órfãos (companyId inválido)
# Verificar se há deals com contactId inválido
# Verificar se há mensagens com conversationId inválido
```

**SQL direto no banco:**
```sql
-- Contatos com empresa inexistente
SELECT c.id, c.companyId
FROM contacts c
LEFT JOIN companies co ON c.companyId = co.id
WHERE c.companyId IS NOT NULL AND co.id IS NULL;

-- Deals com contato inexistente
SELECT d.id, d.contactId
FROM deals d
LEFT JOIN contacts c ON d.contactId = c.id
WHERE d.contactId IS NOT NULL AND c.id IS NULL;

-- Mensagens com conversa inexistente
SELECT m.id, m.conversationId
FROM messages m
LEFT JOIN conversations c ON m.conversationId = c.id
WHERE c.id IS NULL;
```

**O que testar:**
- [ ] Nenhum registro órfão
- [ ] Foreign keys estão funcionando

---

### 16.2 Dados Duplicados

```sql
-- Empresas duplicadas por nome (mesmo org)
SELECT name, organizationId, COUNT(*)
FROM companies
GROUP BY name, organizationId
HAVING COUNT(*) > 1;

-- Contatos duplicados por email
SELECT email, organizationId, COUNT(*)
FROM contacts
WHERE email IS NOT NULL
GROUP BY email, organizationId
HAVING COUNT(*) > 1;

-- Pipelines default duplicados
SELECT organizationId, COUNT(*)
FROM pipelines
WHERE isDefault = true
GROUP BY organizationId
HAVING COUNT(*) > 1;
```

**O que testar:**
- [ ] Nenhuma duplicação inesperada
- [ ] Unicidade respeitada

---

## RELATÓRIO FINAL

Após executar todos os testes, gerar um relatório no seguinte formato:

```markdown
# Relatório de Testes - Alma CRM
Data: YYYY-MM-DD

## Resumo
- Total de testes: XX
- Passou: XX
- Falhou: XX
- Não executado: XX

## Problemas Críticos (Falhas que quebram funcionalidade)
1. [TESTE X.X] Descrição do problema
   - Esperado: ...
   - Obtido: ...
   - Arquivo suspeito: ...
   - Impacto: ...

## Problemas Médios (Comportamento inesperado)
...

## Problemas Baixos (Performance, UX)
...

## Recomendações de Correção
1. ...
2. ...
3. ...
```

---

## 7.0 TESTES DE CORRECOES ARQUITETURAIS (Bug #002)

### 7.1 WebSocket em Staging/Producao
**Relacionado a:** Bug #002 - Fase 1.1 (Configuracao Traefik/Coolify)

| Teste | Passos | Resultado Esperado |
|-------|--------|-------------------|
| WS-001 | Abrir DevTools > Network > WS em staging | Conexao WebSocket estabelecida (status 101) |
| WS-002 | Verificar console em staging | NAO deve aparecer "Invalid frame header" |
| WS-003 | Criar deal em uma aba | Deal aparece na outra aba em tempo real |
| WS-004 | Receber mensagem WhatsApp | Mensagem aparece na Inbox sem refresh |

**Se falhar:** Verificar configuracao Traefik/Coolify conforme `.bugs/active/002-Arquitetura-Sistema/traefik-websocket-config.md`

### 7.2 Connection Pool sob Carga
**Relacionado a:** Bug #002 - Fase 3.4 (Connection Pool)

| Teste | Passos | Resultado Esperado |
|-------|--------|-------------------|
| CP-001 | Abrir 5+ abas do CRM simultaneamente | Todas carregam sem timeout |
| CP-002 | Navegar rapidamente entre paginas | Nao deve haver erro 500 ou "connection timeout" |

### 7.3 Performance de Lead Scores (N+1 Fix)
**Relacionado a:** Bug #002 - Fase 2.3 (N+1 Queries)

| Teste | Passos | Resultado Esperado |
|-------|--------|-------------------|
| LS-001 | Acessar contato com muitas conversas | Carregamento rapido (<2s) |
| LS-002 | Acessar deal com muitas conversas | Carregamento rapido (<2s) |

**Nota:** Antes da correcao, 10 conversas = 10 queries. Agora = 1 query.

---

## NOTAS ADICIONAIS

### Arquivos para Inspecionar se Houver Falhas:

| Área | Arquivos |
|------|----------|
| Contatos | `server/api/contacts.ts`, `server/storage/contacts.ts` |
| Deals | `server/api/deals.ts`, `server/storage/deals.ts`, `server/services/deal-auto-creator.ts` |
| Conversas | `server/api/conversations.ts`, `server/storage/conversations.ts` |
| WebSocket | `server/ws/index.ts` |
| WhatsApp | `server/integrations/evolution/handler.ts`, `server/api/evolution.ts` |
| Arquivos | `server/api/files.ts`, `server/integrations/supabase/storage.ts` |
| Auth | `server/auth.ts`, `server/middleware.ts` |
| DB | `server/db.ts`, `server/storage.ts` |

### Padrões de Erro Comuns:

1. **Erro 500 aleatório** → Verificar catch blocks, promises sem await
2. **Dados não atualizam** → Verificar WebSocket broadcast, cache invalidation
3. **Duplicação** → Verificar transações, race conditions
4. **Lentidão** → Verificar queries N+1, índices faltando
5. **Timeout** → Verificar integrações externas sem timeout configurado
