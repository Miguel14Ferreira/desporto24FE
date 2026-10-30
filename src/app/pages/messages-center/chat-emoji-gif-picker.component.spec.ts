import { TestBed } from '@angular/core/testing';
import { GifChoice } from './gif-picker.client';
import { ChatEmojiGifPickerComponent } from './chat-emoji-gif-picker.component';

describe('ChatEmojiGifPickerComponent', () => {
  let previousLanguage: string | null;
  const gif: GifChoice = {
    id: 'celebration', title: 'Celebration GIF',
    previewUrl: 'https://media0.giphy.com/media/abc/giphy.gif',
    downloadUrl: 'https://media0.giphy.com/media/abc/giphy.gif',
    pageUrl: 'https://giphy.com/gifs/celebration',
    creator: 'sample', size: 500
  };

  beforeEach(async () => {
    previousLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    await TestBed.configureTestingModule({imports: [ChatEmojiGifPickerComponent]}).compileComponents();
  });

  afterEach(() => {
    if (previousLanguage == null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previousLanguage);
  });

  function render(tab: 'emoji' | 'gif' = 'emoji') {
    const fixture = TestBed.createComponent(ChatEmojiGifPickerComponent);
    fixture.componentRef.setInput('tab', tab);
    fixture.componentRef.setInput('attachmentControlsReady', true);
    fixture.componentRef.setInput('emojis', ['⚽', '🏆']);
    fixture.componentRef.setInput('categories', [{icon: '⚽', phrase: 'football'}]);
    fixture.componentRef.setInput('gifAvailable', true);
    fixture.componentRef.setInput('gifResults', [gif]);
    fixture.componentRef.setInput('gifHasMore', true);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves accessible emoji controls and emits a selection without sending a message', () => {
    const fixture = render();
    const selected = jasmine.createSpy('selected');
    fixture.componentInstance.emojiSelected.subscribe(selected);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('section[role="dialog"]')).not.toBeNull();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.inbox-picker-emoji-grid button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('aria-label')).toBe('⚽');
    buttons[0].click();
    expect(selected).toHaveBeenCalledOnceWith('⚽');
    const close = jasmine.createSpy('close');
    fixture.componentInstance.closed.subscribe(close);
    root.querySelector<HTMLButtonElement>('.inbox-picker-close')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('preserves GIF search, pagination, selection and upload events', () => {
    const fixture = render('gif');
    const root = fixture.nativeElement as HTMLElement;
    const selected = jasmine.createSpy('gif');
    const requested = jasmine.createSpy('more');
    const upload = jasmine.createSpy('upload');
    const category = jasmine.createSpy('category');
    const query = jasmine.createSpy('query');
    fixture.componentInstance.gifSelected.subscribe(selected);
    fixture.componentInstance.loadMore.subscribe(requested);
    fixture.componentInstance.uploadRequested.subscribe(upload);
    fixture.componentInstance.categorySelected.subscribe(category);
    fixture.componentInstance.queryChanged.subscribe(query);
    expect(root.querySelectorAll('.inbox-picker-gif-grid button').length).toBe(1);
    root.querySelector<HTMLButtonElement>('.inbox-picker-gif-grid button')!.click();
    expect(selected).toHaveBeenCalledOnceWith(gif);
    root.querySelector<HTMLButtonElement>('.inbox-picker-categories button')!.click();
    expect(category).toHaveBeenCalledOnceWith('football');
    const input = root.querySelector<HTMLInputElement>('.inbox-picker-gif-search input')!;
    input.value = 'goal';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(query).toHaveBeenCalledWith('goal');
    root.querySelector<HTMLButtonElement>('.inbox-picker-more')!.click();
    expect(requested).toHaveBeenCalledOnceWith(1);
    root.querySelector<HTMLButtonElement>('.inbox-picker-footer button')!.click();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('shows provider errors and guards remote actions while a GIF is being selected', () => {
    const fixture = render('gif');
    fixture.componentRef.setInput('gifAvailable', false);
    fixture.componentRef.setInput('gifSelectingId', 'pending');
    fixture.componentRef.setInput('gifError', 'Unavailable');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Unavailable');
    expect(root.querySelector('.inbox-picker-gif-grid button')?.hasAttribute('disabled')).toBeTrue();
    expect(root.querySelector('.inbox-picker-footer button')?.hasAttribute('disabled')).toBeTrue();
    const tab = jasmine.createSpy('tab');
    fixture.componentInstance.tabSelected.subscribe(tab);
    root.querySelector<HTMLButtonElement>('.inbox-picker-tabs button[role="tab"]')!.click();
    expect(tab).toHaveBeenCalledOnceWith('emoji');
  });
});
