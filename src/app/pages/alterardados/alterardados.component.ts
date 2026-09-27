import { HttpErrorResponse } from '@angular/common/http';
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
        error: () => this.errorMessage = 'Não foi possível carregar os teus dados.'
      });
  }

  save(): void {
    if (!this.profile || this.saving) {
      return;
    }

    if (!this.profile.email?.trim()) {
      this.errorMessage = 'O email é obrigatório.';
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
          this.successMessage = 'Perfil atualizado com sucesso.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível atualizar o perfil.'
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
          this.successMessage = 'Fotografia atualizada com sucesso.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível atualizar a fotografia.'
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
      this.errorMessage = 'Escolhe um ficheiro de imagem.';
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
