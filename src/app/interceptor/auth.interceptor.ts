import { Injectable } from '@angular/core';
import { HttpRequest,HttpHandler,HttpEvent,HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginperfilService } from '../services/loginperfil.service';
import { AuthenticationService } from '../services/authethication.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private loginPerfil: LoginperfilService, private authService:AuthenticationService) {}

  intercept(httpRequest: HttpRequest<any>, httpHandler: HttpHandler): Observable<HttpEvent<any>> {
    if (httpRequest.url.includes(`${this.loginPerfil.host}/login`)){
      return httpHandler.handle(httpRequest);
    }
    if (httpRequest.url.includes(`${this.loginPerfil.host}/login/registerNewUser`)){
      return httpHandler.handle(httpRequest);
    }
    if (httpRequest.url.includes(`${this.loginPerfil.host}/menu/alterarPassword`)){
      return httpHandler.handle(httpRequest);
    }
    this.authService.loadToken();
    const token = this.authService.getToken();
    const request = httpRequest.clone({setHeaders: { Authorization: `Bearer ${token}`}});
    return httpHandler.handle(request);
  }
}
