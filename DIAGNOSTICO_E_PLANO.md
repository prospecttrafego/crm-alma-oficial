# Diagnóstico completo + Plano de ação — Alma CRM

Data do diagnóstico: 2026-01-09  
Commit analisado: `f6586ca`  
Ambiente usado para validações: Node `v25.2.1`, npm `11.6.2` (o projeto documenta Node 20+)

Este documento foi criado para:
- Explicar o projeto de forma **não técnica** (para leigos).
- Explicar a **lógica e a arquitetura** do sistema.
- Fazer um **diagnóstico focado em funcionalidades (principalmente backend e integrações)**.
- Listar o que está **alinhado** e o que está **desalinhado** entre código e documentação.
- Fornecer um **plano de ação com milestones e checkboxes**.

---

## 1) O que é este projeto (explicação para leigos)

Pense no Alma CRM como um “painel de controle” para você e seu time acompanharem clientes e oportunidades.

Ele junta, em um só lugar:
- **Pipeline de vendas (Kanban):** um quadro com colunas (etapas) onde cada card é um “negócio” (deal) e você arrasta de etapa conforme avança.
- **Inbox (caixa de entrada):** um lugar para registrar e acompanhar conversas com contatos (ex.: WhatsApp), com mensagens, não lidas, responsáveis e anexos.

Além disso, ele guarda:
- **Contatos e empresas** (cadastro e histórico)
- **Atividades** (tarefas, ligações, reuniões)
- **Calendário** (eventos locais e integração com Google Calendar)
- **Notificações** (em tempo real e/ou push)
- **Arquivos/anexos** (upload e download)
- **IA** (score do lead/negócio e transcrição de áudio, quando configurado)

O objetivo final é: **não perder oportunidades**, organizar processos e centralizar informações para vender e atender melhor.

---

## 2) Como o sistema funciona (visão simples)

Quando você abre o CRM no navegador:
1. O **Frontend** (a “tela”, feito em React) pede dados para o **Backend** (o “cérebro”, feito em Express).
2. O Backend lê e grava tudo no **Banco de Dados** (PostgreSQL).
3. Algumas coisas acontecem “ao vivo” (ex.: nova mensagem, negócio movido) via **WebSocket** (atualizações em tempo real sem precisar dar F5).
4. Integrações (opcionais) conectam o CRM a serviços externos (WhatsApp, Google Calendar, Supabase, OpenAI, Firebase, Redis).

Exemplos práticos:
- Você cria um deal → o backend salva no banco → o frontend atualiza o quadro Kanban.
- Chega uma mensagem do WhatsApp (via Evolution API) → o backend recebe o webhook → cria/atualiza contato e conversa → cria a mensagem no banco → avisa o frontend em tempo real.
- Você anexa um arquivo → o backend gera um link de upload → o navegador envia o arquivo para o storage → o backend registra o arquivo no banco → o arquivo pode ser baixado com permissão.

---

## 3) Arquitetura (visão geral)

```
┌──────────────────────────────┐
│          FRONTEND            │
│  React + Vite + Tailwind     │
│  (páginas, componentes, hooks│
│   TanStack Query, Wouter)    │
└───────────────┬──────────────┘
                │ HTTP (/api) + WebSocket (/ws)
                ▼
┌──────────────────────────────┐
│           BACKEND            │
│ Express + Passport + Session │
│ Rotas (/api) + WebSocket     │
│ Storage (DAL) + Drizzle ORM  │
└───────────────┬──────────────┘
                │
                ▼
┌──────────────────────────────┐
│        POSTGRESQL (DB)       │
│ Tabelas: users, deals, msgs… │
└──────────────────────────────┘

Integrações opcionais (dependem de configuração):
- Supabase Storage (arquivos)
- Evolution API (WhatsApp)
- Google Calendar (OAuth + sync)
- OpenAI (lead scoring e transcrição de áudio)
- Upstash Redis (presença/online e base para cache/rate limit)
- Firebase (push notifications)
```

---

## 4) Features e componentes principais (o que existe hoje)

### Core do CRM (funciona com Postgres + sessões)
- Autenticação por email/senha (Passport + sessão)
- Pipeline (pipelines, estágios e deals)
- Inbox (conversas e mensagens)
- Contatos e empresas
- Atividades
- Notificações internas (tabela + endpoints)
- Logs de auditoria (tabela + endpoints)
- Relatórios (endpoint `/api/reports`)
- Views salvas (filtros)
- Preferências do usuário (ex.: idioma)

### Arquivos e mídia (precisa Supabase configurado)
- Upload com URL assinada
- Registro do arquivo no banco (controle de acesso)
- Download via rota protegida (`/objects/...`)
- Transcrição de áudio (precisa OpenAI)

### Tempo real (WebSocket)
- Eventos de criação/atualização (pipeline, deals, mensagens, calendário, configs)
- Indicador de “digitando”
- Presença (online/offline) usando Redis quando configurado

### Integrações implementadas
- WhatsApp via Evolution API (conectar, status, enviar mensagem, webhook para receber)
- Google Calendar (OAuth + import de eventos)
- Push notifications (Firebase Admin + tokens; usado quando usuário está “offline”)
- IA (OpenAI): recomendações do lead score + transcrição Whisper (quando configurado)

### Integrações **não completas** (existem estruturas, mas faltam rotinas reais)
- “Email channel” (existe `channel_configs.emailConfig`, mas não existe rotina de IMAP/SMTP para sincronizar/enviar emails)
- SMS/telefone (o schema aceita `sms`/`phone` em conversas, mas não existe integração implementada para isso)
- Cache/rate limit via Redis (existe código base em `server/redis.ts`, mas a maior parte não está aplicada nos endpoints)

---

## 5) Estrutura de pastas (explicada)

```
client/                Frontend (React)
  public/              Arquivos públicos (logo, favicon, service worker do Firebase)
  src/
    components/        Componentes (UI e “features”)
    pages/             Páginas (pipeline, inbox, contatos, etc.)
    hooks/             Hooks (auth, websocket, push, toast…)
    lib/               Infra do frontend (query client, firebase, utils)

server/                Backend (Express)
  index.ts             Entry point (Express + Vite dev + static prod)
  routes.ts            Todas as rotas /api + WebSocket (/ws)
  auth.ts              Sessões + Passport (login/register/logout/me)
  db.ts                Conexão Postgres + Drizzle
  storage.ts           “Camada de banco” (CRUD e queries)
  tenant.ts            Regra de “single-tenant” (1 organização por instalação)
  static.ts            Servir frontend em produção (dist/public)
  vite.ts              Vite em modo middleware (dev)
  storage.supabase.ts  Supabase Storage (upload/download/signed URL + controle de acesso)
  evolution-api.ts     Cliente HTTP para Evolution API
  evolution-message-handler.ts  Processa webhooks do WhatsApp
  google-calendar.ts   OAuth + Calendar API + conversões
  notifications.ts     Push notifications via Firebase Admin
  redis.ts             Upstash Redis (presença + base de cache/rate limit)
  aiScoring.ts         Lead scoring + recomendação via OpenAI
  whisper.ts           Transcrição de áudio (OpenAI Whisper)

shared/
  schema.ts            Schema Drizzle + tipos compartilhados

scripts/               Scripts utilitários
script/                Script de build (client + server bundle)

dist/                  Saída do build (gerado)
```

---

## 6) Integrações: o que você precisa fazer (passo a passo, sem “tecniquês”)

### 6.1 Banco de Dados (PostgreSQL) — **obrigatório**
Você precisa de um banco Postgres e uma URL de conexão.

O que você fornece:
- `DATABASE_URL=postgresql://usuario:senha@host:5432/database`

O que fazer:
- Crie um banco Postgres (pode ser Supabase, Neon, Railway, VPS, etc.).
- Coloque a `DATABASE_URL` no `.env`.
- Rode `npm run db:push` para criar as tabelas.

Ponto importante (pode causar erro no deploy):
- O schema usa `gen_random_uuid()` para gerar `users.id`. Em alguns Postgres você precisa habilitar a extensão **pgcrypto** (no Supabase normalmente já vem pronto). Se o `db:push` falhar citando `gen_random_uuid`, esse é o motivo.

### 6.2 Sessões/Login — **obrigatório**
Para manter o usuário logado, o sistema usa cookies e uma tabela `sessions` no Postgres.

O que você fornece:
- `SESSION_SECRET=...` (uma chave forte)

O que fazer:
- Gere uma chave forte (ex.: `openssl rand -base64 32`) e coloque no `.env`.
- Confirme que `npm run db:push` criou a tabela `sessions`.

### 6.3 Organização (modo “single-tenant”) — **obrigatório para o app funcionar**
Este CRM está rodando em modo “uma empresa por instalação” (single-tenant).
Isso significa: **precisa existir 1 organização no banco**.

O que você fornece (recomendado):
- `DEFAULT_ORGANIZATION_ID=1` (ou outro ID válido)

O que fazer:
- Garanta que exista uma linha na tabela `organizations`.
- Garanta que `DEFAULT_ORGANIZATION_ID` aponte para um ID que realmente existe.

Observação importante:
- Hoje **não existe** endpoint público/admin para criar organização. Em geral você cria via banco (manual) ou adiciona um “seed” (ver plano de ação).

### 6.4 Supabase Storage (arquivos/anexos) — **necessário se quiser uploads**
O CRM usa Supabase Storage para anexos e downloads com controle de acesso.

O que você fornece:
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

O que fazer:
- Crie um projeto no Supabase.
- Crie um bucket chamado **`uploads`**.
- Coloque `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env`.

### 6.5 WhatsApp (Evolution API) — **opcional**
Integração implementada para WhatsApp via Evolution API (Baileys).

O que você fornece:
- `EVOLUTION_API_URL=...`
- `EVOLUTION_API_KEY=...`
- `APP_URL=https://seu-dominio.com` (URL pública do CRM)
- `EVOLUTION_WEBHOOK_SECRET=...` (recomendado; em produção o código exige para processar webhooks com segurança)

O que fazer (alto nível):
- Suba/contrate uma Evolution API V2 e pegue URL + API key.
- No CRM, crie um “Channel Config” do tipo WhatsApp.
- Clique para conectar: o backend cria/usa uma instância e pede o QR code.
- Escaneie com o WhatsApp.
- O CRM registra mensagens recebidas via webhook `/api/webhooks/evolution`.

### 6.6 Google Calendar — **opcional**
Integração implementada para importar eventos do Google Calendar.

O que você fornece:
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URI=http(s)://.../api/auth/google/callback` (precisa bater exatamente com o configurado no Google)
- `GOOGLE_TOKEN_ENCRYPTION_KEY=...` (chave base64 de 32 bytes, recomendado)
- `APP_URL=...` (ajuda a montar redirect padrão)

O que fazer (alto nível):
- No Google Cloud Console, crie credenciais OAuth para “Web application”.
- Cadastre o redirect `/api/auth/google/callback`.
- No CRM, inicie a autorização (Settings) e conecte sua conta.
- O CRM salva tokens criptografados e permite sincronizar/importar eventos.

### 6.7 OpenAI (IA + transcrição) — **opcional**
Usado para:
- Recomendação “inteligente” do lead score
- Transcrição de áudio (Whisper)

O que você fornece:
- `OPENAI_API_KEY=...`

Sem essa chave:
- O score ainda é calculado com lógica local, mas a recomendação vira “padrão”.
- A transcrição de áudio fica indisponível.

### 6.8 Firebase Push Notifications — **opcional**
Usado para mandar push quando usuário está offline (especialmente útil para mensagens).

O que você fornece (backend):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (formato com `\n` dentro)

O que você fornece (frontend):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

### 6.9 Upstash Redis — **opcional**
Usado hoje principalmente para:
- Presença (online/offline) no WebSocket
- Base para cache/rate-limit (código existe, mas ainda não está aplicado em tudo)

O que você fornece:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## 7) API (resumo real do que existe hoje)

Endpoints `/api` encontrados em `server/routes.ts`:

- Auth/Usuário:  
  `/api/auth/user`, `/api/users/me`, `/api/users`
- Dashboard/Relatórios:  
  `/api/dashboard/stats`, `/api/reports`
- Pipeline:  
  `/api/pipelines`, `/api/pipelines/default`, `/api/pipelines/:id`, `/api/pipelines/:id/set-default`, `/api/pipelines/:id/stages`, `/api/pipelines/:pipelineId/stages/:id`
- Deals:  
  `/api/deals`, `/api/deals/:id`, `/api/deals/:id/stage`
- Contatos/Empresas:  
  `/api/contacts`, `/api/contacts/:id`, `/api/companies`, `/api/companies/:id`
- Inbox:  
  `/api/conversations`, `/api/conversations/:id`, `/api/conversations/:id/messages`, `/api/conversations/:id/read`
- Atividades:  
  `/api/activities`, `/api/activities/:id`
- Notificações:  
  `/api/notifications`, `/api/notifications/unread-count`, `/api/notifications/:id/read`, `/api/notifications/mark-all-read`
- Email templates:  
  `/api/email-templates`, `/api/email-templates/:id`
- Arquivos:  
  `/api/files/upload-url`, `/api/files`, `/api/files/:entityType/:entityId`, `/api/files/:id`, `/api/files/:id/transcribe`, `/api/audio/transcribe`
- Lead scoring:  
  `/api/lead-scores/:entityType/:entityId`, `/api/lead-scores/:entityType/:entityId/calculate`
- Calendário:  
  `/api/calendar-events`, `/api/calendar-events/:id`
- Config de canais (email/whatsapp):  
  `/api/channel-configs`, `/api/channel-configs/:id`, `/api/channel-configs/:id/test`
- WhatsApp (Evolution):  
  `/api/evolution/status`, `/api/channel-configs/:id/whatsapp/connect`, `/api/channel-configs/:id/whatsapp/status`, `/api/channel-configs/:id/whatsapp/disconnect`, `/api/channel-configs/:id/whatsapp/send`, `/api/webhooks/evolution`
- Google Calendar:  
  `/api/integrations/google-calendar/configured`, `/api/integrations/google-calendar/status`, `/api/auth/google/authorize`, `/api/auth/google/callback`, `/api/integrations/google-calendar/sync`, `/api/integrations/google-calendar/disconnect`
- Push tokens (FCM):  
  `/api/push-tokens`

Outros endpoints importantes:
- WebSocket: `GET /ws` (upgrade)
- Arquivos: `GET /objects/...` (protegido por sessão e controle de acesso no banco)

---

## 8) Diagnóstico técnico (o que foi verificado)

### 8.1 Tipagem / build / lint
Foram executados:
- `npm ci` (OK) — reportou `6 vulnerabilities (4 moderate, 2 high)` no audit
- `npm run check` (OK) — TypeScript sem erros
- `npm run build` (OK) — build do client + bundle do server gerados em `dist/`
- `npm run lint` (OK) — linter configurado; há warnings principalmente de imports/variáveis não usadas

### 8.2 Documentação vs código
- `README.md` está relativamente alinhado com as integrações atuais.
- `CLAUDE.md` estava **desatualizado** em pontos importantes (ex.: endpoints e integrações novas). Foi marcado para atualização (ver seção 10 e tarefas).

---

## 9) Principais achados (foco backend + integrações)

### A) “Blockers” (coisas que costumam quebrar deploy/uso)
- **Organização obrigatória no banco (single-tenant):** o backend assume que existe uma organização. Se não existir, muitos fluxos dão erro (e não há endpoint para criar).  
- **`DEFAULT_ORGANIZATION_ID` precisa bater com o banco:** se o env apontar para um ID inexistente, o backend falha quando tenta determinar a organização.
- **`gen_random_uuid()` no Postgres:** em alguns ambientes você precisa habilitar extensão (pgcrypto). Isso pode quebrar `db:push`.
- **Uploads exigem Supabase configurado:** sem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, upload/download falham.
- **WhatsApp em produção exige `EVOLUTION_WEBHOOK_SECRET`:** o código evita processar webhooks sem segredo em produção.

### B) Gaps de integração (existe “a tela”, mas falta o motor)
- **Email (IMAP/SMTP):** existe `channel_configs.emailConfig`, mas não existe rotina para buscar/enviar emails; o endpoint “test” só responde OK.
- **SMS/telefone:** o modelo de conversas suporta `sms`/`phone`, mas não há integração para entrada/saída.
- **Redis:** presença é usada, mas cache e rate-limit ainda não foram aplicados nas rotas (o código base existe).

### C) Melhorias recomendadas (qualidade/reliabilidade)
- **Linter agora existe:** mas há muitos warnings de imports/variáveis não usados; vale limpar gradualmente.
- **Vulnerabilidades npm:** existem 6 (moderate/high) — vale avaliar com `npm audit` e planejar atualização.
- **Unread count em conversas é global:** a lógica atual incrementa e zera de forma simplificada (não é por usuário); pode gerar contagens “estranhas” em times maiores.
- **WhatsApp mídia:** mensagens de mídia entram como placeholders (`[Imagem]`, etc.) sem anexar arquivo/URL de mídia (melhoria para “inbox completo”).

---

## 10) Plano de ação (milestones + checkboxes)

### Milestone 0 — “Rodar local com o mínimo”
Objetivo: conseguir logar e usar pipeline/inbox localmente com o básico.

- [ ] Criar `.env` a partir de `.env.example`
- [ ] Configurar `DATABASE_URL` e `SESSION_SECRET`
- [ ] Rodar `npm run db:push`
- [ ] Garantir que existe 1 organização em `organizations` e definir `DEFAULT_ORGANIZATION_ID` corretamente
- [ ] Rodar `npm run dev` e validar login

### Milestone 1 — “Bootstrap e estabilidade do backend”
Objetivo: evitar erros clássicos de deploy e tornar a inicialização “à prova de esquecimento”.

- [ ] Criar um **script de seed** (ex.: `scripts/seed.ts`) para criar organização + admin inicial
- [ ] (Opcional) Criar endpoint/admin protegido para bootstrap (somente em dev/primeiro uso)
- [ ] Validar e padronizar mensagens de erro quando faltar env obrigatório
- [ ] Revisar exigência/uso de `DEFAULT_ORGANIZATION_ID` (documentar e/ou tornar mais simples)
- [ ] Adicionar endpoint simples de “health check” (ex.: `/api/health`) para deploy monitorar

### Milestone 2 — “Arquivos (Supabase) redondo”
Objetivo: upload/download confiável e bem explicado.

- [ ] Confirmar bucket `uploads` no Supabase
- [ ] Documentar claramente: `SUPABASE_SERVICE_ROLE_KEY` é necessário e por quê
- [ ] Validar políticas/RLS do bucket (se aplicável) e garantir que o fluxo com URL assinada funciona
- [ ] (Opcional) Melhorar armazenamento: incluir metadados (ex.: transcription) no banco quando necessário

### Milestone 3 — “WhatsApp (Evolution) em produção”
Objetivo: conectar WhatsApp e receber/enviar mensagens com segurança.

- [ ] Configurar `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`
- [ ] Definir `APP_URL` com domínio real do CRM
- [ ] Definir `EVOLUTION_WEBHOOK_SECRET` e validar chamadas no webhook
- [ ] Criar Channel Config WhatsApp no Settings e conectar (QR)
- [ ] Testar recebimento de mensagens (webhook) e envio (`/whatsapp/send`)
- [ ] (Melhoria) Suportar anexos/mídias recebidas: baixar mídia e registrar como `files` + link na mensagem

### Milestone 4 — “Google Calendar”
Objetivo: conectar e sincronizar agenda de forma segura.

- [ ] Criar OAuth Client no Google Cloud Console
- [ ] Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- [ ] Configurar `GOOGLE_TOKEN_ENCRYPTION_KEY` (recomendado)
- [ ] Conectar via Settings e testar sync (`/integrations/google-calendar/sync`)
- [ ] (Melhoria) Sincronização bidirecional (hoje está focado em importar)

### Milestone 5 — “Push Notifications (Firebase)”
Objetivo: push funcionar quando usuário estiver offline.

- [ ] Criar projeto no Firebase e habilitar Cloud Messaging
- [ ] Preencher envs do backend (service account) e do frontend (SDK + VAPID)
- [ ] Confirmar service worker `client/public/firebase-messaging-sw.js` e permissões no navegador
- [ ] Testar: usuário offline recebe push ao chegar mensagem atribuída

### Milestone 6 — “Qualidade contínua”
Objetivo: manter o projeto saudável conforme evolui.

- [ ] Rodar `npm run check` em PRs/antes de deploy
- [ ] Rodar `npm run lint` em PRs/antes de deploy
- [ ] Limpar warnings do lint aos poucos (remover imports/variáveis não usadas)
- [ ] Fazer um plano para tratar `npm audit` (atualizações sem quebrar)
- [ ] (Opcional) Adicionar testes básicos de rotas críticas do backend

### Milestone 7 — “Inbox multicanal completo (roadmap)”
Objetivo: tornar real o “multicanal” além de WhatsApp.

- [ ] Implementar sincronização Email (IMAP) e envio (SMTP) usando `channel_configs.emailConfig`
- [ ] Implementar SMS (provider) e telefonia (se desejado)
- [ ] Ajustar modelo de “não lidas” para ser por usuário (ou por responsável)
- [ ] Melhorar performance do handler WhatsApp (buscar contato/conversa direto no banco, não em memória)

---

## 11) Checklist rápido de deploy (resumo)

- [ ] Banco Postgres acessível + `DATABASE_URL`
- [ ] `SESSION_SECRET` forte
- [ ] Rodar `npm run db:push`
- [ ] Garantir organização existente + `DEFAULT_ORGANIZATION_ID`
- [ ] `APP_URL` setado com domínio final
- [ ] (Se usar uploads) Supabase bucket `uploads` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] (Se usar WhatsApp) `EVOLUTION_*` + webhook secret
- [ ] `npm run build` e `npm start` (ou PM2)
- [ ] Nginx com suporte a WebSocket (`Upgrade`/`Connection`)

