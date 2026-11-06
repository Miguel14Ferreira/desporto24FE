import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournamentEligibilityService, TournamentEligibilityOverview } from '../../services/community-tournament-eligibility.service';

/** Management alert: pre-existing registrations must be checked before kickoff. */
@Component({
  selector: 'app-community-tournament-eligibility-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="eligibility-panel" aria-labelledby="eligibility-title">
      <div class="eligibility-header">
        <h4 id="eligibility-title">Elegibilidade dos jogadores</h4>
        <button type="button" (click)="reload()" [disabled]="loading">Atualizar verificação</button>
      </div>
      <p>Confirma as inscrições e equipas antes do jogo. Esta consulta inclui jogadores
        suspensos depois de já estarem inscritos e não modifica resultados antigos.</p>
      @if (loading) {
        <p role="status">A verificar inscrições existentes…</p>
      } @else if (error) {
        <p role="alert">{{ error }}</p>
      } @else if (overview && overview.ineligibleEntries.length > 0) {
        <p role="alert"><strong>{{ overview.ineligibleEntries.length }} jogador(es) suspenso(s)</strong>
          constam deste torneio.</p>
        <ul>
          @for (entry of overview.ineligibleEntries; track entry.profileId) {
            <li>
              <strong>{{ memberName(entry.profileId) }}</strong>
              @if (entry.teamId !== null) { · equipa #{{ entry.teamId }} }
              @if (entry.participantStatus) { · {{ entry.participantStatus === 'CONFIRMED' ? 'Confirmado' : 'Pendente' }} }
              · até {{ entry.suspendedUntil | date:'dd/MM/yyyy HH:mm' }}
            </li>
          }
        </ul>
      } @else if (overview) {
        <p role="status">Nenhum jogador inscrito ou presente nas equipas tem uma suspensão ativa
          nesta comunidade.</p>
      }
      @if (overview) {
        <small>Verificação realizada em {{ overview.checkedAt | date:'dd/MM/yyyy HH:mm' }}.
          Esta informação não substitui a confirmação dos participantes no dia do jogo.</small>
      }
    </section>
  `,
  styles: [`
    .eligibility-panel { border:1px solid var(--border-color,#77889955); border-radius:14px; padding:1rem; margin:1rem 0; }
    .eligibility-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
    .eligibility-header h4 { margin:0; }
    .eligibility-header button { padding:.4rem .7rem; border-radius:8px; }
    .eligibility-panel p { margin:.7rem 0; }
    .eligibility-panel li { margin:.35rem 0; }
    .eligibility-panel small { opacity:.75; }
  `]
})
export class CommunityTournamentEligibilityPanelComponent implements OnChanges {
  @Input({ required: true }) community!: CommunityGroup;
  @Input({ required: true }) tournamentId!: number;
  overview: TournamentEligibilityOverview | null = null;
  loading = false;
  error = '';
  private revision = 0;

  constructor(private readonly api: CommunityTournamentEligibilityService,
              private readonly changeDetector: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['community'] || changes['tournamentId']) this.reload();
  }

  memberName(profileId: number): string {
    const member = this.community?.members?.find(p => p.profileId === profileId);
    return member?.fullName || member?.username || `#${profileId}`;
  }

  reload(): void {
    const id = this.community?.id;
    const tournament = this.tournamentId;
    const revision = ++this.revision;
    this.overview = null;
    this.error = '';
    this.loading = false;
    if (!id || !tournament || !['OWNER','ADMIN'].includes(this.community.myRole ?? '')) return;
    this.loading = true;
    this.api.overview(id, tournament).subscribe({
      next: result => {
        if (revision !== this.revision) return;
        this.overview = result;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision !== this.revision) return;
        this.error = 'Não foi possível verificar a elegibilidade. Tenta novamente.';
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
  }
}
