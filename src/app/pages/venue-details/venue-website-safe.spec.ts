import { ActivatedRoute } from '@angular/router';
import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueDetailsComponent } from './venue-details.component';

describe('Venue details external website links', () => {
  const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);

  it('shows only HTTPS website links with a hostname', () => {
    component.venue = { website: '  https://cm-cantanhede.pt/mcsite/entidade/1680/pavilhao-marialvas  ' } as Venue;
    expect(component.venueWebsiteUrl).toBe(
      'https://cm-cantanhede.pt/mcsite/entidade/1680/pavilhao-marialvas'
    );
    component.venue = { website: 'https://www.cm-coimbra.pt/areas/desporto' } as Venue;
    expect(component.venueWebsiteUrl).toBe('https://www.cm-coimbra.pt/areas/desporto');
  });

  it('never renders untrusted or incomplete website values as links', () => {
    for (const value of [
      null, '', '   ', 'www.example.pt', 'javascript:alert(1)',
      'http://example.pt', 'https://username:password@example.pt',
      'https://example.pt:8443/', '//example.pt',
      'data:text/html,wrong', 'https://'
    ]) {
      component.venue = { website: value } as Venue;
      expect(component.venueWebsiteUrl).withContext(String(value)).toBeNull();
    }
    component.venue = null;
    expect(component.venueWebsiteUrl).toBeNull();
  });
});
