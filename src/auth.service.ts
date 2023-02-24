import { Injectable } from '@angular/core';
import { Perfil } from './app/pages/model/perfil';

export const AUTH_TOKEN_KEY = 'auth-token';
export const AUTH_USER_DATA = 'user-data';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  login (authData: Perfil ){
    sessionStorage.setItem(AUTH_TOKEN_KEY, authData.username + 'RANDOM_STRING');
    sessionStorage.setItem(AUTH_USER_DATA, JSON.stringify(authData));
    console.log(sessionStorage);
  }
}
