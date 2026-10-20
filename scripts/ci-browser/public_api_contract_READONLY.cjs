/*
 * Jynlo PUBLIC API compatibility, READ ONLY.
 * Only anonymous HTTPS GET endpoints. No cookies, Authorization, mutation
 * requests, credential logging, persisted records, or production writes.
 */
'use strict';

const assert = require('node:assert/strict');

const HOST = 'https://api.d24sports.com';
const MAX_BYTES = 2_000_000;

async function readPublicJson(path, description) {
  assert.ok(path.startsWith('/api/'), 'Only public API paths are allowed');
  const url = new URL(path, HOST);
  assert.equal(url.origin, HOST, 'Disallowed host');
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
    headers: { accept: 'application/json' }
  });
  assert.equal(res.status, 200, description + ' must return 200 for anonymous GET');
  assert.match(res.headers.get('content-type') || '', /application\/json/i,
    description + ' must serve JSON');
  if (Number(res.headers.get('content-length') || '0') > MAX_BYTES) {
    throw new Error(description + ' payload exceeds safety limit');
  }
  const response = await res.arrayBuffer();
  assert.ok(response.byteLength <= MAX_BYTES, description + ' payload exceeds safety limit');
  return JSON.parse(Buffer.from(response).toString('utf8'));
}

function validPositiveId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

async function main() {
  const today = new Date();
  const in14Days = new Date(today.getTime() + 14 * 86_400_000);
  const query = new URLSearchParams({
    privateGame: 'false',
    sort: 'date',
    from: today.toISOString(),
    to: in14Days.toISOString()
  });

  const sessions = await readPublicJson('/api/sessions?' + query, 'Public session discovery');
  assert.ok(Array.isArray(sessions), 'Session discovery must return JSON array');
  for (const s of sessions) {
    assert.ok(validPositiveId(s.id), 'Session ID is not a safe positive integer');
    assert.equal(typeof s.sport, 'string', 'Session sport');
    assert.equal(typeof s.city, 'string', 'Session city');
    assert.ok(Number.isFinite(Date.parse(s.gameDate)), 'Session date must be valid');
    assert.ok(['OPEN', 'FULL'].includes(s.status), 'Only active public sessions should be discovered');
    assert.equal(s.privateGame, false, 'Private sessions must not be returned to anonymous clients');
    assert.notEqual(s.audience, 'COMMUNITY_ONLY', 'Community-only session leaked to anonymous clients');
    assert.ok(Number.isInteger(s.participantCount) && s.participantCount >= 0, 'Invalid confirmed count');
    assert.ok(Number.isInteger(s.maxParticipants) && s.maxParticipants > 0, 'Invalid capacity');
    assert.ok(!('participants' in s) && !('email' in s) && !('phone' in s),
      'Guest listing must not expose participant identities');
  }
  console.log('PASS: anonymous sessions GET; contract checked; no records printed.');

  const venuePage = await readPublicJson('/api/venues/suggest?page=0',
    'Public venue suggestion first page');
  assert.ok(Array.isArray(venuePage.venues), 'Venue suggestion must have venues array');
  assert.equal(venuePage.page, 0, 'Venue suggestion page');
  assert.equal(typeof venuePage.hasMore, 'boolean', 'Venue suggestion hasMore flag');
  assert.ok(venuePage.venues.length <= 50, 'Venue autocomplete should be bounded');
  for (const v of venuePage.venues) {
    assert.ok(validPositiveId(v.id), 'Venue ID invalid');
    assert.equal(typeof v.name, 'string', 'Venue name');
    assert.equal(typeof v.city, 'string', 'Venue city');
  }
  console.log('PASS: anonymous bounded venue suggestions GET; contract checked; no records printed.');

  if (sessions.length > 0) {
    // Only a server-discovered PUBLIC session ID, never a guessed private ID.
    const id = sessions[0].id;
    const preview = await readPublicJson(
      '/api/sessions/' + id + '/public-preview', 'Public session preview');
    assert.equal(preview.id, id, 'Public preview ID mismatch');
    assert.equal(typeof preview.sport, 'string', 'Preview sport');
    assert.equal(typeof preview.city, 'string', 'Preview city');
    assert.ok(Number.isFinite(Date.parse(preview.gameDate)), 'Preview date');
    assert.ok(['OPEN', 'FULL'].includes(preview.status), 'Preview state');
    for (const key of ['participantNames', 'participants', 'createdByUsername',
      'creatorUsername', 'email', 'address', 'venueAddress']) {
      assert.ok(!(key in preview), 'Public preview exposes a private field: ' + key);
    }
    console.log('PASS: anonymous public-preview GET; privacy shape checked; no records printed.');
  } else {
    console.log('SKIP: public-preview GET — no future sessions in the 14-day window.');
  }
  console.log('Public API READ-ONLY contract smoke complete; GET only; no production mutations.');
}

main().catch(error => {
  console.error('READ-ONLY public API contract FAILED: ' + error.message);
  process.exitCode = 1;
});
