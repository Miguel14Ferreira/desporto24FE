import { Component, ElementRef, HostListener, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { AppLanguage, I18nService } from 'src/app/i18n/i18n.service';
import { NotificationApiService } from 'src/app/services/notification-api.service';
import { DirectChatRealtimeService } from 'src/app/services/direct-chat-realtime.service';
import { Subscription, auditTime, filter, retry, timeout } from 'rxjs';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NavbarComponent implements OnInit, OnDestroy {

  dark!:boolean;
  escuro:string = "escuro";
  claro:string = "claro";
  unreadNotifications = 0;
  authenticated = false;
  admin = false;
  loggingOut = false;
  private notificationTimer?: ReturnType<typeof setInterval>;
  private unreadRequest?: Subscription;
  private readonly subscriptions = new Subscription();
  private readonly baseTabTitle = 'Jynlo — Join the game.';

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private router: Router,
    private authService: AuthenticationService,
    private notificationService: NotificationApiService,
    private realtimeService: DirectChatRealtimeService,
    private browserTitle: Title,
    public i18n: I18nService
  ) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
      this.syncAuthenticatedState();

      this.subscriptions.add(
        this.router.events
          .pipe(filter(event => event instanceof NavigationEnd))
          .subscribe(() => this.syncAuthenticatedState())
      );

      // A socket event is not necessarily a visible notification: chat alerts
      // may be disabled, already read, or suppressed by the server.
      // Coalesce bursts and ask the authoritative, preference-filtered endpoint.
      this.subscriptions.add(
        this.realtimeService.messages$.pipe(auditTime(300)).subscribe(() => {
          if (this.authenticated) this.loadUnreadNotifications();
        })
      );

      // A read, delete, friend-request action or saved preference changes the
      // server's unread count without a route change or socket event.
      this.subscriptions.add(
        this.notificationService.changes$.subscribe(() => {
          if (this.authenticated) this.loadUnreadNotifications();
        })
      );
    }

    ngOnDestroy(): void {
      this.subscriptions.unsubscribe();
      this.unreadRequest?.unsubscribe();
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
      }
      this.realtimeService.disconnect();
    }

    private syncAuthenticatedState(): void {
      this.authenticated = this.authService.hasSessionCandidate();
      this.admin = this.authenticated
        && this.authService.hasAnyRole('ROLE_ADMIN', 'ROLE_SUPER_ADMIN');

      if (!this.authenticated) {
        // The navbar persists across SPA logout -> login navigation. A previous
        // pending logout must not disable the button in the next session.
        this.loggingOut = false;
        this.realtimeService.disconnect();
        this.unreadRequest?.unsubscribe();
        this.unreadNotifications = 0;
        this.updateBrowserTabTitle();
        if (this.notificationTimer) {
          clearInterval(this.notificationTimer);
          this.notificationTimer = undefined;
        }
        return;
      }

      this.realtimeService.connect();

      if (!this.notificationTimer) {
        this.notificationTimer = setInterval(
          () => this.loadUnreadNotifications(),
          60000
        );
      }
      // Refresh when navigating back from alerts/settings instead of showing
      // a stale badge for another minute.
      this.loadUnreadNotifications();
    }

    loadUnreadNotifications(): void {
      if (!this.authenticated) return;
      // Discard older responses if a new refresh occurs (logout, navigation,
      // incoming chat message). They must not replace the latest server count.
      this.unreadRequest?.unsubscribe();
      this.unreadRequest = this.notificationService.unreadCount()
        .pipe(
          timeout(10_000),
          retry({ count: 1 })
        )
        .subscribe({
          next: count => {
            if (!this.authenticated || !Number.isFinite(count) || count < 0) return;
            // The same authoritative unread count drives both nav badge and tab.
            this.unreadNotifications = Math.floor(count);
            this.updateBrowserTabTitle();
          },
          // A transient request failure is not evidence that all alerts were read.
          error: () => {}
        });
    }
    
    /** Browser tab displays only the user's unread, in-app notifications. */
    private updateBrowserTabTitle(): void {
      const count = this.authenticated ? this.unreadNotifications : 0;
      const badge = count > 99 ? '99+' : String(count);
      const title = count > 0
        ? `Jynlo (${badge}) — Join the game.`
        : this.baseTabTitle;
      if (this.browserTitle.getTitle() !== title) {
        this.browserTitle.setTitle(title);
      }
    }

    // A user may have read notifications in a different tab.
    @HostListener('window:focus')
    refreshUnreadWhenFocused(): void {
      if (this.authenticated) this.loadUnreadNotifications();
    }

    DarkMode(){
      this.dark = true;
      localStorage.setItem('theme',this.escuro);
      location.reload();
    }
    LightMode(){
      this.dark = false;
      localStorage.setItem('theme',this.claro);
      location.reload();
    }
    setLanguage(language: AppLanguage): void {
      this.i18n.setLanguage(language);
    }

    @HostListener('document:click', ['$event'])
    closeAccountMenuOnOutsideClick(event: MouseEvent): void {
      if (this.elementRef.nativeElement.contains(event.target as Node)) {
        return;
      }
      this.closeAccountMenu();
    }

    @HostListener('document:keydown.escape')
    closeAccountMenuOnEscape(): void {
      this.closeAccountMenu();
    }

    closeAccountMenu(): void {
      this.elementRef.nativeElement
        .querySelector<HTMLDetailsElement>('.account-menu')
        ?.removeAttribute('open');
    }


    logout(): void {
      if (this.loggingOut) {
        return;
      }

      this.loggingOut = true;
      this.authService.terminarSessao()
        .pipe(timeout(10_000))
        .subscribe({
        next: () => this.authService.logOut(),
        error: () => this.authService.logOut()
      });
    }

    remover(){
      this.router.navigate(['login']);
      this.authService.logOut2();
    }
}
