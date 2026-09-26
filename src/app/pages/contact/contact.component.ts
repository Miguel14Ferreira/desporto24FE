import { HttpErrorResponse } from '@angular/common/http';
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
            'Não foi possível enviar a tua mensagem.'
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
      return 'Introduz um email válido.';
    }

    if (this.subject.trim().length > 160) {
      return 'O assunto não pode ter mais de 160 caracteres.';
    }

    if (this.problem.trim().length > 4000) {
      return 'A mensagem não pode ter mais de 4000 caracteres.';
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
