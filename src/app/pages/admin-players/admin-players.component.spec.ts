import { of, Subject, throwError } from 'rxjs';
import { AdminPlayersComponent } from './admin-players.component';
import { AdminPlayer, AdminPlayersService } from '../../services/admin-players.service';
import { AuthenticationService } from '../../services/authethication.service';

describe('AdminPlayersComponent role changes', () => {
  let component: AdminPlayersComponent;
  let service: jasmine.SpyObj<AdminPlayersService>;
  let auth: jasmine.SpyObj<AuthenticationService>;
  const player = (): AdminPlayer => ({
    id: 2, username: 'ana', fullName: null, nickname: null,
    role: 'ROLE_USER', enabled: true, notLocked: true
  });

  beforeEach(() => {
    service = jasmine.createSpyObj('AdminPlayersService', ['search', 'changeRole']);
    auth = jasmine.createSpyObj('AuthenticationService', ['hasAnyRole']);
    auth.hasAnyRole.and.returnValue(true);
    component = new AdminPlayersComponent(service, auth);
    component.players = [player()];
  });

  it('waits for confirmation and cancellation leaves the role unchanged', () => {
    component.beginRoleChange(component.players[0]);
    expect(component.pendingRole?.role).toBe('ROLE_ADMIN');
    expect(service.changeRole).not.toHaveBeenCalled();
    component.cancelRoleChange();
    component.confirmRoleChange();
    expect(service.changeRole).not.toHaveBeenCalled();
    expect(component.players[0].role).toBe('ROLE_USER');
  });

  it('protects superadministrators and hides actions from ordinary admins', () => {
    component.beginRoleChange({ ...player(), role: 'ROLE_SUPER_ADMIN' });
    expect(component.pendingRole).toBeNull();
    auth.hasAnyRole.and.returnValue(false);
    component.beginRoleChange(player());
    expect(component.pendingRole).toBeNull();
    expect(service.changeRole).not.toHaveBeenCalled();
  });

  it('sends the expected role once and updates the player after success', () => {
    const response = new Subject<{ id: number; role: string }>();
    service.changeRole.and.returnValue(response);
    component.beginRoleChange(component.players[0]);
    component.confirmRoleChange();
    component.confirmRoleChange();
    expect(service.changeRole).toHaveBeenCalledOnceWith(2, 'ROLE_ADMIN', 'ROLE_USER');
    expect(component.players[0].role).toBe('ROLE_USER');
    response.next({ id: 2, role: 'ROLE_ADMIN' });
    response.complete();
    expect(component.players[0].role).toBe('ROLE_ADMIN');
    expect(component.changingRole).toBeFalse();
    expect(component.pendingRole).toBeNull();
    component.ngOnDestroy();
  });

  it('keeps the role unchanged when a concurrent change is reported', () => {
    service.changeRole.and.returnValue(throwError(() => ({ status: 409 })));
    component.beginRoleChange(component.players[0]);
    component.confirmRoleChange();
    expect(component.players[0].role).toBe('ROLE_USER');
    expect(component.roleErrorKey).toBe('adminPlayers.roleConflict');
    expect(component.changingRole).toBeFalse();
    component.ngOnDestroy();
  });

  it('allows removal of admin permissions but prevents promotion of inactive players', () => {
    expect(component.canChangeRole({ ...player(), enabled: false })).toBeFalse();
    service.changeRole.and.returnValue(of({ id: 2, role: 'ROLE_USER' }));
    component.players = [{ ...player(), role: 'ROLE_ADMIN' }];
    component.beginRoleChange(component.players[0]);
    component.confirmRoleChange();
    expect(service.changeRole).toHaveBeenCalledOnceWith(2, 'ROLE_USER', 'ROLE_ADMIN');
    expect(component.players[0].role).toBe('ROLE_USER');
    component.ngOnDestroy();
  });
});
