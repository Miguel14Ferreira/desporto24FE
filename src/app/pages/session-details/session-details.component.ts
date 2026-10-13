import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { finalize, retry, Subscription, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../model/session-detail';
import { appTranslate as t } from '../../i18n/i18n.service';
import { SessionMessage } from '../model/session-message';
import { ReliabilitySummary } from '../model/reliability-summary';
import { SessionParticipant } from '../model/session-participant';
import { JoinSessionResponse, SessionService, SessionTeamSuggestion } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';

@Component({
  selector: 'app-session-details',
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SessionDetailsComponent implements OnInit, OnDestroy {
  private readonly messageDateFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  session?: SessionDetail;
  messages: SessionMessage[] = [];
  creatorReliability?: ReliabilitySummary;
  participants: SessionParticipant[] = [];
  sessionParticipants: SessionParticipant[] = [];
  teamAParticipants: SessionParticipant[] = [];
  teamBParticipants: SessionParticipant[] = [];
  confirmedTeams = false;

  loading = false;
  actionLoading = false;
  chatLoading = false;
  messageSending = false;
  reliabilityLoading = false;
  participantsLoading = false;
  sessionParticipantsLoading = false;
  attendanceUpdatingId: number | null = null;
  removeLoadingId: number | null = null;
  pendingRemovalId: number | null = null;
  showProblemReport = false;
  selectedProblemType: 'NOT_OCCURRED' | 'VENUE_PROBLEM' | 'OTHER' | '' = '';
  problemDetails = '';
  showAttendanceManager = false;
  teamSuggestion?: SessionTeamSuggestion;
  teamsLoading = false;
  teamsConfirming = false;
  teamSuggestionPendingConfirmation = false;
  teamsError = '';
  teamsSuccess = '';

  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  sharingSession = false;
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
  private readonly jwtHelper = new JwtHelperService();
  private readonly realtimeSubscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private reliabilityService: ReliabilityService,
    private realtimeService: DirectChatRealtimeService
  ) {}

  ngOnInit(): void {
    this.currentUsername = this.readCurrentUsername();

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMessage = t('feedback.session.invalid');
      return;
    }

    this.sessionId = id;
    this.loadSession();
    this.realtimeService.connect();

    this.realtimeSubscriptions.add(
      this.realtimeService.sessionMessages$.subscribe(message => {
        if (message.sessionId !== this.sessionId) {
          return;
        }

        this.appendMessageIfMissing(message);
      })
    );

    this.realtimeSubscriptions.add(
      this.realtimeService.connected$.subscribe(connected => {
        if (connected && this.canAccessChat()) {
          this.refreshMessages(false);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.realtimeSubscriptions.unsubscribe();
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

    this.sessionService.join(this.sessionId, this.joinPassword)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoading = false)
      )
      .subscribe({
        next: response => {
          this.joinPassword = '';
          this.actionSuccess = this.joinSuccessMessage(response);
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.session.joinError'));
        }
      });
  }

  leaveSession(): void {
    if (!this.sessionId || this.actionLoading || this.isCreator()) {
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
    if (!this.sessionId || !this.session?.joined || this.sessionParticipantsLoading) {
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
    if (!this.sessionId || !this.isCreator() || this.participantsLoading) {
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
        next: participants => this.participants = participants,
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
    if (!this.sessionId || !this.isCreator() || this.attendanceUpdatingId !== null) {
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

  canRemoveParticipant(participant: SessionParticipant): boolean {
    if (!this.session?.creatorUsername) {
      return false;
    }

    return participant.username.toLowerCase() !== this.session.creatorUsername.toLowerCase();
  }

  requestRemoveParticipant(participant: SessionParticipant): void {
    if (!this.canRemoveParticipant(participant) || this.removeLoadingId !== null) {
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
    if (!this.isCreator() || !this.canRecordAttendance()) {
      return;
    }

    this.showAttendanceManager = !this.showAttendanceManager;
    if (this.showAttendanceManager && this.participants.length === 0) {
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
        next: messages => this.messages = this.sortedMessages(messages),
        error: error => {
          this.chatError = this.errorFrom(error, t('feedback.session.chatLoadError'));
        }
      });
  }

  sendMessage(): void {
    const body = this.messageBody.trim();

    if (!this.sessionId || !this.canAccessChat() || this.messageSending) {
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

    this.sessionService.postMessage(this.sessionId, body)
      .pipe(
        timeout(10_000),
        finalize(() => this.messageSending = false)
      )
      .subscribe({
        next: message => {
          this.appendMessageIfMissing(message);
          this.messageBody = '';
          this.showEmojiPicker = false;
        },
        error: error => {
          this.chatError = this.errorFrom(error, t('feedback.chat.sendError'));
        }
      });
  }

  onChatEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) {
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

    this.messages = this.sortedMessages([...this.messages, message]);
  }

  private sortedMessages(messages: SessionMessage[]): SessionMessage[] {
    return [...messages].sort((a, b) => {
      const aTime = Date.parse(a.createdAt || '') || 0;
      const bTime = Date.parse(b.createdAt || '') || 0;
      return aTime - bTime;
    });
  }

  canAccessChat(): boolean {
    return Boolean(this.session?.joined);
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
      && this.isFull()
      && this.session.status !== 'CANCELLED'
      && this.session.status !== 'COMPLETED'
    );
  }

  generateTeams(): void {
    if (!this.sessionId || !this.canGenerateTeams() || this.teamsLoading) {
      return;
    }

    this.teamsLoading = true;
    this.teamsError = '';
    this.teamsSuccess = '';

    this.sessionService.teamSuggestion(this.sessionId)
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

    this.sessionService.confirmTeams(this.sessionId)
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
        },
        error: error => {
          this.teamsError = this.errorFrom(error, t('feedback.session.teamsConfirmError'));
        }
      });
  }

  teamParticipants(code: 'A' | 'B'): SessionParticipant[] {
    return code === 'A' ? this.teamAParticipants : this.teamBParticipants;
  }

  hasConfirmedTeams(): boolean {
    return this.confirmedTeams;
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
            text: 'Vem jogar connosco na Jynlo!',
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

  canJoinSession(): boolean {
    if (!this.session || this.session.joined || this.session.waitlisted
      || (this.session.status !== 'OPEN' && this.session.status !== 'FULL')) {
      return false;
    }

    const startTime = Date.parse(this.session.gameDate);
    return Number.isFinite(startTime) && startTime > Date.now();
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

          if (session.joined) {
            this.loadSessionParticipants();
            this.refreshMessages();
          } else {
            this.sessionParticipants = [];
            this.teamAParticipants = [];
            this.teamBParticipants = [];
            this.confirmedTeams = false;
            this.sessionParticipantsError = '';
            this.messages = [];
            this.chatError = '';
          }
        },
        error: () => this.errorMessage = t('feedback.session.detailsError')
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
