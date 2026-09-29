import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { finalize } from 'rxjs';

import { appTranslate as t } from '../../i18n/i18n.service';
import { FeedbackRequest, FeedbackService } from '../../services/feedback.service';

type ContactField = 'name' | 'email' | 'category' | 'problem';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ContactComponent {
  name = '';
  email = '';
  category = '';
  problem = '';

  readonly categories = [
    'contact.category.partners',
    'contact.category.activity',
    'contact.category.groups',
    'contact.category.tournaments',
    'contact.category.suggestions',
    'contact.category.partnerships',
    'contact.category.technical',
    'contact.category.account',
    'contact.category.safety',
    'contact.category.other'
  ];

  loading = false;
  errorMessage = '';
  successMessage = '';
  fieldErrors: Partial<Record<ContactField, string>> = {};

  constructor(
    private feedbackService: FeedbackService,
    private host: ElementRef<HTMLElement>
  ) {}

  submit(): void {
    this.fieldErrors = this.validate();

    if (Object.keys(this.fieldErrors).length > 0) {
      this.errorMessage = t('feedback.form.attention');
      this.successMessage = '';
      this.focusFirstInvalidField();
      return;
    }

    const request: FeedbackRequest = {
      name: this.name.trim(),
      city: '',
      email: this.email.trim(),
      gender: '',
      subject: t(this.category),
      problem: this.problem.trim()
    };

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.feedbackService.submit(request)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.successMessage = response.message || t('feedback.contact.thanks');
          this.category = '';
          this.problem = '';
          this.fieldErrors = {};
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.contact.sendError')
          );
        }
      });
  }

  clearFieldError(field: ContactField): void {
    if (!this.fieldErrors[field]) {
      return;
    }

    const updated = { ...this.fieldErrors };
    delete updated[field];
    this.fieldErrors = updated;
  }

  private validate(): Partial<Record<ContactField, string>> {
    const errors: Partial<Record<ContactField, string>> = {};

    if (!this.name.trim()) {
      errors.name = t('feedback.contact.nameRequired');
    }

    if (!this.email.trim()) {
      errors.email = t('feedback.contact.emailRequired');
    } else if (!this.email.includes('@')) {
      errors.email = t('feedback.contact.invalidEmail');
    }

    if (!this.category) {
      errors.category = t('feedback.contact.categoryRequired');
    }

    if (!this.problem.trim()) {
      errors.problem = t('feedback.contact.messageRequired');
    } else if (this.problem.trim().length > 4000) {
      errors.problem = t('feedback.contact.messageLong');
    }

    return errors;
  }

  private focusFirstInvalidField(): void {
    queueMicrotask(() => {
      const firstInvalid = this.host.nativeElement.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      );

      if (!firstInvalid) {
        return;
      }

      firstInvalid.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      firstInvalid.focus({ preventScroll: true });
    });
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
