# Alma CRM

Sistema de CRM (Customer Relationship Management) desenvolvido para a agencia digital Alma. Plataforma SaaS com inbox unificado para comunicacoes multicanal e pipeline de vendas estilo Kanban.

## Funcionalidades Principais

### Pipeline de Vendas (Kanban)
- Visualizacao drag-and-drop de deals
- Multiplos pipelines customizaveis
- Probabilidade e valor de deals
- Filtros e views salvos
- Historico de movimentacoes

### Inbox Unificado
- Conversas multicanal (email via IMAP/SMTP e WhatsApp via Evolution API; SMS/telefone em roadmap)
- Atribuicao de responsaveis
- Notas internas
- Anexos de arquivos
- Contagem de nao lidos

### Gestao de Contatos
- Cadastro completo de contatos
- Empresa digitada como texto (auto-criada se nao existir)
- Campos customizados (JSON)
- Tags e segmentacao
- Historico de atividades
- Auto-criacao de deal via WhatsApp (para contatos sem deal aberto)

### Recursos Adicionais
- Lead scoring com IA (OpenAI)
- Calendario de eventos
- Templates de email
- Notificacoes em tempo real
- Logs de auditoria
- Multi-organizacao (parcial: schema suporta, execucao atual em modo single-tenant por instalacao)

## Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|------------|--------|
| Frontend | React | 19.2.3 |
| Build Tool | Vite | 7.3.0 |
| Styling | Tailwind CSS | 4.1.18 |
| Componentes | shadcn/ui + Radix UI | - |
| Estado | TanStack Query | 5.60.5 |
| Roteamento | Wouter | 3.3.5 |
| Backend | Express | 4.21.2 |
| Linguagem | TypeScript | 5.9.3 |
| Banco de Dados | PostgreSQL | - |
| ORM | Drizzle ORM | 0.39.3 |
| Validacao | Zod | 4.1.13 |
| Autenticacao | Passport.js Local | 0.7.0 |
| Storage | Supabase Storage | 2.87.3 |
| Real-time | WebSocket (ws) | 8.18.0 |
| AI | OpenAI | 6.10.0 |

## Design System

O guia definitivo do sistema visual (tokens de tema, padrões de componentes e regras de UI) fica em `DESIGN_SYSTEM.md`.

## Inicio Rapido

```bash
# Instalar dependencias
npm install

# Configurar ambiente
cp .env.example .env.staging
cp .env.example .env.production
# Editar os arquivos com suas credenciais

# Aplicar migrations no banco
npm run db:migrate

# (Somente dev/local) Sincronizar schema direto
npm run db:push:dev

# Desenvolvimento (usa .env.staging quando APP_ENV=staging)
APP_ENV=staging npm run dev

# Producao local (usa .env.production quando NODE_ENV=production)
APP_ENV=production npm run build
npm start

# Ou mantenha um .env para uso local rapido
npm run dev

```

## Estrutura do Projeto

```
├── client/                  # Frontend React
│   ├── public/              # Assets publicos (favicon, logo, SW do Firebase)
│   └── src/
│       ├── components/      # Componentes reutilizaveis
│       │   └── ui/          # shadcn/ui components
│       ├── contexts/        # Contextos (ex.: idioma)
│       ├── locales/         # Traducoes (pt-BR/en)
│       ├── pages/           # Paginas da aplicacao
│       ├── hooks/           # React hooks customizados
│       └── lib/             # Utilitarios e configuracoes
├── server/                  # Backend Express
│   ├── index.ts             # Entry point
│   ├── routes.ts            # Agregador (auth + rate limit + API + WebSocket)
│   ├── middleware.ts        # Middlewares padronizados (asyncHandler, validate*)
│   ├── response.ts          # Helpers de resposta (sendSuccess, sendError, etc)
│   ├── validation/          # Schemas Zod para validacao de entrada (shared/contracts)
│   │   ├── index.ts         # Re-exports
│   │   └── schemas.ts       # Schemas de validacao
│   ├── api/                 # Rotas HTTP por domínio (módulos)
│   ├── ws/                  # WebSocket (/ws) + broadcast
│   ├── jobs/                # Background jobs (Redis/fallback memoria)
│   ├── logger.ts            # Logs estruturados (requestId + integrações)
│   ├── health.ts            # Health check (DB + integrações opcionais)
│   ├── storage/             # DAL por dominio (contacts, deals, etc.)
│   ├── storage.ts           # Facade do storage (re-export dos modulos)
│   ├── auth.ts              # Autenticacao Passport.js
│   ├── db.ts                # Drizzle + conexao Postgres
│   ├── tenant.ts            # Single-tenant (organizacao)
│   ├── storage.supabase.ts  # Upload de arquivos (Supabase Storage)
│   ├── aiScoring.ts         # Lead scoring com IA
│   ├── whisper.ts           # Transcricao de audio (Whisper/OpenAI)
│   ├── evolution-api.ts     # Evolution API (WhatsApp)
│   ├── evolution-message-handler.ts # Webhook handler (WhatsApp)
│   ├── google-calendar.ts   # Google Calendar (OAuth + sync)
│   ├── notifications.ts     # Push notifications (Firebase Admin)
│   ├── redis.ts             # Redis (Upstash)
│   ├── static.ts            # Servir frontend em producao
│   └── vite.ts              # Vite middleware (dev)
├── shared/                  # Codigo compartilhado (fonte unica de verdade)
│   ├── schema.ts            # Schema Drizzle + tipos + enums
│   ├── contracts.ts         # Schemas Zod e DTOs derivados do schema
│   └── types/               # Tipos compartilhados frontend/backend
│       ├── api.ts           # ApiResponse, ErrorCodes, PaginationMeta
│       └── dto.ts           # DTOs para transferencia de dados
├── scripts/                 # Scripts utilitarios
│   └── migrate-users.ts     # Migracao de usuarios
└── script/
    └── build.ts             # Script de build
```

Notas importantes:
- `shared/contracts.ts` e `shared/schema.ts` sao a fonte unica de verdade para schemas e DTOs.
- A validacao no backend usa apenas schemas derivados do Drizzle (nao ha validacao manual duplicada).

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL de conexao PostgreSQL |
| `SESSION_SECRET` | Sim | Chave para criptografia de sessoes |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Nao | Anon key do Supabase (nao usada diretamente hoje pelo backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key do Supabase |
| `OPENAI_API_KEY` | Nao | API key OpenAI (para lead scoring) |
| `ALLOW_REGISTRATION` | Nao | Permitir registro publico (default: false) |
| `VITE_ALLOW_REGISTRATION` | Nao | Permitir registro (flag no frontend) |
| `DEFAULT_ORGANIZATION_ID` | Nao | ID da organizacao padrao (modo single-tenant) |
| `APP_URL` | Nao | URL da aplicacao em producao |
| `PORT` | Nao | Porta do servidor (default: 3000) |
| `UPSTASH_REDIS_REST_URL` | Nao | URL Upstash Redis (opcional; recomendado para rate limit, jobs e presenca) |
| `UPSTASH_REDIS_REST_TOKEN` | Nao | Token Upstash Redis (opcional; recomendado para rate limit, jobs e presenca) |
| `FIREBASE_PROJECT_ID` | Nao | Firebase Project ID (push/FCM - opcional) |
| `FIREBASE_PRIVATE_KEY` | Nao | Private key do service account (push/FCM - opcional) |
| `FIREBASE_CLIENT_EMAIL` | Nao | Client email do service account (push/FCM - opcional) |
| `VITE_FIREBASE_API_KEY` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_PROJECT_ID` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_APP_ID` | Nao | Firebase Web SDK (frontend) |
| `VITE_FIREBASE_VAPID_KEY` | Nao | VAPID key (push/FCM - frontend) |
| `GOOGLE_CLIENT_ID` | Nao | Client ID OAuth (Google Calendar) |
| `GOOGLE_CLIENT_SECRET` | Nao | Client Secret OAuth (Google Calendar) |
| `GOOGLE_REDIRECT_URI` | Nao | Redirect URI OAuth (Google Calendar) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Nao | Chave base64 (32 bytes) para criptografar tokens (obrigatoria em producao se usar Google Calendar) |
| `APP_ENV` | Nao | Define arquivo `.env.{APP_ENV}` (ex.: `staging`, `production`) |
| `ENV_FILE` | Nao | Caminho explicito para arquivo `.env` (sobrescreve APP_ENV) |
| `EVOLUTION_API_URL` | Nao | URL base da Evolution API V2 |
| `EVOLUTION_API_KEY` | Nao | API key da Evolution API |
| `EVOLUTION_INSTANCE_PREFIX` | Nao | Prefixo unico por deploy para evitar colisao de instancias (quando varios CRMs compartilham a mesma Evolution API) |
| `EVOLUTION_WEBHOOK_SECRET` | Nao | Segredo para validar webhooks da Evolution API |

## Comandos Disponiveis

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de producao
npm start         # Inicia servidor de producao
npm run check     # Verifica tipos TypeScript
npm run test      # Alias para verificacao de tipos
npm run lint      # Lint (ESLint)
npm run lint:fix  # Lint + autofix (opcional)
npm run db:migrate   # Aplica migrations no banco
npm run db:push:dev  # Sincroniza schema direto (somente dev/local)
npm run db:generate  # Gera novas migrations a partir do schema
npm run db:migrate-ptbr # Ajustes pontuais (dados legados PT-BR)
```

## Health check

- `GET /api/health` retorna status do banco e integrações opcionais (Redis/Supabase/Evolution API) quando configuradas.

## Padrao de Resposta da API

- Endpoints JSON retornam `{ success, data }` (erros padronizados). Respostas `204` nao possuem corpo.

## Deploy em VPS (Ubuntu)

### Pre-requisitos
- Node.js 20+
- PostgreSQL (ou usar Supabase)
- Projeto Supabase com bucket "uploads"

### Passo a Passo

```bash
# 1. Clonar repositorio
git clone https://github.com/prospecttrafego/crm-alma-oficial.git
cd crm-alma-oficial

# 2. Instalar dependencias
npm install

# 3. Configurar ambiente
cp .env.example .env.production
nano .env.production  # Preencher credenciais

# 4. Aplicar migrations no banco
npm run db:migrate

# 5. Build de producao
npm run build

# 6. Aplicar migrations em producao
npm run db:migrate:prod

# 7. Instalar PM2 globalmente
npm install -g pm2

# 8. Iniciar aplicacao
pm2 start dist/index.cjs --name "crm-alma"

# 9. Configurar auto-start
pm2 save
pm2 startup
```

### Nginx (Proxy Reverso)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Configuracao do Supabase

1. Criar projeto em [supabase.com](https://supabase.com)
2. Criar bucket "uploads" em Storage
3. Configurar politica de acesso (RLS) se necessario
4. Copiar credenciais para `.env.staging` e/ou `.env.production`:
   - `SUPABASE_URL`: Settings > API > Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Settings > API > service_role key

## Licenca

MIT

## Contato

Desenvolvido para Alma Digital Agency
