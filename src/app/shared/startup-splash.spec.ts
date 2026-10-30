import { fakeAsync, tick } from '@angular/core/testing';
import { dismissStartupSplash } from './startup-splash';

describe('Jynlo first-load splash', () => {
  let splash: HTMLElement;

  beforeEach(() => {
    splash = document.createElement('div');
    splash.id = 'jynlo-startup-splash';
    document.body.appendChild(splash);
  });

  afterEach(() => {
    splash.remove();
  });

  it('fades out and removes the splash after the first route is ready', fakeAsync(() => {
    dismissStartupSplash();
    expect(splash.classList.contains('jynlo-startup-splash--exit')).toBeTrue();
    tick(300);
    expect(document.getElementById('jynlo-startup-splash')).toBeNull();
  }));

  it('can be dismissed twice without affecting other content', fakeAsync(() => {
    const app = document.createElement('main');
    app.textContent = 'Jynlo application content';
    document.body.appendChild(app);
    try {
      dismissStartupSplash();
      dismissStartupSplash();
      tick(300);
      expect(app.isConnected).toBeTrue();
      expect(app.textContent).toContain('Jynlo');
      expect(document.getElementById('jynlo-startup-splash')).toBeNull();
    } finally {
      app.remove();
    }
  }));

  it('does nothing after the splash has already been removed', fakeAsync(() => {
    splash.remove();
    expect(() => dismissStartupSplash()).not.toThrow();
    tick(300);
  }));
});
