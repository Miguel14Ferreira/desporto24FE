import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunityGroup } from '../model/community-group';
import { CommunityDisciplineService, CommunityDisciplinaryWarning } from '../../services/community-discipline.service';

/** Community-only warnings. Suspensions and competition eligibility are not part of this phase. */
@Component({
  selector: 'app-community-discipline-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="discipline-panel" aria-labelledby="discipline-title">
      <h3 id="discipline-title">Disciplina e Fair Play</h3>
      <p class="discipline-description">
        Advertências da comunidade. Não suspendem a conta nem impedem a participação em jogos.
      </p>
      @if (canManage) {
        <form (ngSubmit)="issueWarning()" class="discipline-form">
          <label for="discipline-member">Membro</label>
          <select id="discipline-member" name="disciplineMember"
                  [(ngModel)]="targetProfileId" [disabled]="saving" required>
            <option [ngValue]="null">Selecionar membro</option>
            @for (member of eligibleMembers; track member.profileId) {
              <option [ngValue]="member.profileId">{{ member.fullName || member.username }}</option>
            }
          </select>
          <label for="discipline-reason">Motivo da advertência</label>
          <textarea id="discipline-reason" name="disciplineReason"
                    [(ngModel)]="reason" maxlength="1000" rows="3"
                    [disabled]="saving" required
                    placeholder="Descreve objetivamente a ocorrência"></textarea>
          <button type="submit" [disabled]="saving || targetProfileId === null || !reason.trim()">
            {{ saving ? 'A registar…' : 'Registar advertência' }}
          </button>
        </form>
      }
      @if (error) { <p role="alert">{{ error }}</p> }
      @if (feedback) { <p role="status">{{ feedback }}</p> }
      <h4>{{ canManage ? 'Histórico recente da comunidade' : 'As minhas advertências' }}</h4>
      @if (loading) {
        <p role="status">A carregar advertências…</p>
      } @else if (warnings.length === 0) {
        <p>Não existem advertências registadas.</p>
      } @else {
        <ul class="discipline-history">
          @for (warning of warnings; track warning.id) {
            <li>
              @if (canManage) {
                <strong>{{ memberName(warning.targetProfileId) }}</strong>
                <span> · </span>
              }
              <span>{{ warning.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              <p>{{ warning.reason }}</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .discipline-panel { margin: 1rem 0; padding: 1.25rem; border: 1px solid var(--border-color, #77889955); border-radius: 16px; }
    .discipline-panel h3, .discipline-panel h4 { margin: 0 0 .75rem; }
    .discipline-description { opacity: .8; margin: 0 0 1rem; }
    .discipline-form { display: grid; gap: .6rem; max-width: 640px; margin-bottom: 1.3rem; }
    .discipline-form select, .discipline-form textarea { width: 100%; padding: .7rem; border-radius: 8px; }
    .discipline-form button { justify-self: start; padding: .65rem 1rem; border-radius: 8px; }
    .discipline-history { margin: .5rem 0 0; padding-left: 1.3rem; }
    .discipline-history li { margin-bottom: .8rem; }
    .discipline-history p { margin: .3rem 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  `]
})
export class CommunityDisciplinePanelComponent implements OnChanges {
  @Input({ required: true }) community!: CommunityGroup;
  @Input() canManage = false;

  targetProfileId: number | null = null;
  reason = '';
  warnings: CommunityDisciplinaryWarning[] = [];
  loading = false;
  saving = false;
  error = '';
  feedback = '';
  private revision = 0;

  constructor(private readonly api: CommunityDisciplineService,
              private readonly changeDetector: ChangeDetectorRef) {}

  get eligibleMembers() {
    return this.community?.members?.filter(member => member.role === 'MEMBER') ?? [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['community'] || changes['canManage']) {
      this.targetProfileId = null;
      this.reason = '';
      this.feedback = '';
      this.load();
    }
  }

  memberName(profileId: number): string {
    const member = this.community.members.find(item => item.profileId === profileId);
    return member?.fullName || member?.username || `#${profileId}`;
  }

  load(): void {
    const communityId = this.community?.id;
    const revision = ++this.revision;
    this.warnings = [];
    this.error = '';
    if (!communityId) return;
    this.loading = true;
    const request = this.canManage ? this.api.list(communityId) : this.api.mine(communityId);
    request.subscribe({
      next: warnings => {
        if (revision !== this.revision) return;
        this.warnings = warnings;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision !== this.revision) return;
        this.error = 'Não foi possível carregar o histórico disciplinar.';
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  issueWarning(): void {
    if (!this.canManage || this.saving || !this.community?.id
        || this.targetProfileId === null || !this.reason.trim()
        || this.reason.trim().length > 1000
        || !this.eligibleMembers.some(member => member.profileId === this.targetProfileId)) return;
    const communityId = this.community.id;
    const revision = this.revision;
    this.saving = true;
    this.error = '';
    this.feedback = '';
    this.api.warn(communityId, this.targetProfileId, this.reason.trim()).subscribe({
      next: () => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.targetProfileId = null;
        this.reason = '';
        this.feedback = 'Advertência registada na comunidade.';
        this.load();
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision !== this.revision) return;
        this.saving = false;
        this.error = 'Não foi possível registar a advertência. Verifica as permissões e tenta novamente.';
        this.changeDetector.markForCheck();
      }
    });
  }
}
