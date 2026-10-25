-- For EXISTING Wiggle Run Supabase projects. Run this ONCE in SQL Editor.
-- Existing Classic results and attempt IDs remain unchanged.
ALTER TABLE public.wiggle_scores DROP CONSTRAINT IF EXISTS wiggle_scores_course_id_check;
ALTER TABLE public.wiggle_scores ADD CONSTRAINT wiggle_scores_course_id_check
  CHECK (course_id IN ('wiggle-v1', 'chicane-v1', 'switchback-v1', 'hairpin-v1'));
CREATE INDEX IF NOT EXISTS wiggle_scores_course_ranking
  ON public.wiggle_scores (course_id, distance DESC, seconds ASC, created_at ASC);
