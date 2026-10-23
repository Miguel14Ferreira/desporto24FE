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

## Bodyboard — bateria com categoria explícita (23/10/2026)
- Novo tipo `BODYBOARD_HEAT` exclusivo da modalidade Bodyboard. Não reinterpretar as baterias antigas de surf `HEAT`.
- Categoria obrigatória para novas baterias: `PRONE` ou `DROP_KNEE`. Posições apenas dentro da bateria criada; não cruzar categorias.
- Duas melhores ondas já avaliadas (0–10 cada), guardadas nos campos existentes `wave_score_1/2`. Soma local no frontend até 20; ausência de ambas continua sem resultado.
- Sem regras automáticas de interferência, prioridade, penalização ou desempate federativo. Totais iguais partilham posição na vista provisória.
- Nenhum novo changeset ou backfill de BD: contrato já existente é suficiente. Resultados históricos e outros desportos inalterados.
- Referências analisadas: regra de competição da International Bodyboarding Corporation (2025) e clube NCCB (duas melhores ondas, escala 0–10). 

## Skate e Parkour — tipos de prova com resultados próprios (23/10/2026)
- Skate Park `SKATE_PARK`: nota final de run avaliada manualmente (0–100), sem reconstruir médias dos júris ou desempates.
- Skate Street `SKATE_STREET`: total final introduzido manualmente (0–300). Formats de runs/tricks variam; não definir fórmula automática nem assumir o formato olímpico.
- Parkour Speed `PARKOUR_SPEED`: tempo real em segundos (até três casas decimais), posição opcional se conhecida. Sem voltas, melhor volta ou tempos inferidos.
- Parkour Freestyle `PARKOUR_FREESTYLE`: nota final introduzida pelo organizador na escala **comunitária** de 0–100. Não afirmar equivalência com pontuação FIG nem calcular execução/dificuldade.
- Todos os tipos exigem seleção em novas jornadas; históricos `event_type = null` ficam intactos.
- Usam campos `performance_value`, `elapsed_seconds`, `finish_position` já existentes; não há migração Liquibase nem backfill, nem pontos automáticos de época.
- As posições por notas são apenas da jornada e empates não seguem critérios oficiais.
- Referências: World Skate Skateboarding Street & Park Competition Rules (abril 2025), FIG Parkour Code of Points 2025–2028.

## Breaking e Trampolim — decisão vs. nota final (23/10/2026)
- **Breaking `BREAKING_BATTLE`**: dois participantes exatos, uma decisão do júri com um `WIN` e um `LOSS` registados manualmente. Não são recolhidas pontuações artificiais, votos individuais, marcadores ou equipas. `isNeutralEvent` impede inclusão nas classificações gerais W/D/L da comunidade. Batalhas sem decisão final não são publicadas nesta fase; sem brackets automáticos.
- **Trampolim `TRAMPOLINE_INDIVIDUAL`**: regista apenas o resultado final já validado do exercício individual usando `performance_value`, que é opcional. Até duas casas decimais, e máximo **técnico de armazenamento** 9999.99 (não é máximo regulamentar).
- No código FIG 2025–2028, a nota individual combina E/H/T/D menos penalizações, pelo que não inferimos os componentes a partir da nota final.
- Sem modalidade sincronizada, tumbling, double mini, regras de elegibilidade, desempates oficiais, ranking cruzado ou pontos automáticos. Os históricos com `event_type = null` ficam intocados.
- Sem migração Liquibase: utilizam os campos `result`, `event_type` e `performance_value` já existentes.
- Fontes consultadas: WDSF Breaking Rules and Regulations Manual v16 (2026); FIG Trampoline Code of Points 2025–2028.

## Ginástica Rítmica e Natação Artística (individual/solo, 23/10/2026)
- Ginástica Rítmica `RHYTHMIC_APPARATUS`: selecionar obrigatoriamente Arco/Bola/Maças/Fita; nota final de um exercício validada externamente, com até três decimais. Sem total de concurso completo nem conjuntos.
- Natação Artística `ARTISTIC_SOLO_TECHNICAL` e `ARTISTIC_SOLO_FREE`: provas separadas, nota final já validada de uma rotina a quatro decimais. Não gerar componentes de elementos/impressão artística nem soma automática de rotinas.
- `performance_value` alargado de NUMERIC(9,3) para NUMERIC(10,4): seis dígitos inteiros preservados, mais uma casa decimal; Liquibase executa a alteração uma vez sem tocar nos valores históricos. Outros eventos continuam limitados à precisão que tinham.
- Posições são apenas por exercício dentro da jornada, sem desempates de federação nem pontos de época. Duetos, equipas, conjuntos e acrobática necessitam de contrato separado.
- Referências: FIG RG Code of Points 2025–2028; World Aquatics Artistic Swimming Competition Regulations 2025 e página de regras 2026.

## Duetos, equipas e conjuntos — pontuação coletiva (23/10/2026)
- `RHYTHMIC_GROUP_5` e `RHYTHMIC_GROUP_3_2`: exercícios de cinco ginastas com uma nota final por conjunto (três casas decimais); não inferir aparelhos específicos do ciclo FIG.
- `ARTISTIC_DUET_TECH/FREE`: dois participantes por dueto; `ARTISTIC_TEAM_TECH/FREE`: quatro a oito por equipa. Notas finais a quatro decimais, sem calcular elementos, penalizações nem somar automaticamente técnica/livre.
- `entries[].team` associa cada membro ao seu grupo, sem qualquer `performanceValue` individual. `groupScores[]` é 1 resultado partilhado por nome de grupo, com marca opcional. Posições/empates apenas dentro da jornada.
- O backend rejeita grupos vazios, duplicados, atletas com nota individual e participantes fora dos limites; o frontend valida antes de submeter. Nenhum ponto W/D/L é gerado.
- Uma coluna JSON TEXT nullable em `community_round` guarda somente novas jornadas coletivas. Histórico anterior, jornadas individuais e épicas existentes permanecem intactos.
- Referências: FIG RG Code 2025–2028, World Aquatics Artistic Swimming Competition Regulations (fevereiro de 2026). 

## Basquetebol e Basquetebol 3x3 — resultado final por equipa (23/10/2026)
- Provas explícitas `BASKETBALL_FINAL` e `BASKETBALL_3X3_FINAL`; não partilham regras de golos/assistências de futebol.
- Um único `basketballScore: {sideA,sideB}` no resultado da jornada, com valores inteiros não negativos (máximo **técnico** 999), sem empate no resultado final; participantes associados por `entries[].team = A/B`, com `DRAW` técnico neutro em todos os atletas.
- Os resultados não alimentam a classificação genérica W/D/L; vencedor é indicado visualmente apenas pela comparação dos dois pontos finais. Posição individual, cestos, estatísticas, períodos, prolongamentos e regras de desempate não são inferidos.
- Limites oficiais de 3x3 (21 pontos para vitória durante o tempo regulamentar) **não** são usados como limite do marcador, por poder haver vitória com 21 ou mais; não se valida uma ficha federativa/roster completo através dos membros registados.
- Duas colunas inteiras nullable em `community_round` preservam histórico e não alteram épocas anteriores. PT/EN e registo desktop Concept One.
- Fontes: FIBA Official Basketball Rules 2024, FIBA 3x3 Basketball overview.

## Voleibol e Voleibol de Praia — resultados por sets (23/10/2026)
- Tipos de prova explícitos `VOLLEYBALL_FINAL` e `BEACH_VOLLEY_FINAL`. Com estes tipos não há W/D/L nem golos/assistências individuais contabilizados na classificação genérica.
- Voleibol indoor: vence quem ganhar três sets, num máximo de cinco. Primeiros quatro a 25, eventual 5.º a 15, vantagem mínima de dois pontos, sem teto de pontos regulamentar.
- Voleibol de Praia: vence quem ganhar dois sets, num máximo de três. Primeiros dois a 21, eventual 3.º a 15, vantagem mínima de dois, sem teto regulamentar; dois jogadores registados por lado.
- Validar todos os sets completos, não permitir novos sets depois de atingida a vitória. Limite máximo técnico de armazenamento 999 pontos por lado/set (não limite desportivo).
- Reutilizar `CommunitySetScore` e a coluna `community_round.set_scores` para formato compacto; `match_format = NULL` para evitar ser confundido com raquete. **Nenhuma migração** nem reinterpretação de partidas antigas.
- Marcador por sets 3–0, 3–1, 3–2 ou 2–0, 2–1, discriminando os pontos de cada set. Registar apenas participantes associados a cada lado; no indoor não inferir ficha de equipa completa.
- Forfeits, jogos reduzidos e desempates de torneio além de cada partida ficam para outro contrato explícito.
- Referências FIVB regras-base 2025–2028: https://www.fivb.com/volleyball/the-game/basic-rules/ e https://www.fivb.com/beach-volleyball/the-game/basic-rules/

## Andebol / Rugby / Rugby Sevens — marcador final por equipa
- Eventos tipados: HANDBALL_FINAL, RUGBY_FINAL, RUGBY_SEVENS_FINAL.
- Registo manual de golos no Andebol e pontos totais no Rugby, com empates possíveis e sem inferir ensaios, conversões ou pontos de classificação.
- API teamScore e colunas nullable team_score_a/team_score_b, separadas de basketballScore, das estatísticas de futebol e dos resultados históricos.
- Pontuações inteiras 0–999 como limite técnico; equipas A/B, tradução PT/EN, Concept One.

## Futsal, Hóquei em Campo, Hóquei em Patins e Polo Aquático — golos finais por equipa (23/10/2026)
- Tipos de prova: `FUTSAL_FINAL`, `FIELD_HOCKEY_FINAL`, `ROLLER_HOCKEY_FINAL`, `WATER_POLO_FINAL`. Modalidades separadas, sem fallback da modalidade genérica «Hóquei» nem do Hóquei no Gelo.
- Marcador coletivo A/B com golos confirmados e possíveis empates, sem simular prolongamento, shoot-outs, marcadores individuais, penáltis ou vitória numa eliminatória. Os sistemas competitivos exigem contratos adicionais para essas decisões.
- Reutiliza o contrato `teamScore` e as colunas já existentes `team_score_a/b`. **Sem Liquibase novo**. Colunas antigas continuam nullable, sem backfill nem interpretação automática de resultados antigos.
- O rugby mantém pontos e o andebol mantém golos; basquetebol e voleibol não são convertidos. Resultado neutro para classificações W/D/L genéricas, sem pontos de época inventados.
- Design desktop Concept One, traduções PT/EN, testes de validação de resultados e seleção de modalidade. Referências: FIFA Futsal Law 10, FIH Rules of Hockey 2026, World Skate Rink Hockey Regulations e World Aquatics Competition Regulations.
