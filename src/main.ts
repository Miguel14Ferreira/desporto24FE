import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { prepareInitialTranslations } from './app/i18n/i18n.service';
import { environment } from './environment/environment';

if (environment.production) {
  enableProdMode();
}

// English users load their translations before the first screen is rendered.
// If that optional chunk is unavailable, recover with Portuguese rather than
// showing a blank application or untranslated keys.
void prepareInitialTranslations()
  .catch(error => {
    console.error('Could not preload English translations; falling back to Portuguese.', error);
    try {
      localStorage.setItem('d24-language', 'pt');
    } catch {
      // Browsers can disable storage; Portuguese is still the default.
    }
  })
  .then(() => platformBrowserDynamic().bootstrapModule(
    AppModule,
    { applicationProviders: [provideZoneChangeDetection()] }
  ))
  .catch(err => console.error(err));
