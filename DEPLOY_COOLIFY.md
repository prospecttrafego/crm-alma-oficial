# Deploy no Coolify (Dockerfile) — Alma CRM

Este guia é para **subir o CRM em produção no Coolify** usando Dockerfile e, depois, conseguir **atualizar** e (se precisar) **limpar dados** com segurança.

> Importante: o CRM usa **2 coisas diferentes no Supabase**:
> - **Banco de dados (Postgres)**: vem do `DATABASE_URL` (onde ficam usuários, contatos, deals, conversas, etc.)
> - **Storage (arquivos)**: vem de `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (onde ficam anexos, áudios, imagens, etc.)
>
> Limpar o banco **não apaga arquivos** do Storage.

---

## 0) Estratégia recomendada (produção com segurança)

Se a ideia é **produção e escala**, o ideal é separar em 2 ambientes:

- **Staging (homologação)**: para testar fluxos e integrações sem medo de “sujar” dados.
- **Production (go-live)**: para dados reais.

O caminho mais simples e confiável é ter **2 projetos Supabase** (cada um com seu `DATABASE_URL`, `SUPABASE_URL`, bucket `uploads`, etc.) e **2 apps no Coolify** (ou 2 configurações de env no mesmo app), um apontando para o staging e outro para production.

> Obs.: o Supabase *já é* um Postgres por baixo dos panos. O `DATABASE_URL` é exatamente a string de conexão do Postgres do seu projeto Supabase. Você tem acesso ao banco via **SQL Editor** e **Table Editor** no painel.

## 1) O que já está pronto no projeto

- Existe um `Dockerfile` na raiz que:
  - instala dependências
  - roda `npm run build` (gera `dist/`)
  - inicia o servidor com `node dist/index.cjs`
- O servidor expõe a porta `3000` e usa `PORT` se você configurar no ambiente.

---

## 2) Checklist rápido (antes do primeiro deploy)

### 2.1 Supabase (obrigatório)

No Supabase, verifique:
- Existe o bucket **`uploads`** no Storage
- As variáveis no Coolify estão preenchidas:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`

### 2.2 Variáveis de ambiente (obrigatórias)

No Coolify, configure pelo menos:
- `DATABASE_URL`
- `SESSION_SECRET`
- `DEFAULT_ORGANIZATION_ID` (normalmente `1`)
- `APP_URL` (ex.: `https://crm.seudominio.com`)

Recomendado:
- `NODE_ENV=production` (o Dockerfile já define isso)

### 2.3 Atenção: variáveis `VITE_*` (frontend)

As variáveis que começam com `VITE_` são usadas pelo **frontend** e ficam “gravadas” no build (Vite).

⚠️ Tudo que começa com `VITE_` vai para o navegador do usuário (não é segredo).  
Não coloque chaves privadas ali.

Isso significa:
- se elas estiverem vazias durante o build, o site pode subir sem essas configs
- mudar `VITE_*` depois (só em runtime) **não** atualiza o frontend; precisa de novo deploy/build

No Coolify, coloque as `VITE_*` em um lugar que seja aplicado **no build** também (geralmente “Build Args” ou “Build-time Environment”).

Variáveis `VITE_*` usadas neste projeto:
- `VITE_ALLOW_REGISTRATION`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

### 2.4 Integrações (se você for usar)

WhatsApp (Evolution API):
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_WEBHOOK_SECRET` (**obrigatório em produção**)
- `EVOLUTION_INSTANCE_PREFIX` (recomendado se você tem mais de um CRM usando a mesma Evolution API)

Email:
- depende do `channel_configs.emailConfig` (configurado dentro do CRM)

Google Calendar:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (tem que bater com o domínio do `APP_URL`)
- `GOOGLE_TOKEN_ENCRYPTION_KEY` (**obrigatório em produção**)

Push (Firebase):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
e variáveis `VITE_FIREBASE_*` para o frontend

Redis (Upstash) (opcional, mas recomendado para rate-limit, jobs e cache):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## 3) Primeiro deploy no Coolify (passo a passo)

### 3.1 Criar o app no Coolify

1. No Coolify, crie uma **New Application**
2. Escolha o seu repositório (Git) e a branch (ex.: `main`)
3. Selecione build por **Dockerfile** (Coolify detecta automaticamente se existir `Dockerfile`)
4. Configure a porta do container como `3000` (ou a mesma do `PORT`, se você definir)
5. Cole todas as variáveis do seu `.env` na área de **Environment Variables** do Coolify
6. Clique em **Deploy**

### 3.2 Preparar o banco (uma vez)

Depois do container estar rodando, você precisa **garantir o schema do banco** e **criar o admin inicial**.

No Coolify, abra o terminal do container (geralmente “Terminal” / “Execute Command”) e rode:

#### Cenário A (recomendado): banco novo/limpo
Use este caminho se você **ainda não criou as tabelas** (banco vazio) ou se você resetou o banco para começar “do zero”.

1) Aplicar migrations (cria/atualiza schema):
```bash
npm run db:migrate:prod
```

2) Criar organização + usuário admin + pipeline padrão:
```bash
SEED_ADMIN_EMAIL="seu-email@dominio.com" \
SEED_ADMIN_PASSWORD="SuaSenhaForteAqui" \
SEED_ORG_NAME="Sua Empresa" \
npm run db:seed:prod
```

3) Garanta que `DEFAULT_ORGANIZATION_ID` no Coolify está correto.
- Se o banco estava vazio, normalmente fica `1`.

#### Cenário B: seu banco já tem tabelas (você já rodou `db:push` antes)
Se você já criou as tabelas via `npm run db:push` (ou o banco já existe com schema pronto), o **primeiro migration** (`0000_...`) vai tentar criar tabelas e pode falhar com `"relation already exists"`.

Para adotar migrations sem quebrar nada, faça **uma única vez** o “baseline”:

```bash
node dist/migrate.cjs --baseline
```

Isso **não executa SQL de migrations** — apenas marca as migrations atuais como “já aplicadas” no controle do Drizzle.  
Depois disso, nos próximos deploys você usa normalmente:

```bash
npm run db:migrate:prod
```

### 3.3 Verificar se está tudo ok

Abra no navegador:
- `https://SEU_DOMINIO/api/healthz` (liveness: servidor no ar)
- `https://SEU_DOMINIO/api/health` (readiness: status do DB e integrações)
- Faça login com o admin criado

---

## 4) Como fazer deploy depois de novas alterações (rotina do dia a dia)

Quando você mudar qualquer coisa no código (corrigir erro, ajustar telas, etc.), o fluxo normal é:

1) Faça as alterações no seu computador
2) Rode (recomendado):
```bash
npm run check
npm run lint
npm run build
```
3) Faça `git commit` e `git push`
4) No Coolify:
   - se estiver com auto-deploy, ele deploya sozinho
   - se não, clique em **Deploy** novamente

### 4.1 Como atualizar o banco com segurança (migrations)

O fluxo ideal (produção / larga escala) é:

1) Você altera o schema em `shared/schema.ts`
2) Você gera uma migration **localmente** e commita no Git:
```bash
npm run db:generate
```
3) Você faz deploy no Coolify (rebuild da imagem)
4) No container novo (ou via post-deploy command), você aplica as migrations:
```bash
npm run db:migrate:prod
```

> Em produção, evite `db:push` como rotina. Ele é ótimo para dev/prototipagem, mas migrations são a forma segura de evoluir o banco com previsibilidade.

Regra simples (para leigos): **se você mudou o banco, gere migration e rode `db:migrate:prod` no deploy**.

---

## 5) “Testei em produção e agora quero deixar tudo limpo”

Aqui é onde a maioria das pessoas se confunde, porque existem “dados” em lugares diferentes.

### 5.1 Limpar dados do CRM no banco (Postgres / Supabase)

Isso apaga **tudo** do CRM (usuários, contatos, deals, conversas, mensagens, sessões, tokens, etc.).

No Supabase Dashboard:
1. Vá em **SQL Editor**
2. Cole e rode este SQL:

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
  END LOOP;
END $$;
```

Depois de limpar, volte no terminal do container (Coolify) e rode novamente:
```bash
npm run db:seed:prod
```

> Dica: se você quiser garantir que o schema está 100% atualizado (ou se você acabou de fazer um deploy que inclui migrations):
> rode `npm run db:migrate:prod` antes do seed (é seguro/idempotente).

### 5.2 Limpar arquivos (Supabase Storage)

Se você testou uploads, WhatsApp mídia, avatar, etc., podem existir arquivos no bucket `uploads`.

No Supabase Dashboard:
1. Vá em **Storage**
2. Abra o bucket `uploads`
3. Apague pastas/arquivos criados nos seus testes

> Observação: se você limpou o banco (5.1), os arquivos podem virar “órfãos”.
> Se você quer go-live realmente limpo, apague os arquivos de teste também (para não pagar storage à toa).

### 5.3 Limpar coisas fora do Supabase (Evolution API, Email, etc.)

Se você conectou WhatsApp:
- A Evolution API pode ter criado uma instância e configurado webhook.
- Para “zerar”, você pode apagar a instância no painel da Evolution API (ou usar a API dela).

Se você enviou email real durante testes:
- isso foi enviado de verdade (não tem “limpeza” automática).

---

## 6) Comandos úteis (para troubleshooting)

No Coolify, dentro do container:

- Ver logs (depende do Coolify; normalmente fica em “Logs”)
- Conferir se o backend está vivo:
```bash
node -e "fetch('http://localhost:3000/api/healthz').then(r => r.text()).then(console.log).catch(err => { console.error(err); process.exit(1); })"
```
Ou teste via navegador com `https://SEU_DOMINIO/api/healthz`.
