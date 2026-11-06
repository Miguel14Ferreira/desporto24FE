import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface TournamentIneligibleEntry {
  profileId: number;
  teamId: number | null;
  participantStatus: 'PENDING' | 'CONFIRMED' | null;
  suspendedUntil: string;
}

export interface TournamentEligibilityOverview {
  tournamentId: number;
  entryType: 'INDIVIDUAL' | 'TEAM';
  checkedAt: string;
  ineligibleEntries: TournamentIneligibleEntry[];
}

@Injectable({ providedIn: 'root' })
export class CommunityTournamentEligibilityService {
  constructor(private readonly http: HttpClient) {}

  overview(communityId: number, tournamentId: number): Observable<TournamentEligibilityOverview> {
    return this.http.get<TournamentEligibilityOverview>(
      `${environment.apiUrl}/api/communities/${communityId}/tournaments/${tournamentId}/eligibility`);
  }
}
