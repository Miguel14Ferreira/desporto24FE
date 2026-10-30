/**
 * Dismiss the HTML-first splash after Angular's first route has rendered.
 * It lives outside app-root so it can appear before Angular's JS is loaded.
 */
export function dismissStartupSplash(): void {
  const splash = document.getElementById('jynlo-startup-splash');
  if (!splash || splash.classList.contains('jynlo-startup-splash--exit')) {
    return;
  }

  splash.classList.add('jynlo-startup-splash--exit');
  // transitionend is not guaranteed for reduced-motion or background tabs.
  window.setTimeout(() => splash.remove(), 300);
}
