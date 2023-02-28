import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Perfil } from '../pages/model/perfil';
import { JwtHelperService } from '@auth0/angular-jwt';


@Injectable({providedIn: 'root'})
export class AuthenticationService {
  public host = environment.apiUrl;
  token: any;
  loggedInPerfilname: any;
  private jwtHelper = new JwtHelperService();

  constructor(private http: HttpClient) {}

  loginPerfil(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/api/auth/login`, perfil, {observe: 'response'});
  }
  createPerfil(perfil: Perfil):Observable<Perfil>{
    return this.http.post<Perfil>(`${this.host}/api/auth/login/registerNewUser`, perfil);
  }

  public logOut(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    localStorage.removeItem('Perfil');
    localStorage.removeItem('token');
    localStorage.removeItem('Perfils');
  }

  public saveToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  public addPerfilToLocalCache(Perfil: Perfil): void {
    localStorage.setItem('Perfil', JSON.stringify(Perfil));
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