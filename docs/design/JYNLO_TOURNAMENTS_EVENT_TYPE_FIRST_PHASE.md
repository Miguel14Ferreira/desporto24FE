# Jynlo — tipos de prova em torneios (fase inicial)

O catálogo de 121 modalidades continua a ser a fonte de modalidades. Cada modalidade pode exigir mais do que um tipo de prova com regras específicas. A primeira entrega introduz tipos de prova opcionais em **torneios novos** sem alterar a matemática dos resultados existentes nem reinterpretar resultados antigos.

## Contratos explicitamente aceites pelo backend

| Modalidade | Tipo de prova | Motor existente |
| --- | --- | --- |
| BMX | RACE | Campeonato individual por posições |
| Ciclismo de Estrada | ROAD_RACE | Campeonato individual por posições |
| Ciclismo de Pista | TRACK_SCRATCH | Campeonato individual por posições |
| Xadrez | CHESS_GAME | Confronto individual, vitória 1 / empate ½ / derrota 0 |

O novo `community_tournament.event_type` é VARCHAR(64), nullable para preservar torneios históricos e clientes antigos. O backend rejeita novos identificadores que não sejam compatíveis com a modalidade, participação individual/equipa e scoring mode.

O frontend apresenta também tipos de prova que já existem nas jornadas, mas **não estão disponíveis nos torneios**: BMX Freestyle, contrarrelógios, natação de piscina, atletismo de pista/saltos/lançamentos, snowboard, surf, golfe, skate e parkour. Estes aparecem desativados para não criar classificações falsas. Formatos atuais podem continuar sem o campo explicitamente definido.

## Seguimento necessário

- Adicionar `eventDiscipline` e contratos de resultados especializados para variantes por tempos, distâncias, sets, assaltos e notas.
- Exigir a escolha do tipo quando a modalidade tiver várias variantes e cada uma tiver um motor de resultados validado, depois de compatibilizar clientes existentes.
- Associar validação de resultados no backend à combinação (modalidade, tipo, disciplina), não apenas à família visual.
- Testar todas as modalidades, regras e variantes, PT/EN e QA autenticado; preservar históricos `null` e dados existentes.
