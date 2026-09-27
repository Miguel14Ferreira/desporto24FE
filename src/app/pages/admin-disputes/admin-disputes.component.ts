import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import {
  AttendanceDisputeItem,
  AttendanceDisputeStatus
} from '../model/attendance-dispute';
import { ReliabilityService } from '../../services/reliability.service';

@Component({
  selector: 'app-admin-disputes',
  templateUrl: './admin-disputes.component.html',
  styleUrls: ['./admin-disputes.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AdminDisputesComponent implements OnInit {
  disputes: AttendanceDisputeItem[] = [];
  statusFilter: AttendanceDisputeStatus = 'OPEN';

  loading = false;
  resolvingId: number | null = null;

  errorMessage = '';
  actionMessage = '';
  actionError = '';

  constructor(private reliabilityService: ReliabilityService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.reliabilityService.disputes(this.statusFilter)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: disputes => this.disputes = disputes,
        error: error => {
          this.disputes = [];
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.admin.loadError')
          );
        }
      });
  }

  changeStatus(status: AttendanceDisputeStatus): void {
    this.statusFilter = status;
    this.actionMessage = '';
    this.actionError = '';
    this.load();
  }

  resolve(
    dispute: AttendanceDisputeItem,
    status: 'ACCEPTED' | 'REJECTED'
  ): void {
    if (dispute.status !== 'OPEN' || this.resolvingId !== null) {
      return;
    }

    this.resolvingId = dispute.id;
    this.actionMessage = '';
    this.actionError = '';

    this.reliabilityService.resolveDispute(dispute.id, status)
      .pipe(finalize(() => this.resolvingId = null))
      .subscribe({
        next: () => {
          this.actionMessage = status === 'ACCEPTED'
            ? t('feedback.admin.accepted')
            : t('feedback.admin.rejected');
          this.load();
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            t('feedback.admin.resolveError')
          );
        }
      });
  }

  statusLabel(status: AttendanceDisputeStatus): string {
    switch (status) {
      case 'OPEN':
        return t('status.openReview');
      case 'ACCEPTED':
        return 'Aceites';
      case 'REJECTED':
        return 'Rejeitadas';
    }
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
