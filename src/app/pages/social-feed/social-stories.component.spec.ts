import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SocialStoriesComponent } from './social-stories.component';
import { SocialStoriesService } from '../../services/social-stories.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SocialStory } from '../model/social-story';

describe('SocialStoriesComponent', () => {
  let fixture: ComponentFixture<SocialStoriesComponent>;
  let component: SocialStoriesComponent;
  let api: jasmine.SpyObj<SocialStoriesService>;
  let communities: jasmine.SpyObj<CommunityGroupsService>;

  const picture: SocialStory = {
    id: 9, authorUsername: 'joao', displayName: 'João', avatarUrl: null,
    communityId: null, communityName: null, communityPhotoUrl: null,
    caption: 'Grande jogo', mediaUrl: '/media/stories/9.jpg', video: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), canDelete: true
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<SocialStoriesService>('SocialStoriesService', ['feed', 'get', 'publish', 'delete']);
    api.feed.and.returnValue(of([picture]));
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

  it('excludes expired stories from the visual rail', fakeAsync(() => {
    api.feed.and.returnValue(of([{...picture, expiresAt: new Date(Date.now() - 1000).toISOString()}]));
    fixture.detectChanges();
    tick();
    expect(component.storyGroups).toHaveSize(0);
  }));
});
