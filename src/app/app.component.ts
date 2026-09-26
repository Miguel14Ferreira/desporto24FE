import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthenticationService } from './services/authethication.service';

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
    private authenticationService: AuthenticationService
  ) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('confirmRegistration');

    if (!token) {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    this.authenticationService.confirmRegistration(token).subscribe({
      next: response => {
        sessionStorage.setItem(
          'auth-success-message',
          response.message || 'Conta ativada com sucesso. Já podes iniciar sessão.'
        );
        this.router.navigateByUrl('/login');
      },
      error: error => {
        const apiMessage = error?.error?.message;
        sessionStorage.setItem(
          'auth-error-message',
          typeof apiMessage === 'string' && apiMessage.trim()
            ? apiMessage
            : 'Não foi possível ativar a conta. O link pode ter expirado.'
        );
        this.router.navigateByUrl('/login');
      }
    });
  }
}
