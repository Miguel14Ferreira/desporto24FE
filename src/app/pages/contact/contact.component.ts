import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { finalize } from 'rxjs';

import { FeedbackRequest, FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ContactComponent {
  name = '';
  city = '';
  email = '';
  gender = '';
  subject = '';
  problem = '';

  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private feedbackService: FeedbackService) {}

  submit(): void {
    const validation = this.validate();
    if (validation) {
      this.errorMessage = validation;
      this.successMessage = '';
      return;
    }

    const request: FeedbackRequest = {
      name: this.name.trim(),
      city: this.city.trim(),
      email: this.email.trim(),
      gender: this.gender,
      subject: this.subject.trim(),
      problem: this.problem.trim()
    };

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.feedbackService.submit(request)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.successMessage = response.message || 'Obrigado pelo teu feedback.';
          this.subject = '';
          this.problem = '';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.contact.sendError')
          );
        }
      });
  }

  private validate(): string | null {
    const required = [
      this.name,
      this.city,
      this.email,
      this.gender,
      this.subject,
      this.problem
    ];

    if (required.some(value => !value?.trim())) {
      return 'Preenche todos os campos.';
    }

    if (!this.email.includes('@')) {
      return t('feedback.contact.invalidEmail');
    }

    if (this.subject.trim().length > 160) {
      return t('feedback.contact.subjectLong');
    }

    if (this.problem.trim().length > 4000) {
      return t('feedback.contact.messageLong');
    }

    return null;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
