# CLAUDE.md - Documentacao Tecnica Completa

Este documento contem todas as informacoes necessarias para entender, desenvolver e fazer deploy do Alma CRM.

---

## Visao Geral do Projeto

**Alma CRM** e uma aplicacao SaaS de gestao de relacionamento com clientes desenvolvida para a agencia digital Alma. O sistema combina duas funcionalidades principais:

1. **Pipeline de Vendas (Kanban)**: Gestao visual de oportunidades de negocio
2. **Inbox Unificado**: Central de comunicacoes multicanal

### Caracteristicas Tecnicas
- Monorepo: Frontend e Backend no mesmo repositorio
- Type-safe: TypeScript em toda a stack
- Real-time: WebSockets para atualizacoes ao vivo
- Multi-tenant: Suporte a multiplas organizacoes

---

## Arquitetura do Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Pages   │  │Components│  │  Hooks   │  │  TanStack Query  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  Wouter (Routing) │ shadcn/ui │ Tailwind CSS 4 │ Framer Motion  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/REST │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Routes  │  │   Auth   │  │ Storage  │  │    AI Scoring    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  Passport.js │ express-session │ Drizzle ORM │ WebSocket (ws)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICOS EXTERNOS                           │
├────────────────┬────────────────┬────────────────────────────────┤
│   PostgreSQL   │    Supabase    │           OpenAI               │
│   (Database)   │   (Storage)    │      (Lead Scoring)            │
└────────────────┴────────────────┴────────────────────────────────┘
```

### Fluxo de Dados

1. **Requisicao HTTP**: Cliente → Express → Drizzle → PostgreSQL
2. **Upload de Arquivo**: Cliente → Express → Supabase Storage
3. **Real-time**: Express → WebSocket → Todos os clientes conectados
4. **AI Scoring**: Express → OpenAI API → Calculo de score → Banco

---

## Versoes das Bibliotecas Principais

### Frontend

| Pacote | Versao | Funcao |
|--------|--------|--------|
| react | 19.2.0 | Framework UI |
| react-dom | 19.2.0 | Renderizacao DOM |
| vite | 7.3.0 | Build tool / Dev server |
| typescript | 5.9.3 | Tipagem estatica |
| tailwindcss | 4.4.16 | Estilizacao utility-first |
| @tanstack/react-query | 5.60.5 | Gerenciamento de estado servidor |
| wouter | 3.3.5 | Roteamento client-side |
| framer-motion | 12.23.26 | Animacoes |
| react-hook-form | 7.55.0 | Formularios |
| lucide-react | 0.453.0 | Icones |
| recharts | 2.15.2 | Graficos |
| date-fns | 3.6.0 | Manipulacao de datas |

### Backend

| Pacote | Versao | Funcao |
|--------|--------|--------|
| express | 4.21.2 | Framework HTTP |
| drizzle-orm | 0.39.3 | ORM type-safe |
| drizzle-zod | 0.8.1 | Integracao Drizzle + Zod |
| zod | 4.1.13 | Validacao de schemas |
| passport | 0.7.0 | Autenticacao |
| passport-local | 1.0.0 | Strategy email/senha |
| bcryptjs | 3.0.3 | Hash de senhas |
| express-session | 1.18.1 | Gestao de sessoes |
| connect-pg-simple | 10.0.0 | Sessoes no PostgreSQL |
| ws | 8.18.0 | WebSocket |
| pg | 8.16.3 | Driver PostgreSQL |
| @supabase/supabase-js | 2.87.3 | Cliente Supabase |
| openai | 6.10.0 | API OpenAI |

### UI Components (Radix UI)

Todos os componentes Radix UI estao na versao ~1.1.x a ~2.1.x:
- dialog, dropdown-menu, select, popover, tabs, toast
- accordion, checkbox, radio-group, switch, slider
- avatar, tooltip, hover-card, context-menu

---

## Estrutura de Pastas Detalhada

```
CRM_Oficial/
├── client/
│   └── src/
│       ├── components/
│       │   ├── ui/              # shadcn/ui (button, input, card, etc)
│       │   ├── layout/          # Header, Sidebar, Layout
│       │   ├── pipeline/        # Kanban, DealCard, StageColumn
│       │   ├── inbox/           # ConversationList, MessageThread
│       │   └── shared/          # Componentes genericos
│       ├── pages/
│       │   ├── dashboard.tsx    # Dashboard principal
│       │   ├── pipeline.tsx     # Pipeline Kanban
│       │   ├── inbox.tsx        # Inbox de conversas
│       │   ├── contacts.tsx     # Lista de contatos
│       │   ├── companies.tsx    # Lista de empresas
│       │   ├── calendar.tsx     # Calendario
│       │   ├── settings.tsx     # Configuracoes
│       │   ├── login.tsx        # Login/Registro
│       │   └── landing.tsx      # Landing page
│       ├── hooks/
│       │   ├── useAuth.ts       # Autenticacao
│       │   ├── useWebSocket.ts  # Conexao WebSocket
│       │   └── use-toast.ts     # Notificacoes toast
│       └── lib/
│           ├── queryClient.ts   # Configuracao TanStack Query
│           └── utils.ts         # Utilitarios (cn, formatters)
├── server/
│   ├── index.ts                 # Entry point, inicia servidor
│   ├── routes.ts                # Todos os endpoints da API
│   ├── storage.ts               # Camada de acesso ao banco (DAL)
│   ├── auth.ts                  # Passport.js + sessoes
│   ├── storage.supabase.ts      # Upload/download de arquivos
│   ├── aiScoring.ts             # Lead scoring com OpenAI
│   └── vite.ts                  # Integracao Vite em dev
├── shared/
│   └── schema.ts                # Schema Drizzle + tipos TypeScript
├── scripts/
│   └── migrate-users.ts         # Script de migracao de usuarios
├── script/
│   └── build.ts                 # Script de build customizado
├── migrations/                  # Migracoes Drizzle (se houver)
├── dist/                        # Build de producao (gerado)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── components.json              # Configuracao shadcn/ui
├── .env.example
├── README.md
└── CLAUDE.md                    # Este arquivo
```

---

## Schema do Banco de Dados

### Tabelas Principais

#### users
```typescript
{
  id: string (UUID, PK),
  email: string (unique),
  passwordHash: string,
  firstName: string,
  lastName: string,
  profileImageUrl: string,
  role: 'admin' | 'sales' | 'cs' | 'support',
  organizationId: number (FK),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### organizations
```typescript
{
  id: number (PK, auto),
  name: string,
  domain: string,
  logo: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### contacts
```typescript
{
  id: number (PK, auto),
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  jobTitle: string,
  companyId: number (FK),
  organizationId: number (FK),
  ownerId: string (FK users),
  tags: string[],
  source: string,
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### companies
```typescript
{
  id: number (PK, auto),
  name: string,
  domain: string,
  website: string,
  segment: string,
  size: string,
  industry: string,
  organizationId: number (FK),
  ownerId: string (FK users),
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### pipelines
```typescript
{
  id: number (PK, auto),
  name: string,
  organizationId: number (FK),
  isDefault: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### pipeline_stages
```typescript
{
  id: number (PK, auto),
  name: string,
  pipelineId: number (FK),
  order: number,
  color: string (#RRGGBB),
  isWon: boolean,
  isLost: boolean,
  createdAt: timestamp
}
```

#### deals
```typescript
{
  id: number (PK, auto),
  title: string,
  value: decimal(15,2),
  currency: string (default 'BRL'),
  pipelineId: number (FK),
  stageId: number (FK),
  contactId: number (FK),
  companyId: number (FK),
  organizationId: number (FK),
  ownerId: string (FK users),
  probability: number (0-100),
  expectedCloseDate: timestamp,
  status: 'open' | 'won' | 'lost',
  lostReason: string,
  source: string,
  notes: text,
  customFields: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### conversations
```typescript
{
  id: number (PK, auto),
  subject: string,
  channel: 'email' | 'whatsapp' | 'sms' | 'internal' | 'phone',
  status: 'open' | 'closed' | 'pending',
  contactId: number (FK),
  dealId: number (FK),
  organizationId: number (FK),
  assignedToId: string (FK users),
  lastMessageAt: timestamp,
  unreadCount: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### messages
```typescript
{
  id: number (PK, auto),
  conversationId: number (FK),
  senderId: string (FK users),
  senderType: 'user' | 'contact' | 'system',
  content: text,
  isInternal: boolean,
  attachments: jsonb[],
  mentions: string[],
  readBy: string[],
  createdAt: timestamp
}
```

#### activities
```typescript
{
  id: number (PK, auto),
  type: 'call' | 'email' | 'meeting' | 'note' | 'task',
  title: string,
  description: text,
  contactId: number (FK),
  dealId: number (FK),
  organizationId: number (FK),
  userId: string (FK users),
  dueDate: timestamp,
  completedAt: timestamp,
  status: 'pending' | 'completed' | 'cancelled',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Tabelas Auxiliares

- **sessions**: Armazenamento de sessoes (connect-pg-simple)
- **notifications**: Notificacoes do sistema
- **saved_views**: Views salvas pelos usuarios
- **email_templates**: Templates de email
- **audit_logs**: Logs de auditoria
- **files**: Metadados de arquivos
- **lead_scores**: Historico de scores de IA
- **calendar_events**: Eventos do calendario
- **channel_configs**: Configuracoes de canais (IMAP/SMTP, WhatsApp)

---

## API Endpoints

### Autenticacao

```
POST   /api/login          # Login com email/senha
POST   /api/logout         # Encerrar sessao
POST   /api/register       # Registro (se habilitado)
GET    /api/auth/me        # Usuario atual
```

### Contatos

```
GET    /api/contacts                    # Listar contatos
POST   /api/contacts                    # Criar contato
GET    /api/contacts/:id                # Detalhes do contato
PATCH  /api/contacts/:id                # Atualizar contato
DELETE /api/contacts/:id                # Excluir contato
GET    /api/contacts/:id/score          # Score do contato (AI)
```

### Empresas

```
GET    /api/companies                   # Listar empresas
POST   /api/companies                   # Criar empresa
GET    /api/companies/:id               # Detalhes da empresa
PATCH  /api/companies/:id               # Atualizar empresa
DELETE /api/companies/:id               # Excluir empresa
```

### Pipelines e Deals

```
GET    /api/pipelines                   # Listar pipelines
POST   /api/pipelines                   # Criar pipeline
PATCH  /api/pipelines/:id               # Atualizar pipeline
DELETE /api/pipelines/:id               # Excluir pipeline

GET    /api/deals                       # Listar deals
POST   /api/deals                       # Criar deal
GET    /api/deals/:id                   # Detalhes do deal
PATCH  /api/deals/:id                   # Atualizar deal
DELETE /api/deals/:id                   # Excluir deal
PUT    /api/deals/:id/move              # Mover deal de stage
GET    /api/deals/:id/score             # Score do deal (AI)
```

### Conversas e Mensagens

```
GET    /api/conversations               # Listar conversas
POST   /api/conversations               # Criar conversa
GET    /api/conversations/:id           # Detalhes da conversa
PATCH  /api/conversations/:id           # Atualizar conversa

GET    /api/conversations/:id/messages  # Listar mensagens
POST   /api/conversations/:id/messages  # Enviar mensagem
```

### Atividades

```
GET    /api/activities                  # Listar atividades
POST   /api/activities                  # Criar atividade
PATCH  /api/activities/:id              # Atualizar atividade
DELETE /api/activities/:id              # Excluir atividade
```

### Arquivos

```
POST   /api/uploads/presigned           # Gerar URL de upload
GET    /api/files/:path                 # Download de arquivo
```

### Outros

```
GET    /api/notifications               # Listar notificacoes
GET    /api/calendar-events             # Listar eventos
GET    /api/audit-logs                  # Logs de auditoria
GET    /api/users                       # Listar usuarios (admin)
```

---

## Comandos NPM

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento (frontend + backend)
npm run dev

# Verificar tipos TypeScript
npm run check
```

### Banco de Dados

```bash
# Aplicar schema no banco (criar/atualizar tabelas)
npm run db:push

# Gerar migracoes (se necessario)
npx drizzle-kit generate
```

### Producao

```bash
# Build de producao (frontend + backend)
npm run build

# Iniciar servidor de producao
npm start
# ou
NODE_ENV=production node dist/index.cjs
```

---

## Configuracao de Ambiente

### Arquivo .env

```bash
# ====== OBRIGATORIAS ======

# Conexao com PostgreSQL
DATABASE_URL=postgresql://usuario:senha@host:5432/database

# Chave para criptografia de sessoes (gerar com: openssl rand -base64 32)
SESSION_SECRET=chave-secreta-de-pelo-menos-32-caracteres

# Supabase Storage
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ====== OPCIONAIS ======

# Ambiente
NODE_ENV=production
PORT=3000

# OpenAI para lead scoring
OPENAI_API_KEY=sk-...

# URL publica da aplicacao
APP_URL=https://crm.seudominio.com

# Permitir registro de novos usuarios
ALLOW_REGISTRATION=false
VITE_ALLOW_REGISTRATION=false
```

### Gerando SESSION_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Deploy em Producao

### Pre-requisitos

- **Node.js**: 20.x ou superior
- **PostgreSQL**: 14.x ou superior (ou Supabase)
- **Supabase**: Projeto com bucket "uploads" criado
- **VPS**: Ubuntu 22.04 ou similar

### Passo a Passo Completo

#### 1. Preparar Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalacao
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 2. Clonar e Configurar

```bash
# Clonar repositorio
cd /var/www
git clone https://github.com/prospecttrafego/crm-alma-oficial.git
cd crm-alma-oficial

# Instalar dependencias
npm install

# Criar arquivo de ambiente
cp .env.example .env
nano .env  # Editar com credenciais reais
```

#### 3. Configurar Banco de Dados

```bash
# Aplicar schema
npm run db:push

# Verificar tabelas criadas
# (conectar no banco e listar tabelas)
```

#### 4. Build de Producao

```bash
npm run build
```

#### 5. Configurar PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicacao
pm2 start dist/index.cjs --name "crm-alma"

# Verificar status
pm2 status

# Ver logs
pm2 logs crm-alma

# Configurar auto-start no boot
pm2 save
pm2 startup
# (executar o comando que aparecer)
```

#### 6. Configurar Nginx

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuracao
sudo nano /etc/nginx/sites-available/crm-alma
```

Conteudo do arquivo:

```nginx
server {
    listen 80;
    server_name crm.seudominio.com;

    # Tamanho maximo de upload
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/crm-alma /etc/nginx/sites-enabled/

# Testar configuracao
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### 7. Configurar SSL (Certbot)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d crm.seudominio.com

# Auto-renovacao
sudo certbot renew --dry-run
```

#### 8. Criar Primeiro Usuario

Com `ALLOW_REGISTRATION=true`, acesse a aplicacao e crie uma conta. Depois, altere para `false` no .env e reinicie:

```bash
pm2 restart crm-alma
```

---

## Troubleshooting

### Erro: "Cannot find module"

```bash
rm -rf node_modules
npm install
```

### Erro: "ECONNREFUSED" no banco

Verificar se DATABASE_URL esta correta e se o banco aceita conexoes externas.

### WebSocket nao conecta

Verificar se Nginx esta configurado com os headers de upgrade.

### Upload nao funciona

1. Verificar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
2. Verificar se bucket "uploads" existe no Supabase
3. Verificar politicas de acesso do bucket

### Sessao expira rapido

Verificar se SESSION_SECRET esta configurado corretamente.

---

## Atualizacoes e Manutencao

### Atualizar Aplicacao

```bash
cd /var/www/crm-alma-oficial
git pull
npm install
npm run build
pm2 restart crm-alma
```

### Backup do Banco

```bash
pg_dump -U usuario -h host -d database > backup_$(date +%Y%m%d).sql
```

### Monitoramento

```bash
# Status PM2
pm2 status

# Monitoramento em tempo real
pm2 monit

# Logs
pm2 logs crm-alma --lines 100
```

---

## Consideracoes de Seguranca

1. **SESSION_SECRET**: Use uma chave forte de pelo menos 32 caracteres
2. **ALLOW_REGISTRATION**: Mantenha `false` em producao
3. **HTTPS**: Sempre use SSL em producao
4. **Firewall**: Libere apenas portas 80, 443 e SSH
5. **Senhas**: bcrypt com cost 12 (padrao)
6. **Sessoes**: Armazenadas no PostgreSQL, nao em memoria

---

## Contato e Suporte

- **Repositorio**: github.com/prospecttrafego/crm-alma-oficial
- **Desenvolvido para**: Alma Digital Agency
