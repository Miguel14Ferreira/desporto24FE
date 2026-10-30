import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Regression: the original global community --letterboxed rule used
 * object-fit: contain !important and silently overrode saved crop settings.
 * Verify the real production stylesheets in a minimal community hero, with
 * both normal images and GIFs (including the old legacy class).
 */
test('community cover fills its frame and saved zoom remains effective for GIFs', async ({ page }) => {
  await page.setContent(`
    <div class="communities-page jynlo-c1 community-detail-page">
      <div class="community-photo-block">
        <div class="community-avatar community-avatar--large community-avatar--animated community-avatar--letterboxed">
          <img alt="ACM" style="object-fit: cover; object-position: 40% 65%; transform-origin: 40% 65%; transform: scale(1.5)"
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
        </div>
      </div>
    </div>
  `);
  // Match the real style cascade order used by Angular/global Concept One.
  for (const path of [
    'src/styles.css',
    'src/app/pages/communities/communities.component.css',
    'src/styles/jynlo-communities-concept-one.css'
  ]) {
    await page.addStyleTag({ content: readFileSync(path, 'utf8') });
  }
  const image = page.getByAltText('ACM');
  await expect(image).toBeVisible();
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('cover');
  expect(await image.evaluate(node => getComputedStyle(node).objectPosition)).toBe('40% 65%');
  expect(await image.evaluate(node => getComputedStyle(node).transform)).not.toBe('none');

  // Reset the framing: base cover should still have no artificial side bands.
  await image.evaluate(img => {
    (img as HTMLElement).style.removeProperty('transform');
    (img as HTMLElement).style.removeProperty('object-fit');
  });
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('cover');
});
