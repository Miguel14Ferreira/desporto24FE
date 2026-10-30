import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, retry, timeout } from 'rxjs';

import { AdminIdea, IdeaStatus } from '../model/admin-idea';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AdminIdeasService } from '../../services/admin-ideas.service';

@Component({
  selector: 'app-admin-ideas',
  templateUrl: './admin-ideas.component.html',
  styleUrls: ['./admin-ideas.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AdminIdeasComponent implements OnInit {
  ideas: AdminIdea[] = [];
  selected?: AdminIdea;
  loading = false;
  updatingId: number | null = null;
  errorMessage = '';
  newCount = 0;
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  readonly statuses: IdeaStatus[] = [
    'NEW',
    'IN_REVIEW',
    'PLANNED',
    'REJECTED',
    'IMPLEMENTED'
  ];

  constructor(private adminIdeasService: AdminIdeasService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.adminIdeasService.list()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: ideas => {
          this.ideas = ideas;
          this.newCount = ideas.filter(idea => idea.status === 'NEW').length;
          if (this.selected) {
            this.selected = ideas.find(idea => idea.id === this.selected?.id);
          }
        },
        error: () => {
          this.ideas = [];
          this.newCount = 0;
          this.errorMessage = t('adminIdeas.loadError');
        }
      });
  }

  select(idea: AdminIdea): void {
    this.selected = idea;
  }

  close(): void {
    this.selected = undefined;
  }

  updateStatus(idea: AdminIdea, status: IdeaStatus): void {
    if (this.updatingId !== null || idea.status === status) {
      return;
    }

    this.updatingId = idea.id;
    this.errorMessage = '';

    this.adminIdeasService.updateStatus(idea.id, status)
      .pipe(
        timeout(10_000),
        finalize(() => this.updatingId = null)
      )
      .subscribe({
        next: updated => {
          this.ideas = this.ideas.map(item => item.id === updated.id ? updated : item);
          this.newCount = this.ideas.filter(item => item.status === 'NEW').length;
          if (this.selected?.id === updated.id) {
            this.selected = updated;
          }
        },
        error: () => {
          this.errorMessage = t('adminIdeas.updateError');
        }
      });
  }

  statusLabel(status: IdeaStatus): string {
    return t('adminIdeas.status.' + status);
  }

  formatDate(value: string | null): string {
    if (!value) {
      return t('adminIdeas.dateUnavailable');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return this.dateTimeFormatter.format(date);
  }
}
