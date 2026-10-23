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

## Resultados por marca/nota — primeiro incremento (23/10/2026)
- BMX/Snowboard `FREESTYLE`: uma nota agregada de 0 a 100 por participante, opcional; não implica sistema oficial de júris, rondas ou pesos.
- Atletismo `JUMP`/`THROW`: uma marca positiva em metros, até 3 casas decimais, por participante; não se misturam modalidades nem subdisciplinas em rankings de época.
- `community_round_entry.performance_value` é NULL em histórico anterior e nas modalidades não abrangidas. Não há backfill ou alteração de resultados antigos.
- A interface mostra marca, unidade e **posição somente dentro daquela jornada**; marcas iguais partilham posição. Participantes sem marca ficam sem classificação.
- Não são criados pontos de campeonato, medalhas automáticas nem classificação cruzada entre salto em altura e distância, entre outros.
- Próximos incrementos: especificar disciplinas atléticas (altura, comprimento, triplo, dardo, peso, etc.), séries e tentativas, critérios de validade e painel de júris com notas individuais.

## Seguimento — disciplinas atléticas de campo (23/10/2026)
- Novas provas `JUMP`: comprimento, triplo, altura ou vara; `THROW`: peso, disco, dardo ou martelo.
- `community_round.event_discipline` é nullable para histórico; novas jornadas de saltos/lançamentos exigem a seleção.
- Marcas em metros e posições apenas na jornada; **sem** classificação cruzada entre disciplinas, tentativas oficiais ou pontuações inventadas.

## Incremento de avaliações por júri — surf e ginástica artística (23/10/2026)
- Surf HEAT: duas notas de ondas **já avaliadas** entre 0 e 10, opcionais. A soma representa exclusivamente os valores fornecidos. Sem ondas: sem nota ou posição. A posição é apenas na bateria.
- Ginástica Artística APPARATUS: seleção de um de oito aparelhos e registo manual opcional da nota final já apurada. Não há cálculo da dificuldade/exe-cução dos júris.
- Surf utiliza `wave_score_1` e `wave_score_2`, ambos nullable; não reutiliza `performance_value` nem altera histórico.
- Não criar classificação de época, medalhas ou rankings cruzados entre provas/aparelhos.
