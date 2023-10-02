import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, catchError, tap } from 'rxjs';
import { Perfil } from '../pages/model/perfil';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Session } from '../pages/session';
import { CustomHttpResponse } from '../pages/custom-http-response';
import { Token } from '../pages/model/token';


@Injectable({providedIn: 'root'})
export class AuthenticationService {
  public host = environment.apiUrl;
  token: any;
  loggedInPerfilname: any;
  email: any;
  PerfilName: any;
  private jwtHelper = new JwtHelperService();

  constructor(private http: HttpClient) {}

  loginPerfil(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/login`, perfil, {observe: 'response'});
  }
  createPerfil(formData: FormData):Observable<Perfil>{
    return this.http.post<Perfil>(`${this.host}/login/registerNewUser`, formData);
  }

  createPerfil2(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/login/registerNewUser`, perfil, {observe: 'response'});
  }

  createSessao(formData: FormData):Observable<Session>{
    return this.http.post<Session>(`${this.host}/menu/createEvents`, formData);
  }

  sendEmail(perfil:Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/login/resetPassword`,perfil, {observe: 'response'});
  }
  resetPassword(token:string, perfil: Perfil):Observable<Perfil>{
    return this.http.put<Perfil>(`${this.host}/login/resetPassword/${token}`,perfil);
  }
  activatePerfil(token: string):Observable<Token>{
    return this.http.get<Token>(`${this.host}/login/registerNewUser/confirmTokenRegistration/${token}`);
  }
  deactivatePerfil(token: string):Observable<Token>{
    return this.http.get<Token>(`${this.host}/confirmEmergencyToken/${token}`);
  }
  updatePerfilFoto(formData:FormData):Observable<Perfil>{
    return this.http.put<Perfil>(`${this.host}/menu`,formData);
  }

  public logOut(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    localStorage.removeItem('token');
  }

  public saveToken(token: string): void {
    localStorage.setItem('token', token);
  }
  public saveRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  }

  public addSessaoToLocalCache(Sessao: Session): void {
    localStorage.setItem('Sessao', JSON.stringify(Sessao));
  }

  public getPerfilFromLocalCache(): Perfil {
    return JSON.parse(localStorage.getItem('Perfil')!);
  }

  public loadToken(): void {
    this.token = localStorage.getItem('token');
  }

  public getToken(): string {
    return this.token;
  }

  isLoggedIn(): boolean{
    this.loadToken();
    if(this.token != null && this.token !== ''){
      if (this.jwtHelper.decodeToken(this.token).sub != null || ''){
        if (!this.jwtHelper.isTokenExpired(this.token)){
          this.loggedInPerfilname = this.jwtHelper.decodeToken(this.token).sub;
          return true;
        }
      }
    } else {
      this.logOut();
    }
    return false;
  }
}