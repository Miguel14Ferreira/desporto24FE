import { PrivateGroupsComponent } from './private-groups.component';
import { FriendSummary } from '../model/friend-summary';

describe('Private group friend picker', () => {
  let component: PrivateGroupsComponent;

  const people: FriendSummary[] = [
    { username: 'miguel', fullName: 'Miguel Ferreira', nickname: 'Migas',
      profilePicUrl: null, chatBlocked: false, blockedByMe: false },
    { username: 'jmarques', fullName: 'João Marques', nickname: null,
      profilePicUrl: null, chatBlocked: false, blockedByMe: false },
    { username: 'monicagomes', fullName: 'Mónica Gomes', nickname: 'Monica',
      profilePicUrl: null, chatBlocked: false, blockedByMe: false }
  ];

  beforeEach(() => {
    component = Object.create(PrivateGroupsComponent.prototype) as PrivateGroupsComponent;
    component.friends = [...people];
    component.friendSearch = '';
    component.selectedNames = new Set();
    component.showCreate = false;
    component.showAdd = false;
    component.showRename = false;
    component.busy = false;
    component.groupError = '';
    component.title = '';
    component.selected = null;
  });

  it('searches by full name, nickname and username without matching case or accents', () => {
    component.openCreate();
    component.friendSearch = 'JOAO';
    expect(component.filteredInviteFriends.map(friend => friend.username)).toEqual(['jmarques']);

    component.friendSearch = 'MÍGAS';
    expect(component.filteredInviteFriends.map(friend => friend.username)).toEqual(['miguel']);

    component.friendSearch = '@monicagomes';
    expect(component.filteredInviteFriends).toEqual([]);

    component.friendSearch = 'MONICAGOMES';
    expect(component.filteredInviteFriends.map(friend => friend.username)).toEqual(['monicagomes']);
  });

  it('keeps selected friends when searching for another name or clearing the filter', () => {
    component.openCreate('Miguel');
    expect(component.selectedNames.has('miguel')).toBeTrue();

    component.friendSearch = 'joão';
    expect(component.filteredInviteFriends.map(friend => friend.username)).toEqual(['jmarques']);
    component.toggle('JMarques');

    component.friendSearch = 'nenhum resultado';
    expect(component.filteredInviteFriends).toEqual([]);
    expect([...component.selectedNames].sort()).toEqual(['jmarques', 'miguel']);

    component.clearFriendSearch();
    expect(component.filteredInviteFriends).toEqual(people);
    expect(component.selectedNames.size).toBe(2);
  });

  it('does not suggest existing group members when adding new friends', () => {
    component.selected = {
      id: 5, creatorUsername: 'organizer',
      members: [{ username: 'miguel' }]
    } as any;
    (component as any).me = 'organizer';

    component.openAdd();
    expect(component.friendSearch).toBe('');
    expect(component.invitedFriends.map(friend => friend.username)).toEqual([
      'jmarques', 'monicagomes'
    ]);
    component.friendSearch = 'monica';
    expect(component.filteredInviteFriends.map(friend => friend.username)).toEqual(['monicagomes']);
  });

  it('clears stale search state when closing and starting another invitation', () => {
    component.openCreate();
    component.friendSearch = 'joao';
    component.closeInviteDialog();
    expect(component.showCreate).toBeFalse();
    expect(component.friendSearch).toBe('');

    component.openCreate();
    expect(component.friendSearch).toBe('');
    expect(component.filteredInviteFriends.length).toBe(3);
  });

  it('does not dismiss a busy invite dialog while a save is in progress', () => {
    component.openCreate();
    component.friendSearch = 'miguel';
    component.busy = true;
    component.closeInviteDialog();
    expect(component.showCreate).toBeTrue();
    expect(component.friendSearch).toBe('miguel');
  });
});
