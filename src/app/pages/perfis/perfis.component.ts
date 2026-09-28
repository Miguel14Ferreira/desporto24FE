import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityProfile } from '../model/community-profile';
import { ReliabilitySummary } from '../model/reliability-summary';
import { ProfileActivity } from '../model/my-profile';
import { CommunityService } from '../../services/community.service';
import { AuthenticationService } from '../../services/authethication.service';
import { ReliabilityService } from '../../services/reliability.service';

@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PerfisComponent implements OnInit {
  searchTerm = '';
  profiles: CommunityProfile[] = [];
  selectedProfile?: CommunityProfile;
  selectedReliability?: ReliabilitySummary;
  selectedActivity?: ProfileActivity;

  loading = false;
  actionLoading = false;
  searched = false;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  currentUsername = '';
  pendingFriendRequests = new Set<string>();
  friendUsernames = new Set<string>();

  constructor(
    private communityService: CommunityService,
    private authenticationService: AuthenticationService,
    private reliabilityService: ReliabilityService
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  ngOnInit(): void {
    this.loadFriendUsernames();
    this.loadDiscoverableProfiles();
  }

  private loadFriendUsernames(): void {
    this.communityService.friends().subscribe({
      next: friends => {
        this.friendUsernames = new Set(
          friends.map(friend => friend.username.toLowerCase())
        );
      },
      error: () => {
        this.friendUsernames = new Set<string>();
      }
    });
  }

  private loadDiscoverableProfiles(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.discoverProfiles()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: profiles => {
          this.profiles = profiles;
          this.searched = false;
        },
        error: error => {
          this.profiles = [];
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.community.searchError')
          );
        }
      });
  }

  search(): void {
    const term = this.searchTerm.trim();

    if (!term) {
      this.selectedProfile = undefined;
      this.actionError = '';
      this.actionSuccess = '';
      this.loadDiscoverableProfiles();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.actionError = '';
    this.actionSuccess = '';

    this.communityService.searchProfiles(term)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: profiles => {
          this.profiles = profiles;
          this.searched = true;
          this.selectedProfile = undefined;
        },
        error: error => {
          this.profiles = [];
          this.searched = true;
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.community.searchError')
          );
        }
      });
  }

  openProfile(profile: CommunityProfile): void {
    this.selectedProfile = profile;
    this.selectedReliability = undefined;
    this.selectedActivity = undefined;
    this.actionError = '';
    this.actionSuccess = '';

    forkJoin({
      reliability: this.reliabilityService.summary(profile.username)
        .pipe(catchError(() => of(undefined))),
      activity: this.reliabilityService.activity(profile.username)
        .pipe(catchError(() => of(undefined)))
    }).subscribe(({ reliability, activity }) => {
      this.selectedReliability = reliability;
      this.selectedActivity = activity;
    });
  }

  closeProfile(): void {
    this.selectedProfile = undefined;
    this.selectedReliability = undefined;
    this.selectedActivity = undefined;
  }

  sendFriendRequest(profile: CommunityProfile): void {
    if (
      this.actionLoading
      || this.isOwnProfile(profile)
      || this.isFriend(profile)
      || this.pendingFriendRequests.has(profile.username)
    ) {
      return;
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.communityService.sendFriendRequest(profile.username)
      .pipe(finalize(() => this.actionLoading = false))
      .subscribe({
        next: () => {
          this.pendingFriendRequests.add(profile.username);
          this.actionSuccess = t('feedback.community.requestSent', { username: profile.username });
        },
        error: error => {
          const message = this.errorFrom(
            error,
            t('feedback.community.requestError')
          );

          if (message.toLowerCase().includes('pendente')) {
            this.pendingFriendRequests.add(profile.username);
          }

          this.actionError = message;
        }
      });
  }

  isOwnProfile(profile: CommunityProfile): boolean {
    return profile.username === this.currentUsername;
  }

  friendRequestPending(profile: CommunityProfile): boolean {
    return this.pendingFriendRequests.has(profile.username);
  }

  isFriend(profile: CommunityProfile): boolean {
    return this.friendUsernames.has(profile.username.toLowerCase());
  }

  profileImage(profile: CommunityProfile): string | null {
    const path = profile.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(profile: CommunityProfile): string {
    const source = profile.nickname?.trim()
      || profile.fullName?.trim()
      || profile.username;
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(value => value.charAt(0).toUpperCase())
      .join('');
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
