# Jynlo — matriz de capacidades dos torneios (121 modalidades)

## Contrato e alcance

O catálogo integral das 121 modalidades é obrigatório e testado contra `SPORTS_BY_RESULT_FORMAT`.
A família visual de uma modalidade **não equivale** a suporte de todos os formatos, provas ou regras federativas. A função `tournamentSportCapabilities` é o ponto único de decisão, por modalidade e formato individual/coletivo, sobre os modelos que o frontend pode criar através dos contratos atuais do backend.

| Modelo | Estado | Dados e limite |
| --- | --- | --- |
| NUMERIC_INDIVIDUAL | Disponível, parcial | 1 vs 1, marcador numérico; Xadrez: meio ponto |
| NUMERIC_TEAM | Disponível, parcial | Ligas, fases de grupos e eliminatórias por equipas; resultado numérico |
| RACE_POINTS | Disponível, parcial | Sete modalidades de campeonato verificadas, classificações por posição das jornadas compatíveis |
| INLINE_SPEED | Disponível, parcial | Patinagem de Velocidade, fases e baterias específicas |
| SWIM_BEST_TIME | Disponível, parcial | Natação em piscina de 50 m, disciplinas explicitamente validadas |
| CANOE_BEST_TIME | Disponível, parcial | Canoagem Velocidade individual K1, distâncias validadas |
| ROWING_BEST_TIME | Disponível, parcial | Remo single scull (1x), distâncias validadas |
| FIELD_BEST_MARK | Disponível, parcial | Atletismo, saltos e lançamentos validados |
| TRACK_BEST_TIME | Disponível, parcial | Atletismo, provas de pista validadas |
| RELAY_BEST_TIME | Disponível, parcial | Atletismo, estafetas 4×100 e 4×400 em formato de liga |
| UNAVAILABLE | Inativo nesta combinação | Proibido inventar marcador, ranking ou adaptação fictícia do futebol |

As classes existentes `community-round-sport.ts`, `community-tournament-classification.ts` e `community-tournaments.service.ts` continuam a determinar, respetivamente, família, regras genéricas e contratos realmente disponíveis. A nova matriz unifica estes factos sem alterar APIs, bases de dados, épocas ou resultados históricos.

## Entregas seguintes antes de declarar cobertura total

1. Introduzir `eventType` e `eventDiscipline` em torneios, sempre que necessário, sem inferir disciplinas de registos antigos.
2. Associar um esquema de resultados tipado a cada combinação modalidade/prova: marcadores, sets, assaltos, posições, tempos, distâncias, notas e grupos/pares.
3. Validar os esquemas no backend e importação Excel antes de ativar o formato para novos torneios. Reutilizar os contratos de jornadas apenas quando representarem exatamente o mesmo tipo de prova.
4. Classificações, critérios de desempate e eliminatórias próprios do contrato. Não gerar resultados federativos a partir de pontos genéricos.
5. Testes de integração e navegação autenticada para cada modalidade e variação, PT/EN, desktop primeiro, protegendo permissões e histórico.

**Exemplos ainda não concluídos integralmente nos torneios**: Natação (restantes estilos, distâncias e formatos), Atletismo (restantes provas e regras), Golfe (buracos/tacadas), Surf (baterias/notas), Ginástica (aparelhos e prova), e variantes de BMX como Freestyle. As provas especializadas já suportadas acima não implicam cobertura integral da modalidade. Muitos tipos de prova já existem nas jornadas comunitárias, mas não se devem considerar automaticamente torneios completos.

O objetivo de produto continua a ser **121/121 modalidades**. Não declarar cobertura funcional de torneios antes de existirem contratos reais, classificação e testes das variantes relevantes.
