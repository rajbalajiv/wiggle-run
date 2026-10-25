# Wiggle Run

Four camera-only obstacle courses for robot arms. No robot control, no SDK, no user account, no video uploaded. Each owner uses their own teleoperation software and camera.

## Deploy to Vercel + Supabase

1. Create a Supabase project at https://supabase.com/dashboard . In **SQL Editor**, run `supabase/schema.sql` for a new project. If you already have Classic scores, run `supabase/upgrade_courses.sql` instead; do NOT drop the table.
2. Find **Project URL** and a **secret API key** (`sb_secret_...`) in Supabase Settings > API Keys. **Never put a secret key in browser code or commit it to Git.**
3. Deploy this directory as a Vercel project (`https://vercel.com/new` from a Git repository, or `npx vercel --prod` in this directory). Choose **Other** framework, root directory at `wiggle-run/` if it is inside a larger repository. No build command needed.
4. In Vercel project **Settings > Environment Variables**, add these server-side values:
   - `SUPABASE_URL` = `https://YOUR_PROJECT.supabase.co`
   - `SUPABASE_SECRET_KEY` = your Supabase secret key (not publishable key)
   - `ATTEMPT_SIGNING_SECRET` = random string at least 32 characters; on Mac generate with `openssl rand -hex 32`.
5. **Redeploy after setting environment variables**, then open the Vercel HTTPS URL. Check that the Global leaderboard says `No scores yet` rather than `unavailable`.
6. On desktop Chrome/Safari/Edge: connect camera, enter player name, click **Pick marker color**, and click the marker on video. Select **Enable run**, then cross START from left to right. Leave the red corridor to end, or cross FINISH. **Post to leaderboard** after the run.

No extra packages are required for runtime or tests. Files in `api/` are Vercel serverless functions, not static pages. `index.html` and `game.js` are static assets.

## Quick local preview

Run `python3 -m http.server 8080` inside the folder; open **http://localhost:8080/?demo=1**. The demo runs the camera/game locally and saves results locally; the **global leaderboard is disabled**. To test the actual backend API locally, use `npx vercel dev` with the Vercel environment variables configured.

## Camera and rules

- Select one of four fixed red courses: Classic, Chicane, Switchback or Hairpin. Each is drawn onto the same 960x540 virtual camera plane, with progressively narrower corridors. Use a fixed front or 45-degree camera and adjust robot framing so the marker can reach START and FINISH.
- Click a **high-contrast colored patch** attached to the gripper. Any saturated hue can work; if the room has another object with the same color, remove it or choose another marker.
- Cross START **from left to right** and remain within the red outlines. A confirmed boundary exit, lost tracking, browser tab interruption or 90s timer ends the run. Crossing FINISH scores 100%.
- The yellow line shows tracked motion. Percent is the furthest valid progress along the fixed path, not motor travel or physical contact.
- Progress scores can be posted once per signed attempt. Each course has its own leaderboard, sorted by distance descending, then time ascending. Player names and scores are public.
- You can download a square PNG score card to share with friends. Your video stays in your browser. An optional local video file can be downloaded after the run when supported by the browser. Only name, percent, time, outcome and timestamp are sent to Supabase.

## Fairness and limitations

Scores are calculated in the player's browser, so they are **not cheat-proof**. The server checks signed attempts, one-time IDs, lengths, limits and plausible elapsed times; it cannot prove a person actually moved a robot. Use optional video proof for top scores. Do not claim physical contact detection; the system uses only 2D images. Everyone sees the same overlay pixels, but camera perspective and robot setup differ, so results are a social challenge, not metrology.

If the camera is unavailable, test whether another app is using it and check browser permissions. Camera requires HTTPS or localhost. Allow camera access in your browser. A busy, same-color background can confuse detection. `?demo=1` is strictly for offline testing, not a global score.

## Files

- `index.html` minimalist camera game, first-visit tutorial, global and local leaderboards
- `game.js` fixed-course game state and selectable color vision tracker
- `api/start.js` signed server-issued attempt tickets
- `api/score.js` validated one-time result submission
- `api/leaderboard.js` public top 100 results
- `lib/server.js` shared API validation and Supabase REST access
- `supabase/schema.sql` one-time database table and unique key
- `.env.example` server variable names, no real credentials
- `test/server.test.js` API unit and end-to-end mock tests

Run `npm test` from the package root to verify server logic.

## Multiple circuits

Choose **Classic**, **Chicane**, **Switchback**, or **Hairpin** before enabling the run. The selection locks for the entire attempt, is signed in the attempt ticket, and is saved to Supabase. Rankings are separated by circuit. A camera-only overlay cannot detect physical contact, and the harder virtual tracks may not be reachable by every robot/camera configuration. Always position the camera and test reachability before an official attempt.

**Existing Supabase projects:** Apply `supabase/upgrade_courses.sql` in SQL Editor before deploying the update. If you do not, posting scores for new courses will fail with a database check constraint error.
