import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AppNotification } from '../model/app-notification';
import { NotificationApiService } from '../../services/notification-api.service';

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

  errorMessage = '';
  actionError = '';
  actionSuccess = '';

  constructor(
    private notificationService: NotificationApiService,
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
      .pipe(finalize(() => this.loading = false))
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
    this.router.navigate(['/menu/notifications']);
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

  deleteNotification(notification: AppNotification): void {
    if (this.actionLoadingId !== null) {
      return;
    }

    this.actionLoadingId = notification.id;
    this.actionError = '';
    this.actionSuccess = '';

    this.notificationService.delete(notification.id)
      .pipe(finalize(() => this.actionLoadingId = null))
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
      .pipe(finalize(() => this.actionLoadingId = null))
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
      .pipe(finalize(() => this.actionLoadingId = null))
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
