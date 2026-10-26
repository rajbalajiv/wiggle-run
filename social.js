// Public profile only, never put keys or credentials here.
// Set your X username below, without @ or https://x.com/.
// Example: export const CREATOR_X_HANDLE = 'your_actual_handle';
export const CREATOR_X_HANDLE = 'rajships';

export function normalizeXHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : '';
}

export function creatorProfileUrl(handle = CREATOR_X_HANDLE) {
  const clean = normalizeXHandle(handle);
  return clean ? `https://x.com/${clean}` : '';
}

export function gameUrl(pageUrl) {
  const parsed = new URL(pageUrl);
  return `${parsed.origin}${parsed.pathname}`; // strip ?demo=1 and marker state
}

export function buildXCaption({ distance, seconds, course, outcome, name }, handle = CREATOR_X_HANDLE) {
  const pct = Math.max(0, Math.min(100, Number(distance) || 0)).toFixed(1);
  const elapsed = Math.max(0, Number(seconds) || 0).toFixed(1);
  const title = String(course || 'Classic').slice(0, 32);
  const finished = outcome === 'FINISHED';
  const clean = normalizeXHandle(handle);
  const attribution = clean ? `\n\n@${clean}` : '';
  return `my robot ${finished ? 'finished' : 'made it '+pct+'% through'} Wiggle Run / ${title}${finished ? ` in ${elapsed}s` : ''}.\n\nthink yours can beat it? post your run and challenge 3 other robot owners.${attribution}`;
}

export function xIntentUrl(text, url) {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', String(text));
  intent.searchParams.set('url', gameUrl(url));
  return intent.href;
}
