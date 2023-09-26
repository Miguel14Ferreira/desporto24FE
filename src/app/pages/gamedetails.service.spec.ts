import { TestBed } from '@angular/core/testing';

import { GamedetailsService } from './gamedetails.service';

describe('GamedetailsService', () => {
  let service: GamedetailsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GamedetailsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
