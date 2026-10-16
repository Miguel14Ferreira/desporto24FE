# Jynlo — testes reais de navegador (Chromium)

Esta primeira fase exercita os componentes Angular no **navegador real** com
respostas HTTP simuladas e determinísticas. **Não contacta a API de produção,
não utiliza contas reais e não valida a integração Spring Boot/BD.**

## Executar localmente

Node.js 22, Chromium e dependências de sistema disponíveis:

```bash
npm ci
npm install --no-save --package-lock=false @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config=playwright.config.ts
npx playwright show-report
```

Em Linux sem bibliotecas Chromium, usar `npx playwright install --with-deps chromium`.

O Playwright arranca `ng serve` em `127.0.0.1:4200` automaticamente, cria
um token JWT **fictício apenas no localStorage de teste** e intercepta os
pedidos `/api/**` para devolver fixtures. Bloqueia todos os pedidos inesperados
à API. A matriz corre em desktop e viewport de telemóvel.

Em falhas, o workflow **Validate tournament browser flows** publica um artefacto
`jynlo-tournament-browser-report` com relatório HTML, traces, vídeo e imagens.
Executar `npx playwright show-trace caminho/trace.zip` para reproduzir o caso.

**Próxima fase:** testes autenticados num ambiente de staging controlado, com
contas descartáveis, API e BD reais. Nunca usar dados/contas de produção em
testes que criam, modificam ou encerram torneios.
