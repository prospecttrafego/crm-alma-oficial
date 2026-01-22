# Bug: Integração do Whatsapp à EvolutionAPI via painel de configuração do CRM.

## Informações Básicas

| Campo | Valor |
|-------|-------|
| **ID** |001 |
| **Severidade** | CRÍTICO |
| **Área** | inbox / whatsapp / websocket / settings |
| **Data Identificado** | 20-01-2026 |
| **Reportado por** | Mateus|
| **Status** | Pendente |

---

## Descrição do Problema

### INFORMACOES GERAIS 

Integração da Evolution API e whatsapp/inbox

Anteriormente, um AI Agent investigou a configuração da Evolution API, que vem dando erro desde o inicio do projeto. Nunca foi possível conectar automaticamente. Esse AI Agent trouxe a seguinte constatacao sobre realizar a configuracao de forma automatica, direto pelo painel de configuracoes do CRM.

```
"... Dá pra configurar automaticamente via API no momento em que o CRM cria a instância na Evolution (o mesmo fluxo que hoje gera o QR Code).

O que a documentação mostra (Evolution API 2.x / docs oficial)

- No POST /instance/create existe um objeto webhook que aceita headers, incluindo authorization.
- Isso significa que a própria Evolution pode enviar Authorization: ... em todas as chamadas de webhook, desde que o header seja definido na criação da instância (feito pelo
CRM, não pelo usuário).

Melhor abordagem (para seu cenário)

- Usar EVOLUTION_WEBHOOK_SECRET como Bearer token no header:
    - Evolution → CRM: Authorization: Bearer <EVOLUTION_WEBHOOK_SECRET>
    - CRM valida isso no endpoint POST /api/webhooks/evolution
- Vantagem: não expõe segredo na URL (querystring) e não depende de acesso humano à Evolution.

O que já ficou pronto no repo

- server/services/whatsapp-config.ts agora cria a instância com webhook.headers.authorization = Bearer <EVOLUTION_WEBHOOK_SECRET>.
- server/integrations/evolution/api.ts suporta enviar webhook.headers no payload do createInstance.
- server/api/evolution.ts valida Authorization (e mantém compat com x-evolution-webhook-secret, mas a Evolution não precisa disso).
- Rodei npm run check e passou.

Atenção importante

- Pela própria doc/openapi, o POST /webhook/set/{instance} não expõe headers. Então, se existir instância antiga criada sem headers, a forma “clean” de aplicar isso é recriar
a instância (desconectar/force clean e parear de novo via QR).

Se você quiser, eu também posso ajustar o fluxo para detectar instância “legada” e orientar/automatizar a recriação no momento do “Conectar WhatsApp”."

 **(obs: eu autorizei ele a fazer isso, todas essas mudanças.. inclusive para ajustar o fluxo para detectar instancia "legada").**
````


### CONTEXTUALIZANDO:

So pra voce entender. Esse CRM, o foco principal é ser um Painel de Atendimento. Ou seja, eu vou conectar meu whatsapp via Evolution API. E qualquer mensagem que chegar nesse WhatsApp, vai cair direto na Inbox.

Só que esse sistema, futuramente será vendido e usado por outras pessoas, que não terao acesso à minha EVOLUTION API. Logo, a conexao precisa ser feita pelo painel de configuracao do CRM. Ou seja, eu clicar lá para conectar um numero de whatsapp, gerar um QR CODE e assim, conectar o meu whatsapp, criando lá na Evolution API a instancia e todas as configuracoes necessárias.

O QUE ESTÁ ACONTECENDO HOJE é que quando eu abro o projeto que fiz deploy, do "crm-staging.almaagencia.com.br" ou seja, a versao staging, eu vou lá nas configuracoes para configurar o whatsapp, assim que eu clico e nomeio, aparece o botao de gerar qr code.. ele fica girando até que da erro. Nunca abre. Se eu vou lá no Evolution API, no painel direto da Evolution, eu consigo ver que foi criado uma instancia lá. Porém, tem duas informacoes adicionais aqui.

Vamos supor que ao tentar conectar pelo painel do CRM, eu preciso dar um nome para conexao/integracao, vamos supor que eu dê o nome de: "alma-staging". Se eu abro apos isso o painel da Evolution API, lá aparece uma instancia criada mas com um nome diferente.. Aparece: "alma-staging-crm-org-1-channel-5" .. eu não sei se isso influencia, esse nome errado (obs: é channel-5 porque já tentei conectar outras vezes..)

### TAREFA E REGRAS:

Eu preciso que você investigue se o que esse AI Agentic trouxe é verdade e está correto e preciso que você voce verifique se foi feito corretamente a configuracao.

Quero foco 100% nessa configuracao da Evolution API e não só isso, como a configuracao com a INBOX. Porque lembrando que uma mensagem enviada para o Whatsapp cadastrado, precisa cair na INBOX, logo, preciso que esteja configurado isso também, caso não esteja. Faça uma investigacao profunda, em todos os arquivos correspondentes. Veja os arquivos .env.staging e .env.production para verificar se falta alguma informacao referente à essa configuracao da EvolutionAPI.

Use o MCP do context7 para buscar a documentacao completa da Evolution API para que voce compreenda melhor sobre essa conexao e até mesmo pra ver se é possivel fazer isso, de forma automatico como citei acima. Lembre-se de pesquisar a documentacao referente à versão que estamos usando → versão **2.3.7.**

Caso não seja possivel, caso seja obrigatorio realizar acoes direto no painel da Evolution API, quero que voce me relate isso para que eu proponha uma nova solucao.


**OBS:** 
- Detalhe pequeno mas importatissimo. Quando clico para conectar o Whatsapp, aparece o texto: "Conecte sua conta do WhatsApp Business API.". Não vamos conectar WhatsApp Business API e sim Evolution API. Inclusive, isso me faz questionar se nao tem codigo e informacoes referente à conexao via WhatsApp Business API.

---

## Evidências

### Screenshots
<!-- Liste os arquivos de screenshot nesta pasta -->
- `erro-qrcode.png` - Mostra o erro que da no Painel do CRM quando clico em gerar o QR CODE
- `devtools-console.png` - Aba "console" do devtools
- `devtools-network-erro-qrcode.png` - Aba "network" do devtools
- `headers-erro-qrcode.png` - Aba "headers" referente à quarta tentativa de conectar (como pode ser visto no print, gerou 4 tentativas de conexão)

### Vídeos
<!-- Se houver vídeo/gif demonstrando -->
- `video-integracao.mp3` - Mostra toda o processo de conexao do Whatsapp no painel do CRM, mostrando a tentativa de gerar o QR CODE e também mostrando o que acontece no Painel da Evolution API quando eu tento conectar, ele gera sim uma instancia lá na Evolution, com um nome diferente do que colocamos (nao sei se isso tem problema, so pontuando), ou seja, alguma conexao tem, so nao funciona. 

### Logs
<!-- Logs relevantes -->

Coloquei todos os códigos e texto de LOGS no arquivo "informacoes-devtools.md" - /Users/mateusolinto/IA - Projetos ALMA/PROJETOS-INTERNOS/CRM ALMA/CRM-Oficial/crm-alma-oficial/.bugs/active/001-EvolutionAPI-Integracao/informacoes-devtools.md

---

## Resolução (preencher após corrigir)

| Campo | Valor |
|-------|-------|
| **Data Corrigido** | YYYY-MM-DD |
| **Corrigido por** | Nome / IA |
| **Commit** | hash |
| **Arquivos Alterados** | |

### O que foi feito
<!-- Explique a correção -->
