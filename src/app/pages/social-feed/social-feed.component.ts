import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AuthenticationService } from '../../services/authethication.service';
import { SocialFeedService } from '../../services/social-feed.service';
import { FeedItem } from '../model/feed-item';

@Component({
  selector: 'app-social-feed',
  templateUrl: './social-feed.component.html',
  styleUrls: ['./social-feed.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SocialFeedComponent implements OnInit {
  items: FeedItem[] = [];
  postContent = '';

  loading = false;
  posting = false;
  deletingPostId: number | null = null;
  errorMessage = '';
  actionError = '';

  readonly currentUsername: string;

  constructor(
    private feedService: SocialFeedService,
    private authenticationService: AuthenticationService
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.feedService.feed()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: items => this.items = items,
        error: () => {
          this.items = [];
          this.errorMessage = t('feedback.feed.loadError');
        }
      });
  }

  publish(): void {
    const content = this.postContent.trim();
    if (!content || this.posting) {
      return;
    }

    this.posting = true;
    this.actionError = '';

    this.feedService.createPost(content)
      .pipe(finalize(() => this.posting = false))
      .subscribe({
        next: item => {
          this.items = [item, ...this.items];
          this.postContent = '';
        },
        error: () => this.actionError = t('feedback.feed.publishError')
      });
  }

  deletePost(item: FeedItem): void {
    if (
      item.type !== 'POST'
      || item.postId === null
      || item.authorUsername !== this.currentUsername
      || this.deletingPostId !== null
    ) {
      return;
    }

    this.deletingPostId = item.postId;
    this.actionError = '';

    this.feedService.deletePost(item.postId)
      .pipe(finalize(() => this.deletingPostId = null))
      .subscribe({
        next: () => {
          this.items = this.items.filter(
            current => current.postId !== item.postId
          );
        },
        error: () => this.actionError = t('feedback.feed.deleteError')
      });
  }

  profileImage(item: FeedItem): string | null {
    const path = item.authorProfilePicUrl;
    if (!path) {
      return null;
    }

    if (
      path.startsWith('http://')
      || path.startsWith('https://')
      || path.startsWith('data:')
    ) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(item: FeedItem): string {
    return (item.authorDisplayName || item.authorUsername)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }
}
