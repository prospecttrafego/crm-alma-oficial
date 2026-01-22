# Configuracao Traefik/Coolify para WebSocket

## Problema

O console mostra erro `Invalid frame header` ao tentar conectar via WebSocket, ou a conexao WebSocket fecha apos alguns segundos.

**Causa:** O Traefik tem timeouts padrao de 60 segundos que fecham conexoes WebSocket inativas.

## Solucao

### Passo 1: Acessar configuracao do Proxy no Coolify

1. Acesse o painel do Coolify
2. Va para **Server** (seu servidor)
3. Clique em **Proxy** na sidebar
4. Procure a secao de **Configuration** ou **Command**

### Passo 2: Adicionar timeouts para WebSocket

Adicione os seguintes comandos na configuracao do Traefik:

```yaml
command:
  - "--entrypoints.https.transport.respondingTimeouts.readTimeout=5m"
  - "--entrypoints.https.transport.respondingTimeouts.writeTimeout=5m"
  - "--entrypoints.https.transport.respondingTimeouts.idleTimeout=5m"
```

**Explicacao:**
- `readTimeout`: Tempo maximo para ler a requisicao completa
- `writeTimeout`: Tempo maximo para escrever a resposta
- `idleTimeout`: Tempo que uma conexao pode ficar ociosa (importante para WebSocket!)

### Passo 3: Reiniciar o Proxy

Apos salvar, reinicie o proxy do Coolify para aplicar as mudancas.

## Verificacao

1. Abra DevTools > Network > WS
2. Verifique se a conexao WebSocket esta com status 101 (Switching Protocols)
3. A conexao deve permanecer aberta por mais de 60 segundos
4. NAO deve haver erros "Invalid frame header"

## Teste Rapido

Execute no console do navegador:

```javascript
const ws = new WebSocket('wss://crm-staging.almaagencia.com.br/ws');
ws.onopen = () => console.log('WebSocket conectado!');
ws.onerror = (e) => console.error('Erro WebSocket:', e);
ws.onclose = (e) => console.log('WebSocket fechado:', e.code, e.reason);

// Apos 2 minutos, verificar se ainda esta conectado:
setTimeout(() => console.log('Estado:', ws.readyState === 1 ? 'Conectado' : 'Desconectado'), 120000);
```

## Notas Importantes

### Sobre o checkbox "Enable" no Coolify
O checkbox "Enable" na secao "HTTP Basic Authentication" e para **protecao com senha** do site. Deixar **desmarcado** esta correto - voce NAO precisa marcar isso para o WebSocket funcionar.

### Sobre os labels do Traefik
Os labels que aparecem na configuracao (`traefik.enable=true`, `traefik.http.routers...`, etc.) sao gerados automaticamente pelo Coolify e estao corretos. Voce NAO precisa modificar esses labels para WebSocket funcionar.

### Traefik suporta WebSocket nativamente
Diferente do Nginx, o Traefik passa os headers de upgrade automaticamente. O unico ajuste necessario e o timeout.

## Referencia

- Documentacao Coolify: https://coolify.io/docs/troubleshoot/applications/gateway-timeout
- Documentacao Traefik WebSocket: https://doc.traefik.io/traefik/user-guides/websocket/
