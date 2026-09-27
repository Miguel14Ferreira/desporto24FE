import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { AppLanguage, I18nService } from 'src/app/i18n/i18n.service';
import { NotificationApiService } from 'src/app/services/notification-api.service';

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
  private notificationTimer?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private notificationService: NotificationApiService,
    public i18n: I18nService
  ) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
      if (this.isAuthenticated()) {
        this.loadUnreadNotifications();
        this.notificationTimer = setInterval(() => this.loadUnreadNotifications(), 15000);
      }
    }

    ngOnDestroy(): void {
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
      }
    }

    loadUnreadNotifications(): void {
      this.notificationService.mine().subscribe({
        next: notifications => {
          this.unreadNotifications = notifications.filter(notification => !notification.read).length;
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

    isAuthenticated(): boolean {
      return this.authService.isLoggedIn();
    }

    remover(){
      this.router.navigate(['login']);
      this.authService.logOut2();
    }
}
