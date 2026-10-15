import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, debounceTime, finalize, forkJoin, of, retry, switchMap, takeUntil, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AuthenticationService } from '../../services/authethication.service';
import { SocialFeedService } from '../../services/social-feed.service';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
import { SessionSummary } from '../model/session-summary';
import { FeedItem, SocialComment } from '../model/feed-item';
import { CommunityProfile } from '../model/community-profile';

@Component({
  selector: 'app-social-feed',
  templateUrl: './social-feed.component.html',
  styleUrls: ['./social-feed.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SocialFeedComponent implements OnInit, OnDestroy {
  items: FeedItem[] = [];
  postContent = '';
  postImageFile?: File;
  postImagePreview = '';
  availableSessions: SessionSummary[] = [];
  sessionSearch = '';
  sessionPickerExpanded = false;
  get showSessionPicker(): boolean {
    return this.sessionPickerExpanded || this.selectedSessionId !== null;
  }

  private completedSessions: SessionSummary[] = [];
  private discoveredSessions: SessionSummary[] = [];

  private readonly sessionSearchChanges = new Subject<string>();
  private readonly destroyed = new Subject<void>();
  get filteredSessions(): SessionSummary[] { return this.availableSessions; }
  suggestedSessions: SessionSummary[] = [];
  suggestedPeople: CommunityProfile[] = [];
  selectedSessionId: number | null = null;
  postGameSessionId: number | null = null;
  get postGameSession(): SessionSummary | null {
    if (this.postGameSessionId === null || this.selectedSessionId !== this.postGameSessionId) {
      return null;
    }
    return this.availableSessions.find(session => session.id === this.postGameSessionId) ?? null;
  }

  detachPostGameSession(): void {
    if (this.posting || !this.postGameSession) {
      return;
    }
    this.selectedSessionId = null;
    this.postGameSessionId = null;
  }

  readonly postGamePromptKeys = [
    'feed.postGamePrompt.bestMoment',
    'feed.postGamePrompt.team',
    'feed.postGamePrompt.nextGame'
  ];
  loadingSessions = false;
  sessionSearchError = false;

  loading = false;
  posting = false;
  deletingPostId: number | null = null;
  hidingAttendanceSessionId: number | null = null;
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
  sharingSessionId: number | null = null;
  shareFeedbackSessionId: number | null = null;
  shareFeedbackMessage = '';
  manualShareItem: FeedItem | null = null;
  manualShareUrl = '';

  readonly currentUsername: string;

  constructor(
    private feedService: SocialFeedService,
    private sessionService: SessionService,
    private authenticationService: AuthenticationService,
    private route: ActivatedRoute,
    private communityService: CommunityService
  ) {
    this.authenticationService.isLoggedIn();
    this.currentUsername = this.authenticationService.loggedInPerfilname || '';
  }

  ngOnInit(): void {
    this.load();
    this.loadSuggestedPeople();
    this.preparePostGameMoment();
    this.loadCompletedSessions();
    this.sessionSearchChanges.pipe(
      debounceTime(350),
      switchMap(query => {
        this.loadingSessions = true;
        this.sessionSearchError = false;
        return this.sessionService.discover({ query, privateGame: false, availability: 'available', sort: 'date' })
          .pipe(
            timeout(10_000),
            catchError(() => of(null as SessionSummary[] | null))
          );
      }),
      takeUntil(this.destroyed)
    ).subscribe(sessions => {
      this.loadingSessions = false;
      if (sessions === null) {
        this.sessionSearchError = true;
        return;
      }
      this.discoveredSessions = sessions.filter(session => session.audience !== 'COMMUNITY_ONLY');
      if (!this.sessionSearch.trim()) {
        this.suggestedSessions = this.discoveredSessions
          .filter(session => session.status?.toUpperCase() === 'OPEN'
            && !session.privateGame && session.participantCount < session.maxParticipants
            && !session.joinedByViewer && !session.waitlistedByViewer
            && Date.parse(session.gameDate) > Date.now())
          .sort((first, second) => Date.parse(first.gameDate) - Date.parse(second.gameDate))
          .slice(0, 3);
      }
      this.refreshSelectableSessions();
    });
    this.onSessionSearchChange('');
  }

  private loadSuggestedPeople(): void {
    if (!this.currentUsername) {
      return;
    }
    this.communityService.publicProfile(this.currentUsername)
      .pipe(
        timeout(10_000),
        catchError(() => of(null as CommunityProfile | null)),
        switchMap(me => forkJoin({
          profiles: this.communityService.discoverProfiles().pipe(
            timeout(10_000),
            catchError(() => of([] as CommunityProfile[]))
          ),
          friends: this.communityService.friends().pipe(timeout(10_000))
        }).pipe(
          // Without the friends list, do not risk recommending existing friends.
          catchError(() => of({ profiles: [] as CommunityProfile[], friends: [] })),
          switchMap(({ profiles, friends }) => of(this.rankSuggestedPeople(
            profiles, me, new Set(friends.map(friend => friend.username.toLowerCase()))
          )))
        )),
        takeUntil(this.destroyed)
      )
      .subscribe(profiles => this.suggestedPeople = profiles);
  }

  private rankSuggestedPeople(profiles: CommunityProfile[], me: CommunityProfile | null, friends: Set<string>): CommunityProfile[] {
    const sports = new Set((me?.favoriteSports || '').split(/[,;|]/)
      .map(value => this.normalizeSuggestion(value)).filter(Boolean));
    const location = this.normalizeSuggestion(me?.location || '');
    return profiles
      .filter(profile => profile.username?.trim()
        && profile.username.toLowerCase() !== this.currentUsername.toLowerCase()
        && !friends.has(profile.username.toLowerCase()))
      .map((profile, index) => {
        const theirSports = (profile.favoriteSports || '').split(/[,;|]/)
          .map(value => this.normalizeSuggestion(value));
        const sameSport = sports.size > 0 && theirSports.some(sport => sports.has(sport));
        const sameLocation = Boolean(location && this.normalizeSuggestion(profile.location || '') === location);
        return { profile, index, score: Number(sameSport) * 2 + Number(sameLocation) };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 3)
      .map(item => item.profile);
  }

  private normalizeSuggestion(value: string): string {
    return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  suggestedProfileImage(profile: CommunityProfile): string | null {
    const path = profile.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  private loadCompletedSessions(): void {
    this.sessionService.mine().pipe(
      timeout(10_000),
      catchError(() => of(null)),
      takeUntil(this.destroyed)
    ).subscribe(mine => {
      if (!mine) {
        return;
      }
      const seen = new Set<number>();
      this.completedSessions = [...mine.created, ...mine.joined]
        .filter(session => {
          if (session.status !== 'COMPLETED' || session.privateGame
              || session.audience === 'COMMUNITY_ONLY' || seen.has(session.id)) {
            return false;
          }
          seen.add(session.id);
          return true;
        })
        .sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate))
        .slice(0, 20);
      this.refreshSelectableSessions();
    });
  }

  private refreshSelectableSessions(): void {
    const query = this.sessionSearch.trim().toLocaleLowerCase();
    const completed = this.completedSessions.filter(session =>
      !query || (session.sport + ' ' + session.city).toLocaleLowerCase().includes(query)
    );
    const selected = this.availableSessions.find(session => session.id === this.selectedSessionId);
    const byId = new Map<number, SessionSummary>();
    [...(selected ? [selected] : []), ...completed, ...this.discoveredSessions]
      .forEach(session => {
        if (!byId.has(session.id)) {
          byId.set(session.id, session);
        }
      });
    this.availableSessions = [...byId.values()];
  }

  onLinkedSessionChange(sessionId: number | null): void {
    this.selectedSessionId = sessionId;
    this.postGameSessionId = this.availableSessions
      .find(session => session.id === sessionId && session.status === 'COMPLETED')?.id ?? null;
  }

  private preparePostGameMoment(): void {
    const raw = this.route.snapshot.queryParamMap.get('momentSession');
    if (!raw || !/^[1-9]\d*$/.test(raw)) {
      return;
    }
    const id = Number(raw);
    if (!Number.isSafeInteger(id)) {
      return;
    }

    this.sessionService.detail(id).pipe(
      timeout(10_000),
      catchError(() => of(null))
    ).subscribe(session => {
      if (!session || session.id !== id
        || session.status !== 'COMPLETED'
        || session.canSharePublicly !== true
        || session.privateGame
        || (!session.joined
          && (!this.currentUsername
            || session.creatorUsername?.toLowerCase() !== this.currentUsername.toLowerCase()))) {
        return;
      }
      this.postGameSessionId = id;
      this.selectedSessionId = id;
      this.availableSessions = [session, ...this.availableSessions.filter(item => item.id !== id)];
    });
  }

  applyPostGamePrompt(key: string): void {
    if (this.postGameSessionId === null
      || this.selectedSessionId !== this.postGameSessionId
      || this.posting
      || !this.postGamePromptKeys.includes(key)) {
      return;
    }
    const suggestion = t(key);
    const current = this.postContent.trim();
    if (current.includes(suggestion)) {
      return;
    }
    const next = current ? current + '\n' + suggestion : suggestion;
    if (next.length <= 1000) {
      this.postContent = next;
    }
  }

  onSessionSearchChange(query: string): void {
    this.sessionSearch = query;
    this.refreshSelectableSessions();
    this.sessionSearchChanges.next(query.trim());
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
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

    this.feedService.createPost(content, this.postImageFile, this.selectedSessionId ?? undefined)
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
          this.selectedSessionId = null;
          this.postGameSessionId = null;
          this.sessionPickerExpanded = false;
        },
        error: () => this.actionError = t('feedback.feed.publishError')
      });
  }

  async shareSession(item: FeedItem): Promise<void> {
    const sessionId = item.sessionId;
    if (sessionId === null || this.sharingSessionId !== null) {
      return;
    }

    const url = new URL('/sessions/' + sessionId, window.location.origin).href;
    const title = item.sport
      ? t('publicSession.shareTitle', { sport: item.sport })
      : t('publicSession.share');
    const message = item.sport && item.city
      ? t('publicSession.whatsappSportCity', { sport: item.sport, city: item.city })
      : item.sport
        ? t('publicSession.whatsappSport', { sport: item.sport })
        : item.city
          ? t('publicSession.whatsappCity', { city: item.city })
          : t('publicSession.shareMessage');

    this.sharingSessionId = sessionId;
    this.shareFeedbackSessionId = null;
    this.manualShareItem = null;
    this.manualShareUrl = '';
    this.actionError = '';

    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: message, url });
          this.shareFeedbackSessionId = sessionId;
          this.shareFeedbackMessage = t('publicSession.shared');
          return;
        } catch (error) {
          // Closing the native share sheet is not an error.
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          // Some desktop browsers expose share() but cannot complete it.
        }
      }

      await this.copyShareUrl(url);
      this.shareFeedbackSessionId = sessionId;
      this.shareFeedbackMessage = t('publicSession.linkCopied');
    } catch {
      this.manualShareItem = item;
      this.manualShareUrl = url;
      this.shareFeedbackSessionId = sessionId;
      this.shareFeedbackMessage = t('publicSession.selectLink');
    } finally {
      this.sharingSessionId = null;
    }
  }

  private copyShareUrl(url: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return Promise.reject(new Error('Clipboard unavailable'));
    }
    return navigator.clipboard.writeText(url);
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
      .pipe(
        timeout(10_000),
        finalize(() => this.interactionLoadingPostId = null)
      )
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

    this.feedService.comments(postId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
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
      .pipe(
        timeout(10_000),
        finalize(() => this.interactionLoadingPostId = null)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.deletingCommentId = null)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.reportingCommentId = null)
      )
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
      .pipe(
        timeout(10_000),
        finalize(() => this.reportingPostId = null)
      )
      .subscribe({
        next: () => this.reportedPostIds.add(postId),
        error: () => this.actionError = t('feedback.feed.reportError')
      });
  }

  hideAttendanceActivity(item: FeedItem): void {
    if (
      item.type !== 'SESSION_ATTENDED'
      || item.sessionId === null
      || item.authorUsername !== this.currentUsername
      || this.hidingAttendanceSessionId !== null
    ) {
      return;
    }

    const sessionId = item.sessionId;
    this.hidingAttendanceSessionId = sessionId;
    this.actionError = '';

    this.feedService.hideAttendanceActivity(sessionId)
      .pipe(
        timeout(10_000),
        finalize(() => this.hidingAttendanceSessionId = null)
      )
      .subscribe({
        next: () => {
          this.items = this.items.filter(current =>
            !(current.type === 'SESSION_ATTENDED'
              && current.sessionId === sessionId
              && current.authorUsername === this.currentUsername)
          );
        },
        error: () => this.actionError = t('feedback.feed.hideAttendanceError')
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
      .pipe(
        timeout(10_000),
        finalize(() => this.deletingPostId = null)
      )
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
