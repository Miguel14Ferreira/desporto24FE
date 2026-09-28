import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { CommunityVisibility } from '../model/community-group';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

@Component({
  selector: 'app-community-create',
  templateUrl: './community-create.component.html',
  styleUrls: ['./community-create.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CommunityCreateComponent {
  name = '';
  description = '';
  sport = '';
  visibility: CommunityVisibility = 'PRIVATE';

  readonly sportsCatalog = SPORTS_CATALOG;

  saving = false;
  errorMessage = '';

  constructor(
    private communityService: CommunityGroupsService,
    private router: Router
  ) {}

  create(): void {
    if (!this.name.trim() || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.communityService.create({
      name: this.name.trim(),
      description: this.description.trim() || null,
      sport: this.sport || null,
      visibility: this.visibility
    })
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: community => {
          void this.router.navigate(
            ['/menu/communities'],
            { queryParams: { community: community.id } }
          );
        },
        error: error => {
          this.errorMessage =
            error.error?.message || 'Não foi possível criar a comunidade.';
        }
      });
  }

  cancel(): void {
    void this.router.navigate(['/menu/communities']);
  }
}
