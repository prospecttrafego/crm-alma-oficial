# Configuracao Nginx/Coolify para WebSocket

## Problema

O console mostra erro `Invalid frame header` ao tentar conectar via WebSocket.

**Causa:** O proxy (Nginx/Coolify) nao esta passando os headers de upgrade necessarios para WebSocket.

## Solucao

### Opcao 1: Coolify (Recomendado se usando Coolify)

1. Acesse o painel do Coolify
2. Va para a aplicacao CRM Alma
3. Procure por "Custom Nginx Configuration" ou similar
4. Adicione o seguinte bloco:

```nginx
# WebSocket support
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

5. Salve e redeploy

### Opcao 2: Nginx Direto

Se voce tem acesso direto ao nginx.conf:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name crm-staging.almaagencia.com.br;

    # SSL configs...

    # Normal HTTP requests
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Opcao 3: Traefik (se usando Docker com Traefik)

Adicione labels ao container:

```yaml
labels:
  - "traefik.http.routers.crm-ws.rule=Host(`crm-staging.almaagencia.com.br`) && PathPrefix(`/ws`)"
  - "traefik.http.routers.crm-ws.middlewares=websocket-headers"
  - "traefik.http.middlewares.websocket-headers.headers.customrequestheaders.Connection=upgrade"
  - "traefik.http.middlewares.websocket-headers.headers.customrequestheaders.Upgrade=websocket"
```

## Verificacao

Apos aplicar a configuracao:

1. Abra o CRM em staging
2. Abra DevTools > Network > WS
3. Verifique se a conexao WebSocket e estabelecida (status 101 Switching Protocols)
4. NAO deve aparecer erro `Invalid frame header`

## Teste Rapido

Execute no console do navegador:

```javascript
const ws = new WebSocket('wss://crm-staging.almaagencia.com.br/ws');
ws.onopen = () => console.log('WebSocket conectado!');
ws.onerror = (e) => console.error('Erro WebSocket:', e);
ws.onclose = (e) => console.log('WebSocket fechado:', e.code, e.reason);
```

Se conectar sem erros, a configuracao esta correta.

## Notas

- O `proxy_read_timeout: 86400` (24h) e importante para manter conexoes WebSocket abertas
- Se usar load balancer, certifique-se de que sticky sessions estao habilitadas
- O endpoint `/ws` e o padrao usado pelo backend Express
