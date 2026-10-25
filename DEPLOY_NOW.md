**If upgrading from Wiggle Run v1:** First run `supabase/upgrade_courses.sql` on your existing Supabase project. This keeps all Classic scores. Then push the updated project files to GitHub; Vercel auto-deploys.

# Deploy Wiggle Run

## 1. Database (Supabase)

- Create a project at https://supabase.com/dashboard
- In SQL Editor, paste and run `supabase/schema.sql`
- Copy Project URL and the `sb_secret_...` key from Settings > API Keys (server-only)

## 2. Hosting (Vercel)

- Unzip this package, then open Terminal in the `wiggle-run` directory.
- Run `npx vercel` and follow the prompts to link/create a project. Choose **Other** framework, with this directory as the root.
- In the project's Vercel dashboard, Settings > Environment Variables, add:
  - `SUPABASE_URL` = `https://YOUR_PROJECT.supabase.co`
  - `SUPABASE_SECRET_KEY` = `sb_secret_...`
  - `ATTEMPT_SIGNING_SECRET` = output of `openssl rand -hex 32`
- Back in this directory, run `npx vercel --prod`. Use the HTTPS URL printed by Vercel.

Do **not** upload the Supabase secret key to the browser, GitHub or client JS. Set it only in Vercel environment variables.

## 3. Check

- Open the live link and confirm the leaderboard loads (empty is fine).
- Click How to play. Connect a front-facing camera and allow access.
- Click Pick marker color, then click the marker on your gripper.
- Enter a name, Enable run, move through START and exit the course.
- Post score. Refresh on another device and confirm the result is visible globally.

Use the demo route `/?demo=1` only for local camera testing (local scores, no online submission).

The gameplay was tested with synthetic orange-marker video and the API with mocked Supabase responses. A real live Supabase/Vercel deployment and physical robot test have not been performed here.
