import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminDisputesComponent } from './admin-disputes.component';
import { ReliabilityService } from '../../services/reliability.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('AdminDisputesComponent', () => {
  let component: AdminDisputesComponent;
  let fixture: ComponentFixture<AdminDisputesComponent>;
  let service: jasmine.SpyObj<ReliabilityService>;

  const dispute = {
    id: 30,
    participantId: 20,
    sessionId: 10,
    sport: 'Padel',
    city: 'Lisboa',
    gameDate: '2026-09-20T19:00:00Z',
    participantUsername: 'miguel',
    reporterUsername: 'creator',
    reason: 'Estive presente.',
    status: 'OPEN' as const,
    createdAt: '2026-09-20T21:00:00Z',
    resolvedAt: null
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<ReliabilityService>(
      'ReliabilityService',
      ['disputes', 'resolveDispute']
    );
    service.disputes.and.returnValue(of([dispute]));
    service.resolveDispute.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [AdminDisputesComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: ReliabilityService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDisputesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load open disputes by default', () => {
    expect(component).toBeTruthy();
    expect(service.disputes).toHaveBeenCalledWith('OPEN');
    expect(component.disputes.length).toBe(1);
  });

  it('should resolve an open dispute and refresh', () => {
    component.resolve(component.disputes[0], 'ACCEPTED');

    expect(service.resolveDispute).toHaveBeenCalledWith(30, 'ACCEPTED');
    expect(service.disputes).toHaveBeenCalledTimes(2);
    expect(component.actionMessage).toContain('aceite');
  });

  it('should reload when changing status', () => {
    service.disputes.and.returnValue(of([]));

    component.changeStatus('REJECTED');

    expect(component.statusFilter).toBe('REJECTED');
    expect(service.disputes).toHaveBeenCalledWith('REJECTED');
  });
});
