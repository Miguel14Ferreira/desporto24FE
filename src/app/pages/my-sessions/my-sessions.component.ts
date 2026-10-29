import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, retry, timeout } from 'rxjs';

import { AttendanceHistoryItem } from '../model/attendance-history';
import { MySessionsResponse } from '../model/my-sessions-response';
import { SessionSummary } from '../model/session-summary';
import { ReliabilityService } from '../../services/reliability.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-my-sessions',
  templateUrl: './my-sessions.component.html',
  styleUrls: ['./my-sessions.component.css', './my-sessions-concept-one-premium.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class MySessionsComponent implements OnInit {
  data: MySessionsResponse = {
    created: [],
    joined: [],
    waitlisted: []
  };

  attendanceHistory: AttendanceHistoryItem[] = [];

  /** Organize existing data client-side, never mutate server ordering or records. */
  activeTab: 'upcoming' | 'history' | 'participation' = 'upcoming';
  historyQuery = '';
  historySport = '';
  historyStatus = 'all';
  historyFrom = '';
  historyTo = '';
  historyCommunityId = '';
  historyShown = 8;
  communityNames: Record<number, string> = {};

  private communityId(session: SessionSummary): number | null {
    return session.communityId ?? session.seasonCommunityId ?? null;
  }

  private localDateKey(isoDate: string): string {
    const date = new Date(isoDate);
    if (!Number.isFinite(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get historyCommunityIds(): number[] {
    const ids = this.historicalCreated.map(s => this.communityId(s));
    return [...new Set(ids.filter((id): id is number => id !== null))]
      .sort((a, b) => (this.communityNames[a] || '').localeCompare(this.communityNames[b] || '') || a - b);
  }

  communityLabel(id: number): string {
    return this.communityNames[id] || `${t('mySessions.community')} #${id}`;
  }

  /** Hide owned sessions even if the API returns them in more than one category. */
  get joinedOtherSessions(): SessionSummary[] {
    const owned = new Set(this.data.created.map(s => s.id));
    return this.data.joined.filter(s => !owned.has(s.id));
  }

  get waitlistedOtherSessions(): SessionSummary[] {
    const owned = new Set(this.data.created.map(s => s.id));
    return this.data.waitlisted.filter(s => !owned.has(s.id));
  }

  get externalAttendanceHistory(): AttendanceHistoryItem[] {
    const owned = new Set(this.data.created.map(s => s.id));
    return this.attendanceHistory.filter(item => !owned.has(item.sessionId));
  }

  private get chronologicalCreated(): SessionSummary[] {
    return [...this.data.created].sort((a,b) => {
      const aDate=Date.parse(a.gameDate), bDate=Date.parse(b.gameDate);
      const diff=(Number.isFinite(aDate)?aDate:0)-(Number.isFinite(bDate)?bDate:0);
      return diff || a.id-b.id;
    });
  }

  private upcoming(session: SessionSummary): boolean {
    const date=Date.parse(session.gameDate);
    return (session.status==='OPEN'||session.status==='FULL')
      && Number.isFinite(date) && date>Date.now();
  }

  get upcomingCreated(): SessionSummary[] {
    return this.chronologicalCreated.filter(session=>this.upcoming(session));
  }

  get historicalCreated(): SessionSummary[] {
    return this.chronologicalCreated.filter(session=>!this.upcoming(session)).reverse();
  }

  get historySports(): string[] {
    return [...new Set(this.historicalCreated.map(s=>s.sport).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b));
  }

  get filteredHistory(): SessionSummary[] {
    const query=this.historyQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return this.historicalCreated.filter(session => {
      if (this.historySport && session.sport!==this.historySport) return false;
      if (this.historyCommunityId && String(this.communityId(session)) !== this.historyCommunityId) return false;
      if (this.historyFrom || this.historyTo) {
        const day = this.localDateKey(session.gameDate);
        if (!day || (this.historyFrom && day < this.historyFrom)
          || (this.historyTo && day > this.historyTo)) return false;
      }
      if (this.historyStatus!=='all' && this.historyStatus!==session.status) {
        if (this.historyStatus!=='past' || session.status==='CANCELLED'
          || session.status==='COMPLETED') return false;
      } else if (this.historyStatus==='past') return false;
      if (!query) return true;
      return (session.sport+' '+session.city+' '+session.id)
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query);
    });
  }

  get visibleHistory(): SessionSummary[] {
    return this.filteredHistory.slice(0,this.historyShown);
  }

  selectTab(tab:'upcoming'|'history'|'participation'):void {
    this.activeTab=tab;
  }

  resetHistoryFilters():void {
    this.historyQuery='';
    this.historySport='';
    this.historyStatus='all';
    this.historyFrom='';
    this.historyTo='';
    this.historyCommunityId='';
    this.historyShown=8;
  }

  showMoreHistory():void { this.historyShown+=8; }

  sessionStatusLabel(session:SessionSummary):string {
    switch(session.status) {
      case 'CANCELLED': return t('mySessions.statusCancelled');
      case 'COMPLETED': return t('mySessions.statusCompleted');
      case 'FULL': return t('mySessions.statusFull');
      case 'OPEN': return this.upcoming(session)
        ? t('mySessions.statusOpen') : t('mySessions.statusPast');
      default: return session.status;
    }
  }

  historyStatusFilterLabel(status:string):string {
    if(status==='CANCELLED') return t('mySessions.statusCancelled');
    if(status==='COMPLETED') return t('mySessions.statusCompleted');
    return t('mySessions.statusPast');
  }

  loading = false;
  attendanceLoading = false;
  cancelLoading = false;
  disputeLoading = false;
  waitlistLeavingId: number | null = null;

  errorMessage = '';
  attendanceError = '';
  actionMessage = '';
  actionError = '';

  pendingCancelId: number | null = null;
  pendingDispute?: AttendanceHistoryItem;
  disputeReason = '';

  constructor(
    private sessionService: SessionService,
    private reliabilityService: ReliabilityService,
    private communityGroupsService: CommunityGroupsService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadAttendanceHistory();
    this.communityGroupsService.mine().pipe(timeout(10_000)).subscribe({
      next: groups => {
        this.communityNames = {};
        for (const group of groups) this.communityNames[group.id] = group.name;
      },
      // The activity list remains usable even if community names cannot be fetched.
      error: () => {}
    });
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.sessionService.mine()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: data => this.data = data,
        error: () => this.errorMessage = t('feedback.sessions.loadError')
      });
  }

  loadAttendanceHistory(): void {
    this.attendanceLoading = true;
    this.attendanceError = '';

    this.reliabilityService.attendanceHistory()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.attendanceLoading = false)
      )
      .subscribe({
        next: history => this.attendanceHistory = history,
        error: () => {
          this.attendanceHistory = [];
          this.attendanceError = t('feedback.sessions.attendanceLoadError');
        }
      });
  }

  requestCancel(session: SessionSummary): void {
    if (!this.canCancel(session) || this.cancelLoading) {
      return;
    }

    this.pendingCancelId = session.id;
    this.actionMessage = '';
    this.actionError = '';
  }

  dismissCancel(): void {
    if (this.cancelLoading) {
      return;
    }

    this.pendingCancelId = null;
  }

  confirmCancel(): void {
    if (this.pendingCancelId === null || this.cancelLoading) {
      return;
    }

    const sessionId = this.pendingCancelId;
    this.cancelLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.sessionService.cancel(sessionId)
      .pipe(
        timeout(10_000),
        finalize(() => this.cancelLoading = false)
      )
      .subscribe({
        next: () => {
          this.data = {
            ...this.data,
            created: this.data.created.map(session =>
              session.id === sessionId
                ? { ...session, status: 'CANCELLED' }
                : session
            )
          };
          this.pendingCancelId = null;
          this.actionMessage = t('feedback.sessions.cancelled');
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.sessions.cancelError'));
        }
      });
  }

  canLeaveWaitlist(session: SessionSummary): boolean {
    const start = Date.parse(session.gameDate);
    return (session.status === 'OPEN' || session.status === 'FULL')
      && Number.isFinite(start) && start > Date.now();
  }

  leaveWaitlist(session: SessionSummary): void {
    if (this.waitlistLeavingId !== null || !this.canLeaveWaitlist(session)) {
      return;
    }

    this.waitlistLeavingId = session.id;
    this.actionMessage = '';
    this.actionError = '';

    this.sessionService.leave(session.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.waitlistLeavingId = null)
      )
      .subscribe({
        next: () => {
          this.data = {
            ...this.data,
            waitlisted: this.data.waitlisted.filter(
              item => item.id !== session.id
            )
          };
          this.actionMessage = t('feedback.sessions.leftWaitlist');
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.sessions.leaveWaitlistError')
          );
        }
      });
  }

  requestDispute(item: AttendanceHistoryItem): void {
    if (!item.canDispute || this.disputeLoading) {
      return;
    }

    this.pendingDispute = item;
    this.disputeReason = '';
    this.actionMessage = '';
    this.actionError = '';
  }

  dismissDispute(): void {
    if (this.disputeLoading) {
      return;
    }

    this.pendingDispute = undefined;
    this.disputeReason = '';
  }

  confirmDispute(): void {
    const reason = this.disputeReason.trim();

    if (!this.pendingDispute || this.disputeLoading) {
      return;
    }

    if (!reason) {
      this.actionError = t('feedback.sessions.disputeReasonRequired');
      return;
    }

    if (reason.length > 2000) {
      this.actionError = t('feedback.sessions.disputeReasonLong');
      return;
    }

    const participantId = this.pendingDispute.participantId;
    this.disputeLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.reliabilityService.createDispute(participantId, reason)
      .pipe(
        timeout(10_000),
        finalize(() => this.disputeLoading = false)
      )
      .subscribe({
        next: () => {
          this.attendanceHistory = this.attendanceHistory.map(item =>
            item.participantId === participantId
              ? { ...item, disputeStatus: 'OPEN', canDispute: false }
              : item
          );
          this.pendingDispute = undefined;
          this.disputeReason = '';
          this.actionMessage = t('feedback.sessions.disputeSent');
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.sessions.disputeError')
          );
        }
      });
  }

  canCancel(session: SessionSummary): boolean {
    return session.status !== 'CANCELLED' && session.status !== 'COMPLETED';
  }

  vacancies(session: SessionSummary): number {
    return Math.max(session.maxParticipants - session.participantCount, 0);
  }

  sessionDisplayDate(session: SessionSummary): string | null {
    return Number.isFinite(Date.parse(session.gameDate)) ? session.gameDate : null;
  }

  /** The next confirmed upcoming game, never a waitlist or expired session. */
  get nextJoinedSession(): SessionSummary | null {
    const now = Date.now();
    return this.joinedOtherSessions
      .filter(session =>
        (session.status === 'OPEN' || session.status === 'FULL')
        && Number.isFinite(Date.parse(session.gameDate))
        && Date.parse(session.gameDate) > now
      )
      .reduce<SessionSummary | null>((next, session) =>
        !next || Date.parse(session.gameDate) < Date.parse(next.gameDate)
          ? session
          : next,
        null
      );
  }

  attendanceLabel(item: AttendanceHistoryItem): string {
    switch (item.attendanceStatus) {
      case 'ATTENDED':
        return t('mySessions.attendancePresent');
      case 'NO_SHOW':
        return t('mySessions.attendanceAbsent');
      case 'LATE_CANCELLED':
        return t('status.lateCancelled');
      default:
        return t('mySessions.attendancePending');
    }
  }

  disputeLabel(item: AttendanceHistoryItem): string {
    switch (item.disputeStatus) {
      case 'OPEN':
        return t('status.openReview');
      case 'ACCEPTED':
        return t('mySessions.disputeAccepted');
      case 'REJECTED':
        return t('mySessions.disputeRejected');
      default:
        return '';
    }
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
