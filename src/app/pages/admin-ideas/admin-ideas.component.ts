import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize, retry, timeout } from 'rxjs';

import { AdminIdea, IdeaStatus } from '../model/admin-idea';
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

  get newCount(): number {
    return this.ideas.filter(idea => idea.status === 'NEW').length;
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
          if (this.selected) {
            this.selected = ideas.find(idea => idea.id === this.selected?.id);
          }
        },
        error: () => {
          this.ideas = [];
          this.errorMessage = 'Não foi possível carregar as ideias.';
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
          if (this.selected?.id === updated.id) {
            this.selected = updated;
          }
        },
        error: () => {
          this.errorMessage = 'Não foi possível atualizar o estado da ideia.';
        }
      });
  }

  statusLabel(status: IdeaStatus): string {
    switch (status) {
      case 'NEW': return 'Nova';
      case 'IN_REVIEW': return 'Em análise';
      case 'PLANNED': return 'Planeada';
      case 'REJECTED': return 'Rejeitada';
      case 'IMPLEMENTED': return 'Implementada';
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return 'Data indisponível';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }
}
