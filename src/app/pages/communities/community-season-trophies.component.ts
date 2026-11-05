import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunitySeason } from '../model/community-group';

/** Read-only champions history, never determines the official season winner. */
@Component({
  selector: 'app-community-season-trophies',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-season-trophies.component.html',
  styleUrls: ['./community-season-trophies.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunitySeasonTrophiesComponent {
  @Input() seasons: readonly CommunitySeason[] = [];

  get groupedSeasons(): CommunitySeasonTrophyGroup[] {
    return groupSeasonTrophies(this.seasons);
  }
}

export interface CommunitySeasonTrophyGroup {
  /** null is a legacy shared season, never assigned to an arbitrary sport. */
  sport: string | null;
  seasons: readonly CommunitySeason[];
}

/** Build a read-only, stable history; never mix distinct sport trophies. */
export function groupSeasonTrophies(
  seasons: readonly CommunitySeason[]
): CommunitySeasonTrophyGroup[] {
  const groups = new Map<string, { sport: string | null; seasons: CommunitySeason[] }>();
  const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  for (const season of seasons) {
    if (!hasRecordedSeasonChampion(season)) continue;
    const sport = season.sport?.trim() || null;
    const key = sport ? 'sport:' + normalize(sport) : 'shared';
    let group = groups.get(key);
    if (!group) {
      group = { sport, seasons: [] };
      groups.set(key, group);
    }
    group.seasons.push(season);
  }
  return Array.from(groups.values());
}

/** A race champion imported by name can exist without a linked account. */
export function hasRecordedSeasonChampion(
  season: Pick<CommunitySeason,'active'|'championUsername'|'championDisplayName'>
): boolean {
  return !season.active
    && Boolean(season.championUsername?.trim() || season.championDisplayName?.trim());
}
