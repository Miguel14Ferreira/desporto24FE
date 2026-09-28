import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';

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

  photo?: File;
  photoPreview = '';

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
      .pipe(
        switchMap(community =>
          this.photo
            ? this.communityService.updatePhoto(community.id, this.photo)
            : of(community)
        ),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: community => {
          void this.router.navigate(
            ['/menu/communities'],
            { queryParams: { community: community.id } }
          );
        },
        error: error => {
          this.errorMessage =
            error.error?.message || t('communityCreate.error');
        }
      });
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.photo = undefined;
      this.photoPreview = '';
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.errorMessage = t('feedback.image.choose');
      input.value = '';
      return;
    }

    this.photo = file;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photo = undefined;
    this.photoPreview = '';
  }

  cancel(): void {
    void this.router.navigate(['/menu/communities']);
  }
}
