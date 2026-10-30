# Jynlo — auditoria LIVE de notificações com contas QA (apenas leitura)

O script `scripts/qa/jynlo-notifications-live-readonly.cjs` verifica o contrato de notificações em `https://api.d24sports.com` com **apenas** `jynloteste01` e `jynloteste02`. A autenticação usa `POST /api/auth/login`, seguido somente de pedidos `GET`.

Verifica: preferências globais e por categoria; lista de notificações e contador de não lidas; visibilidade de notificações antigas com preferências desativadas; e HTTP 403 ao tentar ler a outra conta QA pelo endpoint legado.

**Não altera preferências, não marca mensagens lidas, não cria convites, não envia emails e não acede a outros perfis** (exceto a chamada deliberadamente recusada de leitura cruzada entre estas duas contas QA). As mensagens e contagens são verificadas mas nunca impressas. Credenciais e JWTs permanecem apenas em memória.

## CI e segredos

Os testes `node --test scripts/qa/jynlo-notifications-live-readonly.test.cjs` são simulados e fazem parte de `qa-inbox-contract.yml`; executam-se em PR sem acesso a credenciais nem à API.

Existe um workflow manual `.github/workflows/notification-live-readonly.yml` preparado para invocar o script. Os segredos `JYNLO_QA_PASSWORD_1` e `JYNLO_QA_PASSWORD_2` devem ser configurados **apenas como GitHub Actions secrets** com as passwords das contas QA autorizadas, nunca num chat, código, ficheiro, PR, logs ou argumentos. O workflow falha antes de chamar a API se não estiverem presentes.

**GitHub exige que um workflow `workflow_dispatch` exista também no branch predefinido** para estar disponível na interface Actions. Como o frontend tem `master` como default e publica `preview/render-fullstack`, é necessário disponibilizar o workflow de disparo no default branch para o poder iniciar pelo GitHub UI. Não ativar execução automática em PRs ou `push` com credenciais de produção.

No GitHub Actions, escolher o workflow manual e executar em modo opt-in apenas após confirmação de ambos os secrets. O relatório visível é reduzido a linhas `[PASS]` e `[FAIL]`.

## Limitações

Esta auditoria de leitura **não comprova entregas de emails nem desativações reais em produção**, porque não executa ações geradoras de email ou grava preferências. Estes testes precisam de um cenário isolado e consentido de envio para caixa controlada, com verificação no Resend e no destinatário. Nunca interpretar `[PASS]` deste script como confirmação de entrega ou supressão de emails.
