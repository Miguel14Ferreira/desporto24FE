// GIPHY web keys are browser-side by provider design. Never use a private token.
// Render static builds set JYNLO_GIPHY_API_KEY; absent keys disable online search.
import { writeFileSync } from 'node:fs';
const key = (process.env.JYNLO_GIPHY_API_KEY || '').trim();
if (key && !/^[a-zA-Z0-9_-]{12,128}$/.test(key)) {
  throw new Error('Invalid JYNLO_GIPHY_API_KEY: expected the browser-side GIPHY key.');
}
writeFileSync('src/assets/giphy-config.json', JSON.stringify({apiKey: key}) + '\n');
