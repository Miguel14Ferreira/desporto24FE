import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Shared action for profile names/avatars anywhere in the application. */
@Injectable({ providedIn:'root' })
export class ProfileQuickViewService {
  readonly username$ = new BehaviorSubject<string | null>(null);
  open(username: string | null | undefined): void {
    const valid = username?.trim();
    if (valid && valid.length <= 128) this.username$.next(valid);
  }
  close(): void { this.username$.next(null); }
}
