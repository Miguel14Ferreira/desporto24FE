import { of, throwError } from 'rxjs';
import { CommunityCreateComponent } from './community-create.component';

describe('Community creation onboarding', () => {
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
});
