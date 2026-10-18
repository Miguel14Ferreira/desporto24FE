import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { environment } from 'src/environment/environment';
import { AdminVenueToolsComponent } from './admin-venue-tools.component';

describe('AdminVenueToolsComponent', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let component: AdminVenueToolsComponent;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    component = new AdminVenueToolsComponent(http, cdr);
  });
  afterEach(() => component.ngOnDestroy());

  it('does not contact the API before explicit preview and never calls an import endpoint', () => {
    expect(http.post).not.toHaveBeenCalled();
    http.post.and.returnValue(of([]));
    component.previewVenues();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.calls.mostRecent().args[0])
      .toBe(environment.apiUrl + '/api/admin/venues/imports/openstreetmap/preview');
    expect(component.previewDone).toBeTrue();
    expect(component.previewLoading).toBeFalse();
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  it('rejects invalid JSON and empty lists without calling the API', () => {
    component.venuePayload = '{bad json';
    component.previewVenues();
    expect(component.previewError).toContain('JSON inválido');
    component.venuePayload = '[]';
    component.previewVenues();
    expect(component.previewError).toContain('lista fora do limite');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('times out stalled preview and allows retries', fakeAsync(() => {
    http.post.and.returnValues(new Subject<any>(), of([]));
    component.previewVenues();
    expect(component.previewLoading).toBeTrue();
    component.previewVenues();
    expect(http.post).toHaveBeenCalledTimes(1);
    tick(12_100);
    expect(component.previewLoading).toBeFalse();
    expect(component.previewError).toContain('Não foi possível');
    component.previewVenues();
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(component.previewDone).toBeTrue();
  }));

  it('shows errors without reporting an empty successful result', () => {
    http.post.and.returnValue(throwError(() => new Error('offline')));
    component.previewVenues();
    expect(component.previewDone).toBeFalse();
    expect(component.previewError).toContain('Não foi possível');
  });
});
