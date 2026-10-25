import { of, throwError } from 'rxjs';
import { CommunityCreateComponent } from './community-create.component';

describe('Community creation onboarding', () => {
  it('reads the owned community quota and blocks creation at the limit', () => {
    const service = {
      creationQuota: jasmine.createSpy('creationQuota').and.returnValue(of({
        owned: 5, limit: 5, createdToday: 1, dailyLimit: 2, canCreate: false
      })),
      create: jasmine.createSpy('create').and.returnValue(of({ id: 42 }))
    };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.ngOnInit();
    component.name = 'Mais um grupo';
    expect(component.quota?.owned).toBe(5);
    component.create();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('does not block when the quota status endpoint is unavailable', () => {
    const service = {
      creationQuota: jasmine.createSpy('creationQuota')
        .and.returnValue(throwError(() => new Error('offline'))),
      create: jasmine.createSpy('create').and.returnValue(of({ id: 43 }))
    };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.name = 'Uma comunidade';
    component.ngOnInit();
    expect(component.quota).toBeNull();
    component.create();
    expect(service.create).toHaveBeenCalled();
  });


  it('opens the invite screen after creating a community', () => {
    const service = { create: jasmine.createSpy('create').and.returnValue(of({ id: 42 })) };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.name = 'Futebol das Quintas';

    component.create();

    expect(service.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42, 'invite']);
  });

  it('still opens the invite screen when optional photo upload fails', () => {
    const service = {
      create: jasmine.createSpy('create').and.returnValue(of({ id: 42 })),
      updatePhoto: jasmine.createSpy('updatePhoto').and.returnValue(throwError(() => new Error('upload failed')))
    };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.name = 'Futebol das Quintas';
    component.photo = new File(['photo'], 'photo.png', { type: 'image/png' });

    component.create();

    expect(service.updatePhoto).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42, 'invite']);
  });
  it('submits multiple sports with the first as the legacy primary sport', () => {
    const service = { create: jasmine.createSpy('create').and.returnValue(of({ id: 42 })) };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.name = 'Desporto entre amigos';
    component.sportSearch = 'pa';
    expect(component.sportSuggestions).toContain('Padel');
    component.addSport('Padel');
    component.addSport('Basquetebol');
    component.addSport('Padel');
    expect(component.sports).toEqual(['Padel', 'Basquetebol']);

    component.create();
    expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({
      sport: 'Padel', sports: ['Padel', 'Basquetebol']
    }));
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42, 'invite']);
  });

  it('supports sportless communities and removable selections', () => {
    const service = { create: jasmine.createSpy('create').and.returnValue(of({ id: 43 })) };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityCreateComponent(service as any, router as any);
    component.name = 'Atividades ao ar livre';
    component.addSport('Corrida');
    component.removeSport('Corrida');
    expect(component.sports).toEqual([]);
    component.create();
    expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({
      sport: null, sports: []
    }));
  });

});
