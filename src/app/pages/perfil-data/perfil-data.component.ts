import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { forkJoin, finalize, of, catchError } from 'rxjs';

import { environment } from 'src/environment/environment';
import { MyProfile, ProfileActivity } from '../model/my-profile';
import { ReliabilitySummary } from '../model/reliability-summary';
import { MyProfileService } from '../../services/my-profile.service';
import { ReliabilityService } from '../../services/reliability.service';
import { sportIcon } from '../../shared/sports-catalog';
import { calculateProfileCompletion } from '../../shared/profile-completion';

@Component({
  selector: 'app-perfil-data',
  templateUrl: './perfil-data.component.html',
  styleUrls: ['./perfil-data.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class PerfilDataComponent implements OnInit {
  profile?: MyProfile;
  reliability?: ReliabilitySummary;
  activity?: ProfileActivity;
  loading = false;
  errorMessage = '';
  favoritesExpanded = false;
  readonly iconForSport = sportIcon;

  constructor(
    private myProfileService: MyProfileService,
    private reliabilityService: ReliabilityService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.myProfileService.get()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: profile => {
          this.profile = profile;
          this.loadReliability(profile.username);
          this.loadActivity(profile.username);
        },
        error: () => this.errorMessage = t('feedback.profile.loadError')
      });
  }

  get profileCompletion() {
    return calculateProfileCompletion(this.profile);
  }

  get completionMissingPreview() {
    return this.profileCompletion.missing.slice(0, 3);
  }

  get favoriteSports(): string[] {
    return (this.profile?.favoriteSports || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  }

  get visibleFavoriteSports(): string[] {
    return this.favoritesExpanded
      ? this.favoriteSports
      : this.favoriteSports.slice(0, 5);
  }

  get hiddenFavoriteSportsCount(): number {
    return Math.max(0, this.favoriteSports.length - 5);
  }

  toggleFavoriteSports(): void {
    this.favoritesExpanded = !this.favoritesExpanded;
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

  private loadActivity(username: string): void {
    this.reliabilityService.activity(username)
      .pipe(catchError(() => of(undefined)))
      .subscribe(activity => this.activity = activity);
  }

  private loadReliability(username: string): void {
    this.reliabilityService.summary(username)
      .pipe(catchError(() => of(undefined)))
      .subscribe(summary => this.reliability = summary);
  }
}
