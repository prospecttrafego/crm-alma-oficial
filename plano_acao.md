# 📋 PLANO DE AÇÃO COMPLETO - CRM ALMA

## ✅ JÁ IMPLEMENTADO

- Optimistic updates para mensagens
- Sistema de rooms WebSocket (broadcast direcionado)
- Cache update direto (sem refetch)
- Deduplicação de mensagens (externalId)
- Status indicators (sending/sent/delivered/read/error)
- Evolution API v2.3.7 fix (webhook integrado na criação)

---

## MILESTONE 1: Correções Críticas de UX

**Prioridade:** ALTA | **Estimativa:** 2-3 dias

- **1.1 Google Calendar Status Hardcoded** - Buscar status real via API
- **1.2 Textos Não Traduzidos no ContextPanel** - Adicionar i18n
- **1.3 Paginação de Contatos** - Implementar server-side pagination
- **1.4 Validação de Lost Reason** - Campo obrigatório quando status = "lost"
- **1.5 Landing Page** - Corrigir nome "Convert.CRM" para "Alma"

---

## MILESTONE 2: Features de Chat Modernas

**Prioridade:** ALTA | **Estimativa:** 5-7 dias

- **2.1 Reply/Quote de Mensagens**

```other
-    Migration: replyToId em messages

-    UI de preview no composer

-    Renderização de quoted message
```

- **2.2 @Mentions de Usuários**

```other
-    Autocomplete ao digitar @

-    Notificações para mencionados

-    Highlight de mentions
```

- **2.3 Busca de Mensagens**

```other
-    Full-text search com PostgreSQL

-    Modal de busca (Cmd+F)

-    Navegação para resultado
```

---

## MILESTONE 3: Resiliência e Offline

**Prioridade:** MÉDIA-ALTA | **Estimativa:** 4-5 dias

- **3.1 Offline Message Queue**

```other
-    IndexedDB com idb

-    Sync automático quando online
```

- **3.2 Message Grouping by Time**

```other
-    Agrupar mensagens do mesmo autor

-    Avatar apenas na primeira do grupo
```

- **3.3 Edit/Delete Messages**

```other
-    Soft delete com deleted_at

-    Janela de 15 min para edição

-    Badge "editado"
```

---

## MILESTONE 4: Melhorias de Integrações

**Prioridade:** MÉDIA | **Estimativa:** 3-4 dias

- **4.1 Email Reset de Senha** (DÉBITO TÉCNICO)

```other
-    Criar server/services/email.ts

-    Integrar com nodemailer

-    Template HTML de reset
```

- **4.2 Google Calendar Bidirectional Sync**

```other
-    CRM → Google sync
```

- **4.3 Firebase Token Rotation**

```other
-    Detectar tokens expirados

-    Batch sending
```

---

## MILESTONE 5: Responsividade e Mobile

**Prioridade:** MÉDIA | **Estimativa:** 3-4 dias

- **5.1 Inbox Mobile** - Botão voltar, swipe gestures
- **5.2 Pipeline Mobile** - Horizontal scroll, touch-friendly
- **5.3 Settings Mobile** - Hamburger menu, drawer

---

## MILESTONE 6: Acessibilidade (A11Y)

**Prioridade:** MÉDIA | **Estimativa:** 2-3 dias

- **6.1 ARIA Labels** em botões de ícone
- **6.2 Keyboard Navigation** completa
- **6.3 Contraste de Cores** WCAG AA

---

## MILESTONE 7: Features Faltantes

**Prioridade:** BAIXA-MÉDIA | **Estimativa:** 4-5 dias

- **7.1 Command Palette** - Integrar (já existe componente)
- **7.2 Saved Views UI** - Salvar/carregar filtros
- **7.3 Notifications Real-time** - WebSocket + badge
- **7.4 Audit Log Filtros** - Por tipo, usuário, data

---

## MILESTONE 8: Performance e Otimizações

**Prioridade:** BAIXA | **Estimativa:** 2-3 dias

- **8.1 Lazy Loading de Gráficos**
- **8.2 Virtualization Melhorias**
- **8.3 Bundle Size** - Code splitting

---

## MILESTONE 9: Qualidade de Código

**Prioridade:** BAIXA | **Estimativa:** 2-3 dias

- **9.1 Refatoração de Arquivos Grandes** (inbox.tsx, MessageComposer)
- **9.2 Testes** - Unit, E2E, integração
- **9.3 Documentação** - JSDoc, Storybook

---

## 📊 RESUMO

| **Milestone**     | **Prioridade** | **Dias**        | **Itens**    |
| ----------------- | -------------- | --------------- | ------------ |
| 1 - UX Críticas   | 🔴 ALTA        | 2-3             | 5            |
| 2 - Chat Features | 🔴 ALTA        | 5-7             | 3            |
| 3 - Offline       | 🟠 MÉDIA-ALTA  | 4-5             | 3            |
| 4 - Integrações   | 🟡 MÉDIA       | 3-4             | 3            |
| 5 - Mobile        | 🟡 MÉDIA       | 3-4             | 3            |
| 6 - A11Y          | 🟡 MÉDIA       | 2-3             | 3            |
| 7 - Features      | 🟢 BAIXA-MÉDIA | 4-5             | 4            |
| 8 - Performance   | 🟢 BAIXA       | 2-3             | 3            |
| 9 - Qualidade     | 🟢 BAIXA       | 2-3             | 3            |
| **TOTAL**         |                | **~28-37 dias** | **30 itens** |

---

## 🎯 ORDEM DE EXECUÇÃO RECOMENDADA

1. **Milestone 1** → Correções que afetam usabilidade imediata
2. **Milestone 2** → Features de chat que usuários esperam
3. **Milestone 4.1** → Email reset é obrigatório para produção
4. **Milestone 3** → Offline queue melhora confiabilidade
5. **Milestone 5** → Se há usuários mobile
6. **Milestones 6-9** → Melhorias incrementais