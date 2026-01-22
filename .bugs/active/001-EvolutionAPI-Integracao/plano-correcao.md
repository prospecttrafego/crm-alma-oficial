# Plano de Correção: Bug #001 - Integração Evolution API / WhatsApp

**Data:** 2026-01-22
**Status:** Em Execução
**Severidade:** CRÍTICO

---

## Resumo do Bug

O QR Code para conexão do WhatsApp nunca é exibido no modal. O usuário vê "loading" infinito seguido de "Erro - Resposta inválida do servidor".

---

## Causa Raiz

**Incompatibilidade de tipos entre backend e frontend:**

O backend retorna `pairingCode: null` na resposta JSON, mas o schema Zod do frontend usa `.optional()` que aceita apenas `string | undefined`, não `null`. A validação falha silenciosamente e lança erro `INVALID_RESPONSE`.

**Evidência:**
- Response HTTP: 200 OK com QR code válido
- Campo problemático: `"pairingCode": null`
- Schema Zod: `pairingCode: z.string().optional()` (não aceita null)
- Screenshot: Modal mostra "Erro - Resposta inválida do servidor"

---

## Tasks de Correção

### Fase 1: Implementação

- [ ] **1.1** Corrigir schema Zod em `shared/apiSchemas.integrations.ts`
  - Mudar `pairingCode: z.string().optional()` → `z.string().nullish()`
  - Mudar `message: z.string().optional()` → `z.string().nullish()`
  - Aplicar mesma correção em `whatsAppStatusResponseSchema`

- [ ] **1.2** Normalizar retorno do backend em `server/services/whatsapp-config.ts`
  - Função `connectWhatsApp`: converter `null` para `undefined` no return
  - Função `getWhatsAppStatus`: aplicar mesma normalização se necessário

- [ ] **1.3** Executar `npm run check` para validar TypeScript

### Fase 2: Documentação

- [ ] **2.1** Atualizar `CLAUDE.md` com lições aprendidas (se relevante)

- [ ] **2.2** Atualizar `descricao.md` deste bug com informações da correção

- [ ] **2.3** Mover pasta do bug para `.bugs/resolved/` após validação

### Fase 3: Verificação

- [ ] **3.1** Verificar que `npm run check` passa sem erros

- [ ] **3.2** **Teste Manual (Staging):**
  - Acessar `/settings/integrations/whatsapp`
  - Clicar em "Escanear QR Code"
  - Verificar se QR code aparece (~3 segundos)
  - Verificar console do navegador: não deve haver erros de validação

- [ ] **3.3** **Teste de Conexão (Staging):**
  - Escanear QR code com WhatsApp no celular
  - Verificar se status muda para "Conectado"
  - Enviar mensagem de teste para o número conectado
  - Verificar se mensagem aparece na Inbox

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `shared/apiSchemas.integrations.ts` | Schema Zod: `.optional()` → `.nullish()` |
| `server/services/whatsapp-config.ts` | Normalização: `null` → `undefined` |
| `CLAUDE.md` | Documentação (se necessário) |
| `.bugs/active/001-EvolutionAPI-Integracao/descricao.md` | Notas de correção |

---

## Detalhes Técnicos da Correção

### Schema Zod (ANTES)
```typescript
export const whatsAppConnectResponseSchema = z
  .object({
    instanceName: z.string(),
    qrCode: z.string().optional(),
    pairingCode: z.string().optional(),  // ← Não aceita null!
    status: z.string(),
    message: z.string().optional(),       // ← Não aceita null!
  })
  .strict();
```

### Schema Zod (DEPOIS)
```typescript
export const whatsAppConnectResponseSchema = z
  .object({
    instanceName: z.string(),
    qrCode: z.string().optional(),
    pairingCode: z.string().nullish(),  // ← Aceita null, undefined, string
    status: z.string(),
    message: z.string().nullish(),       // ← Aceita null, undefined, string
  })
  .strict();
```

### Backend Normalização (ANTES)
```typescript
return {
  instanceName,
  qrCode,
  pairingCode,        // ← Pode ser null
  status: "qr_pending",
  message,            // ← Pode ser null
};
```

### Backend Normalização (DEPOIS)
```typescript
return {
  instanceName,
  qrCode,
  pairingCode: pairingCode ?? undefined,  // ← Sempre undefined ou string
  status: "qr_pending",
  message: message ?? undefined,           // ← Sempre undefined ou string
};
```

---

## Problemas Secundários Identificados

### WebSocket Connection Errors
O console mostra erros de WebSocket: `Invalid frame header`

**Impacto:**
- Pode afetar atualizações em tempo real
- Pode impedir detecção automática quando QR é escaneado

**Status:** A ser investigado após correção do bug principal

**Possíveis causas:**
- Configuração de proxy/nginx
- Headers de upgrade não passando

---

## Riscos de Segurança Identificados

### Credenciais Compartilhadas
As variáveis `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET` são **idênticas** entre `.env.staging` e `.env.production`.

**Recomendação:** Regenerar credenciais de produção separadamente.

---

## Lições Aprendidas

1. **Schemas Zod para APIs externas devem usar `.nullish()`** ao invés de `.optional()` para campos que podem vir como `null`

2. **Backend deve normalizar dados** antes de retornar, especialmente quando integra com APIs externas que podem retornar `null`

3. **Erros de validação no frontend são silenciosos** - o usuário vê apenas "Resposta inválida do servidor" sem saber qual campo falhou

4. **Testar com dados reais da API externa** - o problema só aparece quando a Evolution API retorna `pairingCode: null`

---

## Histórico

| Data | Ação | Por |
|------|------|-----|
| 2026-01-20 | Bug reportado | Mateus |
| 2026-01-22 | Causa raiz identificada | Claude |
| 2026-01-22 | Plano de correção criado | Claude |
| YYYY-MM-DD | Correção implementada | - |
| YYYY-MM-DD | Validação em staging | - |
| YYYY-MM-DD | Bug movido para resolved | - |
