import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { ChatImageInViewDirective } from './chat-image-in-view.directive';

@Component({
  standalone: true,
  imports: [ChatImageInViewDirective],
  template: '<div appChatImageInView (chatImageVisible)="seen()"></div>'
})
class TestHostComponent {
  count = 0;
  seen(): void { this.count++; }
}

describe('private chat image viewport loading', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({imports:[TestHostComponent]});
  });

  it('emits once in browsers without IntersectionObserver', fakeAsync(() => {
    const previous = window.IntersectionObserver;
    try {
      Object.defineProperty(window, 'IntersectionObserver', {configurable:true,value:undefined});
      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
      flushMicrotasks();
      expect(fixture.componentInstance.count).toBe(1);
      fixture.detectChanges();
      expect(fixture.componentInstance.count).toBe(1);
    } finally {
      Object.defineProperty(window, 'IntersectionObserver', {configurable:true,value:previous});
      fixture?.destroy();
    }
  }));
});
