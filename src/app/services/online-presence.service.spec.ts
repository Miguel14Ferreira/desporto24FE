import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { environment } from '../../environment/environment';
import { AuthenticationService } from './authethication.service';
import { OnlinePresenceService } from './online-presence.service';

describe('OnlinePresenceService', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let auth: jasmine.SpyObj<AuthenticationService>;
  let service: OnlinePresenceService;
  let routerEvents: Subject<NavigationEnd>;
  let visibility: 'visible' | 'hidden';
  let doc: {
    readonly visibilityState: string;
    addEventListener: jasmine.Spy;
    removeEventListener: jasmine.Spy;
  };

  beforeEach(() => {
    jasmine.clock().install();
    visibility = 'visible';
    doc = {
      get visibilityState() { return visibility; },
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener')
    };
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    http.post.and.returnValue(of(undefined));
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['hasValidToken']
    );
    auth.hasValidToken.and.returnValue(true);
    routerEvents = new Subject<NavigationEnd>();
    const router = { events: routerEvents.asObservable() } as unknown as Router;
    service = new OnlinePresenceService(http, auth, router,
      new NgZone({ enableLongStackTrace: false }), doc as unknown as Document);
  });

  afterEach(() => {
    service.stop();
    routerEvents.complete();
    jasmine.clock().uninstall();
  });

  it('sends an authenticated heartbeat on visible startup and once per minute', () => {
    service.start();
    expect(http.post).toHaveBeenCalledOnceWith(
      environment.apiUrl + '/api/presence/heartbeat', null
    );
    jasmine.clock().tick(60_000);
    expect(http.post).toHaveBeenCalledTimes(2);
    service.start();
    jasmine.clock().tick(60_000);
    expect(http.post).toHaveBeenCalledTimes(3);
    expect(doc.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('does not report anonymous accounts or invisible background tabs', () => {
    auth.hasValidToken.and.returnValue(false);
    service.start();
    expect(http.post).not.toHaveBeenCalled();
    auth.hasValidToken.and.returnValue(true);
    visibility = 'hidden';
    routerEvents.next(new NavigationEnd(1, '/login', '/menu'));
    jasmine.clock().tick(60_000);
    expect(http.post).not.toHaveBeenCalled();
    visibility = 'visible';
    const callback = doc.addEventListener.calls.mostRecent().args[1] as EventListener;
    callback(new Event('visibilitychange'));
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('detects sign in on route navigation and stops sending after teardown', () => {
    auth.hasValidToken.and.returnValue(false);
    service.start();
    auth.hasValidToken.and.returnValue(true);
    routerEvents.next(new NavigationEnd(2, '/login', '/menu/home'));
    expect(http.post).toHaveBeenCalledTimes(1);
    service.stop();
    jasmine.clock().tick(120_000);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(doc.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('ignores connectivity errors without blocking future heartbeats', () => {
    http.post.and.returnValues(
      throwError(() => new Error('Network unavailable')), of(undefined)
    );
    service.start();
    jasmine.clock().tick(60_000);
    expect(http.post).toHaveBeenCalledTimes(2);
  });
});
