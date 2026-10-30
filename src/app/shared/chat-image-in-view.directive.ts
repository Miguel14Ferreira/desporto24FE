import { AfterViewInit, Directive, ElementRef, EventEmitter, OnDestroy, Output } from '@angular/core';

/** Fetch protected chat images only when their bubbles approach the viewport. */
@Directive({ selector: '[appChatImageInView]', standalone: true })
export class ChatImageInViewDirective implements AfterViewInit, OnDestroy {
  @Output() chatImageVisible = new EventEmitter<void>();
  private observer?: IntersectionObserver;
  private fired = false;
  private destroyed = false;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // Older browsers retain the feature without emitting during the
      // first Angular change-detection pass.
      Promise.resolve().then(() => this.emitOnce());
      return;
    }
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) this.emitOnce();
    }, { root: null, rootMargin: '140px 0px', threshold: 0.01 });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
  }

  private emitOnce(): void {
    if (this.destroyed || this.fired) return;
    this.fired = true;
    this.observer?.disconnect();
    this.chatImageVisible.emit();
  }
}
