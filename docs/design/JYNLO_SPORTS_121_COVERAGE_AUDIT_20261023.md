# Jynlo — Auditoria da cobertura funcional das 121 modalidades

**Data:** 23 de outubro de 2026. **Fontes verificadas:** frontend `1c59d163` (`SPORTS_CATALOG`, `SPORTS_BY_RESULT_FORMAT`) e backend `3a3a3a53` (estado antes da correção), mais `f9cf842a` (catálogo corrigido LIVE) (`SportsCatalog.ALLOWED`, `CommunityRoundEventType`, `CommunityRaceMetrics`, `CommunityRacketResults`). **Importante:** este é um inventário estático de contratos no código; não substitui QA autenticado nem certifica regras oficiais de federação.

## Resultado da auditoria

- **121/121** modalidades constam do catálogo do frontend, sem duplicados; cada uma tem **uma** família visual (`team` 23, `race` 29, `duel` 25, `judged` 19, `score` 6, `measured` 12, `activity` 7).
- **Defeito confirmado, corrigido e publicado no backend** pelo [PR #218](https://github.com/Miguel14Ferreira/desporto24BE/pull/218), commit `f9cf842a`: a lista Java publicada tinha apenas 116. Não incluía **Bowling, Corrida de obstáculos, Hipismo, Teqball, Ténis de praia**. A lista atual contém 121. A suite Java passou, o PR foi integrado por squash merge e o commit `f9cf842a` foi confirmado **LIVE no Render**. A interface já tinha os cinco desportos, não havendo necessidade de novo deploy do frontend.
- **12 modalidades** têm variantes de prova expressamente codificadas (mesmo assim, sem assumir regras oficiais ou cobertura completa de todas as disciplinas).
- **7 modalidades** têm contrato de sets em singulares/pares, mas não implementam necessariamente os diferentes desempates oficiais de cada modalidade.
- **28 modalidades** adicionais usam esquema-base de posições/tempos/voltas; regras oficiais e tipos de percurso continuam por modalidade.
- **23 modalidades** recebem apresentação de confronto coletivo, mas **não** significa que os marcadores, estatísticas ou classificações adequados estejam implementados.
- **51 modalidades** têm apenas uma família de UI, sem contrato de resultados especializado identificado por esta análise. Registo W/D/L genérico, quando disponível, não é sinónimo de regras corretas.

As categorias acima são **exclusivas** e descrevem o contrato mais específico encontrado, não a completude funcional. A soma é 121.

## Matriz por modalidade

| Modalidade (catálogo) | Família UI | Estado do contrato de resultados |
|---|---|---|
| Aeromodelismo | judged | Apenas família visual — contrato por definir |
| Aikido | judged | Apenas família visual — contrato por definir |
| Andebol | team | Confronto genérico — sem regras específicas |
| Apneia | measured | Apenas família visual — contrato por definir |
| Artes Marciais Chinesas | judged | Apenas família visual — contrato por definir |
| Atividades Subaquáticas | measured | Apenas família visual — contrato por definir |
| Atletismo | measured | Tipos de prova explícitos — parcial |
| Automobilismo | race | Métricas-base de corrida — parcial |
| Badminton | duel | Sets singulares/pares — parcial |
| Basebol | team | Confronto genérico — sem regras específicas |
| Basquetebol | team | Confronto genérico — sem regras específicas |
| Basquetebol 3x3 | team | Confronto genérico — sem regras específicas |
| Bilhar | duel | Apenas família visual — contrato por definir |
| BMX | race | Tipos de prova explícitos — parcial |
| Bodyboard | judged | Tipos de prova explícitos — parcial |
| Bowling | score | Apenas família visual — contrato por definir |
| Boxe | duel | Apenas família visual — contrato por definir |
| Breaking | judged | Tipos de prova explícitos — parcial |
| Bridge | score | Apenas família visual — contrato por definir |
| Calistenia | measured | Apenas família visual — contrato por definir |
| Caminhada | activity | Apenas família visual — contrato por definir |
| Campismo | activity | Apenas família visual — contrato por definir |
| Canoagem | race | Métricas-base de corrida — parcial |
| Canoagem Slalom | race | Métricas-base de corrida — parcial |
| Canoagem Velocidade | race | Métricas-base de corrida — parcial |
| Ciclismo | race | Métricas-base de corrida — parcial |
| Ciclismo de Estrada | race | Métricas-base de corrida — parcial |
| Ciclismo de Pista | race | Métricas-base de corrida — parcial |
| Ciclocrosse | race | Métricas-base de corrida — parcial |
| Columbofilia | race | Métricas-base de corrida — parcial |
| Corfebol | team | Confronto genérico — sem regras específicas |
| Corrida | race | Métricas-base de corrida — parcial |
| Corrida de obstáculos | race | Métricas-base de corrida — parcial |
| Cricket | team | Confronto genérico — sem regras específicas |
| Curling | team | Confronto genérico — sem regras específicas |
| Damas | duel | Apenas família visual — contrato por definir |
| Dança Desportiva | judged | Apenas família visual — contrato por definir |
| Escalada | measured | Apenas família visual — contrato por definir |
| Esgrima | duel | Apenas família visual — contrato por definir |
| Esqui | measured | Apenas família visual — contrato por definir |
| Esqui Alpino | race | Métricas-base de corrida — parcial |
| Esqui de Fundo | race | Métricas-base de corrida — parcial |
| Esqui Freestyle | judged | Apenas família visual — contrato por definir |
| Esqui de Montanha | race | Métricas-base de corrida — parcial |
| Flag Football | team | Confronto genérico — sem regras específicas |
| Futebol | team | Confronto genérico — sem regras específicas |
| Futebol Americano | team | Confronto genérico — sem regras específicas |
| Futevólei | team | Confronto genérico — sem regras específicas |
| Futsal | team | Confronto genérico — sem regras específicas |
| Ginásio | activity | Apenas família visual — contrato por definir |
| Ginástica | judged | Apenas família visual — contrato por definir |
| Ginástica Artística | judged | Tipos de prova explícitos — parcial |
| Ginástica Rítmica | judged | Tipos de prova explícitos — parcial |
| Golfe | score | Apenas família visual — contrato por definir |
| Halterofilismo | measured | Apenas família visual — contrato por definir |
| Hipismo | measured | Apenas família visual — contrato por definir |
| Hóquei | team | Confronto genérico — sem regras específicas |
| Hóquei em Campo | team | Confronto genérico — sem regras específicas |
| Hóquei em Patins | team | Confronto genérico — sem regras específicas |
| Hóquei no Gelo | team | Confronto genérico — sem regras específicas |
| Jiu-Jitsu | duel | Apenas família visual — contrato por definir |
| Jiu-Jitsu Brasileiro | duel | Apenas família visual — contrato por definir |
| Judo | duel | Apenas família visual — contrato por definir |
| Karaté | duel | Apenas família visual — contrato por definir |
| Karting | race | Métricas-base de corrida — parcial |
| Kempo | duel | Apenas família visual — contrato por definir |
| Kickboxing | duel | Apenas família visual — contrato por definir |
| Kung Fu | duel | Apenas família visual — contrato por definir |
| Lacrosse | team | Confronto genérico — sem regras específicas |
| Luta Greco-Romana | duel | Apenas família visual — contrato por definir |
| Luta Livre Olímpica | duel | Apenas família visual — contrato por definir |
| Mergulho | measured | Apenas família visual — contrato por definir |
| Montanhismo | activity | Apenas família visual — contrato por definir |
| Motociclismo | race | Métricas-base de corrida — parcial |
| Motocross | race | Métricas-base de corrida — parcial |
| Motonáutica | race | Métricas-base de corrida — parcial |
| Mountain Bike | race | Métricas-base de corrida — parcial |
| Muay Thai | duel | Apenas família visual — contrato por definir |
| Musculação | activity | Apenas família visual — contrato por definir |
| Natação | race | Métricas-base de corrida — parcial |
| Natação Artística | judged | Tipos de prova explícitos — parcial |
| Natação em Águas Abertas | race | Métricas-base de corrida — parcial |
| Orientação | race | Métricas-base de corrida — parcial |
| Padel | duel | Sets singulares/pares — parcial |
| Paraquedismo | judged | Apenas família visual — contrato por definir |
| Parkour | judged | Tipos de prova explícitos — parcial |
| Patinagem | measured | Apenas família visual — contrato por definir |
| Patinagem Artística | judged | Apenas família visual — contrato por definir |
| Patinagem de Velocidade | race | Métricas-base de corrida — parcial |
| Pentatlo Moderno | race | Métricas-base de corrida — parcial |
| Pesca Desportiva | score | Apenas família visual — contrato por definir |
| Petanca | duel | Apenas família visual — contrato por definir |
| Pickleball | duel | Sets singulares/pares — parcial |
| Pilates | activity | Apenas família visual — contrato por definir |
| Polo Aquático | team | Confronto genérico — sem regras específicas |
| Powerlifting | measured | Apenas família visual — contrato por definir |
| Remo | race | Métricas-base de corrida — parcial |
| Rugby | team | Confronto genérico — sem regras específicas |
| Rugby Sevens | team | Confronto genérico — sem regras específicas |
| Skate | judged | Tipos de prova explícitos — parcial |
| Snowboard | judged | Tipos de prova explícitos — parcial |
| Softbol | team | Confronto genérico — sem regras específicas |
| Squash | duel | Sets singulares/pares — parcial |
| Stand Up Paddle | judged | Apenas família visual — contrato por definir |
| Surf | judged | Tipos de prova explícitos — parcial |
| Teqball | duel | Apenas família visual — contrato por definir |
| Taekwondo | duel | Apenas família visual — contrato por definir |
| Ténis | duel | Sets singulares/pares — parcial |
| Ténis de praia | duel | Sets singulares/pares — parcial |
| Ténis de mesa | duel | Sets singulares/pares — parcial |
| Tiro | score | Apenas família visual — contrato por definir |
| Tiro com Arco | score | Apenas família visual — contrato por definir |
| Trail Running | race | Métricas-base de corrida — parcial |
| Trampolim | judged | Tipos de prova explícitos — parcial |
| Triatlo | race | Métricas-base de corrida — parcial |
| Vela | race | Métricas-base de corrida — parcial |
| Voo Livre | measured | Apenas família visual — contrato por definir |
| Voleibol | team | Confronto genérico — sem regras específicas |
| Voleibol de Praia | team | Confronto genérico — sem regras específicas |
| Xadrez | duel | Apenas família visual — contrato por definir |
| Yoga | activity | Apenas família visual — contrato por definir |

## Incrementos prioritários sugeridos

1. **Resultados coletivos não futebolísticos:** Basquetebol/3x3 (pontos), Voleibol (sets e pontos de set), Andebol (golos), Rugby/Rugby Sevens (pontuação própria). Não aplicar uma semântica de golos/assistências comum a 23 modalidades.
2. **Resultados por tentativas/acumulados:** Golfe (tacadas/buracos), Bowling (frames/pinos), Tiro/Tiro com Arco (séries), Halterofilismo e Powerlifting (cargas/tentativas).
3. **Provas de corrida multivariantes:** Natação (distância/estilo/séries), Ciclismo (pista vs estrada), Triatlo (segmentos), Orientação (percurso). A classificação por tempos não equivale automaticamente ao regulamento completo.
4. **Duelos restantes:** Boxe/Judo/Esgrima/Xadrez e semelhantes têm resultado próprio, e não devem assumir sets de ténis.
5. **Atividades sem vencedor:** Yoga, Pilates, Caminhada, Ginásio e outras devem registar participação/progresso sem inventar vitórias.

### Critérios de conclusão por modalidade

Cada formato só fica marcado como **funcionalmente validado** depois de: contrato BE/FE coerente, regras de validação específicas, resultado e histórico visíveis em PT/EN, testes Java+Angular, migração segura se aplicável, CI verde, deploy LIVE confirmado e QA desktop autenticado. **Preservar sempre histórico e ausência de resultados sem gerar pontos fictícios.**

## Notas de manutenção

- **Nunca** deduzir cobertura funcional a partir de `formatForSport` ou da existência de um nome em `SPORTS_CATALOG`.
- Os conjuntos/múltiplas equipas já existentes são pontuados uma vez por grupo, não por atleta.
- Um novo desporto exige atualizações coordenadas nos catálogos FE e BE.
- Repetir esta auditoria antes de declarar que **121/121 têm resultados desportivos adequados**.
