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

### Gestao de Contatos e Empresas
- Cadastro completo de contatos
- Vinculacao com empresas
- Campos customizados (JSON)
- Tags e segmentacao
- Historico de atividades

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

## Inicio Rapido

```bash
# Instalar dependencias
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Aplicar schema no banco
npm run db:push

# Desenvolvimento
npm run dev

# Producao
npm run build
npm start
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
│   ├── logger.ts            # Logs estruturados (requestId + integrações)
│   ├── health.ts            # Health check (DB + integrações opcionais)
│   ├── routes.ts            # Agregador (auth + rate limit + API + WebSocket)
│   ├── api/                 # Rotas HTTP por domínio (módulos)
│   └── ws/                  # WebSocket (/ws) + broadcast
│   ├── storage.ts           # Camada de acesso ao banco
│   ├── auth.ts              # Autenticacao Passport.js
│   ├── db.ts                # Drizzle + conexao Postgres
│   ├── tenant.ts            # Single-tenant (organizacao)
│   ├── storage.supabase.ts  # Upload de arquivos
│   ├── aiScoring.ts         # Lead scoring com IA
│   ├── whisper.ts           # Transcricao de audio (Whisper/OpenAI)
│   ├── evolution-api.ts     # Evolution API (WhatsApp)
│   ├── evolution-message-handler.ts # Webhook handler (WhatsApp)
│   ├── google-calendar.ts   # Google Calendar (OAuth + sync)
│   ├── notifications.ts     # Push notifications (Firebase Admin)
│   ├── redis.ts             # Redis (Upstash)
│   ├── static.ts            # Servir frontend em producao
│   └── vite.ts              # Vite middleware (dev)
├── shared/                  # Codigo compartilhado
│   └── schema.ts            # Schema Drizzle + tipos
├── scripts/                 # Scripts utilitarios
│   └── migrate-users.ts     # Migracao de usuarios
└── script/
    └── build.ts             # Script de build
```

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
npm run db:push   # Aplica schema no banco
npm run db:migrate-ptbr # Ajustes pontuais (dados legados PT-BR)
```

## Health check

- `GET /api/health` retorna status do banco e integrações opcionais (Redis/Supabase/Evolution API) quando configuradas.

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
cp .env.example .env
nano .env  # Preencher credenciais

# 4. Aplicar schema no banco
npm run db:push

# 5. Build de producao
npm run build

# 6. Instalar PM2 globalmente
npm install -g pm2

# 7. Iniciar aplicacao
pm2 start dist/index.cjs --name "crm-alma"

# 8. Configurar auto-start
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
4. Copiar credenciais para `.env`:
   - `SUPABASE_URL`: Settings > API > Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Settings > API > service_role key

## Licenca

MIT

## Contato

Desenvolvido para Alma Digital Agency
