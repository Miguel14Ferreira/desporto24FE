import { Injectable } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { InboxApiService, InboxKind } from './inbox-api.service';
import { JwtHelperService } from '@auth0/angular-jwt';

interface ReadState {
  confirmed: number;
  wanted: number;
  inFlight: boolean;
  failedAt: number;
}

/**
 * Lightweight per-tab read synchronization for the original chat screens.
 * The server is authoritative; this service only advances cursors after the
 * authorized message log becomes visible. No write occurs on history errors.
 */
@Injectable({ providedIn: 'root' })
export class ChatReadSyncService {
  private readonly states = new Map<string, ReadState>();
  private readonly retryDelayMs = 15_000;
  private readonly jwt = new JwtHelperService();
  private cachedToken: string | null = null;
  private cachedViewer = '';

  constructor(private readonly inboxApi: InboxApiService) {}

  markVisible(kind: InboxKind, id: string | number, newestId: number | null | undefined,
              logElement?: HTMLElement): void {
    if (!logElement || !Number.isSafeInteger(newestId) || !newestId || newestId <= 0) return;
    if (!this.isTabVisible()) return;

    // Opening a session details page does not imply viewing its chat.
    // Also avoid reading incoming messages when the user is reviewing old ones.
    const rect = logElement.getBoundingClientRect();
    const screenHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    if (rect.height <= 0 || rect.bottom <= 0 || rect.bottom > screenHeight + 24
        || rect.top >= screenHeight
        || logElement.scrollHeight - logElement.scrollTop - logElement.clientHeight > 120) return;

    const key = this.viewer() + ':' + kind + ':' + String(id).toLowerCase();
    const state = this.states.get(key) ?? {
      confirmed: 0, wanted: 0, inFlight: false, failedAt: 0
    };
    state.wanted = Math.max(state.wanted, newestId);
    this.states.set(key, state);
    this.flush(kind, String(id), state);
  }

  private isTabVisible(): boolean {
    // Visibility alone is insufficient: a tab in an unfocused browser
    // window can still report "visible". Match the unified inbox contract.
    return typeof document !== 'undefined'
      && document.visibilityState === 'visible' && document.hasFocus();
  }

  private viewer(): string {
    // Shared services survive SPA navigation and account switching. Do not let
    // one user's acknowledged watermark suppress another user's read receipts.
    const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('t');
    if (token !== this.cachedToken) {
      this.cachedToken = token;
      try {
        this.cachedViewer = token ? (this.jwt.decodeToken(token)?.sub || '').toLowerCase() : '';
      } catch {
        this.cachedViewer = '';
      }
    }
    return this.cachedViewer;
  }

  private flush(kind: InboxKind, id: string, state: ReadState): void {
    // An older HTTP read may finish after the user switches windows.
    // Do not advance a queued, newer cursor until a fresh focused view.
    if (!this.isTabVisible() || state.inFlight || state.wanted <= state.confirmed
        || Date.now() - state.failedAt < this.retryDelayMs) return;
    const current = state.wanted;
    state.inFlight = true;
    this.inboxApi.markRead({ kind, id }, current)
      .pipe(timeout(10_000), finalize(() => {
        state.inFlight = false;
        // If a newer message arrived while HTTP was in progress,
        // send the next watermark only after the previous request finishes.
        if (state.wanted > state.confirmed && current < state.wanted) {
          this.flush(kind, id, state);
        }
      }))
      .subscribe({
        next: () => {
          state.confirmed = Math.max(state.confirmed, current);
          state.failedAt = 0;
        },
        error: () => {
          // A failed acknowledgement is not a successful read. Retry only
          // after a cooldown and a subsequent visibility/scroll event.
          state.failedAt = Date.now();
        }
      });
  }
}
