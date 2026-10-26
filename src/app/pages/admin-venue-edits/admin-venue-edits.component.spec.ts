import { ChangeDetectorRef } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

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
      ['pending', 'history', 'decide']);
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


  it('clears stale pagination when a subsequent request fails', () => {
    api.pending.and.returnValue(of({ suggestions: [pending], page: 0, hasMore: true }));
    component.load(0);
    expect(component.hasMore).toBeTrue();

    api.pending.and.returnValue(throwError(() => ({status: 503})));
    component.load(1);
    expect(component.page).toBe(1);
    expect(component.hasMore).toBeFalse();
    expect(component.loadError).toBeTrue();
    expect(component.suggestions).toEqual([]);
  });

  it('keeps moderation context stable while decision is in progress', () => {
    const pendingDecision = new Subject<VenueEditSuggestion>();
    api.decide.and.returnValue(pendingDecision.asObservable());
    component.open(pending);
    component.action = 'approve';
    component.decide();
    expect(component.updating).toBeTrue();
    const pageBefore = component.page;
    component.changeMode('history');
    component.load(1);
    expect(component.mode).toBe('pending');
    expect(component.page).toBe(pageBefore);
    expect(api.history).not.toHaveBeenCalled();
    expect(api.pending).toHaveBeenCalledTimes(1);
    pendingDecision.next({ ...pending, status: 'APPROVED' });
    pendingDecision.complete();
    expect(component.updating).toBeFalse();
    expect(component.selected).toBeNull();
    api.history.and.returnValue(of({ suggestions: [], page: 0, hasMore: false }));
    component.changeMode('history');
    expect(api.history).toHaveBeenCalledOnceWith(0);
  });

  it('loads completed moderation records without changing the pending queue', () => {
    const approved: VenueEditSuggestion = {
      ...pending, id: 45, status: 'APPROVED', proposed: {contact: '225073300'},
      before: {contact: null},
      reviewedAt: '2026-10-25T20:00:00Z', reviewedByUsername: 'moderator',
      sourceUrl: 'https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao',
      sourceReviewConfirmedAt: '2026-10-25T20:00:00Z'
    };
    const rejected: VenueEditSuggestion = {
      ...pending, id: 46, status: 'REJECTED',
      reviewedAt: '2026-10-25T19:00:00Z', reviewedByUsername: 'moderator',
      decisionNote: 'Contacto sem confirmação', sourceReviewConfirmedAt: null
    };
    api.history.and.returnValue(of({ suggestions: [approved, rejected], page: 0, hasMore: false }));
    component.changeMode('history');
    expect(component.mode).toBe('history');
    expect(component.page).toBe(0);
    expect(api.history).toHaveBeenCalledOnceWith(0);
    expect(component.suggestions.map(x => x.status)).toEqual(['APPROVED', 'REJECTED']);
    expect(component.suggestions[0].sourceReviewConfirmedAt).toBe('2026-10-25T20:00:00Z');
    expect(component.suggestions[1].sourceReviewConfirmedAt).toBeNull();

    component.open(approved);
    component.action = 'approve';
    component.sourceReviewed = true;
    component.decide();
    expect(api.decide).not.toHaveBeenCalled();
    component.changeMode('pending');
    expect(component.selected).toBeNull();
    expect(component.suggestions).toEqual([pending]);
    expect(api.pending).toHaveBeenCalledTimes(2);
  });

  it('paginates history independently and shows errors without stale pending actions', () => {
    api.history.and.returnValue(of({ suggestions: [], page: 1, hasMore: true }));
    component.changeMode('history');
    component.load(1);
    expect(api.history).toHaveBeenCalledWith(1);
    expect(component.page).toBe(1);
    expect(component.hasMore).toBeTrue();
    api.history.and.returnValue(throwError(() => ({status:503})));
    component.load(0);
    expect(component.loadError).toBeTrue();
    expect(component.suggestions).toEqual([]);
    expect(component.selected).toBeNull();
    expect(api.decide).not.toHaveBeenCalled();
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


  it('exposes trusted-syntax HTTPS evidence for name corrections without contact attestation', () => {
    const nameSuggestion: VenueEditSuggestion = {
      ...pending, sourceUrl:
        'https://www.estadio.ulisboa.pt/sites/default/files/documents/document/2026-04/a3-mapa-reservas.pdf'
    };
    component.open(nameSuggestion);
    expect(component.hasProposedContact(nameSuggestion)).toBeFalse();
    expect(component.sourceLink(nameSuggestion)).toContain('estadio.ulisboa.pt');
    expect(component.canApproveSelected()).toBeTrue();
    component.action = 'approve';
    api.decide.and.returnValue(of({ ...nameSuggestion, status: 'APPROVED' }));
    component.decide();
    expect(api.decide).toHaveBeenCalledOnceWith(31, 'approve', '');
  });


  it('requires verified HTTPS evidence before approving a GPS change', () => {
    const gps = { ...pending,
      proposed: { latitude: '38.72', longitude: '-9.14' },
      before: { latitude: null, longitude: null },
      sourceUrl: 'https://example.org/municipio/recinto'
    };
    component.open(gps);
    component.action = 'approve';
    expect(component.needsEvidenceReview(gps)).toBeTrue();
    expect(component.canApproveSelected()).toBeFalse();
    component.decide();
    expect(api.decide).not.toHaveBeenCalled();
    component.sourceReviewed = true;
    api.decide.and.returnValue(of({ ...gps, status: 'APPROVED' }));
    component.decide();
    expect(api.decide).toHaveBeenCalledWith(gps.id, 'approve', '', true);
  });

  it('requires source verification before approving a contact and then sends one decision', () => {
    const contactSuggestion: VenueEditSuggestion = {
      ...pending, before: {contact: null}, proposed: {contact: '225073300'},
      sourceUrl: 'https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao'
    };
    component.open(contactSuggestion);
    expect(component.hasProposedContact(contactSuggestion)).toBeTrue();
    expect(component.sourceLink(contactSuggestion)).toContain('agoraporto.pt');
    component.action = 'approve';
    component.decide();
    expect(component.actionError).toBeTrue();
    expect(api.decide).not.toHaveBeenCalled();
    component.sourceReviewed = true;
    api.decide.and.returnValue(of({ ...contactSuggestion, status: 'APPROVED' }));
    component.decide();
    expect(api.decide).toHaveBeenCalledOnceWith(31, 'approve', '', true);
    expect(component.selected).toBeNull();
  });

  it('blocks contact approval without a safe source, preserving rejection', () => {
    const missingSource = { ...pending, before: {contact: null}, proposed: {contact:'225073300'} };
    component.open(missingSource);
    expect(component.sourceLink(missingSource)).toBeNull();
    component.sourceReviewed = true;
    expect(component.canApproveSelected()).toBeFalse();
    component.action = 'approve';
    component.decide();
    expect(api.decide).not.toHaveBeenCalled();
    expect(component.actionError).toBeTrue();

    component.action = 'reject';
    component.note = 'Contactos sem fonte verificável';
    api.decide.and.returnValue(of({ ...missingSource, status: 'REJECTED' }));
    component.decide();
    expect(api.decide).toHaveBeenCalledOnceWith(31, 'reject', 'Contactos sem fonte verificável');
    expect(component.selected).toBeNull();
  });

  it('rejects spoofed and non-HTTPS submitted source links', () => {
    const item = { ...pending, proposed: {contact:'225073300'} };
    for (const sourceUrl of [
      'https://user@www.agoraporto.pt/a',
      'https://www.agoraporto.pt.evil.test:8080/a',
      'http://www.agoraporto.pt/a',
      'javascript:alert(1)',
      'https://localhost/a'
    ]) expect(component.sourceLink({ ...item, sourceUrl })).toBeNull();
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
