import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environment/environment';
//import { environment } from '../../environment/environment.prod';
import { Observable, catchError, tap } from 'rxjs';
import { Perfil } from '../pages/model/perfil';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Session } from '../pages/session';
import { CustomHttpResponse } from '../pages/custom-http-response';
import { Token } from '../pages/model/token';
import { Router } from '@angular/router';
import { Notification } from '../pages/model/notification';
import { Chat } from '../pages/model/chat';
import { LoginperfilService } from './loginperfil.service';
import { LoginResponse } from '../pages/model/login-response';


@Injectable()
export class AuthenticationService {
  public host = environment.apiUrl;
  token: any;
  loggedInPerfilname: any;
  email: any;
  PerfilName: any;
  private jwtHelper = new JwtHelperService();
  perfil!:Perfil;

  constructor(private http: HttpClient,private router:Router) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.host}/api/auth/login`,
      { username, password }
    );
  }

  confirmMfaChallenge(challengeId: string, code: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.host}/api/auth/mfa/confirm`,
      { challengeId, code }
    );
  }

  resendMfaChallenge(challengeId: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.host}/api/auth/mfa/resend`,
      { challengeId }
    );
  }

  loginPerfil(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/login`, perfil, {observe: 'response'});
  }
  createPerfil(formData: FormData):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.post<CustomHttpResponse>(`${this.host}/login/registerNewUser`, formData,{observe: 'response'});
  }
  createPerfil2(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.http.post<Perfil>(`${this.host}/login/registerNewUser`, perfil, {observe: 'response'});
  }
  createSessao(formData: FormData):Observable<Session>{
    return this.http.post<Session>(`${this.host}/menu/createEvents`, formData);
  }
  confirmMFA(token:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.post<CustomHttpResponse>(`${this.host}/login/MFAauthentication/:username`,token, {observe: 'response'});
  }
  resendMFA(perfil:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.get<CustomHttpResponse>(`${this.host}/login/MFAauthentication/${perfil}`,{observe: 'response'});
  }
  initiatePasswordReset(email: string): Observable<CustomHttpResponse> {
    return this.http.post<CustomHttpResponse>(
      `${this.host}/api/auth/reset-password/initiate`,
      { email: email.trim() }
    );
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<CustomHttpResponse> {
    return this.http.put<CustomHttpResponse>(
      `${this.host}/api/auth/reset-password/confirm`,
      { token, newPassword }
    );
  }

  sendEmail(perfil:Perfil):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.post<CustomHttpResponse>(`${this.host}/login/resetPassword`,perfil, {observe: 'response'});
  }
  resetPassword(token:string,username:string,password:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.put<CustomHttpResponse>(`${this.host}/login/resetPassword/${token}/${username}`,password, {observe: 'response'});
  }
  resetPasswordEmergency(token:string,username:string,password:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.put<CustomHttpResponse>(`${this.host}/confirmEmergencyToken/resetPassword/${token}/${username}`,password, {observe: 'response'})
  }
  activatePerfil(token: string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.get<CustomHttpResponse>(`${this.host}/login/registerNewUser/confirmTokenRegistration/${token}`,{observe: 'response'});
  }
  deactivatePerfil(token: string,username:string):Observable<Token>{
    return this.http.get<Token>(`${this.host}/confirmEmergencyToken/${token}/${username}`);
  }
  deactivatePerfilEmergency(username:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.post<CustomHttpResponse>(`${this.host}/menu/notifications/:id`,username,{observe: 'response'});
  }
  acceptFriendRequestToken(token:string):Observable<Token>{
    return this.http.get<Token>(`${this.host}/login/confirmNewFriend/${token}`);
  }
  deleteNotification(NotificationNumber:number):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.delete<CustomHttpResponse>(`${this.host}/menu/notifications/${NotificationNumber}`,{observe: 'response'})
  }
  acceptFriendRequest(NotificationNumber:number,NotificationToken:string):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.get<CustomHttpResponse>(`${this.host}/menu/notifications/${NotificationNumber}/${NotificationToken}`,{observe: 'response'});
  }
  getChat(senderId: string, recipientId: string):Observable<Chat[]>{
    return this.http.get<Chat[]>(`${this.host}/menu/friendList/chat/${senderId}/${recipientId}`);
  }
  sendChatMessagem(chat: Chat):Observable<Chat>{
    return this.http.post<Chat>(`${this.host}/menu/friendList/chat/:sender/:recipient`,chat)
  }
  terminarSessao(): Observable<void> {
    return this.http.post<void>(`${this.host}/api/auth/logout`, null);
  }

  public logOut(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    this.email = null;
    this.PerfilName = null;
    localStorage.removeItem('t');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('MFA');
    localStorage.removeItem('Sessao');
    sessionStorage.removeItem('auth-token');
    sessionStorage.removeItem('user-data');
    this.router.navigateByUrl('/login');
  }

  public logOut2(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    localStorage.removeItem('MFA');
  }

  public saveToken(token: string): void {
    this.token = token;
    localStorage.setItem('t', token);
  }

  public hasValidToken(): boolean {
    const token = localStorage.getItem('t');
    if (!token) {
      return false;
    }

    try {
      const payload = this.jwtHelper.decodeToken(token);
      return Boolean(payload?.exp && payload.exp * 1000 > Date.now());
    } catch {
      return false;
    }
  }
  public saveRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  }

  public addSessaoToLocalCache(Sessao: Session): void {
    localStorage.setItem('Sessao', JSON.stringify(Sessao));
  }

  public loadToken(): void {
    this.token = localStorage.getItem('t');
  }

  public getToken(): string {
    return this.token;
  }

  isLoggedIn(): boolean {
    this.loadToken();

    if (!this.hasValidToken()) {
      return false;
    }

    const payload = this.jwtHelper.decodeToken(this.token);
    this.loggedInPerfilname = payload?.sub ?? null;
    return Boolean(this.loggedInPerfilname);
  }
}