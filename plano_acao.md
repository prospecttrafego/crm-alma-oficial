## Plano de Ação: Correções e Melhorias do CRM Alma

## Resumo Executivo

Este plano aborda **4 áreas principais** de correção e melhoria:

1. Integração WhatsApp (Evolution API) - Debug e correção do QR Code
2. Reestruturação da página de Settings (inspirado em Chatwoot/ClickUp)
3. Correção de bugs do Inbox
4. Melhorias na página de Contatos para CRM de vendas

**Estimativa total:** ~60-80 horas **Prioridade:** Alta (bugs críticos) → Média (melhorias de UX)

---

## Parte 1: Integração WhatsApp - Correção do QR Code

### Problema Identificado

- QR Code não carrega ao conectar WhatsApp
- Instância "alma-staging" aparece na Evolution API (indica que conexão parcial ocorreu)
- Possível problema de configuração ou tratamento de resposta

### Diagnóstico Necessário

**1.1 Verificar logs do backend:**

bash

```bash
# Ver logs de criação de instância
grep -i "evolution" logs/*.log
```

**1.2 Verificar variáveis de ambiente:**

- `EVOLUTION_API_URL` está correto?
- `EVOLUTION_API_KEY` está válido?
- `EVOLUTION_INSTANCE_PREFIX` = "alma-staging"?
- `EVOLUTION_WEBHOOK_SECRET` configurado em produção?

**1.3 Verificar banco de dados:**

- `channel_configs.whatsappConfig` tem `qrCode` preenchido?
- `connectionStatus` está em qual estado?

### Arquivos a Modificar

| **Arquivo**                                   | **Mudança**                            |
| --------------------------------------------- | -------------------------------------- |
| `server/api/channelConfigs.ts`                | Melhorar tratamento de erro e logs     |
| `server/integrations/evolution/api.ts`        | Adicionar logs detalhados no getQrCode |
| `client/src/components/whatsapp-qr-modal.tsx` | Melhorar feedback de erro              |

### Correções Específicas

**1.4 Melhorar tratamento de resposta do QR Code:**

typescript

```typescript
// server/api/channelConfigs.ts - linha ~495
const qrData = await evolutionApi.getQrCode(instanceName);

// ADICIONAR VALIDAÇÃO:
if (!qrData || (!qrData.base64 && !qrData.code)) {
  whatsappLogger.error(`[WhatsApp] QR Code vazio para instância: ${instanceName}`, { qrData });
  return sendError(res, ErrorCodes.INTEGRATION_ERROR, "Falha ao obter QR Code da Evolution API", 500);
}
```

**1.5 Limpar instâncias órfãs:**

- Criar endpoint para deletar instância antiga na Evolution API
- Ou adicionar verificação se instância existe antes de criar

---

## Parte 2: Reestruturação da Página de Settings

### Visão Geral

Transformar Settings de uma página monolítica para um sistema de **navegação por abas/seções** inspirado em Chatwoot e ClickUp.

### Nova Estrutura Proposta

```other
/settings                    → Página principal (lista de seções)
/settings/profile           → Perfil do usuário
/settings/organization      → Dados da organização
/settings/pipelines         → Gerenciamento de pipelines
/settings/integrations      → Hub de integrações
/settings/integrations/whatsapp  → Detalhes WhatsApp
/settings/integrations/email     → Detalhes Email
/settings/integrations/calendar  → Google Calendar
/settings/users             → Gerenciamento de usuários (admin)
```

### Layout Proposto

```other
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ Configurações                                                │
├─────────────────┬───────────────────────────────────────────────┤
│                 │                                               │
│ GERAL           │  📱 Integrações                              │
│ - Perfil        │                                               │
│ - Organização   │  Conecte suas ferramentas favoritas          │
│                 │                                               │
│ VENDAS          │  ┌─────────────┐ ┌─────────────┐             │
│ - Pipelines     │  │ 📱 WhatsApp │ │ 📧 Email    │             │
│ - Campos Custom │  │ Conectado ✓ │ │ Configurar  │             │
│                 │  └─────────────┘ └─────────────┘             │
│ INTEGRAÇÕES     │                                               │
│ - WhatsApp      │  ┌─────────────┐ ┌─────────────┐             │
│ - Email         │  │ 📅 Calendar │ │ 🤖 OpenAI   │             │
│ - Calendar      │  │ Sincronizado│ │ Ativo       │             │
│                 │  └─────────────┘ └─────────────┘             │
│ ADMIN           │                                               │
│ - Usuários      │                                               │
│ - Logs          │                                               │
│                 │                                               │
└─────────────────┴───────────────────────────────────────────────┘
```

### Arquivos a Criar/Modificar

| **Arquivo**                                           | **Ação**                                  |
| ----------------------------------------------------- | ----------------------------------------- |
| `client/src/pages/settings/index.tsx`                 | Criar - Página principal com menu lateral |
| `client/src/pages/settings/layout.tsx`                | Criar - Layout compartilhado              |
| `client/src/pages/settings/profile.tsx`               | Extrair de settings.tsx                   |
| `client/src/pages/settings/organization.tsx`          | Extrair de settings.tsx                   |
| `client/src/pages/settings/pipelines/index.tsx`       | Extrair de settings.tsx                   |
| `client/src/pages/settings/integrations/index.tsx`    | Criar - Hub de integrações                |
| `client/src/pages/settings/integrations/whatsapp.tsx` | Criar - Página dedicada                   |
| `client/src/pages/settings/integrations/email.tsx`    | Criar - Página dedicada                   |
| `client/src/pages/settings/integrations/calendar.tsx` | Criar - Página dedicada                   |
| `client/src/pages/settings.tsx`                       | Remover (migrar para estrutura acima)     |

### Página de Integração WhatsApp (Detalhada)

```other
┌─────────────────────────────────────────────────────────────────┐
│ ← Integrações                                                   │
│                                                                 │
│ 📱 WhatsApp Business                                           │
│ Conecte seu WhatsApp para receber e enviar mensagens           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ INSTÂNCIAS CONECTADAS                                          │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 📱 alma-staging                                              ││
│ │ Status: 🟢 Conectado                                         ││
│ │ Conectado em: 13/01/2025 às 07:02                           ││
│ │ Número: +55 11 99999-9999                                   ││
│ │ Mensagens recebidas: 1.234 | Enviadas: 567                  ││
│ │                                      [Desconectar] [Logs]   ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                        [+ Nova Conexão]                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ CONFIGURAÇÕES                                                   │
│                                                                 │
│ Auto-criar deal para novos contatos: [✓]                       │
│ Pipeline padrão: [Pipeline de Vendas ▼]                        │
│ Notificar responsável: [✓]                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ WEBHOOK                                                         │
│                                                                 │
│ URL: https://crm.almaagencia.com.br/api/webhooks/evolution     │
│ Secret: ------------                          [Copiar] [Gerar] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Parte 3: Correção de Bugs do Inbox

### Bug 3.1: Botão de Enviar Mensagem

**Problema:** O botão alterna entre "Enviar" e "Microfone" de forma confusa.

**Arquivo:** `client/src/pages/inbox/components/MessageComposer.tsx`

**Correção:**

typescript

```typescript
// Linha ~332 - Sempre mostrar botão de enviar quando há texto
{newMessage.trim().length > 0 || pendingFiles.length > 0 ? (
  <Button type="submit" ...>
    <Send className="h-5 w-5" />
  </Button>
) : (
  // Botão de microfone apenas quando vazio
  <Button type="button" onClick={onStartRecording} ...>
    <Mic className="h-5 w-5" />
  </Button>
)}
```

**Melhoria adicional:** Adicionar botão de enviar SEMPRE visível (ao lado do mic):

```other
[ Campo de texto                    ] [📎] [🎤] [➤]
```

### Bug 3.2: "Template" de Mensagem Confuso

**Problema:** Ao clicar em template, substitui todo o texto sem feedback claro.

**Arquivo:** `client/src/pages/inbox.tsx` (linhas 267-278)

**Correção:**

- Adicionar confirmação antes de substituir texto existente
- Mostrar preview do template antes de aplicar
- Ou: Inserir template na posição do cursor (não substituir)

### Bug 3.3: Sidebar - Pipeline Inacessível Quando Colapsada

**Problema:** Sub-menus ficam ocultos quando sidebar está no modo ícone.

**Arquivo:** `client/src/components/app-sidebar.tsx`

**Solução:** Usar Popover para mostrar sub-menus quando colapsado

typescript

```typescript
// Substituir Collapsible por lógica condicional
{isCollapsed ? (
  <Popover>
    <PopoverTrigger asChild>
      <SidebarMenuButton tooltip={t("nav.pipeline")} ...>
        <Kanban className="h-4 w-4" />
      </SidebarMenuButton>
    </PopoverTrigger>
    <PopoverContent side="right" className="w-48">
      {pipelines.map((pipeline) => (
        <Link key={pipeline.id} href={`/pipeline/${pipeline.id}`}>
          {pipeline.name}
        </Link>
      ))}
    </PopoverContent>
  </Popover>
) : (
  <Collapsible ...>
    {/* Comportamento atual */}
  </Collapsible>
)}
```

---

## Parte 4: Melhorias na Página de Contatos

### Novos Campos/Colunas Necessários

| **Coluna**          | **Fonte**                             | **Prioridade** |
| ------------------- | ------------------------------------- | -------------- |
| Valor Total (Deals) | Agregação de `deals.value`            | Alta           |
| Qtd. Deals Abertos  | Count de `deals` where status='open'  | Alta           |
| Tags                | `contacts.tags` (já existe no schema) | Alta           |
| Canal de Aquisição  | `contacts.source` (já existe)         | Média          |
| Responsável         | `contacts.ownerId` → `users.name`     | Média          |
| Última Atividade    | Max de `activities.createdAt`         | Média          |
| Status do Lead      | Novo campo ou derivado                | Média          |
| Data de Criação     | `contacts.createdAt`                  | Baixa          |

### Mudanças no Backend

**Arquivo:** `server/api/contacts.ts`

Criar endpoint com agregações:

typescript

```typescript
// GET /api/contacts?withStats=true
// Retorna contatos com:
// - totalDealsValue: sum de deals.value onde status='open'
// - openDealsCount: count de deals onde status='open'
// - lastActivityAt: max de activities.createdAt
// - owner: { id, name } do usuário responsável
```

### Mudanças no Frontend

**Arquivo:** `client/src/pages/contacts.tsx`

1. **Tabela Customizável:**
    - Usar `@tanstack/react-table` com column visibility
    - Permitir reordenar colunas (drag-and-drop)
    - Permitir redimensionar colunas
    - Salvar preferências em localStorage ou backend
1. **Novas Colunas:**

typescript

```typescript
const columns = [
  { id: 'name', header: 'Nome', ... },
  { id: 'email', header: 'Email', ... },
  { id: 'phone', header: 'Telefone', ... },
  { id: 'company', header: 'Empresa', ... },
  { id: 'totalValue', header: 'Valor Oportunidades', ... },  // NOVO
  { id: 'openDeals', header: 'Deals Abertos', ... },         // NOVO
  { id: 'tags', header: 'Tags', ... },                       // NOVO
  { id: 'source', header: 'Canal', ... },                    // NOVO
  { id: 'owner', header: 'Responsável', ... },               // NOVO
  { id: 'lastActivity', header: 'Última Atividade', ... },   // NOVO
  { id: 'createdAt', header: 'Criado em', ... },             // NOVO
];
```

1. **Filtros Avançados:**
    - Por tags (multi-select)
    - Por responsável
    - Por canal de aquisição
    - Por range de valor
    - Por data de criação

### Mudanças no Schema (se necessário)

**Arquivo:** `shared/schema.ts`

Campos que já existem mas podem precisar de ajuste:

- `contacts.tags` - OK (text[])
- `contacts.source` - OK (varchar)
- `contacts.ownerId` - OK (FK)

**Novo campo sugerido:**

typescript

```typescript
// Status do lead (opcional - pode ser derivado do deal)
leadStatus: varchar("lead_status", { length: 50 })
  .$type<"new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost">(),
```

---

## Parte 5: Melhorias no Pipeline (Relacionado)

### Campos a Adicionar nos Cards do Kanban

Os deals já possuem estes campos, garantir que sejam exibidos:

- `value` - Valor da oportunidade ✓ (já exibe)
- `probability` - Probabilidade de conversão
- `expectedCloseDate` - Data prevista de fechamento
- `source` - Canal de aquisição
- `lostReason` - Motivo de perda (quando aplicável)

### Formulário de Criação/Edição de Deal

Campos que devem estar disponíveis:

- Título
- Valor
- Contato
- Empresa
- Probabilidade (slider 0-100%)
- Data prevista de fechamento
- Canal de aquisição
- Tags/Labels
- Motivo de perda (quando mover para Lost)

---

## Ordem de Execução Recomendada

### Sprint 1: Bugs Críticos (Prioridade Alta)

1. Corrigir botão de enviar no Inbox
2. Corrigir sidebar colapsada (Pipeline inacessível)
3. Debug da integração WhatsApp (QR Code)

### Sprint 2: Reestruturação de Settings

1. Criar estrutura de pastas para settings
2. Migrar seções existentes para novas páginas
3. Criar página dedicada de integrações
4. Criar página detalhada do WhatsApp

### Sprint 3: Melhorias em Contatos

1. Backend: Endpoint com agregações de deals
2. Frontend: Novas colunas na tabela
3. Frontend: Tabela customizável (visibility, resize, reorder)
4. Frontend: Filtros avançados

### Sprint 4: Melhorias no Pipeline

1. Adicionar campos no formulário de deal
2. Exibir mais informações nos cards
3. Modal de motivo de perda ao mover para Lost

---

## Verificação Final

### Testes a Executar

1. **WhatsApp:**
    - Conectar nova instância
    - QR Code exibe corretamente
    - Receber mensagem via webhook
    - Deal auto-criado para novo contato
1. **Inbox:**
    - Enviar mensagem de texto
    - Enviar mensagem com arquivo
    - Gravar e enviar áudio
    - Mensagens aparecem em tempo real
1. **Settings:**
    - Navegar entre seções
    - Criar/editar pipeline
    - Conectar/desconectar WhatsApp
    - Configurar email
1. **Contatos:**
    - Visualizar todas as colunas
    - Reordenar colunas
    - Filtrar por tags
    - Ver valor de oportunidades
1. **Sidebar:**
    - Acessar Pipeline com menu colapsado
    - Tooltip funcionando
    - Sub-menus acessíveis

---

## Arquivos Críticos

```other
# Backend
server/api/channelConfigs.ts      # WhatsApp connect
server/api/contacts.ts            # Agregações de deals
server/integrations/evolution/    # Evolution API

# Frontend
client/src/pages/settings.tsx     # Migrar para estrutura modular
client/src/pages/settings/        # Nova estrutura
client/src/pages/contacts.tsx     # Tabela customizável
client/src/pages/inbox/           # Correções de bugs
client/src/components/app-sidebar.tsx  # Popover para sub-menus
```
