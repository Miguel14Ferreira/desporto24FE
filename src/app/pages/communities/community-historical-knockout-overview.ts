import { HistoricalMatchArchive } from '../../services/community-groups.service';
import {
  isHistoricalFinalRound, isQuarterfinalRound, isSemifinalRound
} from './community-historical-tournament-outcome';

export type HistoricalKnockoutPhaseId = 'quarterfinal' | 'semifinal' | 'final';

export interface HistoricalKnockoutPhaseOverview {
  phase: HistoricalKnockoutPhaseId;
  /** Source-labelled fixture count, including flagged possible duplicates. */
  matchCount: number;
  /** Single-leg reference only; not a claim about the original competition rules. */
  singleLegReference: 4 | 2 | 1;
  sourceLabels: string[];
  potentialDuplicates: number;
  drawnResults: number;
  /** Zero-based position in the original archive, not sourceRow (which may skip). */
  firstArchiveIndex: number | null;
  /** First page containing this explicitly labelled stage in the source order. */
  firstPage: number | null;
  requiresReview: boolean;
}

/**
 * Read-only navigation into source-labelled phases. Never reconstruct a bracket,
 * move original fixtures, treat missing labels as missing actual games, or
 * imply that the labelled games certify official progression or a champion.
 */
export function historicalKnockoutPhaseOverview(
  archive: HistoricalMatchArchive,
  pageSize = 50
): HistoricalKnockoutPhaseOverview[] {
  const result: HistoricalKnockoutPhaseOverview[] = [
    stage('quarterfinal', 4), stage('semifinal', 2), stage('final', 1)
  ];
  const recognizers = [isQuarterfinalRound, isSemifinalRound, isHistoricalFinalRound];

  archive.rows.forEach((row, index) => {
    const phaseIndex = recognizers.findIndex(check => check(row.sourceRound));
    if (phaseIndex < 0) return;
    const phase = result[phaseIndex];
    phase.matchCount++;
    if (phase.firstArchiveIndex === null) {
      phase.firstArchiveIndex = index;
      phase.firstPage = Math.floor(index / pageSize);
    }
    const label = row.sourceRound?.trim();
    if (label && !phase.sourceLabels.includes(label)) phase.sourceLabels.push(label);
    if (row.potentialDuplicate) phase.potentialDuplicates++;
    if (row.homeScore === row.awayScore) phase.drawnResults++;
  });

  for (const phase of result) {
    phase.requiresReview = phase.matchCount > 0
      && (phase.matchCount !== phase.singleLegReference
        || phase.potentialDuplicates > 0 || phase.drawnResults > 0);
  }
  return result;
}

function stage(phase: HistoricalKnockoutPhaseId, singleLegReference: 4 | 2 | 1):
HistoricalKnockoutPhaseOverview {
  return {
    phase, matchCount: 0, singleLegReference, sourceLabels: [],
    potentialDuplicates: 0, drawnResults: 0,
    firstArchiveIndex: null, firstPage: null, requiresReview: false
  };
}
