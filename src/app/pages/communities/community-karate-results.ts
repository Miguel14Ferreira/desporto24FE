import { CommunityRoundEntryDraft } from '../model/community-group';

/** WKF 2026 individual-result summary. No automatic refereeing, kata sum or season points. */
export function isKarateEvent(type: string | null | undefined): boolean {
  return type === 'KARATE_KUMITE_POINTS' || type === 'KARATE_KUMITE_SENSHU'
    || type === 'KARATE_KUMITE_HANTEI' || type === 'KARATE_KATA_JUDGES';
}

export function isKarateKumite(type: string | null | undefined): boolean {
  return isKarateEvent(type) && type !== 'KARATE_KATA_JUDGES';
}

export function karateBoutError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'team' | 'result' | 'performanceValue'>[]
): boolean {
  if (!isKarateEvent(type) || entries.length !== 2) return true;
  const aka = entries.find(e => e.team === 'AKA');
  const ao = entries.find(e => e.team === 'AO');
  if (!aka || !ao || !((aka.result === 'WIN' && ao.result === 'LOSS')
    || (aka.result === 'LOSS' && ao.result === 'WIN'))) return true;
  if (!isKarateKumite(type)) return entries.some(e => e.performanceValue != null);
  const a = aka.performanceValue, b = ao.performanceValue;
  if (a == null || b == null
    || !Number.isInteger(Number(a)) || !Number.isInteger(Number(b))
    || Number(a) < 0 || Number(b) < 0 || Number(a) > 999999 || Number(b) > 999999) return true;
  if (type === 'KARATE_KUMITE_POINTS') {
    return Number(a) === Number(b)
      || (Number(a) > Number(b) ? aka.result !== 'WIN' : ao.result !== 'WIN');
  }
  return Number(a) !== Number(b)
    || (type === 'KARATE_KUMITE_SENSHU' && Number(a) === 0);
}
