Alma CRM
Sistema de gerenciamento de relacionamento com clientes (CRM) desenvolvido para agências digitais. Oferece uma caixa de entrada unificada para comunicações multicanal e um pipeline de vendas estilo Kanban para gestão de leads.

Arquitetura do Sistema
Stack Tecnológico
Frontend:

React 18 com TypeScript
Vite como bundler e servidor de desenvolvimento
Wouter para roteamento client-side
TanStack Query para gerenciamento de estado do servidor
shadcn/ui + Radix UI para componentes de interface
Tailwind CSS para estilização
Framer Motion para animações
Backend:

Node.js com Express
TypeScript
WebSocket (ws) para atualizações em tempo real
Passport.js com Replit Auth (OpenID Connect)
Banco de Dados:

PostgreSQL
Drizzle ORM para queries tipadas
Drizzle-Zod para validação de schemas
Integrações:

OpenAI API para pontuação inteligente de leads (AI Lead Scoring)
Replit Object Storage para upload de arquivos
Estrutura de Diretórios
├── client/                     # Aplicação React (Frontend)
│   └── src/
│       ├── components/         # Componentes reutilizáveis
│       │   └── ui/             # Componentes shadcn/ui
│       ├── pages/              # Páginas da aplicação
│       │   ├── dashboard.tsx   # Dashboard com métricas e relatórios
│       │   ├── pipeline.tsx    # Kanban de vendas
│       │   ├── inbox.tsx       # Caixa de entrada unificada
│       │   ├── contacts.tsx    # Gestão de contatos
│       │   ├── calendar.tsx    # Calendário de eventos
│       │   ├── audit-log.tsx   # Log de auditoria
│       │   └── settings.tsx    # Configurações do sistema
│       ├── hooks/              # Custom hooks
│       └── lib/                # Utilitários e configurações
│
├── server/                     # Servidor Express (Backend)
│   ├── routes.ts               # Definição de todas as rotas API
│   ├── storage.ts              # Camada de acesso ao banco de dados
│   ├── aiScoring.ts            # Lógica de pontuação com IA
│   ├── replitAuth.ts           # Configuração de autenticação
│   └── vite.ts                 # Integração Vite/Express
│
├── shared/                     # Código compartilhado
│   └── schema.ts               # Schemas do banco de dados (Drizzle)
│
└── migrations/                 # Migrações do banco de dados

Funcionalidades Principais
1. Pipeline de Vendas (Kanban)
Múltiplos pipelines por organização
Drag-and-drop para mover negócios entre estágios
Customização de estágios e cores
Probabilidade de fechamento por estágio
2. Caixa de Entrada Unificada
Consolidação de mensagens de múltiplos canais
Atribuição de conversas a membros da equipe
Status de conversas (aberta, pendente, resolvida)
Templates de resposta rápida
3. Gestão de Contatos
Perfil completo com informações de contato
Associação com empresas e negócios
Tags para segmentação
Histórico de atividades
4. AI Lead Scoring
Pontuação automática de leads (0-100)
Fatores analisados: engajamento, valor de negócios, atividade, recência, completude
Recomendações personalizadas geradas por IA
Próximas melhores ações sugeridas
5. Sistema de Notificações
Notificações em tempo real via WebSocket
Tipos: nova mensagem, negócio movido, tarefa pendente, menções
Marcar como lida individualmente ou em lote
6. Calendário
Visualizações: mês, semana, dia
Eventos vinculados a contatos e negócios
Agendamento de reuniões
Sincronização com atividades
7. Relatórios e Dashboard
Métricas de performance (negócios, conversões, valores)
Seletor de período personalizado
Gráficos interativos (Recharts)
Exportação para CSV e PDF
8. Templates de Email
Biblioteca de templates reutilizáveis
Variáveis dinâmicas (nome, empresa, valor)
Categorização por tipo
9. Log de Auditoria
Rastreamento de todas as alterações
Filtros por usuário, entidade e ação
Histórico de modificações por registro
10. Configuração de Canais
Integração IMAP/SMTP para email
Suporte a WhatsApp Business API
Gerenciamento seguro de credenciais
Modelo de Dados
Entidades Principais
users               # Usuários do sistema
├── contacts        # Contatos/Leads
├── companies       # Empresas
├── pipelines       # Pipelines de vendas
│   └── stages      # Estágios do pipeline
├── deals           # Negócios/Oportunidades
├── conversations   # Conversas
│   └── messages    # Mensagens
├── activities      # Atividades/Tarefas
├── notifications   # Notificações
├── email_templates # Templates de email
├── saved_views     # Visualizações salvas
├── audit_logs      # Log de auditoria
├── calendar_events # Eventos do calendário
├── lead_scores     # Histórico de pontuação
├── channel_configs # Configurações de canais
└── files           # Arquivos anexados

API REST
Todas as rotas estão sob o prefixo /api:

Recurso	Métodos	Descrição
/api/pipelines	GET, POST	Listar/Criar pipelines
/api/pipelines/:id	GET, PATCH, DELETE	CRUD de pipeline
/api/deals	GET, POST	Listar/Criar negócios
/api/deals/:id	GET, PATCH, DELETE	CRUD de negócio
/api/contacts	GET, POST	Listar/Criar contatos
/api/contacts/:id	GET, PATCH, DELETE	CRUD de contato
/api/conversations	GET, POST	Listar/Criar conversas
/api/messages	POST	Enviar mensagem
/api/activities	GET, POST	Listar/Criar atividades
/api/notifications	GET	Listar notificações
/api/calendar-events	GET, POST	Listar/Criar eventos
/api/email-templates	GET, POST	Listar/Criar templates
/api/lead-score/:type/:id	GET	Calcular pontuação IA
/api/audit-logs	GET	Consultar logs
/api/reports/*	GET	Gerar relatórios
WebSocket
Conexão em /ws para atualizações em tempo real:

Eventos emitidos:

pipeline:created, pipeline:updated, pipeline:deleted
deal:created, deal:updated, deal:moved, deal:deleted
message:created
notification:new
calendar:event:created, calendar:event:updated
typing (indicador de digitação)
Autenticação
O sistema utiliza Replit Auth com OpenID Connect:

Login via conta Replit
Sessões persistidas no PostgreSQL
Proteção de rotas via middleware isAuthenticated
Variáveis de Ambiente
Variável	Descrição
DATABASE_URL	URL de conexão PostgreSQL
SESSION_SECRET	Chave para sessões
OPENAI_API_KEY	Chave da API OpenAI (opcional)
REPLIT_DOMAINS	Domínios permitidos
Executando o Projeto
# Instalar dependências
npm install
# Sincronizar banco de dados
npm run db:push
# Iniciar em desenvolvimento
npm run dev

O servidor inicia na porta 5000 servindo tanto a API quanto o frontend.

Segurança
Senhas e tokens de API nunca são expostos nas respostas
Credenciais de canais são redactadas antes de enviar ao cliente
Validação de entrada com Zod em todas as rotas
Sessões seguras com cookies HTTP-only
CORS configurado para domínios permitidos