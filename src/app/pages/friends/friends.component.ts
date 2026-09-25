import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FriendSummary } from '../model/friend-summary';
import { CommunityService } from '../../services/community.service';

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

  loading = false;
  actionLoadingUsername: string | null = null;
  pendingRemovalUsername: string | null = null;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  constructor(private communityService: CommunityService) {}

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
          this.errorMessage = 'Não foi possível carregar a tua lista de amigos.';
        }
      });
  }

  toggleBlock(friend: FriendSummary): void {
    if (this.actionLoadingUsername !== null) {
      return;
    }

    if (friend.chatBlocked && !friend.blockedByMe) {
      this.actionError = 'Este chat foi bloqueado pelo outro utilizador.';
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
            ? `Chat com ${friend.username} desbloqueado.`
            : `Chat com ${friend.username} bloqueado.`;
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            shouldUnblock
              ? 'Não foi possível desbloquear este chat.'
              : 'Não foi possível bloquear este chat.'
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
          this.actionSuccess = `${friend.username} foi removido da tua lista de amigos.`;
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            'Não foi possível remover este amigo.'
          );
        }
      });
  }

  profileImage(friend: FriendSummary): string | null {
    const path = friend.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(friend: FriendSummary): string {
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
