import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, retry, timeout } from 'rxjs';

import { AppNotification } from '../model/app-notification';
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
  notifications: AppNotification[] = [];
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
    private authenticationService: AuthenticationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get unreadCount(): number {
    return this.notifications.filter(notification => !notification.read).length;
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.notificationService.mine()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: notifications => {
          this.notifications = [...notifications].sort(
            (a, b) => this.timestamp(b.createdAt) - this.timestamp(a.createdAt)
          );

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
      this.notificationService.markRead(notification.id).subscribe({
        error: () => {
          notification.read = false;
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

  openSession(notification: AppNotification): void {
    if (notification.sessionId === null) {
      return;
    }

    this.router.navigate(['/menu/events', notification.sessionId]);
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

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  typeLabel(notification: AppNotification): string {
    switch (notification.type) {
      case 'WAITLIST_PROMOTED':
        return t('notification.waitlist');
      case 'SESSION_REMOVED':
        return t('notification.session');
      case 'SESSION_CANCELLED':
        return t('notification.sessionCancelled');
      case 'CHAT_MESSAGE':
        return t('notification.chatMessage');
      default:
        return notification.friendRequest ? t('notification.friendRequest') : t('notification.generic');
    }
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
