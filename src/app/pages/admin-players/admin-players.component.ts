import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { finalize, Subscription, timeout } from 'rxjs';
import { AuthenticationService } from '../../services/authethication.service';
import { AdminPlayer, AdminPlayerStats, AdminPlayersService } from '../../services/admin-players.service';

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
  pendingRole: { id: number; username: string; role: 'ROLE_ADMIN' | 'ROLE_USER'; expectedRole: string } | null = null;
  changingRole = false;
  roleErrorKey = '';
  roleSuccessName = '';
  private roleRequest?: Subscription;
  private request?: Subscription;
  statsPlayer: AdminPlayer | null = null;
  stats: AdminPlayerStats | null = null;
  statsLoading = false;
  statsErrorKey = '';
  private statsRequest?: Subscription;

  toggleStatistics(player: AdminPlayer): void {
    if (this.loading || this.changingRole) return;
    if (this.statsPlayer?.id === player.id) {
      this.resetStatistics();
      return;
    }
    this.resetStatistics();
    this.statsPlayer = player;
    this.statsLoading = true;
    this.statsRequest = this.service.statistics(player.id)
      .pipe(timeout(10_000), finalize(() => {
        if (this.statsPlayer?.id === player.id) this.statsLoading = false;
      }))
      .subscribe({
        next: result => {
          if (this.statsPlayer?.id === player.id && result.playerId === player.id) {
            this.stats = result;
          }
        },
        error: () => {
          if (this.statsPlayer?.id === player.id) this.statsErrorKey = 'adminPlayers.statsError';
        }
      });
  }

  private resetStatistics(): void {
    this.statsPlayer = null;
    this.statsRequest?.unsubscribe();
    this.statsRequest = undefined;
    this.stats = null;
    this.statsErrorKey = '';
    this.statsLoading = false;
  }

  constructor(private service: AdminPlayersService, private auth: AuthenticationService) {}

  get canManageRoles(): boolean {
    return this.auth.hasAnyRole('ROLE_SUPER_ADMIN');
  }

  canChangeRole(player: AdminPlayer): boolean {
    return this.canManageRoles && (
      player.role === 'ROLE_ADMIN'
      || (player.role === 'ROLE_USER' && player.enabled === true && player.notLocked === true)
    );
  }

  beginRoleChange(player: AdminPlayer): void {
    if (this.changingRole || this.loading || !this.canChangeRole(player)) return;
    this.roleErrorKey = '';
    this.roleSuccessName = '';
    this.pendingRole = {
      id: player.id, username: player.username,
      role: player.role === 'ROLE_ADMIN' ? 'ROLE_USER' : 'ROLE_ADMIN',
      expectedRole: player.role!
    };
  }

  cancelRoleChange(): void {
    if (!this.changingRole) this.pendingRole = null;
  }

  confirmRoleChange(): void {
    const pending = this.pendingRole;
    if (!pending || this.changingRole || !this.canManageRoles) return;
    this.changingRole = true;
    this.roleErrorKey = '';
    this.roleRequest = this.service.changeRole(pending.id, pending.role, pending.expectedRole)
      .pipe(timeout(10_000), finalize(() => this.changingRole = false))
      .subscribe({
        next: result => {
          this.players = this.players.map(player => player.id === result.id
            ? { ...player, role: result.role } : player);
          this.roleSuccessName = pending.username;
          this.pendingRole = null;
        },
        error: error => {
          this.pendingRole = null;
          this.roleErrorKey = error.status === 409 ? 'adminPlayers.roleConflict'
            : error.status === 403 ? 'adminPlayers.roleForbidden' : 'adminPlayers.roleError';
        }
      });
  }

  search(): void {
    if (this.changingRole) return;
    const name = this.name.trim();
    if (!name) {
      this.clear();
      return;
    }
    this.load(name, 0);
  }

  changePage(direction: number): void {
    if (this.loading || this.changingRole || !this.searchedName || (direction > 0 && !this.hasMore)) return;
    const page = this.page + direction;
    if (page >= 0) this.load(this.searchedName, page);
  }

  clear(): void {
    if (this.changingRole) return;
    this.pendingRole = null;
    this.roleErrorKey = '';
    this.roleSuccessName = '';
    this.request?.unsubscribe();
    this.resetStatistics();
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
    this.roleRequest?.unsubscribe();
    this.request?.unsubscribe();
    this.resetStatistics();
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
    this.pendingRole = null;
    this.roleErrorKey = '';
    this.roleSuccessName = '';
    this.request?.unsubscribe();
    this.resetStatistics();
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
