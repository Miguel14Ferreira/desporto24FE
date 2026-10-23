# Jynlo — Contrato de modalidades e resultados (121 desportos)

## Regra de produto
Toda a modalidade do `SPORTS_CATALOG` tem de possuir uma família de apresentação explícita, coberta por testes. **Uma família de UI não define regras de competição ou estatísticas oficiais.** A modalidade da jornada prevalece sobre a modalidade principal da comunidade; para dados antigos sem modalidade numa comunidade multidesporto, apresentar resultados neutros.

## Famílias atuais

| Família | Modalidades | Vista atual | Métricas desportivas específicas |
|---|---:|---|---|
| team | 23 | Confrontos coletivos quando identificáveis | A definir por modalidade e tipo de prova |
| race | 29 | Lista de participantes sem pódio fictício | A definir por modalidade e tipo de prova |
| duel | 25 | Registo neutro com etiqueta de família | A definir por modalidade e tipo de prova |
| judged | 19 | Registo neutro com etiqueta de família | A definir por modalidade e tipo de prova |
| score | 6 | Registo neutro com etiqueta de família | A definir por modalidade e tipo de prova |
| measured | 12 | Registo neutro com etiqueta de família | A definir por modalidade e tipo de prova |
| activity | 7 | Registo neutro com etiqueta de família | A definir por modalidade e tipo de prova |
| **Total** | **121** | | |

O registo central é `src/app/pages/communities/community-round-sport.ts`. Os testes verificam que as 121 modalidades são cobertas **exatamente uma vez**, sem duplicados ou omissões. A adição de uma modalidade exige classificação consciente, não fallback silencioso.

## Próximas fases, obrigatórias antes de declarar cobertura funcional completa

1. **Tipo de evento na jornada**: coletivo, singulares, pares, corrida, prova cronometrada, avaliação, exercício, etc. Modalidades como ténis (singulares/pares), BMX (corrida/freestyle), snowboard, atletismo e natação exigem escolha do tipo de prova quando houver várias opções.
2. **Esquema de resultado por modalidade + tipo**: futebol (golos, assistências, marcador), basquetebol (pontos/cestos), karting (ordem de chegada, tempo, voltas, penalizações), natação (distância e tempo), golfe (buracos/tacadas), ténis (sets/jogos), surf (notas), etc.
3. **Validação no backend e importação Excel**: não aceitar métricas incompatíveis, preservar histórico e nomes de jogadores; definir mapeamentos próprios por tipo, com suporte PT/EN.
4. **Classificação e troféus**: pontos e desempates por tipo, configuráveis e testados; não reutilizar automaticamente WIN/DRAW/LOSS para todos os desportos.
5. **QA de ponta a ponta**: pelo menos um exemplo para cada modalidade e cada variação relevante, no desktop primeiro; nunca editar resultados históricos por heurística automática.

## Segurança e compatibilidade
- Nunca inventar tempos, posições, scores, equipas ou pontuações.
- Não apagar nem reinterpretar dados históricos automaticamente.
- A seleção de modalidade de cada nova jornada já é suportada. Comunidades multidesporto exigem escolha.
- Modalidades desconhecidas usam representação neutra e são detetadas pelo teste de catálogo.

## Estado incremental — tipos de prova em jornadas (23/10/2026)

- **BMX**: corrida `RACE` vs freestyle `FREESTYLE`.
- **Snowboard**: corrida `RACE` vs freestyle `FREESTYLE`.
- **Atletismo**: pista `TRACK`, saltos `JUMP`, lançamentos `THROW`.
- Tipo de prova guardado opcionalmente em `community_round.event_type`; histórico anterior permanece `null`. Na criação de novas jornadas destas três modalidades, a escolha é obrigatória.
- Corridas com tipo `RACE`/`TRACK` podem utilizar as posições/tempos e classificação existentes. Freestyle, saltos e lançamentos são **registos de participação apenas**, sem converter falsamente números de golos ou W/D/L em pontuação.
- **Legado**: as jornadas BMX antigas sem tipo continuam a ser tratadas como corrida, preservando o significado dos dados anteriores. As outras modalidades e a importação histórica mantêm o seu comportamento.
- Próximos passos: modelar resultados por marca/altura/distância, avaliações com júri e regras específicas de pontuação por tipo de evento; ampliar o registo para as restantes modalidades cuja tipologia é variável.
