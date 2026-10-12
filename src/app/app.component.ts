import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthenticationService } from './services/authethication.service';
import { PilotAnalyticsService } from './services/pilot-analytics.service';
import { appTranslate as t } from './i18n/i18n.service';
import { takeRegistrationDestination } from './shared/registration-return-url';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit {
  title = 'desporto24';

  constructor(
    private router: Router,
    private authenticationService: AuthenticationService,
    private pilotAnalyticsService: PilotAnalyticsService
  ) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.pilotAnalyticsService.recordFirstAccess(params.get('cohort'));

    const token = params.get('confirmRegistration');

    if (!token) {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    this.authenticationService.confirmRegistration(token).subscribe({
      next: response => {
        sessionStorage.setItem(
          'auth-success-message',
          t('feedback.confirm.successLogin')
        );
        const destination = takeRegistrationDestination();
        if (destination) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: destination } });
        } else {
          this.router.navigateByUrl('/login');
        }
      },
      error: error => {
        const apiMessage = error?.error?.message;
        sessionStorage.setItem(
          'auth-error-message',
          typeof apiMessage === 'string' && apiMessage.trim()
            ? apiMessage
            : t('feedback.confirm.error')
        );
        this.router.navigateByUrl('/login');
      }
    });
  }
}
