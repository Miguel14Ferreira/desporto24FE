import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginperfilService } from '../services/loginperfil.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private loginPerfil: LoginperfilService) {}

  intercept(httpRequest: HttpRequest<any>, httpHandler: HttpHandler): Observable<HttpEvent<any>> {
    if (httpRequest.url.includes(`${this.loginPerfil.host}/api/auth/login`)){
      return httpHandler.handle(httpRequest);
    }
    if (httpRequest.url.includes(`${this.loginPerfil.host}/api/auth/login/registerNewUser`)){
      return httpHandler.handle(httpRequest);
    }
    if (httpRequest.url.includes(`${this.loginPerfil.host}/api/auth/menu/alterarPassword`)){
      return httpHandler.handle(httpRequest);
    }
    this.loginPerfil.loadToken();
    const token = this.loginPerfil.getToken();
    const request = httpRequest.clone({setHeaders: { Authorization: `Bearer ${token}`}});
    return httpHandler.handle(request);
  }
}
