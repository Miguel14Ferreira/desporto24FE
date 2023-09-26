import { TestBed } from '@angular/core/testing';

import { LoginperfilService } from '../services/loginperfil.service';

describe('LoginperfilService', () => {
  let service: LoginperfilService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoginperfilService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
