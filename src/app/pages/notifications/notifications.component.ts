import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, map, Observable, retry, timeout } from 'rxjs';

import { AppNotification } from '../model/app-notification';
import { JoinSessionResponse, PendingSessionInvite, SessionService } from '../../services/session.service';
import { NotificationApiService } from '../../services/notification-api.service';
import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class NotificationsComponent implements OnInit {
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  notifications: AppNotification[] = [];
  pendingInvites: PendingSessionInvite[] = [];
  unreadCount = 0;
  selected?: AppNotification;

  loading = false;
  actionLoadingId: number | null = null;
  accountBlockConfirming = false;
  clearAllConfirming = false;
  clearAllLoading = false;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  constructor(
    private notificationService: NotificationApiService,
    private sessionService: SessionService,
    private authenticationService: AuthenticationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({ notifications: this.notificationService.mine(), pendingInvites: this.sessionService.pendingInvites() })
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: ({ notifications, pendingInvites }) => {
          this.pendingInvites = pendingInvites;
          this.notifications = [...notifications].sort(
            (a, b) => this.timestamp(b.createdAt) - this.timestamp(a.createdAt)
          );
          this.updateUnreadCount();

          const routeId = Number(this.route.snapshot.paramMap.get('id'));
          if (Number.isFinite(routeId) && routeId > 0) {
            const notification = this.notifications.find(item => item.id === routeId);
            if (notification) {
              this.openNotification(notification, false);
            }
          }
        },
        error: () => {
          this.notifications = [];
          this.pendingInvites = [];
          this.updateUnreadCount();
          this.errorMessage = t('feedback.notifications.loadError');
        }
      });
  }

  openNotification(notification: AppNotification, navigate = true): void {
    this.selected = notification;
    this.actionError = '';
    this.actionSuccess = '';
    this.accountBlockConfirming = false;

    if (navigate) {
      this.router.navigate(['/menu/notifications', notification.id]);
    }

    if (!notification.read) {
      notification.read = true;
      this.updateUnreadCount();
      this.notificationService.markRead(notification.id)
        .pipe(timeout(10_000))
        .subscribe({
          error: () => {
            notification.read = false;
            this.updateUnreadCount();
          }
        });
    }
  }

  closeNotification(): void {
    this.selected = undefined;
    this.accountBlockConfirming = false;
    this.router.navigate(['/menu/notifications']);
  }

  requestClearAll(): void {
    this.clearAllConfirming = true;
    this.actionError = '';
    this.actionSuccess = '';
  }

  cancelClearAll(): void {
    this.clearAllConfirming = false;
  }

  clearAllNotifications(): void {
    if (this.clearAllLoading || this.notifications.length === 0) {
      return;
    }

    this.clearAllLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.notificationService.deleteAll()
      .pipe(
        timeout(10_000),
        finalize(() => this.clearAllLoading = false)
      )
      .subscribe({
        next: () => {
          this.notifications = [];
          this.updateUnreadCount();
          this.selected = undefined;
          this.clearAllConfirming = false;
          this.accountBlockConfirming = false;
          this.actionSuccess = t('feedback.notifications.cleared');
          this.router.navigate(['/menu/notifications']);
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.notifications.clearAllError')
          );
        }
      });
  }


  pendingInviteFor(notification: AppNotification): PendingSessionInvite | undefined {
    if (notification.type !== 'SESSION_INVITE' || notification.sessionId === null) {
      return undefined;
    }
    return this.pendingInvites.find(invite =>
      invite.sessionId === notification.sessionId &&
      invite.inviterUsername.toLowerCase() === notification.relatedUsername?.toLowerCase() &&
      // Don't present a newer pending invitation as an action on an old notification.
      Math.abs(Date.parse(invite.createdAt) - Date.parse(notification.createdAt)) < 60_000
    );
  }

  respondToInvite(notification: AppNotification, accept: boolean): void {
    const invite = this.pendingInviteFor(notification);
    if (!invite || this.actionLoadingId !== null) {
      return;
    }
    this.actionLoadingId = notification.id;
    this.actionError = '';
    this.actionSuccess = '';
    const operation: Observable<JoinSessionResponse | null> = accept
      ? this.sessionService.acceptInvite(invite.sessionId, invite.id)
      : this.sessionService.declineInvite(invite.sessionId, invite.id).pipe(map(() => null));
    operation.pipe(timeout(10_000), finalize(() => this.actionLoadingId = null)).subscribe({
      next: result => {
        this.pendingInvites = this.pendingInvites.filter(item => item.id !== invite.id);
        this.actionSuccess = accept
          ? ((result && 'state' in result && result.state === 'WAITLISTED')
              ? 'Convite aceite. Ficaste na lista de espera.'
              : 'Convite aceite. Estás inscrito na sessão.')
          : 'Convite recusado.';
      },
      error: (error: HttpErrorResponse) => {
        this.actionError = this.errorFrom(error, 'Não foi possível responder ao convite.');
        if (error.status === 404 || error.status === 409) {
          this.sessionService.pendingInvites().pipe(timeout(10_000))
            .subscribe({ next: invites => this.pendingInvites = invites });
        }
      }
    });
  }

  openSession(notification: AppNotification): void {
    if (notification.sessionId === null) {
      return;
    }

    this.router.navigate(['/menu/events', notification.sessionId]);
  }

  openCommunityInvite(notification: AppNotification): void {
    if (notification.type !== 'COMMUNITY_INVITE') {
      return;
    }

    this.router.navigate(['/menu/communities']);
  }

  notificationSubject(notification: AppNotification): string {
    const community = this.invitedCommunityName(notification);
    return community
      ? t('notification.communityInviteSubject', { community })
      : notification.subject;
  }

  notificationMessage(notification: AppNotification): string {
    const community = this.invitedCommunityName(notification);
    return community && notification.relatedUsername
      ? t('notification.communityInviteMessage', {
          username: notification.relatedUsername,
          community
        })
      : notification.message;
  }

  private invitedCommunityName(notification: AppNotification): string | null {
    // The current API includes the community name in the invitation subject.
    const prefix = 'Convite para a comunidade ';
    return notification.type === 'COMMUNITY_INVITE' && notification.subject.startsWith(prefix)
      ? notification.subject.slice(prefix.length).trim() || null
      : null;
  }

  openChat(notification: AppNotification): void {
    if (!notification.relatedUsername) {
      return;
    }

    this.router.navigate(['/menu/friendList/chat', notification.relatedUsername]);
  }

  canProtectAccount(notification: AppNotification): boolean {
    if (notification.updateProfile) {
      return true;
    }

    const subject = (notification.subject || '').toLocaleLowerCase();
    const message = (notification.message || '').toLocaleLowerCase();
    const content = subject + ' ' + message;

    return content.includes('palavra-passe alterada')
      || content.includes('password changed')
      || content.includes('alteração de email')
      || content.includes('email changed')
      || content.includes('autenticação multifator')
      || content.includes('multi-factor authentication')
      || content.includes('perfil atualizado')
      || content.includes('profile updated');
  }

  requestAccountBlock(): void {
    this.accountBlockConfirming = true;
    this.actionError = '';
  }

  cancelAccountBlock(): void {
    this.accountBlockConfirming = false;
  }

  blockAccountAccess(): void {
    if (!this.selected || this.actionLoadingId !== null) {
      return;
    }

    this.actionLoadingId = this.selected.id;
    this.actionError = '';

    this.notificationService.blockOwnAccount()
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoadingId = null)
      )
      .subscribe({
        next: () => {
          this.authenticationService.logOut();
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.notifications.blockAccountError')
          );
        }
      });
  }

  deleteNotification(notification: AppNotification): void {
    if (this.actionLoadingId !== null) {
      return;
    }

    this.actionLoadingId = notification.id;
    this.actionError = '';
    this.actionSuccess = '';

    this.notificationService.delete(notification.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoadingId = null)
      )
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(item => item.id !== notification.id);
          this.updateUnreadCount();
          if (this.selected?.id === notification.id) {
            this.selected = undefined;
            this.router.navigate(['/menu/notifications']);
          }
          this.actionSuccess = t('feedback.notifications.deleted');
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.notifications.deleteError'));
        }
      });
  }

  acceptFriendRequest(notification: AppNotification): void {
    if (!notification.friendRequest || this.actionLoadingId !== null) {
      return;
    }

    this.actionLoadingId = notification.id;
    this.actionError = '';
    this.actionSuccess = '';

    this.notificationService.acceptFriendRequest(notification.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoadingId = null)
      )
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(item => item.id !== notification.id);
          this.updateUnreadCount();
          this.selected = undefined;
          this.actionSuccess = t('feedback.notifications.friendAccepted');
          this.router.navigate(['/menu/notifications']);
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.notifications.friendAcceptError'));
        }
      });
  }

  rejectFriendRequest(notification: AppNotification): void {
    if (!notification.friendRequest || this.actionLoadingId !== null) {
      return;
    }

    this.actionLoadingId = notification.id;
    this.actionError = '';
    this.actionSuccess = '';

    this.notificationService.rejectFriendRequest(notification.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.actionLoadingId = null)
      )
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(item => item.id !== notification.id);
          this.updateUnreadCount();
          this.selected = undefined;
          this.actionSuccess = t('feedback.notifications.friendRejected');
          this.router.navigate(['/menu/notifications']);
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.notifications.friendRejectError')
          );
        }
      });
  }

  formatCreatedAt(value: string): string {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return value;
    }

    return this.dateTimeFormatter.format(new Date(timestamp));
  }

  typeLabel(notification: AppNotification): string {
    switch (notification.type) {
      case 'WAITLIST_PROMOTED':
        return t('notification.waitlist');
      case 'SESSION_REMOVED':
        return t('notification.session');
      case 'SESSION_CANCELLED':
        return t('notification.sessionCancelled');
      case 'SESSION_POST_GAME_REVIEW':
        return t('notification.postGameReview');
      case 'SESSION_INVITE':
        return 'Convite para sessão';
      case 'COMMUNITY_INVITE':
        return t('notification.communityInvite');
      case 'CHAT_MESSAGE':
        return t('notification.chatMessage');
      default:
        return notification.friendRequest ? t('notification.friendRequest') : t('notification.generic');
    }
  }

  private updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter(notification => !notification.read).length;
  }

  private timestamp(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
