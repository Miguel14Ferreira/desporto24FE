import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, retry, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AuthenticationService } from '../../services/authethication.service';
import { SocialFeedService } from '../../services/social-feed.service';
import { FeedItem, SocialComment } from '../model/feed-item';

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
  postImageFile?: File;
  postImagePreview = '';

  loading = false;
  posting = false;
  deletingPostId: number | null = null;
  interactionLoadingPostId: number | null = null;
  deletingCommentId: number | null = null;
  reportingCommentId: number | null = null;
  reportedCommentIds = new Set<number>();
  reportingPostId: number | null = null;
  reportedPostIds = new Set<number>();
  openCommentPosts = new Set<number>();
  commentsByPost: Record<number, SocialComment[]> = {};
  commentDrafts: Record<number, string> = {};
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
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
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

    this.feedService.createPost(content, this.postImageFile)
      .pipe(
        timeout(10_000),
        finalize(() => this.posting = false)
      )
      .subscribe({
        next: item => {
          this.items = [item, ...this.items];
          this.postContent = '';
          this.postImageFile = undefined;
          this.postImagePreview = '';
        },
        error: () => this.actionError = t('feedback.feed.publishError')
      });
  }

  onPostImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.actionError = t('feedback.feed.imageType');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.actionError = t('feedback.feed.imageSize');
      input.value = '';
      return;
    }

    this.postImageFile = file;
    this.actionError = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.postImagePreview = typeof reader.result === 'string'
        ? reader.result
        : '';
    };
    reader.readAsDataURL(file);
  }

  removePostImage(): void {
    this.postImageFile = undefined;
    this.postImagePreview = '';
  }

  postImage(item: FeedItem): string | null {
    const path = item.imageUrl;
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

  toggleLike(item: FeedItem): void {
    if (
      item.type !== 'POST'
      || item.postId === null
      || this.interactionLoadingPostId !== null
    ) {
      return;
    }

    this.interactionLoadingPostId = item.postId;
    this.actionError = '';

    const request$ = item.likedByMe
      ? this.feedService.unlikePost(item.postId)
      : this.feedService.likePost(item.postId);

    request$
      .pipe(finalize(() => this.interactionLoadingPostId = null))
      .subscribe({
        next: status => {
          item.likedByMe = status.likedByMe;
          item.likeCount = status.likeCount;
        },
        error: () => this.actionError = t('feedback.feed.likeError')
      });
  }

  toggleComments(item: FeedItem): void {
    if (item.type !== 'POST' || item.postId === null) {
      return;
    }

    const postId = item.postId;

    if (this.openCommentPosts.has(postId)) {
      this.openCommentPosts.delete(postId);
      return;
    }

    this.openCommentPosts.add(postId);

    if (this.commentsByPost[postId]) {
      return;
    }

    this.feedService.comments(postId).subscribe({
      next: comments => this.commentsByPost[postId] = comments,
      error: () => this.actionError = t('feedback.feed.commentsLoadError')
    });
  }

  submitComment(item: FeedItem): void {
    if (
      item.type !== 'POST'
      || item.postId === null
      || this.interactionLoadingPostId !== null
    ) {
      return;
    }

    const postId = item.postId;
    const content = (this.commentDrafts[postId] || '').trim();

    if (!content) {
      return;
    }

    this.interactionLoadingPostId = postId;
    this.actionError = '';

    this.feedService.addComment(postId, content)
      .pipe(finalize(() => this.interactionLoadingPostId = null))
      .subscribe({
        next: comment => {
          this.commentsByPost[postId] = [
            ...(this.commentsByPost[postId] || []),
            comment
          ];
          this.commentDrafts[postId] = '';
          item.commentCount++;
        },
        error: () => this.actionError = t('feedback.feed.commentError')
      });
  }

  deleteComment(item: FeedItem, comment: SocialComment): void {
    if (
      item.postId === null
      || comment.authorUsername !== this.currentUsername
      || this.deletingCommentId !== null
    ) {
      return;
    }

    const postId = item.postId;
    this.deletingCommentId = comment.id;
    this.actionError = '';

    this.feedService.deleteComment(postId, comment.id)
      .pipe(finalize(() => this.deletingCommentId = null))
      .subscribe({
        next: () => {
          this.commentsByPost[postId] = (this.commentsByPost[postId] || [])
            .filter(current => current.id !== comment.id);
          item.commentCount = Math.max(0, item.commentCount - 1);
        },
        error: () => this.actionError = t('feedback.feed.commentDeleteError')
      });
  }

  reportComment(item: FeedItem, comment: SocialComment): void {
    if (
      item.postId === null
      || comment.authorUsername === this.currentUsername
      || this.reportingCommentId !== null
      || this.reportedCommentIds.has(comment.id)
    ) {
      return;
    }

    const reason = window.prompt(t('feed.reportCommentReasonPrompt'))?.trim();
    if (!reason) {
      return;
    }

    const postId = item.postId;
    this.reportingCommentId = comment.id;
    this.actionError = '';

    this.feedService.reportComment(postId, comment.id, reason.slice(0, 1000))
      .pipe(finalize(() => this.reportingCommentId = null))
      .subscribe({
        next: () => this.reportedCommentIds.add(comment.id),
        error: () => this.actionError = t('feedback.feed.commentReportError')
      });
  }

  reportPost(item: FeedItem): void {
    if (
      item.type !== 'POST'
      || item.postId === null
      || item.authorUsername === this.currentUsername
      || this.reportingPostId !== null
      || this.reportedPostIds.has(item.postId)
    ) {
      return;
    }

    const reason = window.prompt(t('feed.reportReasonPrompt'))?.trim();
    if (!reason) {
      return;
    }

    const postId = item.postId;
    this.reportingPostId = postId;
    this.actionError = '';

    this.feedService.reportPost(postId, reason.slice(0, 1000))
      .pipe(finalize(() => this.reportingPostId = null))
      .subscribe({
        next: () => this.reportedPostIds.add(postId),
        error: () => this.actionError = t('feedback.feed.reportError')
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

  commentProfileImage(comment: SocialComment): string | null {
    const path = comment.authorProfilePicUrl;
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

  commentInitials(comment: SocialComment): string {
    return (comment.authorDisplayName || comment.authorUsername)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
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
