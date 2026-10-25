import { issueTicket, json, handleFailure } from '../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });
  try {
    if (!process.env.SUPABASE_SECRET_KEY || !process.env.SUPABASE_URL) return json(res, 503, { error: 'Leaderboard not configured yet.' });
    return json(res, 200, { ticket: issueTicket(req.body?.name, req.body?.course || undefined) });
  } catch (err) { return handleFailure(res, err); }
}
