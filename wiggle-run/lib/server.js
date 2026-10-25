import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const COURSE_ID = 'wiggle-v1';
export const MAX_SECONDS = 90;
export const OUTCOMES = ['FINISHED', 'OUT OF BOUNDS', 'TIME LIMIT', 'TRACKING LOST', 'INTERRUPTED'];

export function json(res, code, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(code).json(data);
}
export function validateName(raw) {
  if (typeof raw !== 'string') throw new Error('Enter your robot name.');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 32) throw new Error('Use a name between 2 and 32 characters.');
  if (!/^[\p{L}\p{N} ._'\-]+$/u.test(name)) throw new Error('Use letters, numbers, spaces or simple punctuation in your name.');
  return name;
}
function signingKey() {
  const secret = process.env.ATTEMPT_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('Attempt signing secret is not configured.');
  return secret;
}
function sign(payload) {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}
export function issueTicket(name, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id: randomUUID(), name: validateName(name), course: COURSE_ID, iat: now })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyTicket(ticket, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 750) throw new Error('Invalid attempt ticket.');
  const fields = ticket.split('.');
  if (fields.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(fields[0]) || !/^[A-Za-z0-9_-]+$/.test(fields[1])) throw new Error('Invalid attempt ticket.');
  const expected = Buffer.from(sign(fields[0]), 'utf8');
  const supplied = Buffer.from(fields[1], 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw new Error('Invalid attempt ticket.');
  let payload;
  try { payload = JSON.parse(Buffer.from(fields[0], 'base64url').toString('utf8')); }
  catch { throw new Error('Invalid attempt ticket.'); }
  if (!payload || !/^[0-9a-f-]{36}$/.test(payload.id) || payload.course !== COURSE_ID || !Number.isSafeInteger(payload.iat)) throw new Error('Invalid attempt ticket.');
  validateName(payload.name);
  if (payload.iat > now + 5000 || now - payload.iat > 12 * 60 * 1000) throw new Error('Attempt expired. Please try again.');
  return payload;
}
export function verifyScore(body, now = Date.now()) {
  const p = verifyTicket(body?.ticket, now);
  const distance = Number(body?.distance), seconds = Number(body?.seconds), outcome = body?.outcome;
  if (!Number.isFinite(distance) || distance < 0 || distance > 100 || Math.round(distance * 10) !== distance * 10) throw new Error('Invalid distance.');
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_SECONDS + 1 || Math.round(seconds * 10) !== seconds * 10) throw new Error('Invalid time.');
  if (!OUTCOMES.includes(outcome)) throw new Error('Invalid result.');
  if ((outcome === 'FINISHED' && distance !== 100) || (outcome !== 'FINISHED' && distance >= 100)) throw new Error('Invalid finish state.');
  if (outcome === 'TIME LIMIT' && seconds < MAX_SECONDS - 1.5) throw new Error('Invalid timeout.');
  // Ticket issued at Enable. This is only a basic plausibility check, not proof of physical motion.
  if ((now - p.iat) / 1000 + 4 < seconds) throw new Error('Attempt time exceeds time since enabling.');
  return { attempt_id: p.id, player_name: p.name, course_id: COURSE_ID, distance, seconds, outcome };
}
export async function supabaseRequest(method, query, body) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !key) throw new Error('Leaderboard database is not configured.');
  const headers = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Current sb_secret keys only belong in the apikey header, never sent to a client.
  // Legacy service_role JWT keys additionally require Authorization.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (method === 'POST') headers.Prefer = 'return=representation';
  const response = await fetch(`${base}/rest/v1/wiggle_scores${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(7000) });
  const content = await response.text();
  if (!response.ok) {
    const err = new Error(response.status === 409 ? 'This attempt was already submitted.' : `Leaderboard database error (${response.status}).`);
    err.status = response.status === 409 ? 409 : 503;
    console.error('Supabase HTTP', response.status, content.slice(0,250));
    throw err;
  }
  try { return JSON.parse(content); } catch { return []; }
}
export function safeScore(row) {
  return { id: row.attempt_id, name: row.player_name, distance: row.distance, seconds: row.seconds, outcome: row.outcome, at: row.created_at };
}
export function handleFailure(res, err) {
  const status = err.status || (/(Invalid|expired|time|name|Use |Enter |Attempt)/i.test(err.message) ? 400 : 503);
  return json(res, status, { error: status >= 500 ? 'Leaderboard temporarily unavailable. Try again.' : err.message });
}
