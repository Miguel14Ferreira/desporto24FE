/**
 * Display-only terminology for the existing numeric, individual round-robin
 * API. Backend DTO fields remain goalsFor/goalsAgainst for compatibility.
 * This does NOT imply sets-by-set, doubles or team tournament support.
 */
export interface TournamentScoreTerminology {
  scoreInput: string;
  forTitle: string;
  againstTitle: string;
  differenceTitle: string;
  forAbbrev: string;
  againstAbbrev: string;
  differenceAbbrev: string;
  note: string;
}

const SHARED_LIMIT = 'Formato atual: confrontos entre participantes individuais, com um marcador numérico por encontro. Ainda não suporta pares, equipas nem provas por tempos ou distâncias; os critérios de desempate são genéricos.';

const GOALS: TournamentScoreTerminology = {
  scoreInput: 'Golos de',
  forTitle: 'Golos marcados', againstTitle: 'Golos sofridos',
  differenceTitle: 'Diferença de golos',
  forAbbrev: 'GM', againstAbbrev: 'GS', differenceAbbrev: 'DG',
  note: SHARED_LIMIT
};
const POINTS: TournamentScoreTerminology = {
  scoreInput: 'Pontos de',
  forTitle: 'Pontos marcados', againstTitle: 'Pontos sofridos',
  differenceTitle: 'Diferença de pontos',
  forAbbrev: 'PM', againstAbbrev: 'PS', differenceAbbrev: 'DP',
  note: SHARED_LIMIT
};
const SETS: TournamentScoreTerminology = {
  scoreInput: 'Sets ganhos de',
  forTitle: 'Sets ganhos', againstTitle: 'Sets perdidos',
  differenceTitle: 'Diferença de sets',
  forAbbrev: 'SG', againstAbbrev: 'SP', differenceAbbrev: 'DS',
  note: 'Formato atual: apenas o total de sets ganhos por participante em cada confronto. Não regista o resultado de cada set nem organiza pares/equipas. As regras de vitória e desempate por modalidade ainda serão configuráveis.'
};
const GENERIC: TournamentScoreTerminology = {
  scoreInput: 'Marcador de',
  forTitle: 'Marcador a favor', againstTitle: 'Marcador contra',
  differenceTitle: 'Diferença de marcadores',
  forAbbrev: 'MF', againstAbbrev: 'MC', differenceAbbrev: 'DM',
  note: SHARED_LIMIT + ' Confirma se o marcador numérico faz sentido para a tua modalidade antes de organizar uma liga.'
};

export function tournamentScoreTerminology(sport: string | null | undefined): TournamentScoreTerminology {
  const normalized = (sport || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  // American football must be recognized before the broader word "futebol".
  if (/\b(futebol americano|american football|rugby|basquetebol|basquete|basketball|streetball)\b/.test(normalized)
      || /\b3x3\b/.test(normalized)) return POINTS;
  if (/\b(futebol|futsal|football|soccer|andebol|handball|hoquei|hockey|polo aquatico)\b/.test(normalized)) return GOALS;
  if (/\b(padel|tenis|tennis|voleibol|volleyball|badminton|squash|ping.?pong)\b/.test(normalized)) return SETS;
  return GENERIC;
}
