import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ChatReactionsComponent } from './chat-reactions.component';
import { ChatReactionStoreService } from '../../services/chat-reaction-store.service';

describe('Keyboard-accessible chat reaction picker', () => {
  let store: jasmine.SpyObj<ChatReactionStoreService>;

  function mount() {
    const fixture = TestBed.createComponent(ChatReactionsComponent);
    const component = fixture.componentInstance;
    component.kind = 'direct';
    component.conversationId = 'bea';
    component.messageId = 51;
    fixture.detectChanges();
    return {fixture, component, element: fixture.nativeElement as HTMLElement};
  }

  beforeEach(() => {
    store = jasmine.createSpyObj<ChatReactionStoreService>(
      'ChatReactionStoreService', ['watch','unwatch','get','toggle','isBusy','hasFailed','retry','participants']);
    store.get.and.returnValue({messageId:51,counts:{},myEmoji:null});
    store.isBusy.and.returnValue(false);
    Object.defineProperty(store, 'changed', { value: new BehaviorSubject<number>(0) });
    store.hasFailed.and.returnValue(false);
    store.participants.and.returnValue(of([
      { username:'ana', displayName:'Ana',profilePicUrl:null,emoji:'👍',mine:true }
    ]));
    TestBed.configureTestingModule({
      imports:[ChatReactionsComponent],
      providers:[{provide:ChatReactionStoreService,useValue:store}]
    });
  });

  it('keeps a react action visible without a summary and allows retry after a failed read', () => {
    store.get.and.returnValue(undefined);
    store.hasFailed.and.returnValue(true);
    const {fixture,element}=mount();
    const toggle=element.querySelector<HTMLButtonElement>('.reaction-open');
    expect(toggle).not.toBeNull();
    toggle!.click();
    fixture.detectChanges();
    expect(store.retry).toHaveBeenCalledWith('direct','bea',51);
    expect(element.querySelectorAll('.reaction-picker button').length).toBe(1);
    expect(store.toggle).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.reaction-retry')!.click();
    expect(store.retry).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('shows loading state instead of losing the react button before the batch response', () => {
    store.get.and.returnValue(undefined);
    const {fixture,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-open')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.reaction-loading')).not.toBeNull();
    expect(element.querySelector('.reaction-retry')).toBeNull();
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('shows no numeric badge when exactly one person reacted and opens an accessible people dialog', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,component,element}=mount();
    const chip=element.querySelector<HTMLButtonElement>('.reaction-count')!;
    expect(chip.textContent?.trim()).toBe('👍');
    expect(chip.getAttribute('aria-label')).toContain('Remover reação');
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    expect(component.detailsOpen).toBeTrue();
    expect(store.participants).toHaveBeenCalledOnceWith('direct','bea',51);
    expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Ana');
    expect(element.querySelector('.reaction-details-remove')).not.toBeNull();
    expect(store.toggle).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.reaction-details-close')!.click();
    fixture.detectChanges();
    expect(component.detailsOpen).toBeFalse();
    fixture.destroy();
  });

  it('removes own displayed reaction with one click and does not open the people modal', () => {
    store.get.and.returnValue({messageId:51,counts:{'❤️':2},myEmoji:'❤️'});
    const {fixture,component,element}=mount();
    const badge=element.querySelector<HTMLButtonElement>('.reaction-count')!;
    badge.click();
    fixture.detectChanges();
    expect(store.toggle).toHaveBeenCalledOnceWith('direct','bea',51,'❤️',jasmine.any(Function));
    expect(component.detailsOpen).toBeFalse();
    expect(store.participants).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('opens people details when clicking someone elses reaction', () => {
    store.get.and.returnValue({messageId:51,counts:{'❤️':1},myEmoji:null});
    const {fixture,component,element}=mount();
    expect(element.querySelector('.reaction-details-trigger')).toBeNull();
    element.querySelector<HTMLButtonElement>('.reaction-count')!.click();
    fixture.detectChanges();
    expect(component.detailsOpen).toBeTrue();
    expect(store.participants).toHaveBeenCalledOnceWith('direct','bea',51);
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('opens names for own emoji via the separate information action', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,element}=mount();
    const info=element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!;
    expect(info).not.toBeNull();
    info.click();
    fixture.detectChanges();
    expect(element.querySelector('.reaction-details-dialog')).not.toBeNull();
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('shows numeric badges only for multiple reactions and filters the participant list', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':2,'❤️':1},myEmoji:'👍'});
    store.participants.and.returnValue(of([
      {username:'ana',displayName:'Ana',profilePicUrl:null,emoji:'👍',mine:true},
      {username:'bea',displayName:'Bea',profilePicUrl:null,emoji:'👍',mine:false},
      {username:'carla',displayName:'Carla',profilePicUrl:null,emoji:'❤️',mine:false}
    ]));
    const {fixture,element}=mount();
    expect(element.querySelectorAll('.reaction-count').length).toBe(2);
    const buttons=element.querySelectorAll<HTMLButtonElement>('.reaction-count');
    expect(buttons[0].textContent).toContain('2');
    expect(buttons[1].textContent?.trim()).toBe('❤️');
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.reaction-person').length).toBe(3);
    element.querySelectorAll<HTMLButtonElement>('.reaction-filter')[2].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.reaction-person').length).toBe(1);
    expect(element.querySelector('.reaction-person-name')?.textContent).toContain('Carla');
    fixture.destroy();
  });

  it('keeps removal available even when participant names fail to load', () => {
    store.get.and.returnValue({messageId:51,counts:{'❤️':1},myEmoji:'❤️'});
    store.participants.and.returnValue(throwError(() => new Error('offline')));
    const {fixture,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.reaction-details-state[role="alert"]')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('.reaction-details-remove')!.click();
    expect(store.toggle).toHaveBeenCalledOnceWith('direct','bea',51,'❤️',jasmine.any(Function));
    fixture.destroy();
  });

  it('updates a loaded reaction when the store emits after the first render', async () => {
    const {fixture,element}=mount();
    expect(element.querySelector('.reaction-count')).toBeNull();
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    store.changed.next(1);
    await fixture.whenStable();
    expect(element.querySelector('.reaction-count')?.textContent).toContain('👍');
    expect(element.querySelector('.reaction-open')).toBeNull();
    fixture.destroy();
  });

  it('shows exactly one reaction badge with no permanent second smiley trigger', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,element}=mount();
    expect(element.querySelectorAll('.reaction-count').length).toBe(1);
    expect(element.querySelector('.reaction-open')).toBeNull();
    expect(fixture.nativeElement.classList.contains('has-reactions')).toBeTrue();
    expect(element.querySelector('.reaction-picker')).toBeNull();
    fixture.destroy();
  });

  it('restores focus from people dialog with Escape without deleting the reaction', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,component,element}=mount();
    const chip=element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!;
    chip.focus();
    chip.click();
    fixture.detectChanges();
    const close=element.querySelector<HTMLButtonElement>('.reaction-details-close')!;
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    fixture.detectChanges();
    expect(component.detailsOpen).toBeFalse();
    expect(document.activeElement).toBe(chip);
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('only removes own emoji with the explicit action in the details dialog', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    expect(store.toggle).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.reaction-details-remove')!.click();
    expect(store.toggle).toHaveBeenCalledOnceWith('direct','bea',51,'👍',jasmine.any(Function));
    fixture.destroy();
  });

  it('removes my reaction when I tap the already selected emoji in the picker', () => {
    store.get.and.returnValue({messageId:51,counts:{'❤️':2},myEmoji:'❤️'});
    const {fixture,component,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.reaction-details-add')!.click();
    fixture.detectChanges();
    const chosen=element.querySelector<HTMLButtonElement>('.reaction-details-chooser button[aria-label="❤️"]')!;
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(chosen.title).toBe('Remover reação');
    chosen.click();
    fixture.detectChanges();
    expect(store.toggle).toHaveBeenCalledOnceWith('direct','bea',51,'❤️',jasmine.any(Function));
    expect(component.detailsOpen).toBeFalse();
    expect(element.querySelector('.reaction-details-dialog')).toBeNull();
    fixture.destroy();
  });

  it('does not send duplicate reactions while a write is in progress', () => {
    store.get.and.returnValue({messageId:51,counts:{'❤️':2},myEmoji:'❤️'});
    const {fixture,component}=mount();
    store.isBusy.and.returnValue(true);
    component.pick('❤️');
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('opens the inline emoji picker from the detail dialog without changing the existing reaction', () => {
    store.get.and.returnValue({messageId:51,counts:{'👍':1},myEmoji:'👍'});
    const {fixture,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-details-trigger')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.reaction-details-add')!.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    expect(element.querySelector('.reaction-details-chooser')).not.toBeNull();
    expect(store.toggle).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.reaction-details-chooser button[aria-label="❤️"]')!.click();
    expect(store.toggle).toHaveBeenCalledOnceWith('direct','bea',51,'❤️',jasmine.any(Function));
    fixture.destroy();
  });

  it('opens by keyboard, closes with Escape, returns focus without toggling an emoji', () => {
    const {fixture,component,element}=mount();
    const toggle=element.querySelector<HTMLButtonElement>('.reaction-open')!;
    toggle.focus();
    toggle.click();
    fixture.detectChanges();
    expect(component.expanded).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBeTruthy();
    expect(element.querySelector('.reaction-picker')?.id).toBe(toggle.getAttribute('aria-controls') || '');

    const first=element.querySelector<HTMLButtonElement>('.reaction-picker button')!;
    first.focus();
    expect(component.expanded).toBeTrue(); // moving within the picker is allowed
    first.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    fixture.detectChanges();
    expect(component.expanded).toBeFalse();
    expect(element.querySelector('.reaction-picker')).toBeNull();
    expect(document.activeElement).toBe(toggle);
    expect(store.toggle).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('closes when focus leaves the picker but stays open while tabbing between emoji buttons', () => {
    const {fixture,component,element}=mount();
    const outside=document.createElement('button');
    outside.textContent='Outside chat';
    document.body.appendChild(outside);
    try {
      const toggle=element.querySelector<HTMLButtonElement>('.reaction-open')!;
      toggle.focus();
      toggle.click();
      fixture.detectChanges();
      const choices=element.querySelectorAll<HTMLButtonElement>('.reaction-picker button');
      choices[0].focus();
      choices[1].focus();
      expect(component.expanded).toBeTrue();
      outside.focus();
      fixture.detectChanges();
      expect(component.expanded).toBeFalse();
      expect(element.querySelector('.reaction-picker')).toBeNull();
      expect(store.toggle).not.toHaveBeenCalled();
    } finally {
      outside.remove();
      fixture.destroy();
    }
  });

  it('resets an open picker when the host message is reused for a new conversation', () => {
    const {fixture,component,element}=mount();
    element.querySelector<HTMLButtonElement>('.reaction-open')!.click();
    fixture.detectChanges();
    expect(component.expanded).toBeTrue();
    component.conversationId='carla';
    component.ngOnChanges();
    fixture.detectChanges();
    expect(component.expanded).toBeFalse();
    expect(store.unwatch).toHaveBeenCalledWith('direct','bea',51);
    expect(store.watch).toHaveBeenCalledWith('direct','carla',51);
    fixture.destroy();
  });
});
