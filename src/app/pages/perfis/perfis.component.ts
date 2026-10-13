import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, forkJoin, of, retry, Subscription, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityProfile } from '../model/community-profile';
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
export class PerfisComponent implements OnInit, OnDestroy {
  searchTerm = '';
  sportFilter = '';
  locationFilter = '';
  minAge: number | null = null;
  maxAge: number | null = null;
  levelFilter = '';
  readonly sportsCatalog = SPORTS_CATALOG;

  private searchSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private profileSubscription?: Subscription;
  private detailSubscription?: Subscription;
  profilePage = false;
  backToFriends = false;
  get backToFeed(): boolean {
    return this.route.snapshot.queryParamMap.get('from') === 'feed';
  }

  profiles: CommunityProfile[] = [];
  selectedProfile?: CommunityProfile;
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
    private socialGraphService: SocialGraphService,
    private route: ActivatedRoute
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  ngOnInit(): void {
    this.backToFriends = this.route.snapshot.queryParamMap.get('from') === 'friends';
    this.loadFriendUsernames();
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const username = params.get('username');
      this.profilePage = Boolean(username);
      if (username) {
        this.loadProfile(username);
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.profileSubscription?.unsubscribe();
    this.detailSubscription?.unsubscribe();
  }

  private loadFriendUsernames(): void {
    this.communityService.friends()
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
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
      this.clearSearch();
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

    this.searchSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.actionError = '';
    this.actionSuccess = '';

    this.searchSubscription = this.communityService.findProfiles({
      name: this.searchTerm.trim() || undefined,
      sport: this.sportFilter.trim() || undefined,
      location: this.locationFilter.trim() || undefined,
      minAge: this.minAge === null ? undefined : this.minAge,
      maxAge: this.maxAge === null ? undefined : this.maxAge,
      skillLevel: this.levelFilter || undefined
    })
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
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
    this.searchSubscription?.unsubscribe();
    this.loading = false;
    this.profiles = [];
    this.searched = false;
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
  }

  private loadProfile(username: string): void {
    this.profileSubscription?.unsubscribe();
    this.detailSubscription?.unsubscribe();
    this.closeProfile();
    this.loading = true;
    this.errorMessage = '';
    this.actionError = '';
    this.actionSuccess = '';
    this.profileSubscription = this.communityService.publicProfile(username)
      .pipe(timeout(10_000), finalize(() => this.loading = false))
      .subscribe({
        next: profile => this.showProfile(profile),
        error: error => {
          this.errorMessage = this.errorFrom(error, t('community.profileLoadError'));
        }
      });
  }

  private showProfile(profile: CommunityProfile): void {
    this.selectedProfile = profile;
    this.selectedActivity = undefined;
    this.selectedFollowStatus = undefined;
    this.selectedBlocked = false;
    this.reportOpen = false;
    this.reportReason = '';
    this.actionError = '';
    this.actionSuccess = '';

    this.detailSubscription = forkJoin({
      activity: this.reliabilityService.activity(profile.username)
        .pipe(catchError(() => of(undefined))),
      followStatus: this.socialGraphService.status(profile.username)
        .pipe(catchError(() => of(undefined))),
      blockStatus: this.communityService.userBlockStatus(profile.username)
        .pipe(catchError(() => of({ blocked: false })))
    })
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
        next: ({ activity, followStatus, blockStatus }) => {
          this.selectedActivity = activity;
          this.selectedFollowStatus = followStatus;
          this.selectedBlocked = blockStatus.blocked;
        },
        error: () => {
          this.actionError = t('community.profileDetailsError');
        }
      });
  }

  closeProfile(): void {
    this.selectedProfile = undefined;
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
      .pipe(
        timeout(10_000),
        finalize(() => this.blockLoading = false)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.reportLoading = false)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.followLoading = false)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoading = false)
      )
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
