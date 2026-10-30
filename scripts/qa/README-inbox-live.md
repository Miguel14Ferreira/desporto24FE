# Jynlo Chat 3.0 — verificação QA da API real

O script `jynlo-inbox-live-qa.cjs` permite confirmar os cursores de leitura persistentes com **duas contas descartáveis autorizadas**. Não guarda passwords/tokens, não adiciona serviços no Render e não modifica código da aplicação.

## Requisitos e segurança

- Node.js **22+**, ligação de rede a `https://api.d24sports.com` e contas QA `jynloteste01` / `jynloteste02` existentes. Se ainda não forem amigas, a opção `--ensure-friends` cria e aceita o convite **exclusivamente entre estas duas contas**.
- **Nunca** escrever passwords num ficheiro, comando, PR, issue ou comentário. O script lê-as apenas de `JYNLO_QA_PASSWORD_1` / `JYNLO_QA_PASSWORD_2`.
- Só comunica com a URL HTTPS fixa de produção; não aceita `--base-url` nem faz chamadas a serviços terceiros.
- O modo por defeito autentica as duas contas e verifica amizade, autorização e resumos. Não envia mensagens nem altera o cursor.
- `--ensure-friends` primeiro consulta ambos os estados de amizade; se existir um pedido QA pendente, reutiliza-o. Caso contrário, envia **um único convite** de `jynloteste01` para `jynloteste02`, localiza apenas a notificação QA correspondente e aceita-a autenticado como destinatário. Não aceita pedidos de terceiros, não reenvia automaticamente convites com resultado incerto e confirma amizade nos dois sentidos.
- `--send-once` envia **exatamente uma mensagem QA** de `jynloteste01` para `jynloteste02` e regista **uma leitura** em nome do destinatário. A mensagem QA permanece no histórico; nenhuma outra conta é afetada. É obrigatório executar primeiro a pré-validação. Uma falha/timeout no POST **não provoca novo envio automático**.
- Sem `--ensure-friends`, se as contas não forem amigas ou estiverem bloqueadas, o script termina **antes de criar mensagens**. A configuração opcional de amizade pode enviar email/notificação para `jynloteste02`. Não cria sessões, comunidades nem torneios.
- Esta é uma **verificação HTTP da API real**; não testa WebSocket, navegação visual ou sincronização de dois browsers abertos. Os testes Playwright sintéticos existentes são independentes.

## Executar localmente em WSL / Bash

A partir da raiz do repositório FE, depois de obteres a branch publicada:

```bash
node --version
read -rs -p 'Password QA 1: ' JYNLO_QA_PASSWORD_1; echo
read -rs -p 'Password QA 2: ' JYNLO_QA_PASSWORD_2; echo
export JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2

# 1. Corrigir a amizade QA e validar acesso; sem enviar mensagens de chat
node scripts/qa/jynlo-inbox-live-qa.cjs --ensure-friends

# 2. Apenas depois de a pré-validação passar:
#    envia UMA mensagem QA e verifica não lidas, leitura e novo login
node scripts/qa/jynlo-inbox-live-qa.cjs --send-once

unset JYNLO_QA_PASSWORD_1 JYNLO_QA_PASSWORD_2
```

Os dois `read -rs` não mostram a password nem a guardam no histórico Bash. Limpa as variáveis no fim, incluindo em caso de erro. Não colar tokens, passwords ou respostas brutas em relatórios.

## Testes do próprio script (sem rede, sem credenciais)

```bash
node --test scripts/qa/jynlo-inbox-live-qa.test.cjs
```

Os testes simulam os contratos HTTP e verificam o fluxo completo, pré-validação sem escritas, criação/aceitação de amizade, convite já pendente nas duas direções, isolamento de notificações de terceiros e proibição de reenvio depois de resposta ambígua. Não utilizam a BD ou as contas LIVE.

## Interpretação

`[PASS]` para todas as etapas de `--send-once` significa que o backend recebeu uma mensagem, aumentou a contagem de não lidas no destinatário, confirmou essa mensagem no histórico, persistiu a leitura e recuperou o mesmo contador após novo login. **Não basta para fechar a validação browser/UI da Fase 4.**

Se `--ensure-friends` falhar após pedir amizade, não repetir às cegas: verificar o pedido pendente e a notificação na conta destinatária. Não fazer alterações manuais na BD. Em caso de `[FAIL]`, não repetir `--send-once` automaticamente. Verificar o histórico da conta destinatária antes de qualquer nova tentativa, sobretudo se o erro ocorreu durante o POST de envio.
