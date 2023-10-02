import { HttpClient, HttpErrorResponse, HttpEvent, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Ideia } from '../ideia';
import { Perfil } from '../pages/model/perfil';
import { Session } from '../pages/session';
import { environment } from 'src/environments/environment';
import { JwtHelperService } from "@auth0/angular-jwt";
import { CustomHttpResponse } from '../pages/custom-http-response';
import { Token } from '../pages/model/token';

@Injectable({
  providedIn: 'root'
})
export class LoginperfilService {
  
  host = environment.apiUrl;
  tokenmf:any;
  loggedInUsername:any;
  private jwtHelper = new JwtHelperService();
  constructor(private httpClient: HttpClient) { }

  updatePerfil(formData: FormData) {
    return this.httpClient.put<Perfil>(`${this.host}/menu/alterardados`,formData);
  }

  updatePerfil2(perfil: Perfil) {
    return this.httpClient.put<Perfil>(`${this.host}/menu/alterardados/`,perfil);
  }
  public createPerfilFormData(perfil: Perfil, imageFile: File): FormData {
    const formData = new FormData();
    formData.append('username', perfil.username);
    formData.append('password', perfil.password);
    formData.append('fullName', perfil.fullName);
    formData.append('dateOfBirth', perfil.dateOfBirth);
    formData.append('email', perfil.email);
    formData.append('address',perfil.address);
    formData.append('postalCode',perfil.postalCode);
    formData.append('gender',perfil.gender);
    formData.append('country',perfil.country);
    formData.append('location',perfil.location);
    formData.append('indicativePhone',perfil.indicativePhone);
    formData.append('phone',perfil.phone);
    formData.append('foto',imageFile);
    formData.append('desportosFavoritos',perfil.desportosFavoritos);
    formData.append('enabled', JSON.stringify(perfil.enabled));
    formData.append('notLocked', JSON.stringify(perfil.notLocked));
    return formData;
  }

  public createFormResetPassword(perfil: Perfil): FormData {
    const formData = new FormData();
    formData.append('password', perfil.password);
    return formData;
  }

  activatePerfil(token: Token): FormData{
    const formData = new FormData();
    formData.append('token', token.token);
    return formData;
  }

  public createSessionForm(sessao: Session, imageFile: File): FormData {
    const formData = new FormData();
    formData.append('desporto', sessao.desporto);
    formData.append('dataDeJogo', sessao.dataDeJogo);
    formData.append('foto', imageFile);
    formData.append('jogadores', sessao.jogadores);
    formData.append('localidade', sessao.localidade);
    formData.append('password', sessao.password);
    formData.append('private', sessao.private);
    formData.append('preco', sessao.preco);
    formData.append('utilizador', sessao.utilizador);
    return formData;
  }

  public updatePerfilFormData(loggedInUsername: string,perfil: Perfil, foto: File): FormData {
    const formData = new FormData();
    formData.append('username', loggedInUsername);
    formData.append('fullName', perfil.fullName);
    formData.append('dateOfBirth', perfil.dateOfBirth);
    formData.append('email', perfil.email);
    formData.append('address',perfil.address);
    formData.append('postalCode',perfil.postalCode);
    formData.append('gender',perfil.gender);
    formData.append('country',perfil.country);
    formData.append('phone',perfil.phone);
    formData.append('indicativePhone',perfil.indicativePhone);
    formData.append('desportosFavoritos',perfil.desportosFavoritos);
    formData.append('location',perfil.location);
    formData.append('MFA',perfil.MFA);
    formData.append('foto',foto);
    return formData;
  }

  public updatePerfilFoto(loggedInUsername: string, foto: File): FormData{
    const formData = new FormData();
    formData.append('username',loggedInUsername);
    formData.append('foto',foto);
    return formData;
  }

  public updatePerfilPasswordFormData(loggedInUsername: string, perfil: Perfil): FormData{
    const formData = new FormData();
    formData.append('currentUsername',loggedInUsername);
    formData.append('username',perfil.username);
    formData.append('password',perfil.password);
    return formData;
  }

  obterDadosPessoais(): Observable<Perfil[] | HttpErrorResponse>{
    return this.httpClient.get<Perfil[]>(`${this.host}/menu`);
  }
  obterSessoes() {
    return this.httpClient.get<Session[]>(`${this.host}/menu`);
  }
  obterUserPeloUsername1(username:string):Observable<Perfil>{
    return this.httpClient.get<Perfil>(`${this.host}/menu/${username}`);
  }
  updatePerfilPassword(formData: FormData){
    return this.httpClient.put<Perfil>(`${this.host}/menu/alterarPassword`, formData);
  }
  createSession(formData:FormData){
    return this.httpClient.post<Session>(`${this.host}/menu/createEvent`,formData);
  }
  createIdea(ideia:Ideia):Observable<object>{
    return this.httpClient.post(`${this.host}/contact`,ideia);
  }
  obterPerfis() {
    return this.httpClient.get<Perfil[]>(`${this.host}/menu/perfis`);
  }
  deleteUser(perfilid: number): Observable<CustomHttpResponse | HttpErrorResponse>{
    return this.httpClient.delete<CustomHttpResponse>(`${this.host}/delete/${perfilid}`);
  }
}