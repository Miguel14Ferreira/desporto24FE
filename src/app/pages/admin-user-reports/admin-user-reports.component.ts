import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, retry, timeout } from 'rxjs';

import {
  AdminUserReport,
  ClosedUserReportStatus
} from '../model/admin-user-report';
import { AdminUserReportsService } from '../../services/admin-user-reports.service';
import { appTranslate as t } from '../../i18n/i18n.service';

@Component({
  selector: 'app-admin-user-reports',
  templateUrl: './admin-user-reports.component.html',
  styleUrls: ['./admin-user-reports.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AdminUserReportsComponent implements OnInit {
  reports: AdminUserReport[] = [];
  loading = false;
  updatingId: number | null = null;
  errorMessage = '';
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  constructor(private adminUserReportsService: AdminUserReportsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.adminUserReportsService.listOpen()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: reports => this.reports = reports,
        error: () => {
          this.reports = [];
          this.errorMessage = t('adminReports.loadError');
        }
      });
  }

  closeReport(
    report: AdminUserReport,
    status: ClosedUserReportStatus
  ): void {
    if (this.updatingId !== null) {
      return;
    }

    this.updatingId = report.id;
    this.errorMessage = '';

    this.adminUserReportsService.updateStatus(report.id, status)
      .pipe(
        timeout(10_000),
        finalize(() => this.updatingId = null)
      )
      .subscribe({
        next: () => {
          this.reports = this.reports.filter(item => item.id !== report.id);
        },
        error: () => {
          this.errorMessage = t('adminReports.updateError');
        }
      });
  }

  formatDate(value: string | null): string {
    if (!value) {
      return t('adminReports.dateUnavailable');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return this.dateTimeFormatter.format(date);
  }
}
