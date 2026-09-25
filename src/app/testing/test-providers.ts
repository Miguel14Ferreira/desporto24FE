import { Provider } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthenticationService } from '../services/authethication.service';
import { LoginperfilService } from '../services/loginperfil.service';

const profile = {
  username: 'miguel',
  email: 'miguel@example.invalid',
  status: 'OFFLINE'
};

const loginPerfilServiceMock = new Proxy(
  { loggedInUsername: 'miguel' } as Record<string, unknown>,
  {
    get(target, property) {
      if (property in target) {
        return target[property as string];
      }

      const method = String(property);
      if (['obterNotificacoesDoPerfil', 'friendList', 'obterSessoes', 'obterPerfis'].includes(method)) {
        return () => of([]);
      }
      if (method === 'obterUserPeloUsername1') {
        return () => of(profile);
      }
      if (['createPerfilFormData', 'createSessionForm', 'updatePerfilFormData', 'updatePerfilFoto',
 'updatePerfilPasswordFormData', 'addFriendFromData', 'blockFriendFromData',
 'unblockFriendFromData', 'removeFriendFromData', 'createFormResetPassword'].includes(method)) {
        return () => new FormData();
      }

      return () => of({});
    }
  }
);

const authenticationServiceMock = new Proxy(
  {
    loggedInPerfilname: 'miguel',
    isLoggedIn: () => true,
    logOut: () => undefined,
    logOut2: () => undefined,
    saveToken: () => undefined,
    getToken: () => 'test-token',
    getChat: () => of([])
  } as Record<string, unknown>,
  {
    get(target, property) {
      if (property in target) {
        return target[property as string];
      }
      return () => of({});
    }
  }
);

const routerMock = {
  navigate: () => Promise.resolve(true),
  navigateByUrl: () => Promise.resolve(true)
};

const activatedRouteMock = {
  params: of({}),
  queryParams: of({}),
  paramMap: of(convertToParamMap({})),
  queryParamMap: of(convertToParamMap({})),
  snapshot: {
    params: {},
    queryParams: {},
    paramMap: convertToParamMap({}),
    queryParamMap: convertToParamMap({})
  }
};

export const TEST_IMPORTS = [
  FormsModule,
  ReactiveFormsModule,
  RouterTestingModule,
  HttpClientTestingModule
];

export const TEST_PROVIDERS: Provider[] = [
  { provide: AuthenticationService, useValue: authenticationServiceMock },
  { provide: LoginperfilService, useValue: loginPerfilServiceMock },
  { provide: Router, useValue: routerMock },
  { provide: ActivatedRoute, useValue: activatedRouteMock }
];
