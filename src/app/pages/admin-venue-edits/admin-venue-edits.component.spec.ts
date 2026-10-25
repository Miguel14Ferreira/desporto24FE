import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';

import {
  VenueEditSuggestion, VenueEditSuggestionsService
} from '../../services/venue-edit-suggestions.service';
import { AdminVenueEditsComponent } from './admin-venue-edits.component';

describe('AdminVenueEditsComponent', () => {
  const pending: VenueEditSuggestion = {
    id: 31, venueId: 7, venueName: 'Campo',
    status: 'PENDING',
    before: { name: 'Campo' }, proposed: { name: 'Campo Municipal' },
    reason: 'Confirmado pelo município', submittedByUsername: 'member',
    submittedAt: '2026-10-25T13:00:00Z', reviewedByUsername: null,
    reviewedAt: null, decisionNote: null
  };
  let api: jasmine.SpyObj<VenueEditSuggestionsService>;
  let component: AdminVenueEditsComponent;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    api = jasmine.createSpyObj<VenueEditSuggestionsService>('VenueEditSuggestionsService',
      ['pending', 'decide']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    api.pending.and.returnValue(of({ suggestions:[pending], page:0, hasMore:false }));
    component = new AdminVenueEditsComponent(api, cdr);
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('shows only pending proposals with changed fields', () => {
    expect(component.loading).toBeFalse();
    expect(component.suggestions.length).toBe(1);
    expect(component.fields(pending)).toEqual(['name']);
  });

  it('requires a reason for rejection and records the decision once', () => {
    component.open(pending);
    component.action = 'reject';
    component.note = 'x';
    component.decide();
    expect(component.actionError).toBeTrue();
    expect(api.decide).not.toHaveBeenCalled();

    component.note = 'Não confirmado';
    api.decide.and.returnValue(of({...pending, status:'REJECTED'}));
    component.decide();
    expect(api.decide).toHaveBeenCalledOnceWith(31, 'reject', 'Não confirmado');
    expect(component.selected).toBeNull();
    expect(component.suggestions).toEqual([]);
  });

  it('retains proposal if approval conflicts with newer published changes', () => {
    component.open(pending);
    component.action = 'approve';
    api.decide.and.returnValue(throwError(() => ({status:409})));
    component.decide();
    expect(component.actionError).toBeTrue();
    expect(component.selected?.id).toBe(31);
    expect(component.suggestions.length).toBe(1);
  });
});
