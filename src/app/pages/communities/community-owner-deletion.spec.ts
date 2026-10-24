import { of, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';

describe('Owner-only community deletion', () => {
  let component: CommunitiesComponent;
  let deletion: jasmine.Spy;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 42, name: 'Grupo de Teste', myRole: 'OWNER' } as any;
    component.communities = [component.selected!];
    component.communityDeleteConfirming = false;
    component.communityDeleteName = '';
    component.communityDeleteLoading = false;
    component.communityDeleteError = '';
    deletion = jasmine.createSpy('deleteCommunity').and.returnValue(of(void 0));
    navigate = jasmine.createSpy('navigate');
    (component as any).communityService = { deleteCommunity: deletion };
    (component as any).router = { navigate };
  });

  it('requires owner role and a second confirmation with the exact group name', () => {
    component.confirmCommunityDeletion();
    expect(deletion).not.toHaveBeenCalled();
    component.beginCommunityDeletion();
    component.communityDeleteName = 'grupo de teste';
    component.confirmCommunityDeletion();
    expect(deletion).not.toHaveBeenCalled();
    component.communityDeleteName = 'Grupo de Teste';
    component.confirmCommunityDeletion();
    expect(deletion).toHaveBeenCalledOnceWith(42, 'Grupo de Teste');
    expect(navigate).toHaveBeenCalledOnceWith(['/menu/communities'], {
      queryParams: { view: 'mine' }
    });
    expect(component.selected).toBeUndefined();
  });

  it('never allows an administrator to delete a community', () => {
    component.selected = { id: 42, name: 'Grupo de Teste', myRole: 'ADMIN' } as any;
    component.beginCommunityDeletion();
    expect(component.communityDeleteConfirming).toBeFalse();
    component.communityDeleteConfirming = true;
    component.communityDeleteName = 'Grupo de Teste';
    component.confirmCommunityDeletion();
    expect(deletion).not.toHaveBeenCalled();
  });

  it('cancels the flow without requesting deletion', () => {
    component.beginCommunityDeletion();
    component.communityDeleteName = 'Grupo de Teste';
    component.cancelCommunityDeletion();
    expect(component.communityDeleteConfirming).toBeFalse();
    expect(component.communityDeleteName).toBe('');
    expect(deletion).not.toHaveBeenCalled();
  });

  it('keeps the community open when the server rejects a nonempty group', () => {
    deletion.and.returnValue(throwError(() => ({ status: 409 })));
    component.beginCommunityDeletion();
    component.communityDeleteName = 'Grupo de Teste';
    component.confirmCommunityDeletion();
    expect(component.selected?.id).toBe(42);
    expect(component.communityDeleteConfirming).toBeTrue();
    expect(component.communityDeleteError).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
