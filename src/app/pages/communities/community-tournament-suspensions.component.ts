import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunityGroup } from '../model/community-group';
import { CommunityDisciplineService, CommunityTournamentSuspension } from '../../services/community-discipline.service';

/** Tournament-only bans; does not affect ordinary sessions, other communities or accounts. */
@Component({
  selector: 'app-community-tournament-suspensions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="suspension-panel" aria-labelledby="suspension-title">
      <h3 id="suspension-title">Suspensões de torneios</h3>
      <p class="suspension-help">
        Impedem novas inscrições e entradas em equipas dos torneios desta comunidade.
        Não afetam a conta Jynlo, outras comunidades ou sessões fora dos torneios.
        As inscrições existentes não são removidas automaticamente.
      </p>

      @if (canManage) {
        <form (ngSubmit)="issue()" class="suspension-form">
          <label for="suspension-member">Membro a suspender</label>
          <select id="suspension-member" name="suspension-member" [(ngModel)]="targetProfileId"
                  [disabled]="saving" required>
            <option [ngValue]="null">Selecionar membro</option>
            @for (member of eligibleMembers; track member.profileId) {
              <option [ngValue]="member.profileId">{{ member.fullName || member.username }}</option>
            }
          </select>
          <label for="suspension-days">Duração (dias)</label>
          <input id="suspension-days" name="suspension-days" type="number"
                 min="1" max="30" step="1" [(ngModel)]="days" [disabled]="saving" required>
          <label for="suspension-reason">Motivo</label>
          <textarea id="suspension-reason" name="suspension-reason" rows="3" maxlength="1000"
                    [(ngModel)]="reason" [disabled]="saving" required
                    placeholder="Explica a infração e as circunstâncias"></textarea>
          <button type="submit" [disabled]="saving || !canIssue()">
            {{ saving ? 'A registar…' : 'Aplicar suspensão' }}
          </button>
        </form>
      }

      @if (error) { <p role="alert">{{ error }}</p> }
      @if (feedback) { <p role="status">{{ feedback }}</p> }
      <h4>{{ canManage ? 'Suspensões da comunidade' : 'As minhas suspensões' }}</h4>
      @if (loading) {
        <p role="status">A carregar suspensões…</p>
      } @else if (suspensions.length === 0) {
        <p>Não existem suspensões registadas.</p>
      } @else {
        <ul class="suspension-history">
          @for (item of suspensions; track item.id) {
            <li>
              @if (canManage) { <strong>{{ memberName(item.targetProfileId) }}</strong> · }
              <strong>{{ isActive(item) ? 'Ativa' : item.revokedAt ? 'Levantada' : 'Terminada' }}</strong>
              <p>{{ item.reason }}</p>
              <p>{{ item.startsAt | date:'dd/MM/yyyy HH:mm' }} — {{ item.endsAt | date:'dd/MM/yyyy HH:mm' }}</p>
              @if (item.revokedAt) {
                <p>Levantada em {{ item.revokedAt | date:'dd/MM/yyyy HH:mm' }}: {{ item.revocationReason }}</p>
              } @else if (canManage && isActive(item)) {
                <form class="suspension-form" (ngSubmit)="lift(item.id)">
                  <label [for]="'lift-reason-' + item.id">Motivo para levantar a suspensão</label>
                  <textarea [id]="'lift-reason-' + item.id" [name]="'lift-reason-' + item.id"
                            rows="2" maxlength="1000" [(ngModel)]="liftReasons[item.id]"
                            [disabled]="saving" required></textarea>
                  <button type="submit" [disabled]="saving || !liftReasons[item.id]?.trim()">
                    Levantar suspensão
                  </button>
                </form>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .suspension-panel { margin: 1rem 0; padding: 1.25rem; border: 1px solid var(--border-color,#77889955); border-radius: 16px; }
    .suspension-panel h3,.suspension-panel h4 { margin: 0 0 .75rem; }
    .suspension-help { opacity: .8; margin: 0 0 1rem; }
    .suspension-form { display: grid; gap: .6rem; max-width: 640px; margin-bottom: 1rem; }
    .suspension-form select,.suspension-form input,.suspension-form textarea { padding: .7rem; width: 100%; border-radius: 8px; }
    .suspension-form button { justify-self: start; padding: .65rem 1rem; border-radius: 8px; }
    .suspension-history { padding-left: 1.3rem; }
    .suspension-history li { margin-bottom: 1rem; }
    .suspension-history p { margin: .35rem 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  `]
})
export class CommunityTournamentSuspensionsComponent implements OnChanges {
  @Input({ required: true }) community!: CommunityGroup;
  @Input() canManage = false;

  suspensions: CommunityTournamentSuspension[] = [];
  targetProfileId: number | null = null;
  days = 1;
  reason = '';
  liftReasons: Record<number, string> = {};
  saving = false;
  loading = false;
  error = '';
  feedback = '';
  private revision = 0;

  constructor(private readonly api: CommunityDisciplineService,
              private readonly changeDetector: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['community'] || changes['canManage']) {
      this.targetProfileId = null;
      this.days = 1;
      this.reason = '';
      this.liftReasons = {};
      this.feedback = '';
      this.load();
    }
  }

  get eligibleMembers() {
    return this.community?.members?.filter(member => member.role === 'MEMBER') ?? [];
  }

  memberName(profileId: number): string {
    const member = this.community.members.find(entry => entry.profileId === profileId);
    return member?.fullName || member?.username || `#${profileId}`;
  }

  isActive(item: CommunityTournamentSuspension): boolean {
    const now = Date.now();
    return !item.revokedAt && Date.parse(item.startsAt) <= now && Date.parse(item.endsAt) > now;
  }

  canIssue(): boolean {
    return this.canManage && this.targetProfileId !== null
      && this.eligibleMembers.some(member => member.profileId === this.targetProfileId)
      && Number.isInteger(this.days) && this.days >= 1 && this.days <= 30
      && this.reason.trim().length > 0 && this.reason.trim().length <= 1000;
  }

  load(): void {
    const id = this.community?.id;
    const revision = ++this.revision;
    this.suspensions = [];
    this.error = '';
    this.loading = false;
    if (!id) return;
    this.loading = true;
    (this.canManage ? this.api.tournamentSuspensions(id) : this.api.myTournamentSuspensions(id))
      .subscribe({
        next: entries => {
          if (revision !== this.revision) return;
          this.suspensions = entries;
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          if (revision !== this.revision) return;
          this.loading = false;
          this.error = 'Não foi possível carregar as suspensões.';
          this.changeDetector.markForCheck();
        }
      });
  }

  issue(): void {
    if (this.saving || !this.canIssue()) return;
    const revision = this.revision;
    this.saving = true;
    this.error = '';
    this.feedback = '';
    this.api.issueTournamentSuspension(this.community.id, this.targetProfileId!,
      this.days, this.reason.trim()).subscribe({
      next: entry => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.suspensions = [entry, ...this.suspensions];
        this.targetProfileId = null;
        this.reason = '';
        this.feedback = 'Suspensão registada para os torneios desta comunidade.';
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.error = 'Não foi possível aplicar a suspensão. Verifica as permissões e a existência de outras suspensões.';
        this.changeDetector.markForCheck();
      }
    });
  }

  lift(suspensionId: number): void {
    const entry = this.suspensions.find(item => item.id === suspensionId);
    const reason = this.liftReasons[suspensionId]?.trim() ?? '';
    if (!this.canManage || this.saving || !entry || !this.isActive(entry)
        || !reason || reason.length > 1000) return;
    const revision = this.revision;
    this.saving = true;
    this.error = '';
    this.feedback = '';
    this.api.liftTournamentSuspension(this.community.id, suspensionId, reason).subscribe({
      next: updated => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.suspensions = this.suspensions.map(item => item.id === suspensionId ? updated : item);
        delete this.liftReasons[suspensionId];
        this.feedback = 'Suspensão levantada e decisão registada.';
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.error = 'Não foi possível levantar a suspensão.';
        this.changeDetector.markForCheck();
      }
    });
  }
}
