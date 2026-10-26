import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminUserReportsComponent } from './admin-user-reports.component';
import { AdminUserReportsService } from '../../services/admin-user-reports.service';
import { AdminUserReport } from '../model/admin-user-report';
import { I18nService, preloadEnglishTranslations } from '../../i18n/i18n.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('AdminUserReportsComponent PT/EN Concept One audit', () => {
  let fixture: ComponentFixture<AdminUserReportsComponent>;
  let service: jasmine.SpyObj<AdminUserReportsService>;
  let i18n: I18nService;
  let previousLanguage: string | null;

  const report: AdminUserReport = {
    id: 17, reporterUsername: 'alex', reportedUsername: 'test-user',
    reason: 'Motivo de teste', status: 'OPEN', createdAt: '2026-10-25T12:00:00Z'
  };

  beforeAll(async () => {
    await preloadEnglishTranslations();
  });

  beforeEach(async () => {
    previousLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    service = jasmine.createSpyObj<AdminUserReportsService>('AdminUserReportsService', ['listOpen', 'updateStatus']);
    service.listOpen.and.returnValue(of([report]));
    service.updateStatus.and.returnValue(of({ ...report, status: 'REVIEWED' }));
    await TestBed.configureTestingModule({
      declarations: [AdminUserReportsComponent],
      imports: TEST_IMPORTS,
      providers: [...TEST_PROVIDERS, { provide: AdminUserReportsService, useValue: service }]
    }).compileComponents();
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('pt');
    fixture = TestBed.createComponent(AdminUserReportsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (previousLanguage === null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previousLanguage);
  });

  it('localises moderation actions while preserving reported users and reasons', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Denúncias de utilizadores');
    expect(root.querySelector('.report-people')?.textContent).toContain('@test-user');
    i18n.setLanguage('en');
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('User reports');
    expect(root.querySelector('.status-badge')?.textContent).toContain('Open');
    expect(root.querySelector('.report-people')?.textContent).toContain('Reported by @alex');
    expect(root.querySelector('.reason')?.textContent).toContain('Motivo de teste');
    expect(root.querySelector('.report-actions')?.textContent).toContain('Mark reviewed');
    expect(root.querySelector('.report-actions')?.textContent).toContain('Dismiss');
    expect(service.updateStatus).not.toHaveBeenCalled();
  });

  it('keeps the review action wired to the same status endpoint', () => {
    fixture.componentInstance.closeReport(report, 'REVIEWED');
    expect(service.updateStatus).toHaveBeenCalledOnceWith(17, 'REVIEWED');
  });
});
