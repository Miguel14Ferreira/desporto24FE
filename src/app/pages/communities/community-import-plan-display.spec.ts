import { CommunitiesComponent } from './communities.component';

describe('Community import plan date display', () => {
  const component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;

  it('renders ISO-only dates in familiar day/month/year order without timezone conversion', () => {
    expect(component.importRoundDisplayDate('2026-08-31')).toBe('31/08/2026');
    expect(component.importRoundDisplayDate('2026-10-19')).toBe('19/10/2026');
  });

  it('keeps unresolved or unusual source dates unchanged for review', () => {
    expect(component.importRoundDisplayDate('31 agosto')).toBe('31 agosto');
    expect(component.importRoundDisplayDate('data por validar')).toBe('data por validar');
    expect(component.importRoundDisplayDate(null)).toBe('');
  });
});
