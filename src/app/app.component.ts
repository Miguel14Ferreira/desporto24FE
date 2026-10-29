import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';

import { AuthenticationService } from './services/authethication.service';
import { PilotAnalyticsService } from './services/pilot-analytics.service';
import { OnlinePresenceService } from './services/online-presence.service';
import { appTranslate as t } from './i18n/i18n.service';
import { registrationSessionReturnUrl, registrationCommunityReturnUrl, takeRegistrationDestination } from './shared/registration-return-url';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('callOverlayOutlet', { read: ViewContainerRef })
  private callOverlayOutlet?: ViewContainerRef;
  private disposed=false;
  title = 'desporto24';

  constructor(
    private router: Router,
    private authenticationService: AuthenticationService,
    private pilotAnalyticsService: PilotAnalyticsService,
    private onlinePresence: OnlinePresenceService
  ) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.pilotAnalyticsService.recordFirstAccess(params.get('cohort'));
    this.onlinePresence.start();

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
        this.navigateToLoginAfterConfirmation(params);
      },
      error: error => {
        const apiMessage = error?.error?.message;
        sessionStorage.setItem(
          'auth-error-message',
          typeof apiMessage === 'string' && apiMessage.trim()
            ? apiMessage
            : t('feedback.confirm.error')
        );
        this.navigateToLoginAfterConfirmation(params);
      }
    });
  }

  ngAfterViewInit(): void {
    // Do not include the meeting UI and its styles in the initial Angular
    // bundle. Load immediately after boot, so incoming call invitations still
    // have a global route-independent surface.
    void import('./shared/direct-call-overlay.component').then(({DirectCallOverlayComponent}) => {
      if (!this.disposed && this.callOverlayOutlet) {
        this.callOverlayOutlet.createComponent(DirectCallOverlayComponent);
      }
    }).catch(() => {
      // A transient chunk download failure must not crash the rest of Jynlo.
    });
  }

  ngOnDestroy(): void {
    this.disposed=true;
    this.onlinePresence.stop();
  }

  private navigateToLoginAfterConfirmation(params: URLSearchParams): void {
    const destinationFromEmail = registrationSessionReturnUrl(params.get('returnSessionId'))
      ?? registrationCommunityReturnUrl(params.get('returnCommunityId'));
    const destinationFromBrowser = takeRegistrationDestination();
    const destination = destinationFromEmail ?? destinationFromBrowser;
    if (destination) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: destination } });
    } else {
      this.router.navigateByUrl('/login');
    }
  }
}
