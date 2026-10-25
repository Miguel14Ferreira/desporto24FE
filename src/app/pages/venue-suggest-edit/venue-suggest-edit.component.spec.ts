import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Venue } from '../model/venue';
import { VenueService } from '../../services/venue.service';
import {
  VenueEditSuggestionsService, VenueEditSuggestion
} from '../../services/venue-edit-suggestions.service';
import { VenueSuggestEditComponent } from './venue-suggest-edit.component';

describe('VenueSuggestEditComponent', () => {
  const venue = {
    id: 7, name: 'Pavilhão Antigo', city: 'Sintra', district: 'Lisboa',
    address: 'Rua A', sports: 'Futsal', website: null, openingHours: null, contact: null
  } as Venue;
  const route = { snapshot: { paramMap: { get: () => '7' } } } as unknown as ActivatedRoute;

  let api: jasmine.SpyObj<VenueEditSuggestionsService>;
  let venues: jasmine.SpyObj<VenueService>;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let component: VenueSuggestEditComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj<VenueEditSuggestionsService>('VenueEditSuggestionsService',
      ['submit', 'mine']);
    venues = jasmine.createSpyObj<VenueService>('VenueService', ['get']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    venues.get.and.returnValue(of(venue));
    api.mine.and.returnValue(throwError(() => ({status:404})));
    component = new VenueSuggestEditComponent(route, venues, api, cdr);
    component.ngOnInit();
  });

  it('shows live venue fields without modifying them', () => {
    expect(component.loading).toBeFalse();
    expect(component.draft.name).toBe('Pavilhão Antigo');
    expect(component.changeCount).toBe(0);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('only submits changed fields and a user explanation', () => {
    const pending: VenueEditSuggestion = {
      id: 22, venueId: 7, venueName: 'Pavilhão Antigo', status: 'PENDING',
      before: { name: 'Pavilhão Antigo' },
      proposed: { name: 'Pavilhão Atualizado' },
      reason: 'Confirmado na entrada', submittedByUsername: 'member',
      submittedAt: '2026-10-25T12:00:00Z', reviewedByUsername:null,
      reviewedAt:null, decisionNote:null
    };
    api.submit.and.returnValue(of(pending));
    component.draft.name = 'Pavilhão Atualizado';
    component.reason = 'Confirmado na entrada';
    component.submit();
    expect(api.submit).toHaveBeenCalledOnceWith(7, {
      name: 'Pavilhão Atualizado'
    }, 'Confirmado na entrada');
    expect(component.submitted).toBeTrue();
    expect(component.last?.status).toBe('PENDING');
  });


  it('requires a valid official HTTPS source when adding a contact', () => {
    component.draft.contact = '225 073 300';
    component.reason = 'Confirmado na página oficial da piscina';
    expect(component.contactEvidenceRequired).toBeTrue();
    expect(component.validContactSource).toBeFalse();
    component.submit();
    expect(component.sourceUrlInvalid).toBeTrue();
    expect(api.submit).not.toHaveBeenCalled();

    for (const unsafe of ['http://www.agoraporto.pt/piscina',
      'https://user:password@www.agoraporto.pt/piscina',
      'https://localhost/piscina', 'https://127.0.0.1/phone',
      'javascript:alert(1)']) {
      component.sourceUrl = unsafe;
      expect(component.validContactSource).toBeFalse();
    }

    component.sourceUrl = 'https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao';
    expect(component.validContactSource).toBeTrue();
    const receipt = {
      id: 32, venueId: 7, venueName: venue.name, status: 'PENDING',
      before: { contact: null }, proposed: { contact: '225 073 300' },
      sourceUrl: component.sourceUrl, reason: component.reason,
      submittedByUsername: 'member', submittedAt: '2026-10-25T18:00:00Z',
      reviewedByUsername: null, reviewedAt: null, decisionNote: null
    } as VenueEditSuggestion;
    api.submit.and.returnValue(of(receipt));
    component.submit();
    expect(api.submit).toHaveBeenCalledOnceWith(7,
      { contact: '225 073 300' }, component.reason, component.sourceUrl);
    expect(component.submitted).toBeTrue();
    expect(venue.contact).toBeNull();
  });

  it('allows removing an erroneous contact without requiring a source URL', () => {
    component.venue = { ...venue, contact: '225000000' };
    component.draft.contact = '';
    component.reason = 'Este contacto deixou de funcionar no recinto';
    expect(component.contactEvidenceRequired).toBeFalse();
    expect(component.validContactSource).toBeTrue();
    api.submit.and.returnValue(of({
      id: 34, venueId: 7, venueName: venue.name, status: 'PENDING',
      before: { contact: '225000000' }, proposed: { contact: '' },
      reason: component.reason, submittedByUsername: 'member',
      submittedAt: '2026-10-25T18:00:00Z', reviewedByUsername:null,
      reviewedAt:null, decisionNote:null
    }));
    component.submit();
    expect(api.submit).toHaveBeenCalledOnceWith(7, { contact: '' }, component.reason);
  });

  it('does not send unchanged data', () => {
    component.reason = 'Confirmado no site oficial';
    component.submit();
    expect(component.missingChanges).toBeTrue();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('prevents another proposal while a previous one is pending', () => {
    component.last = {
      id: 23, venueId:7, venueName:'Pavilhão Antigo', status:'PENDING',
      before:{}, proposed:{}, reason:'Confirmado no local', submittedByUsername:'x',
      submittedAt:'2026-10-25T12:00:00Z', reviewedByUsername:null,
      reviewedAt:null, decisionNote:null
    };
    component.draft.name = 'Pavilhão Novo';
    component.reason = 'Acabei de verificar';
    component.submit();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('validates the sport catalogue through the selector', () => {
    component.addSport('Padel');
    expect(component.changes.sports).toBe('Futsal;Padel');
    component.removeSport('Futsal');
    expect(component.changes.sports).toBe('Padel');
  });
});
