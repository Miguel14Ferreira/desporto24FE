import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { DirectCallClientService } from './direct-call-client.service';
import { DirectCallEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

describe('Direct calls gated by authenticated realtime and backend availability', () => {
  let calls: DirectCallClientService;
  let http: HttpTestingController;
  let events: Subject<DirectCallEvent>;
  let connect: jasmine.Spy;

  beforeEach(() => {
    events = new Subject<DirectCallEvent>();
    connect = jasmine.createSpy('connect');
    const token = 'eyJhbGciOiJub25lIn0.' +
      btoa(JSON.stringify({sub:'ana',exp:4102444800})).replace(/=+$/,'') + '.fixture';
    spyOn(localStorage,'getItem').and.callFake(key => key === 't' ? token : null);
    TestBed.configureTestingModule({providers:[
      provideHttpClient(), provideHttpClientTesting(),
      {provide:Router,useValue:{events:new Subject()}},
      {provide:DirectChatRealtimeService,useValue:{calls$:events.asObservable(),connect}}
    ]});
    calls=TestBed.inject(DirectCallClientService);
    http=TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    calls.ngOnDestroy();
    http.verify();
  });

  it('does not reveal an incoming call while provider is unconfigured', () => {
    http.expectOne(r => r.url.endsWith('/api/calls/direct/availability')).flush({enabled:false});
    events.next({callId:'uuid',caller:'bea',peer:'ana',media:'video',
      status:'RINGING',actor:'bea',expiresAt:new Date(Date.now()+60000).toISOString()});
    expect(calls.available$.value).toBeFalse();
    expect(calls.state$.value).toBeNull();
    expect(connect).toHaveBeenCalled();
  });

  it('only offers authenticated calls addressed to the current account and allows decline', () => {
    http.expectOne(r => r.url.endsWith('/api/calls/direct/availability')).flush({enabled:true});
    events.next({callId:'wrong',caller:'bea',peer:'carla',media:'voice',
      status:'RINGING',actor:'bea',expiresAt:new Date(Date.now()+60000).toISOString()});
    expect(calls.state$.value).toBeNull();

    events.next({callId:'abc',caller:'bea',peer:'ana',media:'voice',
      status:'RINGING',actor:'bea',expiresAt:new Date(Date.now()+60000).toISOString()});
    expect(calls.state$.value?.phase).toBe('incoming');
    expect(calls.state$.value?.peer).toBe('bea');
    calls.decline();
    const decline=http.expectOne(r => r.url.endsWith('/api/calls/direct/abc/decline'));
    expect(decline.request.method).toBe('POST');
    decline.flush(null);
    expect(calls.state$.value).toBeNull();
  });

  it('rejects outgoing calls before backend readiness is confirmed', async () => {
    http.expectOne(r => r.url.endsWith('/api/calls/direct/availability')).flush({enabled:false});
    await calls.start('bea','voice');
    http.expectNone(r => r.url.endsWith('/api/calls/direct/bea'));
    expect(calls.state$.value).toBeNull();
  });

  it('handles a backend call conflict with an actionable error instead of showing a phantom call', async () => {
    http.expectOne(r => r.url.endsWith('/api/calls/direct/availability')).flush({enabled:true});
    const sending=calls.start('bea','video');
    const request=http.expectOne(r => r.url.endsWith('/api/calls/direct/bea'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({media:'video'});
    request.flush({message:'Already in a call'}, {status:409,statusText:'Conflict'});
    await sending;
    expect(calls.state$.value?.phase).toBe('error');
    expect(calls.state$.value?.error).toBe('calls.busy');
    calls.closeError();
    expect(calls.state$.value).toBeNull();
  });

  it('explains the exact signalling failure class instead of always saying unavailable', async () => {
    http.expectOne(req=>req.url.endsWith('/api/calls/direct/availability'))
      .flush({enabled:true});
    const examples: Array<{status:number; statusText:string; key:string}> = [
      {status:403,statusText:'Forbidden',key:'calls.notAllowed'},
      {status:409,statusText:'Conflict',key:'calls.busy'},
      {status:429,statusText:'Too Many Requests',key:'calls.rateLimited'},
      {status:503,statusText:'Unavailable',key:'calls.providerUnavailable'},
      {status:401,statusText:'Unauthorized',key:'calls.sessionExpired'},
      {status:0,statusText:'Unknown Error',key:'calls.networkError'}
    ];
    for (const item of examples) {
      const sending=calls.start('bea','voice');
      http.expectOne(req => req.url.endsWith('/api/calls/direct/bea'))
        .flush({message:'hidden backend detail'}, {status:item.status,statusText:item.statusText});
      await sending;
      expect(calls.state$.value?.phase).toBe('error');
      expect(calls.state$.value?.error).toBe(item.key);
      calls.closeError();
    }
  });

  it('ignores replayed expired invitations instead of ringing indefinitely', () => {
    http.expectOne(r => r.url.endsWith('/api/calls/direct/availability')).flush({enabled:true});
    events.next({callId:'abc',caller:'bea',peer:'ana',media:'video',
      status:'RINGING',actor:'bea',expiresAt:new Date(Date.now()-10000).toISOString()});
    expect(calls.state$.value).toBeNull();
  });
});
