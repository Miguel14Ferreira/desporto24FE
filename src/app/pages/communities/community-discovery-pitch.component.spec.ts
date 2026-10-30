import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CommunityDiscoveryPitchComponent } from './community-discovery-pitch.component';

describe('CommunityDiscoveryPitchComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityDiscoveryPitchComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  function render(loading = false) {
    const fixture = TestBed.createComponent(CommunityDiscoveryPitchComponent);
    fixture.componentRef.setInput('communitySearchLoading', loading);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves the community creation link, four benefits and explore action', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.community-pitch[aria-labelledby="community-pitch-title"]')).not.toBeNull();
    expect(root.querySelectorAll('.community-pitch-benefit[role="listitem"]').length).toBe(4);
    const create = root.querySelector<HTMLAnchorElement>('.community-pitch-actions a');
    expect(create?.getAttribute('href')).toBe('/menu/communities/create');
    const button = root.querySelector<HTMLButtonElement>('.community-pitch-actions button');
    expect(button?.disabled).toBeFalse();
    const handler = jasmine.createSpy('explore');
    fixture.componentInstance.exploreRequested.subscribe(handler);
    button!.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('disables the discovery action during search without removing the create route', () => {
    const fixture = render(true);
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.community-pitch-actions button')!;
    expect(button.disabled).toBeTrue();
    const handler = jasmine.createSpy('explore');
    fixture.componentInstance.exploreRequested.subscribe(handler);
    button.click();
    expect(handler).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLAnchorElement>('.community-pitch-actions a')?.getAttribute('href'))
      .toBe('/menu/communities/create');
  });
});
