import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityProfile } from '../model/community-profile';
import { CommunityService } from '../../services/community.service';
import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PerfisComponent {
  searchTerm = '';
  profiles: CommunityProfile[] = [];
  selectedProfile?: CommunityProfile;

  loading = false;
  actionLoading = false;
  searched = false;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  currentUsername = '';
  pendingFriendRequests = new Set<string>();

  constructor(
    private communityService: CommunityService,
    private authenticationService: AuthenticationService
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  search(): void {
    const term = this.searchTerm.trim();

    if (!term) {
      this.errorMessage = t('feedback.community.searchRequired');
      this.profiles = [];
      this.searched = false;
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
    this.actionError = '';
    this.actionSuccess = '';
  }

  closeProfile(): void {
    this.selectedProfile = undefined;
  }

  sendFriendRequest(profile: CommunityProfile): void {
    if (
      this.actionLoading
      || this.isOwnProfile(profile)
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
    const source = profile.fullName?.trim() || profile.username;
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
