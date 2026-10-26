import { TestBed } from '@angular/core/testing';
import { CommunityWhatsAppShareComponent } from './community-whatsapp-share.component';

describe('CommunityWhatsAppShareComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityWhatsAppShareComponent] }).compileComponents();
  });

  function render(visibility: string = 'PUBLIC', feedback = '') {
    const fixture = TestBed.createComponent(CommunityWhatsAppShareComponent);
    fixture.componentRef.setInput('visibility', visibility);
    fixture.componentRef.setInput('feedback', feedback);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves two real share/copy actions and never performs the action itself', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.row-actions button');
    expect(buttons.length).toBe(2);
    const share = jasmine.createSpy('share');
    const copy = jasmine.createSpy('copy');
    fixture.componentInstance.shareRequested.subscribe(share);
    fixture.componentInstance.copyRequested.subscribe(copy);
    buttons[0].click();
    buttons[1].click();
    expect(share).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it('shows the private-only warning and accessible feedback only when needed', () => {
    const publicRoot = render().nativeElement as HTMLElement;
    expect(publicRoot.querySelector('.whatsapp-group-share-note')).toBeNull();
    expect(publicRoot.querySelector('[role="status"]')).toBeNull();
    const privateRoot = render('PRIVATE', 'Ligação copiada').nativeElement as HTMLElement;
    expect(privateRoot.querySelector('.whatsapp-group-share-note')).not.toBeNull();
    expect(privateRoot.querySelector('[role="status"]')?.textContent).toContain('Ligação copiada');
  });
});
