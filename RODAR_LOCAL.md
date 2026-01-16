# Rodar o Alma CRM localmente (dev) — guia rapido e confiavel

Este guia existe para qualquer pessoa (ou outra IA) conseguir **rodar o CRM localmente** e **ver a aplicacao funcionando no navegador**.

> TL;DR: voce vai subir um Postgres via Docker, criar um `.env.local`, rodar migrations + seed e iniciar `npm run dev`.

---

## 0) Pre-requisitos (no seu computador)

- Node.js + npm (recomendado: Node 20+)
- Docker Desktop (ou Docker Engine) rodando

---

## 1) Instalar dependencias

No **terminal do seu computador**, na raiz do repo:

```bash
npm install
```

---

## 2) Subir Postgres (via Docker)

### 2.1 Criar volume (uma vez)

```bash
docker volume create crm-alma-pgdata
```

### 2.2 Subir container (padrao: porta 5432)

```bash
docker run --name crm-alma-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crm_alma \
  -p 5432:5432 \
  -v crm-alma-pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

Se a porta `5432` ja estiver ocupada, use `5433:5432` (e ajuste o `DATABASE_URL` no `.env.local`):

```bash
docker run --name crm-alma-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crm_alma \
  -p 5433:5432 \
  -v crm-alma-pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

### 2.3 Comandos uteis

```bash
docker ps                     # ver se o container esta rodando
docker logs -f crm-alma-postgres
docker stop crm-alma-postgres # parar
docker start crm-alma-postgres # iniciar novamente
```

---

## 3) Criar `.env.local` (recomendado)

Crie um arquivo `.env.local` na raiz do repo (ele ja esta no `.gitignore`).

Exemplo minimo (ajuste a porta para `5432` ou `5433` conforme seu Docker):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_alma
SESSION_SECRET=COLE_UM_SECRET_AQUI
DEFAULT_ORGANIZATION_ID=1
APP_URL=http://localhost:3000
ALLOW_REGISTRATION=true
VITE_ALLOW_REGISTRATION=true
```

Para gerar um `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

> Dica: voce pode copiar o `.env.example` e ir removendo/ajustando o que nao vai usar localmente.

---

## 4) Aplicar migrations e criar dados iniciais (seed)

O projeto suporta escolher um arquivo `.env` explicitamente via `ENV_FILE`.
Isso evita confusao com `.env.production`/`.env.staging`.

```bash
ENV_FILE=.env.local npm run db:migrate
ENV_FILE=.env.local npm run db:seed
```

O seed cria uma organizacao (ID `1`) e um usuario admin.

Credenciais padrao:
- Email: `admin@example.com`
- Senha: `Admin123!`

---

## 5) Rodar o app (backend + frontend)

```bash
ENV_FILE=.env.local npm run dev
```

Abra no navegador:
- `http://localhost:3000`

---

## 6) O que e opcional (nao precisa para rodar o CRM)

### Storybook (UI docs)

O Storybook serve para documentar componentes e testar UI isoladamente. Ele **nao e necessario** para rodar o CRM.

```bash
npm run storybook
```

---

## 7) Troubleshooting rapido

- Paginas nao carregam / erro 500: confirme que voce rodou `db:migrate` e `db:seed` com `ENV_FILE=.env.local`.
- Erro de conexao no banco: confirme `DATABASE_URL` (porta, usuario/senha e nome do DB).
- Uploads/anexos nao funcionam em local: configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (caso queira testar uploads).

