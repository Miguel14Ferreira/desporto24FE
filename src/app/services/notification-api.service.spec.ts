import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NotificationApiService } from './notification-api.service';
import { environment } from 'src/environment/environment';

describe('NotificationApiService change events', () => {
  let service: NotificationApiService;
  let http: HttpTestingController;
  let changes: jasmine.Spy;
  const base = environment.apiUrl + '/api/notifications';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(NotificationApiService);
    http = TestBed.inject(HttpTestingController);
    changes = jasmine.createSpy('changed');
    service.changes$.subscribe(changes);
  });

  afterEach(() => http.verify());

  it('does not publish a change on reads or before a preference update succeeds', () => {
    service.preferences().subscribe();
    http.expectOne(base + '/me/preferences').flush({
      inAppEnabled: true, emailEnabled: true,
      disabledInAppTypes: [], disabledEmailTypes: []
    });
    expect(changes).not.toHaveBeenCalled();

    service.updatePreferences({
      inAppEnabled: false, emailEnabled: false,
      disabledInAppTypes: ['CHAT_MESSAGE'], disabledEmailTypes: []
    }).subscribe();
    const update = http.expectOne(base + '/me/preferences');
    expect(update.request.method).toBe('PUT');
    expect(changes).not.toHaveBeenCalled();
    update.flush({
      inAppEnabled: false, emailEnabled: false,
      disabledInAppTypes: ['CHAT_MESSAGE'], disabledEmailTypes: []
    });
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('publishes once after marking a notification as read, not before confirmation', () => {
    service.markRead(42).subscribe();
    const read = http.expectOne(base + '/42/read');
    expect(read.request.method).toBe('PUT');
    expect(changes).not.toHaveBeenCalled();
    read.flush(null);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('publishes after deleting one or all notifications and after friendship actions', () => {
    service.delete(7).subscribe();
    http.expectOne(base + '/7').flush(null);
    expect(changes).toHaveBeenCalledTimes(1);

    service.deleteAll().subscribe();
    http.expectOne(base + '/me').flush(null);
    expect(changes).toHaveBeenCalledTimes(2);

    service.acceptFriendRequest(5).subscribe();
    http.expectOne(base + '/friend-request/5/accept').flush({});
    expect(changes).toHaveBeenCalledTimes(3);

    service.rejectFriendRequest(9).subscribe();
    http.expectOne(base + '/friend-request/9/reject').flush(null);
    expect(changes).toHaveBeenCalledTimes(4);
  });

  it('does not claim a badge change when the server rejects a mutation', () => {
    service.markRead(42).subscribe({ error: () => {} });
    http.expectOne(base + '/42/read').flush(
      { message: 'Not found' }, { status: 404, statusText: 'Not Found' }
    );
    service.updatePreferences({
      inAppEnabled: false, emailEnabled: false,
      disabledInAppTypes: [], disabledEmailTypes: []
    }).subscribe({ error: () => {} });
    http.expectOne(base + '/me/preferences').flush(
      { message: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' }
    );
    expect(changes).not.toHaveBeenCalled();
  });
});
