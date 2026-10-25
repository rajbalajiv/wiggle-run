import { supabaseRequest, safeScore, json, handleFailure } from '../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET required.' });
  try {
    const rows = await supabaseRequest('GET', '?select=attempt_id,player_name,distance,seconds,outcome,created_at&order=distance.desc,seconds.asc,created_at.asc&limit=100');
    return json(res, 200, { course: 'wiggle-v1', scores: rows.map(safeScore) });
  } catch (err) { return handleFailure(res, err); }
}
