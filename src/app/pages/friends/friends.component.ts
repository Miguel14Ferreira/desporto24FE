import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FriendSummary } from '../model/friend-summary';
import { CommunityProfile } from '../model/community-profile';
import { ReliabilitySummary } from '../model/reliability-summary';
import { CommunityService } from '../../services/community.service';
import { ReliabilityService } from '../../services/reliability.service';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class FriendsComponent implements OnInit {
  friends: FriendSummary[] = [];
  filter = '';
  selectedProfile?: CommunityProfile;
  selectedReliability?: ReliabilitySummary;
  profileLoading = false;

  loading = false;
  actionLoadingUsername: string | null = null;
  pendingRemovalUsername: string | null = null;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  constructor(
    private communityService: CommunityService,
    private reliabilityService: ReliabilityService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredFriends(): FriendSummary[] {
    const term = this.filter.trim().toLowerCase();
    if (!term) {
      return this.friends;
    }

    return this.friends.filter(friend =>
      friend.username.toLowerCase().includes(term)
      || (friend.fullName ?? '').toLowerCase().includes(term)
      || (friend.location ?? '').toLowerCase().includes(term)
    );
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.friends()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: friends => this.friends = friends,
        error: () => {
          this.friends = [];
          this.errorMessage = t('feedback.friends.loadError');
        }
      });
  }

  openProfile(friend: FriendSummary): void {
    this.profileLoading = true;
    this.selectedProfile = undefined;
    this.selectedReliability = undefined;

    forkJoin({
      profile: this.communityService.publicProfile(friend.username),
      reliability: this.reliabilityService.summary(friend.username)
    })
      .pipe(finalize(() => this.profileLoading = false))
      .subscribe({
        next: result => {
          this.selectedProfile = result.profile;
          this.selectedReliability = result.reliability;
        },
        error: () => {
          this.communityService.publicProfile(friend.username).subscribe({
            next: profile => this.selectedProfile = profile
          });
        }
      });
  }

  closeProfile(): void {
    this.selectedProfile = undefined;
    this.selectedReliability = undefined;
  }

  toggleBlock(friend: FriendSummary): void {
    if (this.actionLoadingUsername !== null) {
      return;
    }

    if (friend.chatBlocked && !friend.blockedByMe) {
      this.actionError = t('feedback.chat.blockedOther');
      this.actionSuccess = '';
      return;
    }

    const shouldUnblock = friend.chatBlocked && friend.blockedByMe;
    const request$ = shouldUnblock
      ? this.communityService.unblockFriend(friend.username)
      : this.communityService.blockFriend(friend.username);

    this.actionLoadingUsername = friend.username;
    this.actionError = '';
    this.actionSuccess = '';

    request$
      .pipe(finalize(() => this.actionLoadingUsername = null))
      .subscribe({
        next: () => {
          friend.chatBlocked = !shouldUnblock;
          friend.blockedByMe = !shouldUnblock;
          this.actionSuccess = shouldUnblock
            ? t('feedback.friends.unblockedUser', { username: friend.username })
            : t('feedback.friends.blockedUser', { username: friend.username });
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            shouldUnblock
              ? t('feedback.chat.unblockError')
              : t('feedback.chat.blockError')
          );
        }
      });
  }

  requestRemove(friend: FriendSummary): void {
    if (this.actionLoadingUsername !== null) {
      return;
    }

    this.pendingRemovalUsername = friend.username;
    this.actionError = '';
    this.actionSuccess = '';
  }

  cancelRemove(): void {
    if (this.actionLoadingUsername !== null) {
      return;
    }

    this.pendingRemovalUsername = null;
  }

  confirmRemove(friend: FriendSummary): void {
    if (
      this.pendingRemovalUsername !== friend.username
      || this.actionLoadingUsername !== null
    ) {
      return;
    }

    this.actionLoadingUsername = friend.username;
    this.actionError = '';
    this.actionSuccess = '';

    this.communityService.removeFriend(friend.username)
      .pipe(finalize(() => this.actionLoadingUsername = null))
      .subscribe({
        next: () => {
          this.friends = this.friends.filter(item => item.username !== friend.username);
          this.pendingRemovalUsername = null;
          this.actionSuccess = t('feedback.friends.removed', { username: friend.username });
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.friends.removeError')
          );
        }
      });
  }

  profileImage(friend: FriendSummary | CommunityProfile): string | null {
    const path = friend.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(friend: FriendSummary | CommunityProfile): string {
    const source = friend.fullName?.trim() || friend.username;
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
