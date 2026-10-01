import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { PilotAnalyticsService } from './pilot-analytics.service';

describe('PilotAnalyticsService', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let service: PilotAnalyticsService;

  beforeEach(() => {
    localStorage.removeItem('d24_pilot_device_id');
    localStorage.removeItem('d24_pilot_access_recorded');
    localStorage.removeItem('d24_pilot_cohort');

    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    service = new PilotAnalyticsService(http);
  });

  afterEach(() => {
    localStorage.removeItem('d24_pilot_device_id');
    localStorage.removeItem('d24_pilot_access_recorded');
    localStorage.removeItem('d24_pilot_cohort');
  });

  it('should persist an anonymous device id and send access once', () => {
    http.post.and.returnValue(of(void 0));

    service.recordFirstAccess('  pilot-lisbon-2026  ');
    service.recordFirstAccess('other-cohort');

    expect(http.post).toHaveBeenCalledTimes(1);

    const body = http.post.calls.mostRecent().args[1] as {
      deviceId: string;
      cohort: string | null;
    };
    expect(body.deviceId).toBeTruthy();
    expect(body.cohort).toBe('pilot-lisbon-2026');
    expect(localStorage.getItem('d24_pilot_device_id')).toBe(body.deviceId);
    expect(localStorage.getItem('d24_pilot_cohort')).toBe('pilot-lisbon-2026');
    expect(localStorage.getItem('d24_pilot_access_recorded')).toBe('1');
  });

  it('should retry on a future start when the request fails', () => {
    http.post.and.returnValues(
      throwError(() => new Error('network')),
      of(void 0)
    );

    service.recordFirstAccess('pilot-lisbon-2026');
    expect(localStorage.getItem('d24_pilot_access_recorded')).toBeNull();

    service.recordFirstAccess();

    expect(http.post).toHaveBeenCalledTimes(2);
    const retryBody = http.post.calls.mostRecent().args[1] as {
      deviceId: string;
      cohort: string | null;
    };
    expect(retryBody.cohort).toBe('pilot-lisbon-2026');
    expect(localStorage.getItem('d24_pilot_access_recorded')).toBe('1');
  });
});
