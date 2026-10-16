import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { VenueService, VenuePhoto, VenueSportCondition } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueDetailsComponent } from './venue-details.component';

describe('Venue details stale HTTP response protection', () => {
  let component: VenueDetailsComponent;
  let service: jasmine.SpyObj<VenueService>;
  const photo = (id: number): VenuePhoto => ({
    id, photoUrl: 'https://example.test/venue/' + id + '.jpg',
    uploadedByUsername: 'player', createdAt: '2026-10-16T09:00:00Z'
  });
  const condition = (id: number): VenueSportCondition => ({
    id, sport: 'Futsal', conditions: 'Piso preparado',
    informationSource: 'COMMUNITY', createdByUsername: 'player',
    createdAt: '2026-10-16T09:00:00Z'
  });
  const uploadInput = (): HTMLInputElement => ({
    files: [new File(['photo'], 'venue.jpg', { type: 'image/jpeg' })],
    value: 'C:\\fakepath\\venue.jpg'
  } as unknown as HTMLInputElement);

  beforeEach(() => {
    service = jasmine.createSpyObj<VenueService>('VenueService', [
      'listPhotos', 'listSportConditions', 'addPhoto', 'addSportCondition'
    ]);
    component = new VenueDetailsComponent({} as ActivatedRoute, service);
    component.venue = { id: 7 } as Venue;
  });

  it('keeps a newly uploaded photo when an older list returns empty', () => {
    const oldList = new Subject<VenuePhoto[]>();
    service.listPhotos.and.returnValue(oldList.asObservable());
    service.addPhoto.and.returnValue(of(photo(21)));

    component.retryPhotos();
    expect(component.photosLoading).toBeTrue();
    const input = uploadInput();
    component.uploadPhoto({ target: input } as unknown as Event);
    expect(component.photos.map(item => item.id)).toEqual([21]);
    expect(component.photosLoading).toBeFalse();

    oldList.next([]);
    oldList.complete();
    expect(component.photos.map(item => item.id)).toEqual([21]);
    expect(component.photosLoadError).toBeFalse();
    expect(input.value).toBe('');
  });

  it('ignores an older photo loading error after a successful upload', () => {
    const oldList = new Subject<VenuePhoto[]>();
    service.listPhotos.and.returnValue(oldList.asObservable());
    service.addPhoto.and.returnValue(of(photo(31)));

    component.retryPhotos();
    component.uploadPhoto({ target: uploadInput() } as unknown as Event);
    oldList.error(new Error('late network failure'));

    expect(component.photos.map(item => item.id)).toEqual([31]);
    expect(component.photosLoadError).toBeFalse();
    expect(component.photosLoading).toBeFalse();
  });

  it('keeps a newly added sport condition when its initial list arrives late', () => {
    const oldList = new Subject<VenueSportCondition[]>();
    service.listSportConditions.and.returnValue(oldList.asObservable());
    service.addSportCondition.and.returnValue(of(condition(11)));

    component.retrySportConditions();
    component.sportConditionSport = 'Futsal';
    component.sportConditionText = 'Piso preparado';
    component.addSportCondition();
    oldList.next([]);
    oldList.complete();

    expect(component.sportConditions.map(item => item.id)).toEqual([11]);
    expect(component.sportConditionsLoading).toBeFalse();
    expect(component.sportConditionsLoadError).toBeFalse();
  });

  it('ignores an earlier failed conditions list after successfully saving', () => {
    const oldList = new Subject<VenueSportCondition[]>();
    service.listSportConditions.and.returnValue(oldList.asObservable());
    service.addSportCondition.and.returnValue(of(condition(11)));

    component.retrySportConditions();
    component.sportConditionSport = 'Futsal';
    component.sportConditionText = 'Piso preparado';
    component.addSportCondition();
    oldList.error(new Error('stale timeout'));

    expect(component.sportConditions.map(item => item.id)).toEqual([11]);
    expect(component.sportConditionsLoadError).toBeFalse();
  });

  it('allows only the latest photo refresh to update results and loading', () => {
    const oldList = new Subject<VenuePhoto[]>();
    const latest = new Subject<VenuePhoto[]>();
    service.listPhotos.and.returnValues(oldList.asObservable(), latest.asObservable());

    component.retryPhotos();
    component.retryPhotos();
    oldList.next([photo(1)]);
    oldList.complete();
    expect(component.photos).toEqual([]);
    expect(component.photosLoading).toBeTrue();

    latest.next([photo(2)]);
    latest.complete();
    expect(component.photos.map(item => item.id)).toEqual([2]);
    expect(component.photosLoading).toBeFalse();
  });

  it('allows only the latest conditions refresh to update results and loading', () => {
    const oldList = new Subject<VenueSportCondition[]>();
    const latest = new Subject<VenueSportCondition[]>();
    service.listSportConditions.and.returnValues(oldList.asObservable(), latest.asObservable());

    component.retrySportConditions();
    component.retrySportConditions();
    oldList.next([condition(1)]);
    oldList.complete();
    expect(component.sportConditions).toEqual([]);
    expect(component.sportConditionsLoading).toBeTrue();

    latest.next([condition(2)]);
    latest.complete();
    expect(component.sportConditions.map(item => item.id)).toEqual([2]);
    expect(component.sportConditionsLoading).toBeFalse();
  });

  it('keeps older list results usable if the photo upload fails', () => {
    const oldList = new Subject<VenuePhoto[]>();
    service.listPhotos.and.returnValue(oldList.asObservable());
    service.addPhoto.and.returnValue(throwError(() => new Error('upload failed')));

    component.retryPhotos();
    component.uploadPhoto({ target: uploadInput() } as unknown as Event);
    expect(component.photoUploadError).toBeTrue();
    oldList.next([photo(15)]);
    oldList.complete();

    expect(component.photos.map(item => item.id)).toEqual([15]);
    expect(component.photosLoadError).toBeFalse();
  });
});
