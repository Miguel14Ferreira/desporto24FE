import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { forkJoin, finalize, of, catchError } from 'rxjs';

import { environment } from 'src/environment/environment';
import { MyProfile } from '../model/my-profile';
import { ReliabilitySummary } from '../model/reliability-summary';
import { MyProfileService } from '../../services/my-profile.service';
import { ReliabilityService } from '../../services/reliability.service';

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
  loading = false;
  errorMessage = '';

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
        },
        error: () => this.errorMessage = 'Não foi possível carregar o teu perfil.'
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

  private loadReliability(username: string): void {
    this.reliabilityService.summary(username)
      .pipe(catchError(() => of(undefined)))
      .subscribe(summary => this.reliability = summary);
  }
}
