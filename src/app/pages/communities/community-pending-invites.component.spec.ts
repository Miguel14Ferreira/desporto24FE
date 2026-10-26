import { TestBed } from '@angular/core/testing';
import { CommunityInvite } from '../model/community-group';
import { CommunityPendingInvitesComponent } from './community-pending-invites.component';

describe('CommunityPendingInvitesComponent', () => {
  const invite: CommunityInvite = {
    id: 15, communityId: 8, communityName: 'Futebol de Domingo',
    invitedByUsername: 'ana', createdAt: '2026-10-25T12:00:00Z'
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunityPendingInvitesComponent]}).compileComponents();
  });
  function render(invites: CommunityInvite[], targetedInviteId: number | null = null) {
    const fixture=TestBed.createComponent(CommunityPendingInvitesComponent);
    fixture.componentRef.setInput('invites', invites);
    fixture.componentRef.setInput('targetedInviteId', targetedInviteId);
    fixture.detectChanges();
    return fixture;
  }
  it('shows pending invitations in original order and keeps PT/EN labels', () => {
    const fixture=render([invite, {...invite,id:16,communityName:'Voleibol'}]);
    const root=fixture.nativeElement as HTMLElement;
    const rows=root.querySelectorAll('.invite-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Futebol de Domingo');
    expect(rows[1].textContent).toContain('Voleibol');
    expect(root.querySelectorAll('button').length).toBe(4);
  });
  it('highlights only a matching invite deep link, never all pending invitations', () => {
    const root=render([invite, {...invite,id:16}],16).nativeElement as HTMLElement;
    const rows=root.querySelectorAll('.invite-row');
    expect(rows[0].classList.contains('invite-row--targeted')).toBeFalse();
    expect(rows[1].classList.contains('invite-row--targeted')).toBeTrue();
  });
  it('emits separate accept and reject intentions with the untouched original invitation', () => {
    const fixture=render([invite]);
    const accept=jasmine.createSpy('accept'),reject=jasmine.createSpy('reject');
    fixture.componentInstance.acceptRequested.subscribe(accept);
    fixture.componentInstance.rejectRequested.subscribe(reject);
    const buttons=(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    expect(accept).toHaveBeenCalledOnceWith(invite);
    expect(reject).not.toHaveBeenCalled();
    buttons[1].click();
    expect(reject).toHaveBeenCalledOnceWith(invite);
    expect(accept).toHaveBeenCalledTimes(1);
  });
  it('does not manufacture requests or perform API calls when no invitations are present', () => {
    const root=render([]).nativeElement as HTMLElement;
    expect(root.querySelectorAll('.invite-row').length).toBe(0);
    expect(root.querySelector('button')).toBeNull();
  });
});
