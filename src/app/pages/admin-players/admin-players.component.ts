import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { finalize, Subscription, timeout } from 'rxjs';
import { AdminPlayer, AdminPlayersService } from '../../services/admin-players.service';

@Component({
  selector: 'app-admin-players',
  templateUrl: './admin-players.component.html',
  styleUrls: ['./admin-players.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AdminPlayersComponent implements OnDestroy {
  name = '';
  searchedName = '';
  players: AdminPlayer[] = [];
  page = 0;
  hasMore = false;
  loading = false;
  searched = false;
  errorKey = '';
  private request?: Subscription;

  constructor(private service: AdminPlayersService) {}

  search(): void {
    const name = this.name.trim();
    if (!name) {
      this.clear();
      return;
    }
    this.load(name, 0);
  }

  changePage(direction: number): void {
    if (this.loading || !this.searchedName || (direction > 0 && !this.hasMore)) return;
    const page = this.page + direction;
    if (page >= 0) this.load(this.searchedName, page);
  }

  clear(): void {
    this.request?.unsubscribe();
    this.name = '';
    this.searchedName = '';
    this.players = [];
    this.page = 0;
    this.hasMore = false;
    this.loading = false;
    this.searched = false;
    this.errorKey = '';
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  statusKey(player: AdminPlayer): string {
    if (player.enabled === false) return 'adminPlayers.inactive';
    if (player.notLocked === false) return 'adminPlayers.locked';
    if (player.enabled === true && player.notLocked === true) return 'adminPlayers.active';
    return 'common.notProvided';
  }

  roleKey(player: AdminPlayer): string {
    return ['ROLE_USER', 'ROLE_HR', 'ROLE_MANAGER', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'].includes(player.role || '')
      ? 'adminPlayers.role.' + player.role
      : 'common.notProvided';
  }

  private load(name: string, page: number): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorKey = '';
    this.request = this.service.search(name, page)
      .pipe(timeout(10_000), finalize(() => this.loading = false))
      .subscribe({
        next: result => {
          this.players = result.players;
          this.page = result.page;
          this.hasMore = result.hasMore;
          this.searchedName = name;
          this.searched = true;
        },
        error: () => {
          this.players = [];
          this.hasMore = false;
          this.errorKey = 'adminPlayers.loadError';
        }
      });
  }
}
