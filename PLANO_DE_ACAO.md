# Plano de Ação — Limpeza e Padronização do Codebase (Alma CRM)

> **Objetivo**: Eliminar código morto, duplicações, inconsistências e drift de contratos.
> **Princípio**: Codebase limpo, robusto e preparado para escala.
> **Última atualização**: 2026-01-20

---

## Workflow Padrão por Milestone

Ao finalizar CADA milestone, executar obrigatoriamente:

```bash
# 1. Debug e Verificação
npm run check        # TypeScript sem erros
npm run lint         # ESLint sem erros
npm run build        # Build completo

# 2. Teste manual do fluxo afetado (quando aplicável)

# 3. Atualizar documentação (apenas se necessário)
# - README.md: visão geral, comandos, quick start
# - ESTRUTURA_DE_PASTAS.md: se arquivos/pastas mudaram
# - Outros docs específicos conforme a mudança
# - CLAUDE.md: SOMENTE remover info obsoleta ou corrigir erros

# 4. Commit e Push
git add .
git commit -m "milestone X: descrição concisa"
git push origin staging
```

---

## Milestone 1 — Remoção de Código Morto (Risco Zero)

**Por que é necessário:** Código morto aumenta complexidade cognitiva, confunde desenvolvedores e infla o bundle.

### 1.1 Frontend - Arquivos Não Utilizados

| # | Arquivo | Problema | Ação | Status |
|---|---------|----------|------|--------|
| 1 | `client/src/lib/authUtils.ts` | `isUnauthorizedError()` nunca importado | DELETAR arquivo | [ ] |
| 2 | `client/src/components/ui/input-otp.tsx` | Componente OTP nunca usado | DELETAR arquivo | [ ] |

### 1.2 Frontend - Funções Não Utilizadas

| # | Arquivo | Função | Ação | Status |
|---|---------|--------|------|--------|
| 3 | `client/src/pages/inbox/utils/groupMessages.ts` | `formatGroupDate()` | DELETAR função (manter resto do arquivo) | [ ] |

### 1.3 Backend - Exports Não Utilizados

| # | Arquivo | Export | Ação | Status |
|---|---------|--------|------|--------|
| 4 | `server/logger.ts` | `googleLogger` (linha 166) | DELETAR linha | [ ] |
| 5 | `server/logger.ts` | `supabaseLogger` (linha 168) | DELETAR linha | [ ] |
| 6 | `server/response.ts` | `sendRateLimited()` | DELETAR função | [ ] |
| 7 | `server/response.ts` | `sendIntegrationError()` | DELETAR função | [ ] |
| 8 | `server/lib/circuit-breaker.ts` | `withCircuitBreaker()` | DELETAR função (manter `isServiceFailure` - está em uso) | [ ] |

### 1.4 Verificação Pós-Milestone

- [ ] Executar `npm run check` - sem erros
- [ ] Executar `npm run lint` - sem erros
- [ ] Executar `npm run build` - build completo
- [ ] Atualizar ESTRUTURA_DE_PASTAS.md se necessário
- [ ] Commit: `chore: remove dead code (authUtils, input-otp, unused exports)`
- [ ] Push para staging

**Linhas removidas estimadas:** ~60 linhas

---

## Milestone 2 — Consolidar Duplicações de Upload

**Por que é necessário:** Mesma lógica de upload repetida em 4 lugares causa drift e bugs difíceis de rastrear.

### 2.1 Criar Hook Centralizado

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Criar `client/src/hooks/useFileUpload.ts` com lógica unificada | [ ] |
| 2 | Implementar: `uploadFile()`, `getUploadUrl()`, estados de loading/error | [ ] |

### 2.2 Refatorar Consumidores

| # | Arquivo | Ação | Status |
|---|---------|------|--------|
| 3 | `client/src/contexts/inbox/hooks/useInboxAudioRecorder.ts` | Usar `useFileUpload` | [ ] |
| 4 | `client/src/contexts/inbox/hooks/useInboxFileUploads.ts` | Usar `useFileUpload` | [ ] |
| 5 | `client/src/components/file-uploader/FileUploader.tsx` | Usar `useFileUpload` | [ ] |
| 6 | `client/src/components/file-uploader/MessageFileUploader.tsx` | Usar `useFileUpload` | [ ] |

### 2.3 Verificação Pós-Milestone

- [ ] Testar upload de arquivo no Inbox
- [ ] Testar upload de áudio no Inbox
- [ ] Testar upload em FileUploader (deals/contacts)
- [ ] Executar `npm run check && npm run lint && npm run build`
- [ ] Atualizar ESTRUTURA_DE_PASTAS.md (novo hook)
- [ ] Commit: `refactor: centralize file upload logic in useFileUpload hook`
- [ ] Push para staging

**Linhas de duplicação eliminadas:** ~80 linhas

---

## Milestone 3 — Unificar Tipos e Utilitários Duplicados

**Por que é necessário:** Tipos e funções duplicados divergem com o tempo ("drift").

### 3.1 Tipo `PendingFile`

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Manter definição canônica em `client/src/pages/inbox/types.ts` | [ ] |
| 2 | Atualizar `MessageFileUploader.tsx` para importar de `@/pages/inbox/types` | [ ] |
| 3 | Deletar `client/src/components/file-uploader/types.ts` | [ ] |

### 3.2 Função `getFileIcon`

| # | Tarefa | Status |
|---|--------|--------|
| 4 | Manter definição canônica em `client/src/components/file-uploader/utils.tsx` | [ ] |
| 5 | Atualizar `FileAttachments.tsx` para importar de `@/components/file-uploader/utils` | [ ] |
| 6 | Remover definição duplicada em `FileAttachments.tsx` | [ ] |

### 3.3 Verificação Pós-Milestone

- [ ] Executar `npm run check && npm run lint && npm run build`
- [ ] Testar exibição de anexos no Inbox
- [ ] Atualizar ESTRUTURA_DE_PASTAS.md se necessário
- [ ] Commit: `refactor: unify PendingFile type and getFileIcon function`
- [ ] Push para staging

**Arquivos eliminados:** 1 | **Duplicações eliminadas:** 2

---

## Milestone 4 — Unificar Preferências de Usuário (Double Source of Truth)

**Por que é necessário:** Preferências estão em dois lugares (localStorage e backend), causando inconsistência.

### 4.1 Estado Atual

| Preferência | localStorage | Backend DB | Sync Atual |
|-------------|--------------|------------|------------|
| Theme | ✓ Armazenado | ✗ Não existe | Nenhum |
| Language | ✓ Armazenado | ✓ `user.preferences` | Parcial |
| Sound | ✓ Armazenado | ✗ Não existe | Nenhum |

### 4.2 Solução: Backend como Fonte de Verdade

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Expandir tipo `UserPreferences` em `server/storage/users.ts` | [ ] |
| 2 | Adicionar campos: `theme`, `soundEnabled` ao schema se necessário | [ ] |
| 3 | Atualizar `client/src/components/theme-provider.tsx` para sync com backend | [ ] |
| 4 | Atualizar `client/src/contexts/LanguageContext.tsx` para sync com backend | [ ] |
| 5 | Atualizar `client/src/hooks/useNotificationSound.ts` para sync com backend | [ ] |

### 4.3 Fluxo Esperado

```
1. Login → GET /api/auth/me retorna preferences completas
2. Frontend popula localStorage como cache
3. Mudança de preferência → localStorage (UI instantânea) + PATCH /api/users/me
4. Backend é fonte de verdade, localStorage é cache
```

### 4.4 Tipo Expandido

```typescript
type UserPreferences = {
  language?: "pt-BR" | "en";
  theme?: "light" | "dark" | "system";
  soundEnabled?: boolean;
};
```

### 4.5 Verificação Pós-Milestone

- [ ] Testar: alterar tema → logout → login → tema persiste
- [ ] Testar: alterar idioma → logout → login → idioma persiste
- [ ] Testar: alterar som → logout → login → preferência persiste
- [ ] Executar `npm run check && npm run lint && npm run build`
- [ ] Atualizar CLAUDE.md seção "Preferencias de Usuario"
- [ ] Commit: `feat: unify user preferences with backend as source of truth`
- [ ] Push para staging

---

## Milestone 5 — Corrigir Drift de Eventos WebSocket

**Por que é necessário:** Eventos emitidos no backend sem handler no frontend = código morto e confusão.

### 5.1 Evento `message:read` - Emitido mas Não Tratado

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Verificar se o evento é necessário para a UX | [ ] |
| 2 | **Se SIM**: Adicionar handler em `useWebSocket.ts` | [ ] |
| 3 | **Se NÃO**: Remover emissão em `server/api/conversations/messages.ts` | [ ] |

### 5.2 Eventos de Calendário - Melhorar Eficiência

| # | Tarefa | Status |
|---|--------|--------|
| 4 | Avaliar se `calendar:event:*` pode usar `setQueryData` (como pipelines/deals) | [ ] |
| 5 | Se viável, implementar handlers com setQueryData em `useWebSocket.ts` | [ ] |

### 5.3 Payloads - Garantir Consistência de Tipos

| # | Tarefa | Status |
|---|--------|--------|
| 6 | Verificar `conversation:updated` payload (Date vs string) | [ ] |
| 7 | Criar/atualizar tipos em `shared/types/` se necessário | [ ] |

### 5.4 Verificação Pós-Milestone

- [ ] Testar fluxo de mensagens no Inbox
- [ ] Testar eventos de calendário (se aplicável)
- [ ] Executar `npm run check && npm run lint && npm run build`
- [ ] Atualizar CLAUDE.md seção WebSocket se handlers mudaram
- [ ] Commit: `fix: align websocket events between backend and frontend`
- [ ] Push para staging

---

## Milestone 6 — Padronizar API Client

**Por que é necessário:** Uso inconsistente de fetch() direto vs API client causa duplicação e dificulta manutenção.

### 6.1 Arquivos com fetch() Direto (Inconsistente)

| # | Arquivo | Ação | Status |
|---|---------|------|--------|
| 1 | `useInboxAudioRecorder.ts` | Já resolvido no Milestone 2 | [ ] |
| 2 | `useInboxFileUploads.ts` | Já resolvido no Milestone 2 | [ ] |
| 3 | `FileUploader.tsx` | Já resolvido no Milestone 2 | [ ] |
| 4 | `MessageFileUploader.tsx` | Já resolvido no Milestone 2 | [ ] |
| 5 | `avatar-upload.tsx` | Avaliar refatoração para usar hook centralizado | [ ] |

### 6.2 Export Faltando

| # | Tarefa | Status |
|---|--------|--------|
| 6 | Adicionar `export { searchApi } from './search';` em `client/src/lib/api/index.ts` | [ ] |

### 6.3 Verificação Pós-Milestone

- [ ] Verificar que todos os componentes de upload usam padrão consistente
- [ ] Executar `npm run check && npm run lint && npm run build`
- [ ] Commit: `refactor: standardize API client usage across codebase`
- [ ] Push para staging

---

## Resumo de Métricas

| Métrica | Antes | Depois |
|---------|-------|--------|
| Arquivos mortos | 2 | 0 |
| Funções não usadas | 6 | 0 |
| Duplicações de lógica | 4+ | 0 |
| Sources of truth para prefs | 2 | 1 |
| Eventos WS sem handler | 1+ | 0 |
| Linhas de código removidas | - | ~150+ |

---

## Ordem de Execução

```
Milestone 1 (Código Morto) → debug → docs → commit → push
    ↓
Milestone 2 (Upload Hook) → debug → docs → commit → push
    ↓
Milestone 3 (Tipos/Utils) → debug → docs → commit → push
    ↓
Milestone 4 (Preferências) → debug → docs → commit → push
    ↓
Milestone 5 (WebSocket) → debug → docs → commit → push
    ↓
Milestone 6 (API Client) → debug → docs → commit → push
    ↓
✅ COMPLETO
```

---

## Checklist Final

- [ ] Todos os milestones concluídos
- [ ] Nenhum erro de TypeScript
- [ ] Nenhum erro de ESLint
- [ ] Build completo sem warnings críticos
- [ ] Documentação atualizada
- [ ] Todos os commits no staging
- [ ] Testes manuais dos fluxos principais passando

---

## Notas Importantes

1. **CSV utils NÃO é código morto** - verificado que `exportRowsToCsv` e `exportFullReportToCsv` são usados em `reports.tsx`

2. **`isServiceFailure` está em uso** - verificado que é importado em `evolution/api.ts` e `openai/scoring.ts`. Apenas `withCircuitBreaker` pode ser removido.

3. **CLAUDE.md deve permanecer enxuto** - apenas remover informações obsoletas ou corrigir erros. Não adicionar detalhes excessivos.

4. **Documentação específica vai nos docs específicos:**
   - Estrutura de pastas → ESTRUTURA_DE_PASTAS.md
   - Como rodar local → RODAR_LOCAL.md
   - Deploy → DEPLOY_COOLIFY_HOSTINGER.md
   - Design system → DESIGN_SYSTEM.md
