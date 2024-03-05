import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
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


@Injectable({providedIn: 'root'})
export class AuthenticationService {
  public host = environment.apiUrl;
  token: any;
  loggedInPerfilname: any;
  email: any;
  PerfilName: any;
  private jwtHelper = new JwtHelperService();
  perfil!:Perfil;

  constructor(private http: HttpClient,private router:Router) {}

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
  sendEmail(perfil:Perfil):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.post<CustomHttpResponse>(`${this.host}/login/resetPassword`,perfil, {observe: 'response'});
  }
  resetPassword(token:string,perfil:Perfil):Observable<HttpResponse<CustomHttpResponse>>{
    return this.http.put<CustomHttpResponse>(`${this.host}/login/resetPassword/${token}/:username`,perfil ,{observe: 'response'});
  }
  resetPasswordEmergency(token:string,username:string,password:string):Observable<Perfil>{
    return this.http.put<Perfil>(`${this.host}/confirmEmergencyToken/resetPassword/${token}/${username}`,password)
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
  acceptFriendRequest(NotificationNumber:number,NotificationToken:string):Observable<Notification>{
    return this.http.get<Notification>(`${this.host}/menu/notifications/${NotificationNumber}/${NotificationToken}`,);
  }
  getChat(senderId: string, recipientId: string):Observable<Chat[]>{
    return this.http.get<Chat[]>(`${this.host}/menu/friendList/chat/${senderId}/${recipientId}`);
  }
  sendChatMessagem(chat: Chat):Observable<Chat>{
    return this.http.post<Chat>(`${this.host}/menu/friendList/chat/:sender/:recipient`,chat)
  }
  terminarSessao(email: Perfil):Observable<Perfil>{
    return this.http.post<Perfil>(`${this.host}/menu/terminarSessao`,email)
  }

  public logOut(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    localStorage.removeItem('token');
  }

  public logOut2(): void {
    this.token = null;
    this.loggedInPerfilname = null;
    localStorage.removeItem('tokenMFA');
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

  public loadToken(): void {
    this.token = localStorage.getItem('token');
  }

  public getToken(): string {
    return this.token;
  }

  isLoggedIn(){
    this.loadToken();
    if(this.token != null && this.token !== ''){
      if (this.jwtHelper.decodeToken(this.token).sub != null || ''){
        if (!this.jwtHelper.isTokenExpired(this.token)){
          this.loggedInPerfilname = this.jwtHelper.decodeToken(this.token).sub;
          return this.router.navigateByUrl('/menu')
        }
      }
    } else {
      return this.logOut();
    }
  }
  isLoggedIn2(){
    this.loadToken();
    if(this.token == null && this.token == ''){
      return this.router.navigateByUrl('/login')
        } else {
      return this.logOut();
        }
  }
}