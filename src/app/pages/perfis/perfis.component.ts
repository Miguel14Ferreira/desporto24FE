import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityProfile } from '../model/community-profile';
import { ReliabilitySummary } from '../model/reliability-summary';
import { ProfileActivity } from '../model/my-profile';
import { FollowStatus } from '../model/follow';
import { CommunityService } from '../../services/community.service';
import { AuthenticationService } from '../../services/authethication.service';
import { ReliabilityService } from '../../services/reliability.service';
import { SocialGraphService } from '../../services/social-graph.service';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PerfisComponent implements OnInit {
  searchTerm = '';
  sportFilter = '';
  locationFilter = '';
  minAge: number | null = null;
  maxAge: number | null = null;
  levelFilter = '';
  readonly sportsCatalog = SPORTS_CATALOG;

  profiles: CommunityProfile[] = [];
  selectedProfile?: CommunityProfile;
  selectedReliability?: ReliabilitySummary;
  selectedActivity?: ProfileActivity;
  selectedFollowStatus?: FollowStatus;

  loading = false;
  actionLoading = false;
  followLoading = false;
  reportLoading = false;
  blockLoading = false;
  selectedBlocked = false;
  reportOpen = false;
  reportReason = '';
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
    private reliabilityService: ReliabilityService,
    private socialGraphService: SocialGraphService
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  ngOnInit(): void {
    this.loadFriendUsernames();
    this.prefillSearchFromProfile();
    this.loadDiscoverableProfiles();
  }

  private prefillSearchFromProfile(): void {
    if (!this.currentUsername) {
      return;
    }

    this.communityService.publicProfile(this.currentUsername).subscribe({
      next: profile => {
        if (!this.sportFilter && profile.favoriteSports) {
          this.sportFilter = profile.favoriteSports
            .split(',')
            .map(value => value.trim())
            .find(Boolean) || '';
        }

        if (!this.locationFilter && profile.location) {
          this.locationFilter = profile.location;
        }

        if (!this.levelFilter && profile.skillLevel) {
          this.levelFilter = profile.skillLevel;
        }

        if (profile.age !== null && profile.age !== undefined) {
          this.minAge ??= Math.max(18, profile.age - 10);
          this.maxAge ??= Math.min(99, profile.age + 10);
        }
      },
      error: () => {
        // Discovery still works without pre-filling the form.
      }
    });
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
    const hasFilters = Boolean(
      this.searchTerm.trim()
      || this.sportFilter.trim()
      || this.locationFilter.trim()
      || this.levelFilter.trim()
      || this.minAge !== null
      || this.maxAge !== null
    );

    if (!hasFilters) {
      this.selectedProfile = undefined;
      this.actionError = '';
      this.actionSuccess = '';
      this.loadDiscoverableProfiles();
      return;
    }

    if (
      this.minAge !== null
      && this.maxAge !== null
      && this.minAge > this.maxAge
    ) {
      this.errorMessage = t('feedback.community.invalidAgeRange');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.actionError = '';
    this.actionSuccess = '';

    this.communityService.findProfiles({
      name: this.searchTerm.trim() || undefined,
      sport: this.sportFilter.trim() || undefined,
      location: this.locationFilter.trim() || undefined,
      minAge: this.minAge === null ? undefined : this.minAge,
      maxAge: this.maxAge === null ? undefined : this.maxAge,
      skillLevel: this.levelFilter || undefined
    })
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

  clearSearch(): void {
    this.searchTerm = '';
    this.sportFilter = '';
    this.locationFilter = '';
    this.minAge = null;
    this.maxAge = null;
    this.levelFilter = '';
    this.selectedProfile = undefined;
    this.errorMessage = '';
    this.actionError = '';
    this.actionSuccess = '';
    this.loadDiscoverableProfiles();
  }

  openProfile(profile: CommunityProfile): void {
    this.selectedProfile = profile;
    this.selectedReliability = undefined;
    this.selectedActivity = undefined;
    this.selectedFollowStatus = undefined;
    this.selectedBlocked = false;
    this.reportOpen = false;
    this.reportReason = '';
    this.actionError = '';
    this.actionSuccess = '';

    forkJoin({
      reliability: this.reliabilityService.summary(profile.username)
        .pipe(catchError(() => of(undefined))),
      activity: this.reliabilityService.activity(profile.username)
        .pipe(catchError(() => of(undefined))),
      followStatus: this.socialGraphService.status(profile.username)
        .pipe(catchError(() => of(undefined))),
      blockStatus: this.communityService.userBlockStatus(profile.username)
        .pipe(catchError(() => of({ blocked: false })))
    }).subscribe(({ reliability, activity, followStatus, blockStatus }) => {
      this.selectedReliability = reliability;
      this.selectedActivity = activity;
      this.selectedFollowStatus = followStatus;
      this.selectedBlocked = blockStatus.blocked;
    });
  }

  closeProfile(): void {
    this.selectedProfile = undefined;
    this.selectedReliability = undefined;
    this.selectedActivity = undefined;
    this.selectedFollowStatus = undefined;
    this.selectedBlocked = false;
    this.reportOpen = false;
    this.reportReason = '';
  }

  toggleBlock(profile: CommunityProfile): void {
    if (
      this.blockLoading
      || this.isOwnProfile(profile)
    ) {
      return;
    }

    this.blockLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    const request$ = this.selectedBlocked
      ? this.communityService.unblockUser(profile.username)
      : this.communityService.blockUser(profile.username);

    request$
      .pipe(finalize(() => this.blockLoading = false))
      .subscribe({
        next: status => {
          this.selectedBlocked = status.blocked;

          if (status.blocked) {
            this.selectedFollowStatus = undefined;
            this.friendUsernames.delete(profile.username.toLowerCase());
            this.pendingFriendRequests.delete(profile.username);
            this.reportOpen = false;
            this.reportReason = '';
          }

          this.actionSuccess = status.blocked
            ? t('feedback.community.blocked', { username: profile.username })
            : t('feedback.community.unblocked', { username: profile.username });
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.community.blockError')
          );
        }
      });
  }

  toggleReport(): void {
    if (this.reportLoading) {
      return;
    }

    this.reportOpen = !this.reportOpen;
    this.reportReason = '';
    this.actionError = '';
    this.actionSuccess = '';
  }

  submitReport(profile: CommunityProfile): void {
    const reason = this.reportReason.trim();

    if (
      this.reportLoading
      || this.isOwnProfile(profile)
      || this.selectedBlocked
      || !reason
    ) {
      return;
    }

    this.reportLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.communityService.reportUser(profile.username, reason)
      .pipe(finalize(() => this.reportLoading = false))
      .subscribe({
        next: () => {
          this.reportOpen = false;
          this.reportReason = '';
          this.actionSuccess = t('feedback.community.reported', { username: profile.username });
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.community.reportError')
          );
        }
      });
  }

  toggleFollow(profile: CommunityProfile): void {
    if (
      this.followLoading
      || this.isOwnProfile(profile)
      || this.selectedBlocked
    ) {
      return;
    }

    this.followLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    const request$ = this.selectedFollowStatus?.followedByMe
      ? this.socialGraphService.unfollow(profile.username)
      : this.socialGraphService.follow(profile.username);

    request$
      .pipe(finalize(() => this.followLoading = false))
      .subscribe({
        next: status => {
          this.selectedFollowStatus = status;
          this.actionSuccess = status.followedByMe
            ? t('feedback.social.followed', { username: profile.username })
            : t('feedback.social.unfollowed', { username: profile.username });
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.social.followError')
          );
        }
      });
  }

  sendFriendRequest(profile: CommunityProfile): void {
    if (
      this.actionLoading
      || this.isOwnProfile(profile)
      || this.selectedBlocked
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
