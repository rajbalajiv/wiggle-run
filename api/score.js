import { verifyScore, supabaseRequest, safeScore, json, handleFailure } from '../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });
  try {
    const row = verifyScore(req.body);
    try {
      const result = await supabaseRequest('POST', '', row);
      return json(res, 201, { score: safeScore(result[0]) });
    } catch (err) {
      // If a response was lost after the DB inserted it, a retry must not lose the user's score.
      if (err.status !== 409) throw err;
      const existing = await supabaseRequest('GET', `?select=attempt_id,course_id,player_name,distance,seconds,outcome,created_at&attempt_id=eq.${row.attempt_id}&limit=1`);
      if (existing.length !== 1 || Number(existing[0].distance) !== row.distance || Number(existing[0].seconds) !== row.seconds || existing[0].outcome !== row.outcome || existing[0].course_id !== row.course_id)
        throw err;
      return json(res, 200, { score: safeScore(existing[0]), alreadySaved: true });
    }
  } catch (err) { return handleFailure(res, err); }
}
