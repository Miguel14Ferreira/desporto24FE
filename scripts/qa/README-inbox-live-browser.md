# Jynlo — QA real de dois browsers e WebSocket

Este teste opt-in usa as contas descartáveis jynloteste01 e jynloteste02 em contextos Chromium totalmente separados. Faz login na API real, abre o Centro de Mensagens em https://d24sports.com e exige WebSocket autenticado nas duas contas. Não grava passwords, tokens, perfis do browser, capturas de ecrã ou traces.

Sem argumentos, **não cria mensagens**, mas abrir o histórico pode marcar mensagens QA como lidas. Se as contas tiverem uma comunidade exclusiva ou uma sessão passada, valida também o isolamento/encerramento. O marcador [SKIP] significa que esse cenário não estava disponível.

A opção --send-once, executada só depois de o modo normal passar, envia exatamente uma mensagem QA com identificador único e exige vê-la na segunda conta sem refresh. Em caso de erro após o envio, consultar o histórico antes de tentar de novo. Nunca repetir automaticamente.

## PowerShell no Windows (na pasta do frontend)

~~~powershell
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium

$secure1 = Read-Host 'Password QA 1' -AsSecureString
$secure2 = Read-Host 'Password QA 2' -AsSecureString
$env:JYNLO_QA_PASSWORD_1 = [System.Net.NetworkCredential]::new('', $secure1).Password
$env:JYNLO_QA_PASSWORD_2 = [System.Net.NetworkCredential]::new('', $secure2).Password

node scripts/qa/jynlo-inbox-live-browser.cjs

# Opcional e com apenas uma mensagem de teste:
node scripts/qa/jynlo-inbox-live-browser.cjs --send-once

Remove-Item Env:JYNLO_QA_PASSWORD_1, Env:JYNLO_QA_PASSWORD_2 -ErrorAction SilentlyContinue
Remove-Variable secure1,secure2 -ErrorAction SilentlyContinue
~~~

Não colar credenciais em issues, PRs, argumentos de comandos ou ficheiros. Os testes internos sem rede nem credenciais são:

~~~powershell
node --test scripts/qa/jynlo-inbox-live-browser.test.cjs
~~~

Este teste real de browser não é executado automaticamente em CI, porque requer as credenciais privadas e utiliza produção. O CI executa apenas os testes de contratos simulados. Não cria serviços ou deploys no Render.


## Verificar permissões das comunidades e sessões sem alterar produção (WSL)

Este teste também consulta, **apenas por GET**, a descoberta pública para
tentar confirmar que um utilizador sem adesão não consegue consultar as mensagens
de uma comunidade pública ou sessão de terceiros. Respostas 403 ou 404 são
aceites como acesso recusado. Um HTTP 200 num chat não autorizado faz falhar o
teste. Não imprime nomes de comunidades, IDs, mensagens nem tokens.

As verificações são independentes: uma comunidade pública de terceiros não
substitui o teste de proprietário e não membro da *mesma* comunidade. Do mesmo
modo, impedir um estranho de ler uma sessão futura não substitui observar o
encerramento do chat **de uma sessão da própria conta QA** quando começa.

A partir da pasta /home/mf/jynlo-frontend, já com Chromium e Playwright instalados:

~~~bash
git pull --ff-only

read -rsp 'Password QA 1: ' JYNLO_QA_PASSWORD_1; echo
read -rsp 'Password QA 2: ' JYNLO_QA_PASSWORD_2; echo
export JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2

# Só leitura, à exceção dos possíveis recibos de leitura ao abrir chats QA:
node scripts/qa/jynlo-inbox-live-browser.cjs

unset JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2
~~~

Não executar --send-once para esta nova verificação: o envio de uma mensagem
privada já foi confirmado anteriormente. Nunca criar automaticamente uma
comunidade de teste na base de dados real, pois a API atual não dispõe de
eliminação completa de comunidades.

O resultado [SKIP] continua a significar *não testado*. Para fechar o teste
de início de sessão com o organizador real, será necessária uma sessão QA
privada e controlada, criada intencionalmente num teste separado.
