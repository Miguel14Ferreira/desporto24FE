import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, NgZone, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { catchError, concatMap, finalize, forkJoin, from, map, mergeMap, of, retry, Subscription, TimeoutError, timeout, toArray } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityService } from '../../services/community.service';
import { DirectChatService } from '../../services/direct-chat.service';
import { FriendSummary } from '../model/friend-summary';
import { SessionDetail } from '../model/session-detail';
import { appTranslate as t } from '../../i18n/i18n.service';
import { compactSessionShareMessage } from '../../shared/session-share-message';
import { SessionMessage } from '../model/session-message';
import { ReliabilitySummary } from '../model/reliability-summary';
import { SessionParticipant } from '../model/session-participant';
import { JoinSessionResponse, MyVenueRating, OrganizerExclusionReason, PlayerCompliment, PlayerComplimentType, SessionOverallRating, SessionService, SessionTeamSuggestion, SessionTeamScoreSource, SessionGuestRequest } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { ChatTypingTracker } from '../../services/chat-typing-tracker';
import { chatContinuesGroup, chatDaySeparator } from '../../shared/chat-thread-presentation';
import { ChatReadSyncService } from '../../services/chat-read-sync.service';

@Component({
  selector: 'app-session-details',
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css', './session-details-concept-one-premium.css', './session-details-invite-layout.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SessionDetailsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatMessageList') chatMessageList?: ElementRef<HTMLElement>;
  @ViewChild('sessionComposer') sessionComposer?: ElementRef<HTMLTextAreaElement>;
  private readonly messageDateFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  session?: SessionDetail;
  messages: SessionMessage[] = [];
  replyingToSessionMessage: SessionMessage | null = null;
  creatorReliability?: ReliabilitySummary;
  participants: SessionParticipant[] = [];
  sessionParticipants: SessionParticipant[] = [];
  teamAParticipants: SessionParticipant[] = [];
  teamBParticipants: SessionParticipant[] = [];
  confirmedTeams = false;

  loading = false;
  actionLoading = false;
  registrationClock = Date.now();
  private registrationClockTimer?: ReturnType<typeof setInterval>;
  chatLoading = false;
  messageSending = false;
  chatRealtimeConnected = false;
  chatEverConnected = false;
  chatDeliveryUncertain = false;
  chatDeliveryChecking = false;
  private pendingChatDelivery?: { text: string; replyToMessageId: number | null; knownIds: Set<number>; startedAt: number };
  private scrollChatToBottomRequested = false;
  newMessagesPending = 0;
  reliabilityLoading = false;
  participantsLoading = false;
  sessionParticipantsLoading = false;
  attendanceUpdatingId: number | null = null;
  attendanceBulkUpdating = false;
  removeLoadingId: number | null = null;
  pendingRemovalId: number | null = null;
  pendingFutureExclusionId: number | null = null;
  pendingFutureExclusionReason: OrganizerExclusionReason | '' = '';
  readonly futureExclusionReasons: readonly OrganizerExclusionReason[] = [
    'NO_SHOW', 'UNSPORTING_CONDUCT', 'DISRESPECTFUL_BEHAVIOUR', 'ABUSIVE_BEHAVIOUR', 'OTHER'
  ];

  futureExclusionUpdatingId: number | null = null;
  futureExclusions: Record<number, boolean | null> = {};
  showProblemReport = false;
  selectedProblemType: 'NOT_OCCURRED' | 'VENUE_PROBLEM' | 'OTHER' | '' = '';
  problemDetails = '';
  showAttendanceManager = false;
  teamSuggestion?: SessionTeamSuggestion;
  teamsScoreSource: SessionTeamScoreSource = 'FORM';
  teamsLoading = false;
  teamsConfirming = false;
  teamSuggestionPendingConfirmation = false;
  teamsError = '';
  teamsSuccess = '';

  readonly overallRatingStars = [1, 2, 3, 4, 5];
  selectedOverallScore: number | null = null;
  myOverallScore: number | null = null;
  ratingLoading = false;
  ratingSaving = false;
  ratingDismissed = false;
  ratingCollapsedByExisting = false;
  private ratingReopenedByUser = false;
  ratingError = '';
  ratingSuccess = '';
  ratingLoadedSessionId: number | null = null;

  // Venue stars are separate from the overall session rating.
  // Only confirmed attendees can edit; the venue summary is anonymous.
  selectedVenueScore: number | null = null;
  myVenueScore: number | null = null;
  venueRatingLoading = false;
  venueRatingSaving = false;
  venueRatingDismissed = false;
  venueRatingCollapsedByExisting = false;
  venueRatingError = '';
  venueRatingSuccess = '';
  venueRatingLoadedSessionId: number | null = null;

  // Post-game appreciation is private, optional, positive-only and unrelated to stars.
  readonly complimentTypes: readonly PlayerComplimentType[] =
    ['FAIR_PLAY', 'GREAT_TEAMMATE', 'POSITIVE_ENERGY'];
  complimentsOpen = false;
  complimentsLoading = false;
  complimentSavingUsername: string | null = null;
  complimentsLoadedSessionId: number | null = null;
  complimentsSent: PlayerCompliment[] = [];
  complimentsReceived: PlayerCompliment[] = [];
  complimentsError = '';
  complimentsSuccess = '';

  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  detailRefreshWarning = '';
  joinOutcomeUnknown = false;
  joinStatusChecking = false;
  joinStatusMessage = '';
  inviteFriendsOpen = false;
  guestLinkUrl = '';
  guestLinkWorking = false;
  guestPanelError = '';
  guestPanelSuccess = '';
  guestRequests: SessionGuestRequest[] = [];
  guestRequestsLoading = false;
  guestRequestBusyId: number | null = null;
  guestRequestsLoadedForSession: number | null = null;

  inviteFriendsLoading = false;
  inviteSendingTo: string | null = null;
  formalInviteSendingTo: string | null = null;
  formalInvitedFriends = new Set<string>();
  inviteFriends: FriendSummary[] = [];
  inviteFeedback = '';
  inviteError = '';
  sharingSession = false;
  creationShareDismissed = false;
  promotionOpen = false;
  shareFeedback = '';
  manualShareUrl = '';
  chatError = '';
  reliabilityError = '';
  attendanceError = '';
  attendanceSuccess = '';
  participantManagementError = '';
  participantManagementSuccess = '';
  sessionParticipantsError = '';

  joinPassword = '';
  messageBody = '';
  showEmojiPicker = false;

  readonly emojis = ['😀', '😂', '😊', '😍', '🥳', '😎', '😉', '👍', '👏', '🙌', '🔥', '⚽', '🏀', '🎾', '🏓', '💪', '❤️', '✅'];

  private sessionId?: number;
  private currentUsername: string | null = null;
  private pendingJoinScroll = false;
  private pendingChatScroll = false;
  private pendingMembershipScroll = false;
  private readonly jwtHelper = new JwtHelperService();
  private readonly router = inject(Router);
  private readonly readSync = inject(ChatReadSyncService);
  private readonly zone = inject(NgZone);
  private readonly realtimeSubscriptions = new Subscription();
  readonly typing: ChatTypingTracker;

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private communityService: CommunityService,
    private directChatService: DirectChatService,
    private reliabilityService: ReliabilityService,
    private realtimeService: DirectChatRealtimeService
  ) {
    this.typing = new ChatTypingTracker(realtimeService);
  }

  ngOnInit(): void {
    this.pendingJoinScroll = this.route.snapshot.queryParamMap?.get('join') === '1';
    this.pendingChatScroll = this.route.snapshot.queryParamMap?.get('chat') === '1';
    this.pendingMembershipScroll = this.route.snapshot.queryParamMap?.get('membership') === '1';
    this.promotionOpen = this.route.snapshot.queryParamMap?.get('promote') === '1';
    this.currentUsername = this.readCurrentUsername();

    // In a lazy-loaded empty child route, the :id may live on the parent snapshot.
    const rawId = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id');
    const id = rawId && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(id)) {
      this.errorMessage = t('feedback.session.invalid');
      return;
    }

    this.sessionId = id;
    if (this.pendingChatScroll) {
      void this.router.navigate(['/menu/messages'], {
        queryParams: { kind: 'session', id }, replaceUrl: true
      });
      return;
    }
    this.restoreRatingDismissal();
    this.loadSession();
    // Run the clock outside Angular so fixture.whenStable() and browser
    // navigation do not wait forever for a persistent repeating task.
    this.zone.runOutsideAngular(() => {
      this.registrationClockTimer = setInterval(
        () => this.zone.run(() => this.registrationClock = Date.now()), 15000);
    });
    this.realtimeService.connect();

    this.realtimeSubscriptions.add(
      this.realtimeService.sessionMessages$.subscribe(message => {
        if (message.sessionId !== this.sessionId) {
          return;
        }

        this.appendMessageIfMissing(message);
        if (this.chatDeliveryUncertain && this.matchesPendingChatDelivery(message)) {
          this.confirmChatDelivery();
        }
      })
    );

    this.realtimeSubscriptions.add(
      this.realtimeService.connected$.subscribe(connected => {
        this.chatRealtimeConnected = connected;
        if (connected) {
          this.chatEverConnected = true;
          // The session details page has no chat log. Only the inbox loads it.
        }
      })
    );
  }

  ngOnDestroy(): void {
    if (this.registrationClockTimer) clearInterval(this.registrationClockTimer);
    this.typing.destroy();
    this.realtimeSubscriptions.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.scrollChatToBottomRequested && this.chatMessageList?.nativeElement) {
      const el = this.chatMessageList.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.scrollChatToBottomRequested = false;
      this.newMessagesPending = 0;
    }
    this.markVisibleMessagesRead();
    if (this.loading || !this.session) {
      return;
    }

    if (this.pendingChatScroll) {
      this.pendingChatScroll = false;
      if (this.canAccessChat()) {
        document.getElementById('session-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (this.pendingMembershipScroll) {
      // A historical promotion notification may be opened after the membership
      // changes again. Only scroll if the current session confirms membership.
      this.pendingMembershipScroll = false;
      if (this.session.joined || this.session.waitlisted) {
        document.getElementById('session-membership')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (!this.pendingJoinScroll) {
      return;
    }
    if (!this.canJoinSession()) {
      this.pendingJoinScroll = false;
      return;
    }

    const participation = document.getElementById('session-participation');
    if (participation) {
      this.pendingJoinScroll = false;
      participation.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToParticipants(): void {
    if (!this.session || (!this.session.joined && !this.isCreator())) {
      return;
    }

    document.getElementById('session-participants')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToParticipation(): void {
    if (!this.canJoinSession()) {
      return;
    }

    document.getElementById('session-participation')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  joinSession(): void {
    if (!this.canJoinSession() || !this.sessionId || this.actionLoading) {
      return;
    }
    if (this.session!.privateGame && !this.joinPassword.trim()) {
      this.actionError = t('feedback.session.privatePassword');
      this.actionSuccess = '';
      return;
    }
    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';
    this.joinStatusMessage = '';

    this.sessionService.join(this.sessionId, this.joinPassword)
      .pipe(timeout(10_000), finalize(() => this.actionLoading = false))
      .subscribe({
        next: response => {
          this.joinPassword = '';
          this.joinOutcomeUnknown = false;
          this.actionSuccess = this.joinSuccessMessage(response);
          // The POST result is authoritative even if the follow-up details GET fails.
          if (this.session) {
            this.session = {
              ...this.session,
              joined: response.state === 'PARTICIPANT',
              waitlisted: response.state === 'WAITLISTED',
              waitlistPosition: response.state === 'WAITLISTED' ? response.waitlistPosition : null
            };
          }
          this.loadSession(false);
        },
        error: error => {
          if (this.isUncertainJoinError(error)) {
            // Timeout or lost response can follow a successful server-side commit.
            // Block repeat POSTs until a separate GET verifies the actual membership.
            this.joinOutcomeUnknown = true;
            this.joinStatusMessage = t('feedback.session.joinChecking');
            this.verifyJoinOutcome();
          } else {
            this.actionError = this.errorFrom(error, t('feedback.session.joinError'));
          }
        }
      });
  }

  verifyJoinOutcome(): void {
    if (!this.joinOutcomeUnknown || this.joinStatusChecking || !this.sessionId) return;
    this.joinStatusChecking = true;
    this.joinStatusMessage = t('feedback.session.joinChecking');
    this.sessionService.detail(this.sessionId)
      .pipe(timeout(10_000), retry({ count: 1 }),
        finalize(() => this.joinStatusChecking = false))
      .subscribe({
        next: detail => {
          this.session = detail;
          if (detail.joined || detail.waitlisted) {
            this.joinOutcomeUnknown = false;
            this.joinStatusMessage = '';
            this.actionSuccess = this.joinSuccessMessage({
              state: detail.waitlisted ? 'WAITLISTED' : 'PARTICIPANT',
              waitlistPosition: detail.waitlisted ? detail.waitlistPosition : null
            });
            this.actionError = '';
            if (detail.joined) {
              this.loadSessionParticipants();
            }
          } else {
            // A new POST is only possible after a successful verification GET.
            this.joinOutcomeUnknown = false;
            this.joinStatusMessage = t('feedback.session.joinNotConfirmed');
          }
        },
        error: () => {
          // Keep repeat POST disabled until membership can be checked.
          this.joinStatusMessage = t('feedback.session.joinVerificationUnavailable');
        }
      });
  }

  private isUncertainJoinError(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof HttpErrorResponse) {
      return error.status === 0 || error.status === 408 || error.status === 429
        || error.status >= 500;
    }
    // Unknown client failures are not proof the server rolled back the transaction.
    return true;
  }

  leaveSession(): void {
    if (!this.canLeaveSession() || !this.sessionId || this.actionLoading) {
      return;
    }

    const wasWaitlisted = Boolean(this.session?.waitlisted);

    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.leave(this.sessionId)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoading = false)
      )
      .subscribe({
        next: () => {
          this.actionSuccess = wasWaitlisted
            ? t('feedback.session.leftWaitlist')
            : t('feedback.session.left');
          if (this.session) {
            this.session = { ...this.session, joined: false, waitlisted: false, waitlistPosition: null };
          }
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.session.leaveError'));
        }
      });
  }

  canReviewPostGame(): boolean {
    if (!this.session || !this.isCreator()
        || (this.session.status !== 'OPEN' && this.session.status !== 'FULL')) {
      return false;
    }
    const start = Date.parse(this.session.gameDate);
    return Number.isFinite(start) && start + (2 * 60 * 60 * 1000) <= Date.now();
  }

  canRatePostGame(): boolean {
    if (!this.session?.joined || !this.currentUsername
      || this.session.status === 'CANCELLED'
      || this.session.problemType === 'NOT_OCCURRED') {
      return false;
    }

    // Registration alone does not prove participation. Only confirmed
    // attendees should see the editor; the backend checks the stored
    // attendance timestamp independently before accepting any rating.
    const attended = this.sessionParticipants.some(participant =>
      participant.username.toLowerCase() === this.currentUsername!.toLowerCase()
      && participant.attendanceStatus === 'ATTENDED'
    );
    if (!attended) return false;

    const kickoff = Date.parse(this.session.gameDate);
    return Number.isFinite(kickoff)
      && kickoff + (2 * 60 * 60 * 1000) <= Date.now();
  }

  canRateVenuePostGame(): boolean {
    return this.canRatePostGame() && !!this.session?.venue?.id;
  }

  /** A username is the stable identity exposed by the roster; its id is a participation id. */
  eligibleComplimentPlayers(): SessionParticipant[] {
    if (!this.canRatePostGame() || !this.currentUsername) return [];
    const me = this.currentUsername.toLowerCase();
    return this.sessionParticipants.filter(participant =>
      participant.attendanceStatus === 'ATTENDED'
      && participant.username.toLowerCase() !== me
    );
  }

  canOfferCompliments(): boolean {
    return this.eligibleComplimentPlayers().length > 0;
  }

  toggleCompliments(): void {
    if (!this.canOfferCompliments()) return;
    this.complimentsOpen = !this.complimentsOpen;
    if (this.complimentsOpen) this.loadCompliments();
  }

  loadCompliments(): void {
    if (!this.sessionId || !this.canOfferCompliments() || this.complimentsLoading
        || this.complimentSavingUsername
        || this.complimentsLoadedSessionId === this.sessionId) return;

    const sessionId = this.sessionId;
    this.complimentsLoading = true;
    this.complimentsError = '';
    forkJoin({
      sent: this.sessionService.sentCompliments(sessionId),
      received: this.sessionService.receivedCompliments(sessionId)
    }).pipe(
      timeout(10_000),
      finalize(() => this.complimentsLoading = false)
    ).subscribe({
      next: ({ sent, received }) => {
        if (this.sessionId !== sessionId) return;
        this.complimentsSent = sent;
        this.complimentsReceived = received;
        this.complimentsLoadedSessionId = sessionId;
      },
      error: () => {
        if (this.sessionId === sessionId) {
          this.complimentsError = t('sessionDetail.complimentsLoadError');
        }
      }
    });
  }

  myCompliment(recipientUsername: string): PlayerCompliment | undefined {
    return this.complimentsSent.find(item =>
      item.recipientUsername.toLowerCase() === recipientUsername.toLowerCase());
  }

  complimentLabel(type: PlayerComplimentType): string {
    return t('sessionDetail.compliment.' + type);
  }

  giveCompliment(participant: SessionParticipant, type: PlayerComplimentType): void {
    if (!this.sessionId || !this.complimentsOpen || this.complimentsLoading
        || this.complimentsLoadedSessionId !== this.sessionId
        || this.complimentSavingUsername
        || !this.eligibleComplimentPlayers().some(player =>
          player.username.toLowerCase() === participant.username.toLowerCase())
        || !this.complimentTypes.includes(type)
        || this.myCompliment(participant.username)?.type === type) return;

    const sessionId = this.sessionId;
    this.complimentSavingUsername = participant.username;
    this.complimentsError = '';
    this.complimentsSuccess = '';
    this.sessionService.giveCompliment(sessionId, participant.username, type)
      .pipe(timeout(10_000), finalize(() => this.complimentSavingUsername = null))
      .subscribe({
        next: compliment => {
          if (this.sessionId !== sessionId
              || compliment.recipientUsername.toLowerCase() !== participant.username.toLowerCase()) return;
          this.complimentsSent = [
            ...this.complimentsSent.filter(item =>
              item.recipientUsername.toLowerCase() !== participant.username.toLowerCase()),
            compliment
          ];
          this.complimentsSuccess = t('sessionDetail.complimentsSaved');
        },
        error: () => {
          if (this.sessionId === sessionId) {
            this.complimentsError = t('sessionDetail.complimentsSaveError');
          }
        }
      });
  }

  loadMyVenueRating(): void {
    if (!this.sessionId || !this.canRateVenuePostGame()
      || this.venueRatingLoading || this.venueRatingSaving
      || this.venueRatingLoadedSessionId === this.sessionId) return;

    const sessionId = this.sessionId;
    const venueId = this.session?.venue?.id;
    this.venueRatingLoading = true;
    this.venueRatingError = '';
    this.sessionService.myVenueRating(sessionId)
      .pipe(timeout(10_000), finalize(() => this.venueRatingLoading = false))
      .subscribe({
        next: rating => {
          if (this.sessionId !== sessionId || this.session?.venue?.id !== venueId) return;
          this.venueRatingLoadedSessionId = sessionId;
          this.myVenueScore = rating?.score ?? null;
          this.selectedVenueScore = this.myVenueScore;
          this.venueRatingCollapsedByExisting = this.myVenueScore !== null;
        },
        error: () => {
          this.venueRatingError = t('feedback.venue.ratingLoadError');
        }
      });
  }

  selectVenueScore(score: number): void {
    if (!this.canRateVenuePostGame() || this.venueRatingLoading || this.venueRatingSaving
      || this.venueRatingLoadedSessionId !== this.sessionId
      || !Number.isInteger(score) || score < 1 || score > 5) return;
    this.selectedVenueScore = score;
    this.venueRatingError = '';
    this.venueRatingSuccess = '';
  }

  canSaveVenueRating(): boolean {
    return this.canRateVenuePostGame()
      && !this.venueRatingLoading && !this.venueRatingSaving
      && this.venueRatingLoadedSessionId === this.sessionId
      && this.selectedVenueScore !== null
      && this.selectedVenueScore >= 1 && this.selectedVenueScore <= 5
      && this.selectedVenueScore !== this.myVenueScore;
  }

  saveVenueRating(): void {
    if (!this.sessionId || !this.canSaveVenueRating() || this.selectedVenueScore === null) return;
    const sessionId = this.sessionId;
    const venueId = this.session?.venue?.id;
    const wasRated = this.myVenueScore !== null;
    this.venueRatingSaving = true;
    this.venueRatingError = '';
    this.venueRatingSuccess = '';
    this.sessionService.rateVenue(sessionId, this.selectedVenueScore)
      .pipe(timeout(10_000), finalize(() => this.venueRatingSaving = false))
      .subscribe({
        next: (saved: MyVenueRating) => {
          if (this.sessionId !== sessionId || saved.venueId !== venueId) return;
          this.myVenueScore = saved.score;
          this.selectedVenueScore = saved.score;
          this.venueRatingLoadedSessionId = sessionId;
          this.venueRatingSuccess = t(wasRated
            ? 'feedback.venue.ratingUpdated' : 'feedback.venue.ratingSaved');
        },
        error: () => {
          this.venueRatingError = t('feedback.venue.ratingSaveError');
        }
      });
  }

  dismissVenueRating(): void {
    if (this.venueRatingSaving) return;
    this.venueRatingDismissed = true;
    this.venueRatingError = '';
  }

  reopenVenueRating(): void {
    if (!this.canRateVenuePostGame()) return;
    this.venueRatingDismissed = false;
    this.venueRatingCollapsedByExisting = false;
    this.loadMyVenueRating();
  }

  loadMyOverallRating(): void {
    if (!this.sessionId || !this.canRatePostGame()
      || this.ratingLoading || this.ratingSaving
      || this.ratingLoadedSessionId === this.sessionId) {
      return;
    }
    const sessionId = this.sessionId;
    this.ratingLoading = true;
    this.ratingError = '';
    this.sessionService.myOverallRating(sessionId)
      .pipe(timeout(10_000), finalize(() => this.ratingLoading = false))
      .subscribe({
        next: rating => {
          if (this.sessionId !== sessionId) {
            return;
          }
          this.ratingLoadedSessionId = sessionId;
          this.myOverallScore = rating?.overallScore ?? null;
          this.selectedOverallScore = this.myOverallScore;
          // Keep existing ratings collapsed by default, except when the user
          // explicitly chose to reopen the panel before this response arrived.
          this.ratingCollapsedByExisting =
            this.myOverallScore !== null && !this.ratingReopenedByUser;
        },
        error: () => {
          this.ratingError = t('feedback.session.overallRatingLoadError');
        }
      });
  }

  selectOverallScore(score: number): void {
    if (!this.canRatePostGame() || this.ratingLoading || this.ratingSaving
      || this.ratingLoadedSessionId !== this.sessionId
      || !Number.isInteger(score) || score < 1 || score > 5) {
      return;
    }
    this.selectedOverallScore = score;
    this.ratingError = '';
    this.ratingSuccess = '';
  }

  canSaveOverallRating(): boolean {
    return this.canRatePostGame()
      && !this.ratingLoading && !this.ratingSaving
      && this.ratingLoadedSessionId === this.sessionId
      && this.selectedOverallScore !== null
      && this.selectedOverallScore >= 1 && this.selectedOverallScore <= 5
      && this.selectedOverallScore !== this.myOverallScore;
  }

  saveOverallRating(): void {
    if (!this.sessionId || !this.canSaveOverallRating() || this.selectedOverallScore === null) {
      return;
    }
    const sessionId = this.sessionId;
    const wasRated = this.myOverallScore !== null;
    const score = this.selectedOverallScore;
    this.ratingSaving = true;
    this.ratingError = '';
    this.ratingSuccess = '';

    this.sessionService.rateOverall(sessionId, score)
      .pipe(timeout(10_000), finalize(() => this.ratingSaving = false))
      .subscribe({
        next: (saved: SessionOverallRating) => {
          if (this.sessionId !== sessionId) {
            return;
          }
          this.myOverallScore = saved.overallScore;
          this.selectedOverallScore = saved.overallScore;
          this.ratingLoadedSessionId = sessionId;
          this.ratingSuccess = t(wasRated
            ? 'feedback.session.overallRatingUpdated'
            : 'feedback.session.overallRatingSaved');
        },
        error: () => {
          this.ratingError = t('feedback.session.overallRatingSaveError');
        }
      });
  }

  dismissOverallRating(): void {
    if (this.ratingSaving) {
      return;
    }
    this.ratingDismissed = true;
    this.ratingReopenedByUser = false;
    this.ratingError = '';
    const key = this.ratingDismissalKey();
    if (key) {
      try {
        localStorage.setItem(key, '1');
      } catch {
        // Keep the panel dismissed for this visit if browser storage is unavailable.
      }
    }
  }

  reopenOverallRating(): void {
    if (!this.canRatePostGame()) {
      return;
    }
    this.ratingDismissed = false;
    this.ratingCollapsedByExisting = false;
    this.ratingReopenedByUser = true;
    const key = this.ratingDismissalKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Re-opening still works if browser storage is unavailable.
      }
    }
    this.loadMyOverallRating();
  }

  private restoreRatingDismissal(): void {
    const key = this.ratingDismissalKey();
    if (!key) {
      return;
    }
    try {
      this.ratingDismissed = localStorage.getItem(key) === '1';
    } catch {
      this.ratingDismissed = false;
    }
  }

  private ratingDismissalKey(): string | null {
    if (!this.sessionId || !this.currentUsername) {
      return null;
    }
    return 'jynlo.session-rating-dismissed:'
      + encodeURIComponent(this.currentUsername.toLowerCase()) + ':' + this.sessionId;
  }

  openPostGameAttendance(): void {
    if (!this.sessionId || !this.canReviewPostGame() || this.actionLoading) {
      return;
    }
    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.complete(this.sessionId)
      .pipe(timeout(10_000), finalize(() => this.actionLoading = false))
      .subscribe({
        next: () => {
          this.actionSuccess = t('feedback.session.completed');
          this.showAttendanceManager = true;
          this.loadParticipants();
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.session.completeError'));
        }
      });
  }

  confirmGameDidNotHappen(): void {
    if (!this.sessionId || !this.canReviewPostGame() || this.actionLoading) {
      return;
    }
    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.reportDidNotOccur(this.sessionId)
      .pipe(timeout(10_000), finalize(() => this.actionLoading = false))
      .subscribe({
        next: () => {
          this.showAttendanceManager = false;
          this.actionSuccess = t('sessionDetail.postGameDidNotHappenSaved');
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.session.problemReportError'));
        }
      });
  }

  toggleProblemReport(): void {
    if (!this.canReportProblem() || this.actionLoading) {
      return;
    }

    this.showProblemReport = !this.showProblemReport;
    if (!this.showProblemReport) {
      this.selectedProblemType = '';
      this.problemDetails = '';
    }
    this.actionError = '';
    this.actionSuccess = '';
  }

  reportProblem(): void {
    if (
      !this.sessionId
      || !this.canReportProblem()
      || this.actionLoading
      || !this.selectedProblemType
    ) {
      return;
    }

    const problemType = this.selectedProblemType;
    const details = this.problemDetails.trim();

    if (details.length > 500) {
      this.actionError = t('feedback.session.problemDetailsLong');
      this.actionSuccess = '';
      return;
    }
    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.reportProblem(this.sessionId, problemType, details)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoading = false)
      )
      .subscribe({
        next: () => {
          this.showProblemReport = false;
          this.selectedProblemType = '';
          this.problemDetails = '';
          this.actionSuccess = t('feedback.session.problemReported');
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.session.problemReportError'));
        }
      });
  }

  loadSessionParticipants(): void {
    if (!this.sessionId || !this.session
        || (!this.session.joined && !this.isCreator()) || this.sessionParticipantsLoading) {
      return;
    }

    this.sessionParticipantsLoading = true;
    this.sessionParticipantsError = '';

    this.sessionService.participants(this.sessionId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.sessionParticipantsLoading = false)
      )
      .subscribe({
        next: participants => {
          this.sessionParticipants = participants;
          // The initial session load runs before the participant roster.
          // Load private rating only after the API confirms actual attendance.
          if (this.canRatePostGame() && !this.ratingDismissed) {
            this.loadMyOverallRating();
          }
          if (this.canRateVenuePostGame() && !this.venueRatingDismissed) {
            this.loadMyVenueRating();
          }
          if (this.isCreator()) {
            this.participants = participants;
          }
          this.teamAParticipants = participants.filter(participant => participant.teamCode === 'A');
          this.teamBParticipants = participants.filter(participant => participant.teamCode === 'B');
          this.confirmedTeams = this.teamAParticipants.length > 0 || this.teamBParticipants.length > 0;
        },
        error: error => {
          this.sessionParticipants = [];
          this.teamAParticipants = [];
          this.teamBParticipants = [];
          this.confirmedTeams = false;
          this.sessionParticipantsError = this.errorFrom(
            error,
            t('feedback.session.participantsError')
          );
        }
      });
  }

  loadParticipants(): void {
    if (!this.sessionId || !this.isCreator() || this.participantsLoading || this.attendanceBulkUpdating) {
      return;
    }

    this.participantsLoading = true;
    this.attendanceError = '';

    this.sessionService.participants(this.sessionId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.participantsLoading = false)
      )
      .subscribe({
        next: participants => {
          this.participants = participants;
          this.loadFutureExclusionStatuses(participants);
        },
        error: error => {
          this.participants = [];
          this.attendanceError = this.errorFrom(
            error,
            t('feedback.session.participantsError')
          );
        }
      });
  }

  recordAttendance(participant: SessionParticipant, status: 'ATTENDED' | 'NO_SHOW'): void {
    if (!this.sessionId || !this.isCreator() || this.attendanceUpdatingId !== null
      || this.attendanceBulkUpdating || this.futureExclusionUpdatingId !== null) {
      return;
    }

    if (!this.canRecordAttendance()) {
      this.attendanceError = t('feedback.session.attendanceTooEarly');
      this.attendanceSuccess = '';
      return;
    }

    this.attendanceUpdatingId = participant.id;
    this.attendanceError = '';
    this.attendanceSuccess = '';

    this.reliabilityService.recordAttendance(this.sessionId, participant.id, status)
      .pipe(
        timeout(10_000),
        finalize(() => this.attendanceUpdatingId = null)
      )
      .subscribe({
        next: () => {
          participant.attendanceStatus = status;
          this.attendanceSuccess = status === 'ATTENDED'
            ? t('feedback.session.present', { username: participant.username })
            : t('feedback.session.absent', { username: participant.username });
        },
        error: error => {
          this.attendanceError = this.errorFrom(
            error,
            t('feedback.session.attendanceError')
          );
        }
      });
  }

  hasRecordedNoShows(): boolean {
    return this.participants.some(participant => participant.attendanceStatus === 'NO_SHOW');
  }

  canConfirmPendingAttendance(): boolean {
    return this.isCreator()
      && this.canRecordAttendance()
      && !this.participantsLoading
      && !this.attendanceBulkUpdating
      && this.attendanceUpdatingId === null
      && this.removeLoadingId === null
      && this.futureExclusionUpdatingId === null
      && this.participants.some(participant => participant.attendanceStatus === 'PENDING');
  }

  confirmPendingAttendance(): void {
    if (!this.sessionId || !this.canConfirmPendingAttendance()) {
      return;
    }
    const pending = this.participants.filter(participant => participant.attendanceStatus === 'PENDING');
    const sessionId = this.sessionId;
    this.attendanceBulkUpdating = true;
    this.attendanceError = '';
    this.attendanceSuccess = '';

    from(pending).pipe(
      concatMap(participant => this.reliabilityService.recordAttendance(
        sessionId, participant.id, 'ATTENDED'
      ).pipe(
        timeout(10_000),
        map(() => {
          participant.attendanceStatus = 'ATTENDED';
          return true;
        }),
        catchError(() => of(false))
      )),
      toArray(),
      finalize(() => this.attendanceBulkUpdating = false)
    ).subscribe(results => {
      const confirmed = results.filter(Boolean).length;
      if (confirmed > 0) {
        this.attendanceSuccess = t('feedback.session.bulkAttendanceSuccess', { count: confirmed });
      }
      if (confirmed !== pending.length) {
        this.attendanceError = t('feedback.session.bulkAttendancePartial', {
          confirmed, total: pending.length
        });
      }
    });
  }

  private loadFutureExclusionStatuses(participants: SessionParticipant[]): void {
    if (!this.sessionId || !this.isCreator()) {
      return;
    }
    const sessionId = this.sessionId;
    this.futureExclusions = {};

    // Bounded concurrency: query only the participants, without a request for every render.
    from(participants.filter(participant => this.canRemoveParticipant(participant))).pipe(
      mergeMap(participant => this.sessionService.futureExclusionStatus(sessionId, participant.id).pipe(
        timeout(10_000),
        map(response => ({ id: participant.id, excluded: response.excluded as boolean | null })),
        catchError(() => of({ id: participant.id, excluded: null }))
      ), 4),
      toArray()
    ).subscribe(statuses => {
      if (this.sessionId !== sessionId) {
        return;
      }
      for (const result of statuses) {
        this.futureExclusions[result.id] = result.excluded;
      }
    });
  }

  availableFutureExclusionReasons(participant: SessionParticipant): OrganizerExclusionReason[] {
    return this.futureExclusionReasons.filter(reason =>
      reason !== 'NO_SHOW' || participant.attendanceStatus === 'NO_SHOW'
    );
  }

  chooseFutureExclusionReason(participant: SessionParticipant, value: string): void {
    if (this.pendingFutureExclusionId !== participant.id
      || this.futureExclusionUpdatingId !== null) return;
    const selected = value as OrganizerExclusionReason;
    this.pendingFutureExclusionReason =
      this.availableFutureExclusionReasons(participant).includes(selected) ? selected : '';
  }

  requestFutureExclusion(participant: SessionParticipant): void {
    if (!this.isCreator() || !this.canRemoveParticipant(participant)
      || this.futureExclusions[participant.id] !== false
      || this.futureExclusionUpdatingId !== null) {
      return;
    }
    this.pendingFutureExclusionId = participant.id;
    this.pendingFutureExclusionReason = '';
    this.participantManagementError = '';
    this.participantManagementSuccess = '';
  }

  cancelFutureExclusion(): void {
    if (this.futureExclusionUpdatingId === null) {
      this.pendingFutureExclusionId = null;
      this.pendingFutureExclusionReason = '';
    }
  }

  confirmFutureExclusion(participant: SessionParticipant): void {
    if (!this.sessionId || !this.isCreator() || !this.canRemoveParticipant(participant)
      || !this.pendingFutureExclusionReason
      || !this.availableFutureExclusionReasons(participant).includes(this.pendingFutureExclusionReason)
      || this.pendingFutureExclusionId !== participant.id
      || this.futureExclusions[participant.id] !== false
      || this.futureExclusionUpdatingId !== null || this.attendanceUpdatingId !== null
      || this.attendanceBulkUpdating || this.removeLoadingId !== null) {
      return;
    }
    this.futureExclusionUpdatingId = participant.id;
    this.participantManagementError = '';
    this.sessionService.excludeFromFutureSessions(this.sessionId, participant.id, this.pendingFutureExclusionReason as OrganizerExclusionReason)
      .pipe(timeout(10_000), finalize(() => this.futureExclusionUpdatingId = null))
      .subscribe({
        next: result => {
          this.futureExclusions[participant.id] = result.excluded;
          this.pendingFutureExclusionId = null;
          this.pendingFutureExclusionReason = '';
          this.participantManagementSuccess =
            t('feedback.session.futureExclusionSaved', { username: participant.username });
        },
        error: error => this.participantManagementError =
          this.errorFrom(error, t('feedback.session.futureExclusionError'))
      });
  }

  allowFutureSessions(participant: SessionParticipant): void {
    if (!this.sessionId || !this.isCreator() || !this.canRemoveParticipant(participant)
      || this.futureExclusions[participant.id] !== true
      || this.futureExclusionUpdatingId !== null || this.attendanceUpdatingId !== null
      || this.attendanceBulkUpdating || this.removeLoadingId !== null) {
      return;
    }
    this.futureExclusionUpdatingId = participant.id;
    this.participantManagementError = '';
    this.sessionService.allowFutureSessions(this.sessionId, participant.id)
      .pipe(timeout(10_000), finalize(() => this.futureExclusionUpdatingId = null))
      .subscribe({
        next: result => {
          this.futureExclusions[participant.id] = result.excluded;
          this.participantManagementSuccess =
            t('feedback.session.futureExclusionRemoved', { username: participant.username });
        },
        error: error => this.participantManagementError =
          this.errorFrom(error, t('feedback.session.futureExclusionError'))
      });
  }

  canRemoveParticipant(participant: SessionParticipant): boolean {
    if (!this.session?.creatorUsername) {
      return false;
    }

    return participant.username.toLowerCase() !== this.session.creatorUsername.toLowerCase();
  }

  requestRemoveParticipant(participant: SessionParticipant): void {
    if (!this.canRemoveParticipant(participant) || this.removeLoadingId !== null
      || this.attendanceBulkUpdating || this.futureExclusionUpdatingId !== null) {
      return;
    }

    this.pendingRemovalId = participant.id;
    this.participantManagementError = '';
    this.participantManagementSuccess = '';
  }

  cancelRemoveParticipant(): void {
    if (this.removeLoadingId !== null) {
      return;
    }

    this.pendingRemovalId = null;
  }

  confirmRemoveParticipant(participant: SessionParticipant): void {
    if (
      !this.sessionId
      || !this.isCreator()
      || !this.canRemoveParticipant(participant)
      || this.removeLoadingId !== null
      || this.attendanceBulkUpdating
      || this.futureExclusionUpdatingId !== null
    ) {
      return;
    }

    this.removeLoadingId = participant.id;
    this.participantManagementError = '';
    this.participantManagementSuccess = '';

    this.sessionService.removeParticipant(this.sessionId, participant.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.removeLoadingId = null)
      )
      .subscribe({
        next: () => {
          this.pendingRemovalId = null;
          this.sessionParticipants = this.sessionParticipants.filter(item => item.id !== participant.id);
          this.participants = this.participants.filter(item => item.id !== participant.id);
          this.teamAParticipants = this.teamAParticipants.filter(item => item.id !== participant.id);
          this.teamBParticipants = this.teamBParticipants.filter(item => item.id !== participant.id);
          this.confirmedTeams = this.teamAParticipants.length > 0 || this.teamBParticipants.length > 0;
          this.participantManagementSuccess =
            t('feedback.session.removed', { username: participant.username });
        },
        error: error => {
          this.participantManagementError = this.errorFrom(
            error,
            t('feedback.session.removeError')
          );
        }
      });
  }

  attendanceLabel(status: string): string {
    switch (status) {
      case 'ATTENDED':
        return t('status.attended');
      case 'NO_SHOW':
        return t('status.noShow');
      case 'LATE_CANCELLED':
        return t('status.lateCancelShort');
      default:
        return 'Por marcar';
    }
  }

  toggleAttendanceManager(): void {
    if (!this.isCreator() || !this.canRecordAttendance() || this.attendanceBulkUpdating) {
      return;
    }

    this.showAttendanceManager = !this.showAttendanceManager;
    if (this.showAttendanceManager) {
      this.loadParticipants();
    }
  }

  canRecordAttendance(): boolean {
    if (!this.session?.gameDate || this.session.status === 'CANCELLED') {
      return false;
    }

    const attendanceAvailableAt =
      new Date(this.session.gameDate).getTime() + (30 * 60 * 1000);

    return attendanceAvailableAt <= Date.now();
  }

  @HostListener('window:scroll')
  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  onSessionChatScroll(): void {
    if (this.isNearChatBottom()) this.newMessagesPending = 0;
    this.markVisibleMessagesRead();
  }

  jumpToLatestMessages(): void {
    const log = this.chatMessageList?.nativeElement;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
    this.newMessagesPending = 0;
    this.markVisibleMessagesRead();
  }

  private markVisibleMessagesRead(): void {
    // Session details can be opened without opening/seeing the chat.
    // The session details screen no longer renders a chat log. Never mark
    // hidden messages as read; the unified inbox owns read acknowledgements.
    if (!this.chatMessageList?.nativeElement || !this.sessionId || !this.canAccessChat()
        || this.chatLoading || this.chatError || this.messages.length === 0) return;
    const highestId = this.messages.reduce((max, message) => Math.max(max, message.id), 0);
    this.readSync.markVisible('session', this.sessionId,
      highestId, this.chatMessageList?.nativeElement);
  }

  private isNearChatBottom(): boolean {
    const el = this.chatMessageList?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  refreshMessages(showLoading = true): void {
    if (!this.sessionId || !this.canAccessChat() || this.chatLoading) {
      return;
    }

    if (showLoading) {
      this.chatLoading = true;
    }
    this.chatError = '';

    this.sessionService.messages(this.sessionId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (showLoading) {
            this.chatLoading = false;
          }
        })
      )
      .subscribe({
        next: messages => {
          // A websocket event may arrive while HTTP is still in flight.
          const follow = this.messages.length === 0 || this.isNearChatBottom();
          this.messages = this.sortedMessages([
            ...this.messages.filter(existing => !messages.some(incoming => incoming.id === existing.id)),
            ...messages
          ]);
          if (follow) this.scrollChatToBottomRequested = true;
          if (this.chatDeliveryUncertain &&
              this.messages.some(message => this.matchesPendingChatDelivery(message))) {
            this.confirmChatDelivery();
          }
        },
        error: error => {
          this.chatError = this.errorFrom(error, t('feedback.session.chatLoadError'));
        }
      });
  }

  replyToSessionMessage(message: SessionMessage): void {
    if (!this.canSendChat() || this.messageSending || this.chatDeliveryUncertain) return;
    this.replyingToSessionMessage = message;
    this.sessionComposer?.nativeElement.focus({ preventScroll: true });
  }

  cancelSessionReply(): void {
    if (!this.messageSending && !this.chatDeliveryUncertain) this.replyingToSessionMessage = null;
  }

  sendMessage(): void {
    this.typing.stop();
    const body = this.messageBody.trim();

    if (!this.sessionId || !this.canSendChat() || this.messageSending || this.chatDeliveryUncertain) {
      return;
    }

    if (!body) {
      this.chatError = t('feedback.chat.writeFirst');
      return;
    }

    if (body.length > 2000) {
      this.chatError = t('feedback.chat.messageLong');
      return;
    }

    this.messageSending = true;
    this.chatError = '';
    const replyId = this.replyingToSessionMessage?.id ?? null;
    this.sessionComposer?.nativeElement.focus({ preventScroll: true });
    const pending = {
      text: body, replyToMessageId: replyId,
      knownIds: new Set(this.messages.map(message => message.id)),
      startedAt: Date.now()
    };

    const send = replyId
      ? this.sessionService.postMessage(this.sessionId, body, replyId)
      : this.sessionService.postMessage(this.sessionId, body);
    send.pipe(
        timeout(10_000),
        finalize(() => this.messageSending = false)
      )
      .subscribe({
        next: message => {
          this.appendMessageIfMissing(message);
          this.messageBody = '';
          this.replyingToSessionMessage = null;
          this.showEmojiPicker = false;
          this.chatDeliveryUncertain = false;
          this.pendingChatDelivery = undefined;
          this.scrollChatToBottomRequested = true;
        },
        error: error => {
          if (this.isUncertainChatSendError(error)) {
            // Timeout / dropped response can occur after a committed POST.
            // Keep the draft and do not automatically issue another POST.
            this.pendingChatDelivery = pending;
            this.chatDeliveryUncertain = true;
            this.chatError = t('chat.sendUncertain');
            this.verifyChatDelivery();
          } else {
            this.chatError = this.errorFrom(error, t('feedback.chat.sendError'));
          }
        }
      });
  }

  verifyChatDelivery(): void {
    if (!this.chatDeliveryUncertain || this.chatDeliveryChecking
        || !this.pendingChatDelivery || !this.sessionId || !this.canAccessChat()) return;
    const existing = this.messages.find(message => this.matchesPendingChatDelivery(message));
    if (existing) {
      this.confirmChatDelivery();
      return;
    }
    this.chatDeliveryChecking = true;
    this.sessionService.messages(this.sessionId)
      .pipe(timeout(10_000), finalize(() => this.chatDeliveryChecking = false))
      .subscribe({
        next: messages => {
          const follow = this.isNearChatBottom();
          this.messages = this.sortedMessages([
            ...this.messages.filter(existing => !messages.some(incoming => incoming.id === existing.id)),
            ...messages
          ]);
          if (follow) this.scrollChatToBottomRequested = true;
          if (this.messages.some(message => this.matchesPendingChatDelivery(message))) {
            this.confirmChatDelivery();
          } else {
            this.chatError = t('chat.sendUnconfirmed');
          }
        },
        error: () => { this.chatError = t('chat.verifyUnavailable'); }
      });
  }

  resumeChatAfterUncertainSend(): void {
    if (this.chatDeliveryChecking) return;
    this.pendingChatDelivery = undefined;
    this.chatDeliveryUncertain = false;
    this.chatError = t('chat.sendRetryWarning');
  }

  private confirmChatDelivery(): void {
    this.pendingChatDelivery = undefined;
    this.chatDeliveryUncertain = false;
    this.messageBody = '';
    this.replyingToSessionMessage = null;
    this.chatError = '';
    this.scrollChatToBottomRequested = true;
  }

  private matchesPendingChatDelivery(message: SessionMessage): boolean {
    const pending = this.pendingChatDelivery;
    if (!pending || pending.knownIds.has(message.id)
        || !this.sessionId || message.sessionId !== this.sessionId
        || !this.isOwnMessage(message) || message.body !== pending.text) return false;
    const sentAt = Date.parse(message.createdAt);
    return Number.isFinite(sentAt) && sentAt >= pending.startedAt - 60_000
      && (message.replyToMessageId ?? null) === pending.replyToMessageId;
  }

  private isUncertainChatSendError(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof HttpErrorResponse) {
      return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
    }
    return true;
  }

  onTypingInput(): void {
    if (this.sessionId != null) this.typing.input('session', this.sessionId,
      this.messageBody, this.canSendChat() && !this.messageSending && !this.chatDeliveryUncertain);
  }

  onChatEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey || keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
      return;
    }

    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string): void {
    if (this.messageBody.length + emoji.length <= 2000) {
      this.messageBody += emoji;
      this.showEmojiPicker = false;
    }
  }

  dayLabelAt(index: number): string {
    const current = this.messages[index];
    return current ? chatDaySeparator(current.createdAt,
      index > 0 ? this.messages[index - 1].createdAt : null) : '';
  }

  continuesGroupAt(index: number): boolean {
    if (index <= 0) return false;
    const current = this.messages[index], before = this.messages[index - 1];
    return chatContinuesGroup(current.senderUsername, current.createdAt,
      before.senderUsername, before.createdAt);
  }

  messageDate(message: SessionMessage): string {
    if (!message.createdAt) {
      return '';
    }

    const parsed = Date.parse(message.createdAt);
    if (Number.isNaN(parsed)) {
      return message.createdAt;
    }

    return this.messageDateFormatter.format(new Date(parsed));
  }

  private appendMessageIfMissing(message: SessionMessage): void {
    if (this.messages.some(existing => existing.id === message.id)) {
      return;
    }

    const follow = this.isNearChatBottom() || this.isOwnMessage(message);
    this.messages = this.sortedMessages([...this.messages, message]);
    if (follow) {
      this.newMessagesPending = 0;
      this.scrollChatToBottomRequested = true;
    } else {
      this.newMessagesPending++;
    }
  }

  private sortedMessages(messages: SessionMessage[]): SessionMessage[] {
    return [...messages].sort((a, b) => {
      const aTime = Date.parse(a.createdAt || '') || 0;
      const bTime = Date.parse(b.createdAt || '') || 0;
      return aTime - bTime;
    });
  }

  canAccessChat(): boolean {
    return Boolean(this.session?.joined || this.isCreator());
  }

  canSendChat(): boolean {
    if (!this.canAccessChat() || !this.session
        || this.session.status === 'COMPLETED'
        || this.session.status === 'CANCELLED'
        || this.session.problemType === 'NOT_OCCURRED') {
      return false;
    }

    // No session chat from kick-off onward.
    const kickoff = Date.parse(this.session.gameDate);
    return Number.isFinite(kickoff) && Date.now() < kickoff;
  }

  isOwnMessage(message: SessionMessage): boolean {
    return Boolean(
      this.currentUsername
      && message.senderUsername.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  isCreator(): boolean {
    if (!this.session?.creatorUsername || !this.currentUsername) {
      return false;
    }

    return this.session.creatorUsername.toLowerCase() === this.currentUsername.toLowerCase();
  }

  problemTypeLabel(type: 'NOT_OCCURRED' | 'VENUE_PROBLEM' | 'OTHER'): string {
    switch (type) {
      case 'NOT_OCCURRED':
        return t('sessionDetail.didNotOccur');
      case 'VENUE_PROBLEM':
        return t('sessionDetail.venueProblem');
      default:
        return t('sessionDetail.otherProblem');
    }
  }

  canReportProblem(): boolean {
    if (!this.session || !this.isCreator() || this.session.problemType) {
      return false;
    }

    if (this.session.status !== 'OPEN' && this.session.status !== 'FULL') {
      return false;
    }

    const startTime = new Date(this.session.gameDate).getTime();
    return Number.isFinite(startTime) && startTime <= Date.now();
  }

  toggleFriendInvites(): void {
    if (!this.canFindPlayers()) {
      return;
    }
    this.inviteFriendsOpen = !this.inviteFriendsOpen;
    this.inviteFeedback = '';
    this.inviteError = '';
    if (!this.inviteFriendsOpen) {
      return;
    }
    this.inviteFriendsLoading = true;
    this.communityService.friends()
      .pipe(timeout(10_000), finalize(() => this.inviteFriendsLoading = false))
      .subscribe({
        next: friends => this.inviteFriends = friends.filter(friend =>
          !friend.chatBlocked && !friend.blockedByMe
          && friend.username.toLowerCase() !== this.currentUsername?.toLowerCase()
        ),
        error: () => this.inviteError = 'Não foi possível carregar os amigos.'
      });
  }

  sendFormalSessionInvite(username: string): void {
    if (!this.sessionId || !this.canFindPlayers() || !this.canShareSession()
        || this.formalInviteSendingTo || this.formalInvitedFriends.has(username)
        || !this.inviteFriends.some(friend => friend.username === username)) {
      return;
    }
    this.formalInviteSendingTo = username;
    this.inviteError = '';
    this.inviteFeedback = '';
    this.sessionService.invitePlayer(this.sessionId, username)
      .pipe(timeout(10_000), finalize(() => this.formalInviteSendingTo = null))
      .subscribe({
        next: () => {
          this.formalInvitedFriends.add(username);
          this.inviteFeedback = `Convite enviado a @${username}.`;
        },
        error: (error: HttpErrorResponse) => {
          this.inviteError = error.status === 409
            ? `@${username} já está inscrito, em espera ou tem um convite pendente.`
            : `Não foi possível convidar @${username}.`;
        }
      });
  }

  sendSessionInvite(username: string): void {
    if (!this.canFindPlayers() || this.inviteSendingTo || !this.canShareSession()
        || !this.inviteFriends.some(friend => friend.username === username)) {
      return;
    }
    const url = this.publicShareUrl();
    if (!url) {
      return;
    }
    this.inviteSendingTo = username;
    this.inviteFeedback = '';
    this.inviteError = '';
    this.directChatService.send(username, `Queres juntar-te ao nosso jogo de ${this.session!.sport}? ${url}`)
      .pipe(timeout(10_000), finalize(() => this.inviteSendingTo = null))
      .subscribe({
        next: () => this.inviteFeedback = `Mensagem enviada a @${username}.`,
        error: () => this.inviteError = `Não foi possível enviar a mensagem a @${username}.`
      });
  }

  missingPlayers(): number {
    if (!this.session) {
      return 0;
    }
    return Math.max(0, this.session.maxParticipants - this.session.participantCount);
  }

  organizerPreparation(): { confirmed: number; capacity: number; missing: number; full: boolean } | null {
    const session = this.session;
    if (!session || !this.isCreator() || (session.status !== 'OPEN' && session.status !== 'FULL')) {
      return null;
    }
    const kickoff = Date.parse(session.gameDate);
    if (!Number.isFinite(kickoff) || kickoff <= Date.now()
        || !Number.isSafeInteger(session.maxParticipants) || session.maxParticipants <= 0
        || !Number.isSafeInteger(session.participantCount) || session.participantCount < 0
        || session.participantCount > session.maxParticipants) {
      return null;
    }

    // FULL from the backend takes precedence over a potentially delayed count.
    const full = session.status === 'FULL' || session.participantCount === session.maxParticipants;
    return {
      confirmed: session.participantCount,
      capacity: session.maxParticipants,
      missing: full ? 0 : session.maxParticipants - session.participantCount,
      full
    };
  }

  canFindPlayers(): boolean {
    const preparation = this.organizerPreparation();
    return !!preparation && !preparation.full
      && this.session?.status === 'OPEN'
      && this.session.privateGame === false
      && this.session.audience !== 'COMMUNITY_ONLY';
  }

  scrollToPlayerSearch(): void {
    if (this.canFindPlayers()) {
      document.getElementById('session-player-search')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  isFull(): boolean {
    if (!this.session) {
      return false;
    }

    return this.session.maxParticipants > 0
      && this.session.participantCount >= this.session.maxParticipants;
  }

  canGenerateTeams(): boolean {
    return Boolean(
      this.session
      && this.isCreator()
      && this.session.communityId
      && this.session.teamBalanceSupported === true
      && this.isFull()
      && this.session.status !== 'CANCELLED'
      && this.session.status !== 'COMPLETED'
    );
  }

  generateTeams(source: SessionTeamScoreSource = 'FORM'): void {
    if (!this.sessionId || !this.canGenerateTeams() || this.teamsLoading || this.teamsConfirming) {
      return;
    }

    this.teamsLoading = true;
    this.teamsError = '';
    this.teamsSuccess = '';
    this.teamsScoreSource = source;
    this.teamSuggestion = undefined;
    this.teamSuggestionPendingConfirmation = false;

    this.sessionService.teamSuggestion(this.sessionId, source)
      .pipe(
        timeout(10_000),
        finalize(() => this.teamsLoading = false)
      )
      .subscribe({
        next: suggestion => {
          this.teamSuggestion = suggestion;
          this.teamSuggestionPendingConfirmation = true;
        },
        error: error => {
          this.teamSuggestion = undefined;
          this.teamSuggestionPendingConfirmation = false;
          this.teamsError = this.errorFrom(error, t('feedback.session.teamsError'));
        }
      });
  }

  confirmTeams(): void {
    if (
      !this.sessionId
      || !this.teamSuggestion
      || !this.canGenerateTeams()
      || !this.teamSuggestionPendingConfirmation
      || this.teamsConfirming
    ) {
      return;
    }

    this.teamsConfirming = true;
    this.teamsError = '';
    this.teamsSuccess = '';

    this.sessionService.confirmTeams(this.sessionId, this.teamsScoreSource)
      .pipe(
        timeout(10_000),
        finalize(() => this.teamsConfirming = false)
      )
      .subscribe({
        next: suggestion => {
          this.teamSuggestion = suggestion;
          this.teamSuggestionPendingConfirmation = false;
          this.teamsSuccess = t('feedback.session.teamsConfirmed');
          this.loadSessionParticipants();
          if (this.isCreator()) this.loadGuestRequests();
        },
        error: error => {
          this.teamsError = this.errorFrom(error, t('feedback.session.teamsConfirmError'));
        }
      });
  }

  teamParticipants(code: 'A' | 'B'): SessionParticipant[] {
    return code === 'A' ? this.teamAParticipants : this.teamBParticipants;
  }

  guestTeamParticipants(code: 'A' | 'B'): SessionGuestRequest[] {
    return this.isCreator()
      ? this.guestRequests.filter(guest => guest.status === 'APPROVED' && guest.teamCode === code)
      : [];
  }

  hasConfirmedTeams(): boolean {
    return this.confirmedTeams
      || this.guestTeamParticipants('A').length > 0
      || this.guestTeamParticipants('B').length > 0;
  }

  canShareGuestInvites(): boolean {
    return !!this.session && this.isCreator() && !!this.session.communityId
      && (this.session.audience === 'PUBLIC' || this.session.audience === 'COMMUNITY_ONLY')
      && !this.session.privateGame
      && (this.session.status === 'OPEN' || this.session.status === 'FULL')
      && Date.parse(this.session.gameDate) > Date.now();
  }

  openRegisteredInvitePicker(): void {
    if (!this.canFindPlayers()) return;
    if (!this.inviteFriendsOpen) this.toggleFriendInvites();
    this.scrollToPlayerSearch();
  }

  createGuestLink(): void {
    if (!this.sessionId || !this.canShareGuestInvites() || this.guestLinkWorking) return;
    this.guestLinkWorking=true;
    this.guestPanelError='';
    this.guestPanelSuccess='';
    this.sessionService.issueGuestLink(this.sessionId).pipe(
      timeout(10000),finalize(()=>this.guestLinkWorking=false)
    ).subscribe({
      next:({token})=>{
        this.guestLinkUrl=new URL('/sessions/'+this.sessionId+'?guest='+encodeURIComponent(token),
          window.location.origin).href;
        this.guestPanelSuccess=t('guestAdmin.newLink');
        this.loadGuestRequests();
      },
      error:()=>{this.guestPanelError=t('guestAdmin.linkError');}
    });
  }

  get guestLinkWhatsAppUrl(): string {
    return this.guestLinkUrl
      ? 'https://wa.me/?text='+encodeURIComponent(this.compactShareText()+'\n'+this.guestLinkUrl)
      : '';
  }

  async copyGuestLink(): Promise<void> {
    if (!this.guestLinkUrl) return;
    try {
      await navigator.clipboard.writeText(this.guestLinkUrl);
      this.guestPanelSuccess=t('guestAdmin.copied');
    } catch {
      this.guestPanelError=t('guestAdmin.copyError');
    }
  }

  loadGuestRequests(): void {
    if(!this.sessionId || !this.isCreator() || this.guestRequestsLoading) return;
    this.guestRequestsLoading=true;
    this.guestPanelError='';
    const id=this.sessionId;
    this.sessionService.guestRequests(id).pipe(
      timeout(10000),finalize(()=>this.guestRequestsLoading=false)
    ).subscribe({
      next:rows=>{if(id===this.sessionId)this.guestRequests=rows;},
      error:()=>{
        this.guestRequestsLoadedForSession=null;
        this.guestPanelError=t('guestAdmin.loadError');
      }
    });
  }

  reviewGuest(request:SessionGuestRequest,approve:boolean): void {
    if(!this.sessionId || !this.isCreator() || this.guestRequestBusyId!==null
      || request.status!=='PENDING') return;
    this.guestRequestBusyId=request.id;
    this.guestPanelError='';
    this.guestPanelSuccess='';
    this.sessionService.reviewGuestRequest(this.sessionId,request.id,approve).pipe(
      timeout(10000),finalize(()=>this.guestRequestBusyId=null)
    ).subscribe({
      next:updated=>{
        this.guestRequests=this.guestRequests.map(g=>g.id===updated.id?updated:g);
        this.guestPanelSuccess=t('guestAdmin.saved');
        this.teamSuggestion=undefined;
        this.teamSuggestionPendingConfirmation=false;
        this.loadSession(false);
      },
      error:()=>{this.guestPanelError=t('guestAdmin.decisionError');}
    });
  }

  cancelApprovedGuest(request:SessionGuestRequest): void {
    if(!this.sessionId || !this.isCreator() || this.guestRequestBusyId!==null
      || request.status!=='APPROVED' || !this.canShareGuestInvites()) return;
    this.guestRequestBusyId=request.id;
    this.guestPanelError='';
    this.guestPanelSuccess='';
    this.sessionService.cancelGuestRequest(this.sessionId,request.id).pipe(
      timeout(10000),finalize(()=>this.guestRequestBusyId=null)
    ).subscribe({
      next:updated=>{
        this.guestRequests=this.guestRequests.map(g=>g.id===updated.id?updated:g);
        this.guestPanelSuccess=t('guestAdmin.cancelled');
        this.teamSuggestion=undefined;
        this.teamSuggestionPendingConfirmation=false;
        this.loadSession(false);
        this.loadSessionParticipants();
      },
      error:()=>{this.guestPanelError=t('guestAdmin.cancelError');}
    });
  }

  canPromoteSession(): boolean {
    const session = this.session;
    return !!session && this.isCreator() && this.canShareSession()
      && session.privateGame === false
      && session.audience !== 'COMMUNITY_ONLY'
      && (session.status === 'OPEN' || session.status === 'FULL')
      && Date.parse(session.gameDate) > Date.now();
  }

  showCreationSharePanel(): boolean {
    return !this.creationShareDismissed
      && this.route.snapshot.queryParamMap?.get('created') === '1'
      && this.canPromoteSession();
  }

  togglePromotionPanel(): void {
    if (this.canPromoteSession()) {
      this.promotionOpen = !this.promotionOpen;
    }
  }

  dismissCreationShare(): void {
    this.creationShareDismissed = true;
  }

  private compactShareText(): string {
    return compactSessionShareMessage({
      sport: this.session?.sport,
      city: this.session?.city,
      gameDate: this.session?.gameDate,
      remainingPlaces: this.session?.status === 'OPEN' && this.session.maxParticipants != null
        && this.session.participantCount != null
        ? Math.max(0, this.session.maxParticipants - this.session.participantCount) : null
    }, document.documentElement.lang === 'en' ? 'en-GB' : 'pt-PT');
  }

  whatsappShareUrl(): string | null {
    const url = this.publicShareUrl();
    if (!url || !this.session || !this.canPromoteSession()) return null;
    return 'https://wa.me/?text=' + encodeURIComponent(this.compactShareText() + '\n' + url);
  }

  async copyPublicShareLink(): Promise<void> {
    const url = this.publicShareUrl();
    if (!url || this.sharingSession) {
      return;
    }
    this.sharingSession = true;
    this.shareFeedback = '';
    this.manualShareUrl = '';
    try {
      await this.copyShareUrl(url);
      this.shareFeedback = t('publicSession.linkCopied');
    } catch {
      this.manualShareUrl = url;
      this.shareFeedback = t('publicSession.manualShare');
    } finally {
      this.sharingSession = false;
    }
  }

  canShareSession(): boolean {
    const session = this.session;
    return session?.canSharePublicly === true
      && Number.isSafeInteger(session.id)
      && session.id > 0;
  }

  canSharePostGameMoment(): boolean {
    return this.canShareSession()
      && this.session?.status === 'COMPLETED'
      && (this.session.joined || this.isCreator());
  }

  publicShareUrl(): string | null {
    return this.canShareSession()
      ? new URL('/sessions/' + this.session!.id, window.location.origin).href
      : null;
  }

  async shareSession(): Promise<void> {
    const url = this.publicShareUrl();
    if (!url || this.sharingSession) {
      return;
    }

    this.sharingSession = true;
    this.shareFeedback = '';
    this.manualShareUrl = '';

    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'Sessão de ' + this.session!.sport + ' na Jynlo',
            text: this.compactShareText(),
            url
          });
          this.shareFeedback = 'Partilhado';
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          // The native share sheet may be unavailable on this device.
        }
      }

      await this.copyShareUrl(url);
      this.shareFeedback = 'Ligação copiada';
    } catch {
      this.manualShareUrl = url;
      this.shareFeedback = 'Não foi possível copiar automaticamente. Seleciona a ligação abaixo.';
    } finally {
      this.sharingSession = false;
    }
  }

  private copyShareUrl(url: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return Promise.reject(new Error('Clipboard unavailable'));
    }
    return navigator.clipboard.writeText(url);
  }

  canLeaveSession(): boolean {
    const session = this.session;
    if (!session || !(session.joined || session.waitlisted)
      || this.isCreator()
      || (session.status !== 'OPEN' && session.status !== 'FULL')) {
      return false;
    }

    const startTime = Date.parse(session.gameDate);
    return Number.isFinite(startTime) && startTime > Date.now();
  }

  registrationPending(): boolean {
    if (!this.session || this.session.joined && !this.isCreator()) return false;
    if (this.session.registrationOpeningMode === 'MANUAL') return true;
    if (this.session.registrationOpeningMode === 'SCHEDULED') {
      const when = Date.parse(this.session.registrationOpensAt ?? '');
      return !Number.isFinite(when) || this.registrationClock < when;
    }
    return false;
  }

  openCallup(): void {
    if (!this.sessionId || !this.session || !this.isCreator()
        || this.session.registrationOpeningMode !== 'MANUAL' || this.actionLoading) return;
    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';
    this.sessionService.openRegistration(this.sessionId)
      .pipe(timeout(10000), finalize(() => this.actionLoading = false))
      .subscribe({
        next: detail => {
          this.session = detail;
          this.actionSuccess = t('sessionDetail.callupOpened');
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('sessionDetail.callupOpenError'));
        }
      });
  }

  canJoinSession(): boolean {
    if (this.joinOutcomeUnknown || !this.session || this.session.joined || this.session.waitlisted
      || (this.session.status !== 'OPEN' && this.session.status !== 'FULL')) {
      return false;
    }

    const startTime = Date.parse(this.session.gameDate);
    return !this.registrationPending()
      && Number.isFinite(startTime) && startTime > Date.now();
  }

  joinButtonLabel(): string {
    if (this.actionLoading) {
      return t('session.joinProcessing');
    }

    return this.isFull() ? t('session.joinWaitlist') : t('session.join');
  }

  photoUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  googleCalendarUrl(): string | null {
    if (!this.session) {
      return null;
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: this.calendarTitle(),
      dates: this.calendarStartUtc(),
      details: this.calendarDescription(),
      location: this.calendarLocation()
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  outlookCalendarUrl(): string | null {
    if (!this.session) {
      return null;
    }

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: this.calendarTitle(),
      startdt: new Date(this.session.gameDate).toISOString(),
      body: this.calendarDescription(),
      location: this.calendarLocation()
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  calendarIcsContent(): string | null {
    if (!this.session) {
      return null;
    }

    const uid = `session-${this.session.id}@desporto24`;
    const dtStamp = this.toIcsUtc(new Date());
    const dtStart = this.toIcsUtc(new Date(this.session.gameDate));

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Desporto24//Session Calendar//PT',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `SUMMARY:${this.escapeIcs(this.calendarTitle())}`,
      `DESCRIPTION:${this.escapeIcs(this.calendarDescription())}`,
      `LOCATION:${this.escapeIcs(this.calendarLocation())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  downloadIcs(): void {
    if (!this.session) {
      return;
    }

    const content = this.calendarIcsContent();
    if (!content) {
      return;
    }

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `desporto24-session-${this.session.id}.ics`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private calendarTitle(): string {
    return `Desporto24 — ${this.session?.sport ?? 'Sessão'}`;
  }

  private calendarDescription(): string {
    const creator = this.session?.creatorUsername
      ? ` Criada por ${this.session.creatorUsername}.`
      : '';

    return `Sessão de ${this.session?.sport ?? 'desporto'} no Desporto24.${creator}`;
  }

  /** Only share precise coordinates with people authorised by the session API.
   * Many Jynlo venues have verified catalogue GPS but no postal address: a
   * missing street must not disable their navigation link.
   */
  exactGoogleMapsUrl(): string | null {
    if (!this.session?.canSeeExactAddress) return null;
    const lat = this.session.venue?.latitude;
    const lon = this.session.venue?.longitude;
    const hasGps = typeof lat === 'number' && typeof lon === 'number'
      && Number.isFinite(lat) && Number.isFinite(lon)
      && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    const address = this.session.address?.trim();
    if (!hasGps && !address) return null;
    const query = hasGps ? lat + ',' + lon : address + ', ' + this.session.city;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  /** Never present an OSM GPS-only location as a confirmed postal address. */
  exactLocationLabel(): string {
    const address = this.session?.address?.trim();
    return address && this.session?.venue?.locationStatus !== 'GPS_ONLY_ADDRESS_UNKNOWN'
      ? address : t('sessionDetail.openMaps');
  }

  private calendarLocation(): string {
    if (!this.session) {
      return '';
    }

    return this.session.canSeeExactAddress && this.session.address
      ? this.session.address
      : this.session.city;
  }

  private calendarStartUtc(): string {
    return this.toIcsUtc(new Date(this.session?.gameDate ?? ''));
  }

  private toIcsUtc(date: Date): string {
    return date.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeIcs(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  retrySessionLoad(): void {
    this.loadSession();
  }

  private loadSession(showPageLoader = true): void {
    if (!this.sessionId) {
      return;
    }

    if (showPageLoader) {
      this.loading = true;
    }
    this.errorMessage = '';
    this.detailRefreshWarning = '';

    this.sessionService.detail(this.sessionId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (showPageLoader) {
            this.loading = false;
          }
        })
      )
      .subscribe({
        next: session => {
          this.session = session;
          if (this.canShareGuestInvites()
              && this.guestRequestsLoadedForSession !== session.id) {
            this.guestRequestsLoadedForSession = session.id;
            this.loadGuestRequests();
          }
          // Rating eligibility is determined after the participant roster loads,
          // not from the joined flag alone.
          if (session.creatorUsername) {
            this.loadCreatorReliability(session.creatorUsername);
          }

          if (!this.isCreator()) {
            this.participants = [];
            this.showAttendanceManager = false;
          }

          if (!this.canGenerateTeams()) {
            this.teamSuggestion = undefined;
            this.teamsError = '';
          }

          if (session.joined || this.isCreator()) {
            // The existing backend endpoint authorizes the creator independently
            // of membership. Do not require the organiser to reserve a playing spot.
            this.loadSessionParticipants();
          } else {
            this.sessionParticipants = [];
            this.teamAParticipants = [];
            this.teamBParticipants = [];
            this.confirmedTeams = false;
            this.sessionParticipantsError = '';
          }

          // Never fetch a hidden chat on session details.
          this.messages = [];
          this.chatError = '';
        },
        error: () => {
          if (showPageLoader) {
            this.errorMessage = t('feedback.session.detailsError');
          } else {
            this.detailRefreshWarning = t('feedback.session.detailsRefreshError');
          }
        }
      });
  }

  private loadCreatorReliability(username: string): void {
    this.reliabilityLoading = true;
    this.reliabilityError = '';

    this.reliabilityService.summary(username)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.reliabilityLoading = false)
      )
      .subscribe({
        next: summary => this.creatorReliability = summary,
        error: () => {
          this.creatorReliability = undefined;
          this.reliabilityError = t('feedback.session.reliabilityError');
        }
      });
  }

  private joinSuccessMessage(response: JoinSessionResponse): string {
    if (response.state === 'WAITLISTED') {
      return response.waitlistPosition
        ? t('feedback.session.waitlistedPos', { position: response.waitlistPosition })
        : t('feedback.session.waitlisted');
    }

    return t('feedback.session.joined');
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }

  private readCurrentUsername(): string | null {
    const token = localStorage.getItem('t');
    if (!token) {
      return null;
    }

    try {
      return this.jwtHelper.decodeToken(token)?.sub ?? null;
    } catch {
      return null;
    }
  }
}
