import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AuthenticationService } from '../../services/authethication.service';
import { MyProfileService } from '../../services/my-profile.service';
import { NotificationApiService } from '../../services/notification-api.service';
import { MyProfile } from '../model/my-profile';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class MenuComponent implements OnInit {
  profile?: MyProfile;

  unreadNotifications = 0;
  loadingProfile = false;
  loadingNotifications = false;
  loggingOut = false;
  errorMessage = '';

  constructor(
    private authenticationService: AuthenticationService,
    private myProfileService: MyProfileService,
    private notificationService: NotificationApiService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadNotifications();
  }

  loadProfile(): void {
    this.loadingProfile = true;
    this.errorMessage = '';

    this.myProfileService.get()
      .pipe(finalize(() => this.loadingProfile = false))
      .subscribe({
        next: profile => this.profile = profile,
        error: () => this.errorMessage = 'Não foi possível carregar o teu perfil.'
      });
  }

  loadNotifications(): void {
    this.loadingNotifications = true;

    this.notificationService.mine()
      .pipe(finalize(() => this.loadingNotifications = false))
      .subscribe({
        next: notifications => {
          this.unreadNotifications = notifications.filter(notification => !notification.read).length;
        },
        error: () => this.unreadNotifications = 0
      });
  }

  logout(): void {
    if (this.loggingOut) {
      return;
    }

    this.loggingOut = true;

    this.authenticationService.terminarSessao()
      .subscribe({
        next: () => this.authenticationService.logOut(),
        error: () => this.authenticationService.logOut()
      });
  }

  profileImage(): string | null {
    const path = this.profile?.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(): string {
    const source = this.profile?.fullName?.trim() || this.profile?.username || '?';

    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(value => value.charAt(0).toUpperCase())
      .join('');
  }
}
