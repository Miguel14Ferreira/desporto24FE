import { compactSessionShareMessage } from './session-share-message';

describe('compactSessionShareMessage', () => {
  it('shows only useful details without advertising the platform', () => {
    const text = compactSessionShareMessage({
      sport: 'Futebol', city: 'Parede', gameDate: '2026-10-26T21:00:00Z', remainingPlaces: 2
    }, 'pt-PT');
    expect(text.startsWith('Futebol')).toBeTrue();
    expect(text).toContain('Quando: ');
    expect(text).toContain('Local: Parede');
    expect(text).toContain('Vagas: 2 disponíveis');
    expect(text).not.toContain('Jynlo');
  });

  it('does not invent a location or number of places', () => {
    const text = compactSessionShareMessage({
      sport: 'Padel', city: '', gameDate: 'not-a-date', remainingPlaces: null
    }, 'en-GB');
    expect(text).toBe('Padel');
  });

  it('supports English and singular spots', () => {
    const text = compactSessionShareMessage({
      sport: 'Basketball', city: 'Lisbon', remainingPlaces: 1
    }, 'en-GB');
    expect(text).toContain('Basketball');
    expect(text).toContain('Location: Lisbon');
    expect(text).toContain('Places: 1 left');
  });

  it('uses only readable characters when WhatsApp loses emoji support', () => {
    const text = compactSessionShareMessage({
      sport: 'Futsal', city: 'Campo Grande', remainingPlaces: 9
    }, 'pt-PT');
    expect(text).toBe('Futsal\nLocal: Campo Grande\nVagas: 9 disponíveis');
    expect(text).not.toMatch(/[\uFFFD\uD800-\uDFFF]/);
  });

  it('cannot inject multiple fabricated lines through untrusted sport or city', () => {
    const text = compactSessionShareMessage({
      sport: 'Futebol\nfake', city: 'Lisboa\nspoofed', remainingPlaces: -1
    }, 'pt-PT');
    expect(text).not.toContain('Futebol\nfake');
    expect(text).not.toContain('Local: Lisboa\nspoofed');
    expect(text).not.toContain('Vagas:');
  });
});
