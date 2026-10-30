# QA LIVE de papéis em comunidades e torneios (apenas leitura)

Este auditor usa **exclusivamente** duas contas descartáveis já autorizadas:
`jynloteste01` e `jynloteste02`. As credenciais têm de estar nos **GitHub Actions secrets**
`JYNLO_QA1_USERNAME`, `JYNLO_QA1_PASSWORD`, `JYNLO_QA2_USERNAME`, `JYNLO_QA2_PASSWORD`.
Nunca partilhar passwords, tokens ou screenshots de dados LIVE em PRs, logs ou conversas.

## O que valida

- Login: exatamente dois `POST /api/auth/login`, sem MFA bypass.
- Depois do login: **apenas GET** e uma allowlist restrita a `/api/communities/mine`,
  `/api/communities/{id}`, `/api/communities/{id}/tournaments?page=0` e
  `/api/communities/{id}/tournaments/{tournamentId}`.
- Detalhes das comunidades **já pertencentes** a cada conta, consistência de `myRole`
  e `visibility`; no máximo 3 comunidades por conta.
- Se as duas contas pertencerem à mesma comunidade, consulta no máximo duas comunidades
  partilhadas, dois detalhes de torneios por conta e confirma a diferença de papéis
  **OWNER/ADMIN/MEMBER**, se existir.
- Se não existir um detalhe de torneio numa comunidade partilhada, consulta no máximo
  **uma comunidade já pertencente a cada conta** para procurar uma amostra autorizada.
  Só faz GET e mantém o limite global de 34 pedidos.
- Se uma comunidade **PRIVATE** pertencer apenas a uma das contas, testa no máximo um
  pedido de detalhe com o outro utilizador, esperando 403 ou 404. Nunca lê o corpo
  dessa resposta, nem mesmo se o servidor devolver incorretamente 200.
- Logs agregados e sem identificadores, IDs de comunidades, nomes, emails, JWTs ou corpos.
  Respostas limitadas a 1,5 MB, 12 s por pedido e orçamento de 34 pedidos.

## O que NÃO valida

Não testa escrita na API LIVE — nada de inscrição, resultados, convites, publicação,
alteração de papéis ou eliminação. Logo, não pode demonstrar que um MEMBER recebe
403 ao tentar gravar resultados, nem substitui os testes do backend Spring.
Se não existirem comunidades partilhadas com papéis distintos, regista `[SKIP]`:
**não** reportar “permissões de gestão validadas” nesses casos.
Também regista `[SKIP]` quando a amostra tem zero comunidades ou zero detalhes de
 torneios; só imprime `[PASS]` para a cobertura que realmente executou. Os
contadores são agregados e nunca incluem identificadores.

## Execução

O workflow `.github/workflows/community-role-live-readonly.yml` é **manual**:
`workflow_dispatch` e `permissions: contents: read`. Não usa secrets em PRs.
O workflow precisa de estar também no **branch predefinido** do GitHub (`master`)
para o GitHub expor o botão *Run workflow*. Depois pode escolher
`preview/render-fullstack` como referência para executar a versão publicada.
Não adicionar um trigger automático nem colocar credenciais nos argumentos de linha de comandos.

Para validação sem rede ou passwords:

```bash
node --check scripts/qa/jynlo-community-roles-live-readonly.cjs
node --test scripts/qa/jynlo-community-roles-live-readonly.test.cjs
```

Uma eventual falha de autenticação, ausência de secrets ou autorização inesperada
é reportada apenas com códigos controlados; não desativar os guardrails para obter verde.
