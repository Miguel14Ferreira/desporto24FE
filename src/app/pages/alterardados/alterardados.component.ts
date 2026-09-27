import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { MyProfile, UpdateMyProfileRequest } from '../model/my-profile';
import { MyProfileService } from '../../services/my-profile.service';

@Component({
  selector: 'app-alterardados',
  templateUrl: './alterardados.component.html',
  styleUrls: ['./alterardados.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AlterardadosComponent implements OnInit {
  profile?: MyProfile;
  photo?: File;
  photoPreview = '';

  loading = false;
  saving = false;
  photoSaving = false;
  photoEditing = false;
  errorMessage = '';
  successMessage = '';

  readonly maxBirthDate = this.dateYearsAgo(18);
  readonly minBirthDate = this.dateYearsAgo(120);

  constructor(private myProfileService: MyProfileService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.myProfileService.get()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: profile => {
          this.profile = { ...profile };
          this.photoPreview = this.profileImage(profile) || '';
        },
        error: () => this.errorMessage = t('feedback.profile.dataLoadError')
      });
  }

  save(): void {
    if (!this.profile || this.saving) {
      return;
    }

    if (!this.profile.email?.trim()) {
      this.errorMessage = t('feedback.profile.emailRequired');
      return;
    }

    if (this.profile.dateOfBirth && !this.isAdultBirthDate(this.profile.dateOfBirth)) {
      this.errorMessage = t('feedback.register.minimumAge');
      return;
    }

    const request: UpdateMyProfileRequest = {
      fullName: this.clean(this.profile.fullName),
      dateOfBirth: this.clean(this.profile.dateOfBirth),
      address: this.clean(this.profile.address),
      country: this.clean(this.profile.country),
      location: this.clean(this.profile.location),
      postalCode: this.clean(this.profile.postalCode),
      indicativePhone: this.clean(this.profile.indicativePhone),
      phone: this.clean(this.profile.phone),
      gender: this.clean(this.profile.gender),
      email: this.profile.email.trim(),
      favoriteSports: this.clean(this.profile.favoriteSports),
      mfa: Boolean(this.profile.mfa)
    };

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.myProfileService.update(request)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: updated => {
          this.profile = { ...updated };
          this.photo = undefined;
          this.photoPreview = this.profileImage(updated) || this.photoPreview;
          this.successMessage = t('feedback.profile.updated');
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.profile.updateError')
          );
        }
      });
  }

  startPhotoEdit(): void {
    this.photoEditing = true;
    this.photo = undefined;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelPhotoEdit(): void {
    this.photoEditing = false;
    this.photo = undefined;
    this.photoPreview = this.profile ? (this.profileImage(this.profile) || '') : '';
  }

  savePhoto(): void {
    if (!this.photo || this.photoSaving) {
      return;
    }

    this.photoSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.myProfileService.updatePhoto(this.photo)
      .pipe(finalize(() => this.photoSaving = false))
      .subscribe({
        next: updated => {
          this.profile = { ...updated };
          this.photoPreview = this.profileImage(updated) || this.photoPreview;
          this.photo = undefined;
          this.photoEditing = false;
          this.successMessage = t('feedback.profile.photoUpdated');
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.profile.photoError')
          );
        }
      });
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.photo = undefined;
      return;
    }

    if (!file.type.startsWith('image/')) {
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

  private profileImage(profile: MyProfile): string | null {
    const path = profile.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  private isAdultBirthDate(value: string): boolean {
    const birthDate = new Date(value + 'T00:00:00');
    if (Number.isNaN(birthDate.getTime())) {
      return false;
    }

    const minDate = new Date(this.minBirthDate + 'T00:00:00');
    const maxDate = new Date(this.maxBirthDate + 'T00:00:00');
    return birthDate >= minDate && birthDate <= maxDate;
  }

  private dateYearsAgo(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private clean(value: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
