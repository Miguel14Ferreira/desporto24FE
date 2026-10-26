import { TestBed } from '@angular/core/testing';
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
      'ChatReactionStoreService', ['watch','unwatch','get','toggle','isBusy','hasFailed','retry']);
    store.get.and.returnValue({messageId:51,counts:{},myEmoji:null});
    store.isBusy.and.returnValue(false);
    store.hasFailed.and.returnValue(false);
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
