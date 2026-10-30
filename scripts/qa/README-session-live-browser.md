# QA real: ciclo de vida de uma sessão privada

Este teste requer autorização explícita para escrever em produção. Cria exatamente UMA sessão privada fictícia de Futebol, sem recinto e sem recorrência, com duas vagas para jynloteste01 e jynloteste02. Confirma acesso proibido antes da segunda conta aderir, acesso autorizado após aderir, receção WebSocket sem refresh, histórico bloqueado após início (403), envio recusado após início (409), chat retirado do Centro de Mensagens e cancelamento final.

**Cancelar não apaga o registo histórico da base de dados.** A sessão fica identificada como "JYNLO QA - TESTE PRIVADO - NAO E UM EVENTO REAL". Em caso de falha, o script tenta cancelar apenas a sessão criada por ele. A criação e os envios não são repetidos automaticamente. Se a ligação falhar durante a criação ou o processo for interrompido, consultar primeiro as sessões da conta QA antes de repetir.

Executar no WSL, com Playwright e Chromium já instalados:

~~~bash
cd ~/jynlo-frontend
git pull --ff-only

read -rsp 'Password QA 1: ' JYNLO_QA_PASSWORD_1; echo
read -rsp 'Password QA 2: ' JYNLO_QA_PASSWORD_2; echo
export JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2
export JYNLO_QA_PRIVATE_SESSION_CONSENT=PRIVATE_QA_SESSION_PERSISTS

node scripts/qa/jynlo-session-live-browser.cjs
RESULT=$?

unset JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2 JYNLO_QA_PRIVATE_SESSION_CONSENT
echo "QA exit status: $RESULT"
~~~

O script acompanha a hora de início real da sessão. Não executar em duplicado ou em paralelo. Não partilhar passwords, tokens ou detalhes privados. Em caso de erro, partilhar apenas linhas PASS/FAIL/SKIP e o código de erro. O ID da sessão QA é apresentado para possibilitar limpeza manual.

Testes de contratos simulados, sem produção:

~~~bash
node --test scripts/qa/jynlo-session-live-browser.test.cjs
~~~

GitHub Actions executa apenas estes testes simulados; nunca inicia sessões reais.
