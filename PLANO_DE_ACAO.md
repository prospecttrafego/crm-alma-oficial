# Plano de ação — Alma CRM (milestones + checklists)

Este arquivo contém **apenas o plano de ação** com milestones e checkboxes.

Diagnóstico (explicação do projeto + análise atual): `DIAGNOSTICO.md`.

---

## Milestone 0 — Ambiente local de validação (para testar "como empresa")
Objetivo: ter um ambiente local que reproduz a operação real para validar regras, integrações e volume.

- [ ] Criar `.env` a partir de `.env.example`
- [ ] Configurar `DATABASE_URL` e `SESSION_SECRET`
- [ ] Conferir se estrutura do Supabase foi feito corretamente
- [ ] Rodar `npm run db:push` (criar/atualizar tabelas)
- [ ] Garantir que existe uma organizacao em `organizations` e definir `DEFAULT_ORGANIZATION_ID` corretamente
- [ ] Subir com `npm run dev` e validar login/registro (conforme `ALLOW_REGISTRATION`)
- [ ] Criar um "dataset de teste" (contatos, empresas, deals, conversas e mensagens) para simular volume
- [ ] Validar features principais manualmente: pipeline (drag), inbox (mensagens), anexos, notificacoes, relatorios
- [x] Rodar rotinas de qualidade: `npm run check`, `npm run lint`, `npm run build` ✅ (2026-01-09)

---

## Milestone 1 (P0) — Segurança de acesso (login, sessões e permissões)
Objetivo: reduzir risco de invasão, vazamento e ações indevidas.

- [x] Rate limit e proteção anti brute force no login e endpoints sensíveis ✅ (2026-01-09) — 5 tentativas/min por IP no login/registro
- [x] Rate limit geral para rotas autenticadas ✅ (2026-01-09) — exige Upstash Redis configurado
- [x] Política de senha (mínimo 8 chars, 1 maiúscula, 1 número) ✅ (2026-01-09)
- [x] Fluxo de "esqueci minha senha" ✅ (2026-01-09) — `POST /api/forgot-password` e `POST /api/reset-password` com token de 1h
- [ ] Revisar sessões/cookies: duração real, renovação, logout em todos os dispositivos, e parâmetros seguros (sem "surpresas")
- [x] Definir claramente o que cada perfil pode fazer (admin/sales/cs/support) e aplicar isso nas rotas (RBAC de verdade) ✅ (2026-01-09) — `requireRole("admin")` aplicado em pipelines
- [ ] Revisar dados expostos nos endpoints (por exemplo: listas de usuários, auditoria, arquivos) para garantir que só sai o necessário
- [x] Revisar segurança de webhooks (WhatsApp): segredo obrigatório, logs de falha, e idempotência ✅ (2026-01-09) — campo `externalId` em mensagens + validação de token

---

## Milestone 2 (P0) — Performance e escalabilidade (principalmente backend + banco)
Objetivo: o CRM continuar rápido com muito dado.

- [x] Paginação + busca + ordenação nas listagens grandes ✅ (2026-01-09) — contacts, companies, deals, conversations, activities
- [x] Índices no Postgres para os filtros reais ✅ (2026-01-09) — contacts (org, email, phone, company), companies (org, domain), deals (org, pipeline, stage, status), conversations (org, contact, status, lastMessage), messages (conversation, createdAt)
- [x] Reutilizar pool do Postgres (queries + sessões) ✅ (2026-01-09) — reduz conexões duplicadas no banco
- [x] Corrigir/definir a regra de "não lidas" ✅ (2026-01-09) — mensagens de usuário não incrementam unreadCount; sender já é adicionado ao readBy
- [x] Otimizar WhatsApp: buscar contato/conversa direto no banco ✅ (2026-01-09) — `getContactByPhone()` e `getConversationByContactAndChannel()` criados
- [ ] Melhorar consistência de dados (ex.: normalizar e indexar telefone para busca rápida)

---

## Milestone 3 (P0) — Observabilidade e confiabilidade
Objetivo: você "enxergar" problemas antes de virarem crise e evitar travar o app.

- [x] Logs estruturados (com `requestId`) e logs específicos de integrações ✅ (2026-01-09) — `server/logger.ts` com whatsappLogger, googleLogger, openaiLogger, supabaseLogger
- [x] Endpoint de health/status interno ✅ (2026-01-09) — `GET /api/health` verifica DB, Redis, Supabase, Evolution API
- [x] Timeouts nas chamadas externas ✅ (2026-01-09) — Evolution API (30s), OpenAI (30s), Whisper (120s), download audio (60s)
- [x] Retries controlados nas chamadas externas ✅ (2026-01-09) — `server/retry.ts` com exponential backoff + jitter; aplicado em Evolution API
- [ ] Tirar tarefas pesadas do request (ex.: transcrição/sync/score) e rodar em job/background quando fizer sentido
- [ ] Política de erros: o que retorna pro usuário, o que fica no log, e como alertar quando algo cair

---

## Milestone 4 (P1) — Integrações “de verdade” (não só configuração)
Objetivo: as integrações serem estáveis e completas.

- [ ] Email: implementar sincronização IMAP + envio SMTP usando `channel_configs.emailConfig` (com segurança e proteção de credenciais)
- [x] WhatsApp: suportar mídia/anexos recebidos ✅ (2026-01-09) — baixa mídia da Evolution API, salva no Supabase Storage, registra em `files`, adiciona attachment na mensagem
- [ ] Google Calendar: sincronização incremental e tratamento robusto de refresh token/expiração
- [ ] Firebase push: fluxo de tokens (registrar/atualizar/remover) e testes reais em múltiplos dispositivos

---

## Milestone 5 (P1) — Governança e dados (empresa de verdade)
Objetivo: evitar perda de dados e ficar mais “profissional” na operação.

- [ ] Estratégia de migração (Drizzle migrations) para evoluir schema com segurança
- [ ] Seed/bootstrap controlado (organização + usuário admin inicial) para não depender de “mexer no banco na mão”
- [ ] Política de retenção (o que guardar e por quanto tempo) e ações LGPD básicas (exportação/remoção sob demanda)
- [ ] Auditoria mais completa (cobrir ações críticas: deals, contatos, arquivos, integrações)

---

## Milestone 6 (P2) — Qualidade contínua (para o projeto não degradar)
Objetivo: manter o ritmo de evolução sem quebrar produção.

- [ ] Padronizar rotinas internas: `npm run check`, `npm run lint`, `npm run build`
- [ ] Começar suíte de testes do backend (rotas críticas + permissões + integrações mockadas)
- [ ] Limpar warnings do lint gradualmente (não precisa “parar o mundo”)
- [ ] Plano para reduzir vulnerabilidades do `npm audit` sem quebrar dependências

---

## Milestone 7 (Roadmap) — Multicanal completo
Objetivo: transformar “multicanal” em realidade (além do WhatsApp).

- [ ] Email completo (já no P1-1)
- [ ] SMS e telefonia (definir provider e requisitos)
- [ ] Relatórios avançados (KPI por canal, SLA de atendimento, performance por usuário)

---

## Milestone 8 (P1) — Manutenibilidade (estrutura do backend)
Objetivo: facilitar evolução sem “routes.ts gigante” e reduzir risco de regressões.

- [x] Criar `server/api/` e quebrar rotas por domínio (auth, contacts, deals, inbox, etc.)
- [x] Criar `server/ws/` e extrair WebSocket/broadcast para módulo dedicado
- [ ] Criar `server/integrations/` e organizar integrações (Evolution/Google/OpenAI/Firebase/Supabase)
- [ ] Padronizar middlewares (auth, rate limit, validação) e contratos de resposta

---

## Checklist de maturidade (empresa com alto volume)
Use isso como "lista de pronto" para operar com confiança:

- [x] Listagens com paginação + busca (não carregar tudo) ✅
- [x] Índices e queries revisados (principalmente contatos, conversas, deals, mensagens) ✅
- [x] Regra clara e correta de "não lidas" ✅ (2026-01-09)
- [x] Rate limit e proteção no login ✅
- [x] Permissões por perfil aplicadas (RBAC) ✅
- [x] Logs e alertas (saber quando algo quebrou) ✅
- [x] Integrações com timeout e status visível ✅ (retries implementado 2026-01-09)
- [ ] Rotina de migrações e bootstrap (sem "mexer no banco na mão")
- [ ] Política mínima de retenção e ações LGPD (exportar/remover quando necessário)
