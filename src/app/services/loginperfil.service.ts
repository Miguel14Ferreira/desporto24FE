import { HttpClient, HttpErrorResponse, HttpEvent, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Ideia } from '../ideia';
import { Perfil } from '../pages/model/perfil';
import { Session } from '../pages/session';
import { environment } from 'src/environments/environment';
import { JwtHelperService } from "@auth0/angular-jwt";
import { CustomHttpResponse } from '../pages/custom-http-response';

@Injectable({
  providedIn: 'root'
})
export class LoginperfilService {
  
  host = environment.apiUrl;
  tokenmf:any;
  loggedInUsername:any;
  private jwtHelper = new JwtHelperService();
  constructor(private httpClient: HttpClient) { }

  loginPerfil(perfil: Perfil):Observable<HttpResponse<Perfil>>{
    return this.httpClient.post<Perfil>(`${this.host}/api/auth/login`, perfil, {observe: 'response'});
  }
  createPerfil(perfil: Perfil):Observable<Perfil>{
    return this.httpClient.post<Perfil>(`${this.host}/api/auth/login/registerNewUser`, perfil);
  }

  updatePerfil(formData: FormData) {
    return this.httpClient.put<Perfil>(`${this.host}/api/auth/menu/alterardados/`,formData);
  }
  public createPerfilFormData(loggedInUsername: string, perfil: Perfil): FormData {
    const formData = new FormData();
    formData.append('currentUsername', loggedInUsername);
    formData.append('fullName', perfil.fullName);
    formData.append('dateOfBirth', JSON.stringify(perfil.dateOfBirth));
    formData.append('email', perfil.email);
    formData.append('foto', perfil.foto);
    formData.append('address',perfil.address);
    formData.append('postal',perfil.postal);
    formData.append('code',perfil.code);
    formData.append('gender',perfil.gender);
    formData.append('country',perfil.country);
    formData.append('phone',perfil.phone);
    formData.append('enabled', JSON.stringify(perfil.enabled));
    formData.append('notLocked', JSON.stringify(perfil.notLocked));
    return formData;
  }

  public createPerfilPasswordFormData(loggedInUsername: string, perfil: Perfil): FormData{
    const formData = new FormData();
    formData.append('currentUsername',loggedInUsername);
    formData.append('username',perfil.username);
    formData.append('password',perfil.password);
    return formData;
  }

  logOut():void {
    this.tokenmf = null;
    this.loggedInUsername = null;
    localStorage.removeItem('perfil');
    localStorage.removeItem('token');
    localStorage.removeItem('perfis');
  }

  saveToken(token: string):void {
    this.tokenmf = token;
    localStorage.setItem('tokenmf',token);
  }
  addPerfilToLocalCache(perfil: Perfil):void {
    localStorage.setItem('perfil',JSON.stringify(perfil));
  }
  getPerfilFromLocalCache(): Perfil{
    return JSON.parse(localStorage.getItem('perfil')!);
  }
  loadToken(): void{
    this.tokenmf = localStorage.getItem('tokenmf');
  }
  getToken(): string{
    return this.tokenmf;
  }

  isLoggedIn(): boolean{
    this.loadToken();
    if(this.tokenmf != null && this.tokenmf !== ''){
      if (this.jwtHelper.decodeToken(this.tokenmf).sub != null || ''){
        if (!this.jwtHelper.isTokenExpired(this.tokenmf)){
          this.loggedInUsername = this.jwtHelper.decodeToken(this.tokenmf).sub;
          return true;
        }
      }
    } else {
      this.logOut();
    }
    return false;
  }

  //updatePerfil(perfil: Perfil): Observable<Perfil | HttpErrorResponse>{
  //  return this.httpClient.put<Perfil>(`${this.host}/api/auth/menu/alterardados/`,perfil);
  //}
  obterDadosPessoais(): Observable<Perfil[] | HttpErrorResponse>{
    return this.httpClient.get<Perfil[]>(`${this.host}/api/auth/menu`);
  }
  obterInfo(perfil: Perfil):Observable<Perfil>{
    return this.httpClient.get<Perfil>(`${this.host}/api/auth/menu/alterardados/`);
  }
  obterUserPeloUsername1(username:string):Observable<Perfil>{
    return this.httpClient.get<Perfil>(`${this.host}/api/auth/menu/alterardados`+`?username=${username}`);
  }
  updatePerfilPassword(formData: FormData){
    return this.httpClient.put<Perfil>(`${this.host}/api/auth/menu/alterarPassword`, formData);
  }
  updateProfileImage(formData: FormData): Observable<HttpEvent<Perfil> | HttpErrorResponse>{
    return this.httpClient.post<Perfil>(`${this.host}/api/auth/updateProfileImage`, formData, {reportProgress: true, observe: 'events'})
  }
  createSession(session:Session):Observable<object>{
    return this.httpClient.post(`${this.host}/api/auth/menu/events/events`,session);
  }
  createIdea(ideia:Ideia):Observable<object>{
    return this.httpClient.post(`${this.host}/api/auth/contacts`,ideia);
  }
  obterPerfis() {
    return this.httpClient.get<Perfil[]>(`${this.host}/api/auth/menu/allUsers`);
  }
  deleteUser(perfilid: number): Observable<CustomHttpResponse | HttpErrorResponse>{
    return this.httpClient.delete<CustomHttpResponse>(`${this.host}/api/auth/delete/${perfilid}`);
  }
  addPerfisToLocalCache(perfis: Perfil[]): void{
    localStorage.setItem('perfis',JSON.stringify(perfis));
  }
  getPerfisFromLocalCache(): Perfil[]{
      return JSON.parse(localStorage.getItem('perfis')!);
  }
}