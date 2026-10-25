import { HistoricalMatchArchive } from '../../services/community-groups.service';
import {
  isHistoricalFinalRound, isQuarterfinalRound, isSemifinalRound
} from './community-historical-tournament-outcome';

export type HistoricalMatchReviewFlag = 'possible-duplicate' | 'tied-knockout';

/**
 * Flags observations in the unmodified imported spreadsheet. A flagged row is
 * not automatically an invalid result and this does not establish who advanced.
 * Ordinary league draws and unlabelled knockout rounds are never reclassified.
 */
export function historicalMatchReviewFlags(
  row: HistoricalMatchArchive['rows'][number],
  knockout: boolean
): HistoricalMatchReviewFlag[] {
  const result: HistoricalMatchReviewFlag[] = [];
  if (row.potentialDuplicate) result.push('possible-duplicate');
  if (knockout && row.homeScore === row.awayScore
    && (isQuarterfinalRound(row.sourceRound)
      || isSemifinalRound(row.sourceRound)
      || isHistoricalFinalRound(row.sourceRound))) {
    result.push('tied-knockout');
  }
  return result;
}
