import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { SocialStoriesComponent } from './social-stories.component';
import { SocialStoriesService } from '../../services/social-stories.service';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SocialStory } from '../model/social-story';

describe('SocialStoriesComponent', () => {
  let fixture: ComponentFixture<SocialStoriesComponent>;
  let component: SocialStoriesComponent;
  let api: jasmine.SpyObj<SocialStoriesService>;
  let communities: jasmine.SpyObj<CommunityGroupsService>;
  let direct: jasmine.SpyObj<DirectChatService>;

  const picture: SocialStory = {
    id: 9, authorUsername: 'joao', displayName: 'João', avatarUrl: null,
    communityId: null, communityName: null, communityPhotoUrl: null,
    caption: 'Grande jogo', mediaUrl: '/media/stories/9.jpg', video: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), canDelete: true
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<SocialStoriesService>('SocialStoriesService', ['feed', 'mine', 'get', 'publish', 'delete']);
    api.feed.and.returnValue(of([picture]));
    direct = jasmine.createSpyObj<DirectChatService>('DirectChatService', ['send']);
    direct.send.and.returnValue(of({} as any));
    api.mine.and.returnValue(of([picture]));
    communities = jasmine.createSpyObj<CommunityGroupsService>('CommunityGroupsService', ['mine']);
    communities.mine.and.returnValue(of([
      { id: 3, name: 'CNG', visibility: 'PUBLIC', myRole: 'ADMIN' },
      { id: 4, name: 'Privada', visibility: 'PRIVATE', myRole: 'OWNER' },
      { id: 5, name: 'Sem permissão', visibility: 'PUBLIC', myRole: 'MEMBER' }
    ] as any));
    await TestBed.configureTestingModule({
      imports: [SocialStoriesComponent],
      providers: [
        { provide: SocialStoriesService, useValue: api },
        { provide: DirectChatService, useValue: direct },
        { provide: CommunityGroupsService, useValue: communities },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SocialStoriesComponent);
    component = fixture.componentInstance;
  });

  it('shows active Stories and only offers public communities managed by the viewer', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.storyGroups).toHaveSize(1);
    expect(component.storyGroups[0].name).toBe('João');
    expect(component.groups.map(c => c.id)).toEqual([3]);
    expect(fixture.nativeElement.querySelectorAll('.story-bubble').length).toBe(1);
  }));

  it('groups several Stories from the same author and lets viewers move between them', fakeAsync(() => {
    const older = { ...picture, id: 8, createdAt: new Date(Date.now() - 1000).toISOString() };
    api.feed.and.returnValue(of([picture, older]));
    fixture.detectChanges();
    tick();
    expect(component.storyGroups).toHaveSize(1);
    expect(component.storyGroups[0].stories).toHaveSize(2);
    component.openGroup(component.storyGroups[0]);
    expect(component.activeStory?.id).toBe(8);
    component.next();
    expect(component.activeStory?.id).toBe(9);
    component.next();
    expect(component.activeStory).toBeNull();
  }));

  it('blocks unsupported media and oversized videos in the browser', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    for (const file of [
      new File(['invalid'], 'a.gif', { type: 'image/gif' }),
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'a.mp4', { type: 'video/mp4' })
    ]) {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      component.pickFile({ target: input } as unknown as Event);
      expect(component.file).toBeNull();
      expect(component.error).toBeTruthy();
    }
  }));

  it('does not leave the loading indicator stuck when the API times out', fakeAsync(() => {
    api.feed.and.returnValue(NEVER);
    fixture.detectChanges();
    tick(10001);
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(component.error).toBeTruthy();
    expect(component.storyGroups).toHaveSize(1); // Author-owned fallback
    expect(component.mineEntries).toHaveSize(1);
  }));

  it('shows an owned active story when discovery returns an empty result', fakeAsync(() => {
    api.feed.and.returnValue(of([]));
    fixture.detectChanges();
    tick();
    expect(component.mineEntries).toHaveSize(1);
    expect(component.storyGroups).toHaveSize(1);
  }));

  it('displays the @username and hides the native video player controls and dates', fakeAsync(() => {
    api.feed.and.returnValue(of([{ ...picture, video: true }]));
    fixture.detectChanges();
    tick();
    component.openGroup(component.storyGroups[0]);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('.story-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('@joao');
    expect(dialog.querySelector('video')?.hasAttribute('controls')).toBeFalse();
    expect(dialog.querySelector('.story-progress-track')).toBeTruthy();
    expect(dialog.textContent).not.toContain('dd/MM');
    expect(dialog.querySelector('.story-dialog-footer')).toBeNull();
    component.close();
  }));

  it('advances a loaded photo when its seven-second story duration expires', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.openGroup(component.storyGroups[0]);
    component.onImageLoaded();
    tick(7100);
    expect(component.activeStory).toBeNull();
  }));

  it('sends an explicit Story reply through existing private chat with the Story link', fakeAsync(() => {
    const other = { ...picture, canDelete: false };
    api.feed.and.returnValue(of([other]));
    api.mine.and.returnValue(of([]));
    fixture.detectChanges();
    tick();
    component.openGroup(component.storyGroups[0]);
    component.replyText = 'Boa!';
    component.replyToStory();
    tick();
    expect(direct.send).toHaveBeenCalledWith('joao', jasmine.stringMatching(/Boa![\s\S]*story=9/));
    expect(component.replyText).toBe('');
    component.close();
  }));

  it('excludes expired stories from the visual rail', fakeAsync(() => {
    api.feed.and.returnValue(of([{...picture, expiresAt: new Date(Date.now() - 1000).toISOString()}]));
    api.mine.and.returnValue(of([]));
    fixture.detectChanges();
    tick();
    expect(component.storyGroups).toHaveSize(0);
  }));
});
