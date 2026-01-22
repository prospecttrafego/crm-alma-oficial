# Bugs e Erros - Alma CRM

Esta pasta contém documentação de bugs, erros e problemas identificados no sistema.

---

## INSTRUÇÕES PARA IA

Ao receber uma tarefa de correção de bugs:

1. **Leia este README primeiro** para entender a estrutura
2. **Verifique a pasta `active/`** para ver todos os bugs pendentes
3. **Cada bug tem sua própria pasta** com:
   - `descricao.md` - Detalhes do problema
   - Screenshots/prints do erro
   - Logs relevantes (console, network, servidor)
4. **Após corrigir**, mova a pasta do bug para `resolved/`
5. **Adicione notas** no `descricao.md` explicando a correção

---

## Estrutura de Pastas

```
.bugs/
├── README.md              ← Você está aqui
├── active/                ← Bugs pendentes (NÃO RESOLVIDOS)
│   └── NNN-nome-do-bug/
│       ├── descricao.md   ← Descrição completa
│       ├── *.png/jpg      ← Screenshots
│       ├── *.mp4/gif      ← Vídeos (se necessário)
│       └── *.txt/log      ← Logs de console/rede
├── resolved/              ← Bugs já corrigidos (histórico)
│   └── NNN-nome-do-bug/
└── templates/             ← Templates para novos bugs
    └── descricao-template.md
```

---

## Como Adicionar um Novo Bug

### 1. Criar pasta com número sequencial

```bash
mkdir -p .bugs/active/NNN-nome-descritivo
```

Exemplo: `001-inbox-nao-atualiza`, `002-deal-duplicado`

### 2. Copiar e preencher o template

```bash
cp .bugs/templates/descricao-template.md .bugs/active/NNN-nome/descricao.md
```

### 3. Adicionar evidências

- Screenshots do problema
- Logs do console do navegador
- Logs do servidor (se disponível)
- Vídeo/GIF demonstrando o problema (opcional)

### 4. Atualizar a tabela acima

---

## Severidade

| Nível | Descrição | Exemplos |
|-------|-----------|----------|
| **CRÍTICO** | Sistema inutilizável, perda de dados | Login quebrado, dados não salvam |
| **ALTO** | Funcionalidade principal quebrada | Inbox não atualiza, deals não movem |
| **MÉDIO** | Funcionalidade secundária com problema | Filtros não funcionam, ordenação errada |
| **BAIXO** | Inconveniência, problemas visuais | Layout quebrado, texto cortado |

---

## Áreas do Sistema

Para facilitar a categorização:

| Área | Descrição | Arquivos Principais |
|------|-----------|---------------------|
| `auth` | Login, sessão, permissões | `server/auth.ts` |
| `contacts` | CRUD de contatos | `server/api/contacts.ts`, `client/src/pages/contacts/` |
| `deals` | Pipeline, deals | `server/api/deals.ts`, `client/src/pages/pipeline/` |
| `inbox` | Conversas, mensagens | `server/api/conversations.ts`, `client/src/pages/inbox/` |
| `whatsapp` | Integração Evolution API | `server/integrations/evolution/` |
| `files` | Upload, download | `server/api/files.ts` |
| `websocket` | Real-time, broadcasts | `server/ws/index.ts` |
| `calendar` | Eventos, Google Calendar | `server/api/calendar.ts` |
| `reports` | Dashboard, relatórios | `server/api/reports.ts`, `client/src/pages/reports/` |
| `settings` | Configurações | `client/src/pages/settings/` |
| `ui` | Interface, componentes | `client/src/components/` |

---

## Checklist de Informações Úteis

Ao documentar um bug, tente incluir:

- [ ] **O que deveria acontecer** (comportamento esperado)
- [ ] **O que acontece** (comportamento atual)
- [ ] **Passos para reproduzir** (1, 2, 3...)
- [ ] **Frequência** (sempre, às vezes, raro)
- [ ] **Navegador/dispositivo** (se relevante)
- [ ] **Screenshots/vídeos** (evidências visuais)
- [ ] **Logs de console** (erros JavaScript)
- [ ] **Logs de rede** (requests falhando)
- [ ] **Dados de exemplo** (IDs, valores que causam o problema)

---

## Fluxo de Resolução

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   active/   │ ──► │  Correção   │ ──► │  resolved/  │
│  (pendente) │     │   (dev)     │     │ (histórico) │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. Bug é documentado em `active/`
2. Desenvolvedor/IA corrige o problema
3. Pasta é movida para `resolved/`
4. Notas de correção são adicionadas ao `descricao.md`

---

## Contato

- **Repositório:** github.com/prospecttrafego/crm-alma-oficial
- **Desenvolvedor:** Mateus Olinto
