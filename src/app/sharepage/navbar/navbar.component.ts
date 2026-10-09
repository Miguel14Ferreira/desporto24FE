import { Component, ElementRef, HostListener, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { AppLanguage, I18nService } from 'src/app/i18n/i18n.service';
import { NotificationApiService } from 'src/app/services/notification-api.service';
import { DirectChatRealtimeService } from 'src/app/services/direct-chat-realtime.service';
import { Subscription, filter, retry, timeout } from 'rxjs';

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
  private readonly subscriptions = new Subscription();

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private router: Router,
    private authService: AuthenticationService,
    private notificationService: NotificationApiService,
    private realtimeService: DirectChatRealtimeService,
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

      this.subscriptions.add(
        this.realtimeService.messages$.subscribe(() => {
          if (this.authenticated) {
            this.unreadNotifications += 1;
          }
        })
      );
    }

    ngOnDestroy(): void {
      this.subscriptions.unsubscribe();
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
        this.realtimeService.disconnect();
        this.unreadNotifications = 0;
        if (this.notificationTimer) {
          clearInterval(this.notificationTimer);
          this.notificationTimer = undefined;
        }
        return;
      }

      this.realtimeService.connect();

      if (!this.notificationTimer) {
        this.loadUnreadNotifications();
        this.notificationTimer = setInterval(
          () => this.loadUnreadNotifications(),
          60000
        );
      }
    }

    loadUnreadNotifications(): void {
      this.notificationService.unreadCount()
        .pipe(
          timeout(10_000),
          retry({ count: 1 })
        )
        .subscribe({
        next: unreadCount => {
          this.unreadNotifications = unreadCount;
        },
        error: () => this.unreadNotifications = 0
      });
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
