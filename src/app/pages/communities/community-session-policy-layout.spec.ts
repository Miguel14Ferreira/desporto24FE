import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * Real-browser CSS regression for the communities session permission selector.
 * The surrounding community form deliberately gives inputs width: 100%.
 * Radio controls must stay compact, with readable text on desktop and mobile.
 */
@Component({
  standalone: true,
  template: `
    <section class="community-session-policy">
      <fieldset class="community-session-policy-options">
        <legend>Permitir criar sessões a</legend>
        <div class="community-session-policy-choice-grid">
          <label class="selected">
            <input type="radio" name="sessionPolicyQA" value="everyone" checked>
            <span class="community-session-policy-choice-copy">Todos os membros</span>
          </label>
          <label>
            <input type="radio" name="sessionPolicyQA" value="admins">
            <span class="community-session-policy-choice-copy">Apenas administradores</span>
          </label>
        </div>
      </fieldset>
    </section>
  `,
  styleUrls: ['./communities.component.css']
})
class CommunitySessionPolicyLayoutHarness {}

describe('Community session creation policy — browser layout regression', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunitySessionPolicyLayoutHarness] })
      .compileComponents();
  });

  for (const [name, width] of [['desktop', 820], ['mobile', 340]] as const) {
    it('keeps radio cards readable and contained on ' + name, () => {
      const fixture = TestBed.createComponent(CommunitySessionPolicyLayoutHarness);
      const host = fixture.nativeElement as HTMLElement;
      host.style.width = width + 'px';
      fixture.detectChanges();

      const grid = host.querySelector('.community-session-policy-choice-grid') as HTMLElement;
      const labels = Array.from(grid.querySelectorAll('label')) as HTMLElement[];
      const inputs = Array.from(grid.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      const spans = Array.from(grid.querySelectorAll('.community-session-policy-choice-copy')) as HTMLElement[];
      expect(labels.length).toBe(2);
      expect(inputs.length).toBe(2);

      for (let i = 0; i < labels.length; i++) {
        const card = labels[i].getBoundingClientRect();
        const radio = inputs[i].getBoundingClientRect();
        const copy = spans[i].getBoundingClientRect();
        expect(radio.width).withContext('radio width').toBeCloseTo(18, 0);
        expect(radio.height).withContext('radio height').toBeCloseTo(18, 0);
        expect(copy.width).withContext('text must not collapse into a vertical column').toBeGreaterThan(145);
        expect(card.height).withContext('no extremely tall selection card').toBeLessThan(125);
        expect(copy.right).toBeLessThanOrEqual(card.right);
        expect(copy.left).toBeGreaterThanOrEqual(radio.right);
      }
      const a = labels[0].getBoundingClientRect();
      const b = labels[1].getBoundingClientRect();
      if (name === 'desktop') {
        expect(Math.abs(a.top - b.top)).toBeLessThan(2);
      } else {
        expect(b.top).toBeGreaterThan(a.bottom);
      }

      // The whole label is clickable, not only the radio circle.
      labels[1].click();
      expect(inputs[1].checked).toBeTrue();
      expect(inputs[0].checked).toBeFalse();
      fixture.destroy();
    });
  }
});
