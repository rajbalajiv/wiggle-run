import { supabaseRequest, safeScore, json, handleFailure, validateCourse } from '../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET required.' });
  try {
    const course = validateCourse(req.query?.course || 'wiggle-v1');
    const rows = await supabaseRequest('GET', '?select=attempt_id,course_id,player_name,distance,seconds,outcome,created_at&course_id=eq.' + course + '&order=distance.desc,seconds.asc,created_at.asc&limit=100');
    return json(res, 200, { course, scores: rows.map(safeScore) });
  } catch (err) { return handleFailure(res, err); }
}
