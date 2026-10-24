import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, of, Subject, takeUntil, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { appTranslate as t } from '../../i18n/i18n.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SocialStoriesService } from '../../services/social-stories.service';
import { CommunityGroup } from '../model/community-group';
import { SocialStory } from '../model/social-story';

interface StoryGroup {
  key: string;
  name: string;
  avatar: string | null;
  stories: SocialStory[];
}

@Component({
  selector: 'app-social-stories',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './social-stories.component.html',
  styleUrls: ['./social-stories.component.css']
})
export class SocialStoriesComponent implements OnInit, OnDestroy {
  entries: SocialStory[] = [];
  groups: CommunityGroup[] = [];
  loading = true;
  composerOpen = false;
  uploading = false;
  deleting = false;
  caption = '';
  communityId = '';
  file: File | null = null;
  filePreview: string | null = null;
  error = '';
  feedback = '';
  activeStory: SocialStory | null = null;
  private currentGroup: SocialStory[] = [];
  private storyIndex = 0;
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly stories: SocialStoriesService,
    private readonly communities: CommunityGroupsService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.reload();
    this.communities.mine().pipe(
      timeout(10000),
      catchError(() => of([] as CommunityGroup[])),
      takeUntil(this.destroyed)
    ).subscribe(groups => this.groups = groups.filter(group =>
      group.visibility === 'PUBLIC' && (group.myRole === 'OWNER' || group.myRole === 'ADMIN')
    ));
    const linkedId = this.route.snapshot.queryParamMap.get('story');
    if (linkedId && /^[1-9][0-9]*$/.test(linkedId) && Number.isSafeInteger(Number(linkedId))) {
      this.stories.get(Number(linkedId)).pipe(
        timeout(10000),
        takeUntil(this.destroyed)
      ).subscribe({
        next: story => this.showStory(story),
        error: () => this.error = t('stories.unavailable')
      });
    }
  }

  get storyGroups(): StoryGroup[] {
    const ordered = new Map<string, StoryGroup>();
    for (const entry of this.entries) {
      if (Date.parse(entry.expiresAt) <= Date.now()) continue;
      const key = entry.communityId === null
        ? 'person:' + entry.authorUsername.toLowerCase()
        : 'group:' + entry.communityId;
      let group = ordered.get(key);
      if (!group) {
        group = {
          key,
          name: entry.communityName || entry.displayName,
          avatar: this.media(entry.communityPhotoUrl || entry.avatarUrl),
          stories: []
        };
        ordered.set(key, group);
      }
      group.stories.push(entry);
    }
    return Array.from(ordered.values());
  }

  reload(): void {
    this.loading = true;
    this.stories.feed().pipe(
      timeout(10000),
      finalize(() => this.loading = false),
      takeUntil(this.destroyed)
    ).subscribe({
      next: stories => this.entries = stories,
      error: () => this.error = t('stories.loadFailed')
    });
  }

  openGroup(group: StoryGroup): void {
    this.currentGroup = [...group.stories].reverse();
    this.storyIndex = 0;
    this.activeStory = this.currentGroup[0] || null;
    this.feedback = '';
  }

  showStory(story: SocialStory): void {
    this.currentGroup = [story];
    this.storyIndex = 0;
    this.activeStory = story;
    this.feedback = '';
  }

  next(): void {
    if (this.storyIndex + 1 >= this.currentGroup.length) {
      this.close();
    } else {
      this.activeStory = this.currentGroup[++this.storyIndex];
      this.feedback = '';
    }
  }

  previous(): void {
    if (this.storyIndex > 0) {
      this.activeStory = this.currentGroup[--this.storyIndex];
      this.feedback = '';
    }
  }

  close(): void {
    this.activeStory = null;
    this.currentGroup = [];
    this.feedback = '';
  }

  @HostListener('document:keydown.escape')
  escape(): void {
    this.close();
    this.composerOpen = false;
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0];
    input.value = '';
    if (!selected) return;
    const image = ['image/jpeg', 'image/png', 'image/webp'].includes(selected.type);
    const video = ['video/mp4', 'video/webm'].includes(selected.type);
    if (!image && !video) {
      this.error = t('stories.invalidType');
      return;
    }
    if (!selected.size || selected.size > (video ? 20 : 5) * 1024 * 1024) {
      this.error = t('stories.invalidSize');
      return;
    }
    this.removeFile();
    this.file = selected;
    this.filePreview = URL.createObjectURL(selected);
    this.error = '';
  }

  removeFile(): void {
    if (this.filePreview) URL.revokeObjectURL(this.filePreview);
    this.filePreview = null;
    this.file = null;
  }

  publish(): void {
    if (this.uploading || !this.file) return;
    const group = this.communityId ? Number(this.communityId) : null;
    if (group !== null && !this.groups.some(item => item.id === group)) return;
    this.uploading = true;
    this.error = '';
    this.stories.publish(this.file, this.caption, group).pipe(
      timeout(90000),
      finalize(() => this.uploading = false),
      takeUntil(this.destroyed)
    ).subscribe({
      next: story => {
        this.entries = [story, ...this.entries.filter(item => item.id !== story.id)];
        this.removeFile();
        this.caption = '';
        this.communityId = '';
        this.composerOpen = false;
        this.feedback = t('stories.published');
      },
      error: () => this.error = t('stories.publishFailed')
    });
  }

  deleteStory(): void {
    if (!this.activeStory?.canDelete || this.deleting
        || !window.confirm(t('stories.deleteConfirm'))) return;
    const id = this.activeStory.id;
    this.deleting = true;
    this.stories.delete(id).pipe(
      timeout(10000),
      finalize(() => this.deleting = false),
      takeUntil(this.destroyed)
    ).subscribe({
      next: () => {
        this.entries = this.entries.filter(entry => entry.id !== id);
        this.close();
      },
      error: () => this.error = t('stories.deleteFailed')
    });
  }

  async shareStory(): Promise<void> {
    if (!this.activeStory) return;
    const url = new URL('/menu/feed?story=' + this.activeStory.id, window.location.origin).href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: t('stories.title'), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.feedback = t('stories.copied');
    } catch {
      this.feedback = t('stories.shareFallback');
    }
  }

  media(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    return environment.apiUrl + (url.startsWith('/') ? url : '/' + url);
  }

  ngOnDestroy(): void {
    this.removeFile();
    this.destroyed.next();
    this.destroyed.complete();
  }
}
