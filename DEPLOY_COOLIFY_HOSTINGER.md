# Deploy (Coolify v4 na Hostinger VPS) — Alma CRM

Este guia explica, de forma bem simples, como fazer **deploy** e **redeploy** do Alma CRM usando **Coolify v4** rodando em uma **VPS da Hostinger**.

> Importante: este arquivo nao contem IPs, senhas ou tokens. Voce configura tudo no painel do Coolify (variaveis de ambiente/segredos).

## 1) Conceitos basicos (bem rapido)

- **Hostinger VPS**: e o “servidor” (uma maquina Linux na nuvem) onde o Coolify esta instalado.
- **Coolify**: e o painel que cria containers Docker, faz build do seu repo e publica em um dominio com HTTPS.
- **Application (Aplicacao)** no Coolify: e quando voce faz deploy de um repo (Git) usando build pack (ex.: **Dockerfile**).
- **Service (Servico)** no Coolify: normalmente e quando voce sobe algo via **Docker Compose** ou “one-click services”.

No nosso caso, o **Alma CRM** roda como **Application** com **Build Pack: Dockerfile**.

## 2) Onde rodar comandos (nao confunda)

Existem 3 “terminais” possiveis:

1. **Seu computador (terminal local)**: usado para desenvolvimento (ex.: `npm run dev`).
2. **Coolify → Terminal (web)**: terminal no navegador. Ele consegue abrir terminal **do servidor** e **dos containers** (docs: `https://coolify.io/docs/knowledge-base/internal/terminal`).
3. **Hostinger (SSH na VPS)**: terminal do servidor via SSH. Use so quando precisar mexer no servidor (avancado).

Quando este guia falar “**Terminal do container do app**”, significa:
- Abrir o projeto/app no Coolify e usar o **Terminal** apontando para o container do Alma CRM.

## 3) Checklist antes do primeiro deploy

- O repo esta no GitHub e voce sabe qual branch vai usar (ex.: `staging` ou `main`).
- Voce tem um banco Postgres (pode ser:
  - **um Postgres criado no Coolify**, ou
  - **um Postgres externo** como Supabase).
- No Supabase Storage existe um bucket chamado **`uploads`**.
- Voce tem (ou vai gerar) um `SESSION_SECRET` forte.
- Voce sabe o dominio (ex.: `crm.seudominio.com`) e ja apontou o DNS para a VPS (a configuracao exata depende do seu DNS).

## 4) Criar a aplicacao (primeira vez) no Coolify

Baseado na doc oficial do Coolify para Dockerfile: `https://coolify.io/docs/applications/build-packs/dockerfile`.

### 4.1 Criar o recurso

No Coolify:

1. Abra seu **Project**.
2. Clique em **Create New Resource**.
3. Escolha como conectar o repo:
   - **Public Repository** (se o repo for publico), ou
   - **Github App / Deploy Key** (se o repo for privado).
4. Selecione o repo e o branch (`staging` ou `main`).
5. Em **Build Pack**, selecione **Dockerfile**.
6. Em **Base Directory**, use `/` (porque este repo e um monorepo na raiz).
7. Clique em **Continue**.

### 4.2 Configurar Network / dominio / porta

1. Em Network, garanta que a porta exposta seja **`3000`** (o servidor do CRM sobe em `PORT=3000`).
2. Adicione o dominio (ex.: `crm.seudominio.com`) no app.
3. Salve.

### 4.3 Configurar Environment Variables (Runtime e Build)

No Coolify, va em **Environment Variables** (do app) e adicione:

**Runtime (rodam quando o container esta ligado):**
- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` (ex.: `https://crm.seudominio.com`)
- `DEFAULT_ORGANIZATION_ID` (ex.: `1`)
- Opcionais conforme seu uso: `OPENAI_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, etc.

**Build time (Vite / frontend):** marque a checkbox **Build Variable** para cada uma:
- `VITE_ALLOW_REGISTRATION`
- `VITE_FIREBASE_*` (se estiver usando push)

Por que isso importa?
- Variaveis `VITE_*` sao “coladas” no frontend durante o **build**. Se voce mudar `VITE_*`, precisa fazer **Deploy** (rebuild), nao so “Restart”.
- As variaveis do backend (runtime) normalmente so precisam de **Restart** (mas “Deploy” tambem funciona).

## 5) Fazer o deploy

No app do Coolify:

1. Clique em **Deploy**.
2. Acompanhe os logs ate o container ficar “healthy”.
3. Teste:
   - `https://SEU_DOMINIO/api/healthz` (healthcheck simples)
   - `https://SEU_DOMINIO/api/health` (health detalhado)

## 6) Rodar migrations (muito importante)

Quando rodar:
- **Sempre no primeiro deploy**.
- Em todo deploy que tiver mudanca de schema (novas migrations em `migrations/`).

Onde rodar:
- No **Terminal do container do app** (Coolify → Terminal → container do Alma CRM).

Comando:
- `npm run db:migrate`

### 6.1 O que e “baseline”?

**Baseline** e um modo especial para quando:
- seu banco **ja existia** (tabelas criadas “na mao” ou via `db:push`),
- e agora voce quer comecar a usar `migrations/` sem o Drizzle tentar recriar tudo.

Ele **nao executa** SQL das migrations: ele so “marca” como aplicadas.

Rodar (apenas 1 vez, se fizer sentido):
- `npm run db:migrate -- --baseline`

## 7) Redeploy (atualizar o app)

Existem 2 cenarios comuns:

### 7.1 Atualizei o codigo (push no GitHub)

- Se voce habilitou auto-deploy: o Coolify pode deployar sozinho ao receber o webhook.
- Se nao: entre no app e clique em **Deploy**.

Se tiver migrations novas:
- Depois do deploy: abra o **Terminal do container do app** e rode `npm run db:migrate`.

### 7.2 Atualizei variaveis no Coolify

- Se mudou **runtime vars** (ex.: `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`): normalmente basta **Restart**.
- Se mudou **Build Variable** (ex.: `VITE_*`): faca **Deploy** (rebuild), senao o frontend nao muda.

## 8) (Opcional) Criar um Postgres dentro do Coolify

Se voce quer um Postgres gerenciado pelo proprio Coolify (em vez de externo):

1. No mesmo Project, clique em **Create New Resource**.
2. Crie um **Database → PostgreSQL**.
3. Depois de criado, copie a URL de conexao e use como `DATABASE_URL` no app do CRM.

Depois:
- Faca **Deploy/Restart** do app e rode `npm run db:migrate` no **Terminal do container do app**.

## 9) Sobre `MEDIA_DOWNLOAD_ALLOWED_HOSTS` (SSRF hardening)

Esse campo **nao** e uma URL completa. Ele e uma lista (CSV) de **hostnames** permitidos para baixar midia.

- Por padrao, o CRM ja permite baixar midia do **mesmo host** de `EVOLUTION_API_URL`.
- So preencha `MEDIA_DOWNLOAD_ALLOWED_HOSTS` se a midia vier de outros hosts (ex.: um CDN).

Exemplo:
- `EVOLUTION_API_URL=https://evolution.seudominio.com`
- Se a Evolution devolver arquivos em `https://cdn.seudominio.com/...`, entao use:
  - `MEDIA_DOWNLOAD_ALLOWED_HOSTS=cdn.seudominio.com`

Se voce nao usa WhatsApp/Evolution, pode deixar vazio.

## 10) Troubleshooting rapido (quando da ruim)

### Paginas ficam em branco / nao carregam (Inbox, Pipeline, etc.)

Quase sempre e 1 destes:
- Banco sem migrations aplicadas → rode `npm run db:migrate` no **Terminal do container do app**
- `APP_URL` errado (cookies/sessoes) → confira `APP_URL` no Coolify
- Porta errada no Coolify → confirme **3000** em Network

### Bad Gateway (502) / No Available Server

- Confira se o app esta ouvindo em `0.0.0.0` (o projeto usa `PORT` e sobe com Express).
- Confira Network/Port Exposes no Coolify (deve bater com a porta real do app).
- Veja logs no Coolify.

### Terminal nao abre no Coolify

No Coolify v4 existe “Terminal Access” no servidor (docs: `https://coolify.io/docs/knowledge-base/server/terminal-access`).
Se estiver desabilitado, nenhum terminal funciona ate reabilitar.
