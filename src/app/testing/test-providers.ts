import { Provider } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { AuthenticationService } from '../services/authethication.service';
import { LoginperfilService } from '../services/loginperfil.service';

const observableServiceMock = new Proxy({}, {
  get: () => (..._args: unknown[]) => of({})
});

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

export const TEST_PROVIDERS: Provider[] = [
  { provide: AuthenticationService, useValue: observableServiceMock },
  { provide: LoginperfilService, useValue: observableServiceMock },
  { provide: Router, useValue: routerMock },
  { provide: ActivatedRoute, useValue: activatedRouteMock }
];
