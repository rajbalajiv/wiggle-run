# Wiggle Run: Share your run

Small, opt-in X/Twitter share update. No API key, login, or new Supabase schema required.

## Before pushing

Open `social.js`. Set your own X username (without the `@`):

```js
export const CREATOR_X_HANDLE = 'YOUR_ACTUAL_HANDLE';
```

This creates a subtle `@handle on X` link in the footer and includes your handle in suggested challenge posts. If the value is empty, the footer X link stays hidden and social posts omit the mention. Do not guess a username.

## Player workflow

1. Play a course. The existing camera and scoring rules are unchanged.
2. End a run and optionally post the result to the leaderboard.
3. Click `Share on X` to open an editable draft with the score, game URL, and call to challenge three robot owners.
4. If a clip was recorded, the browser also downloads it locally. Players attach it in X before publishing. X does not allow attaching a local video file from a plain intent link.
5. `Share video` uses the device share sheet if file sharing is supported, otherwise downloads the clip. On some browsers the saved file may be `.webm`. X may require converting it to MP4 if the upload is rejected.
6. The original `Save video`, `Save score card`, and `Copy result` actions remain available.

Nothing is uploaded to X automatically. Video is stored only on the player's device, and not sent to Supabase or Vercel.

## Push to GitHub

Assuming your repo is `~/Downloads/wiggle-run-fix` with `index.html` at its root:

```bash
cd ~/Downloads/wiggle-run-fix
unzip -o ~/Downloads/wiggle_run_social_update.zip -d .
# Edit social.js with your correct handle, then:
node --test test/*.test.js
git add index.html game.js social.js test/social.test.js SHARE_UPDATE.md
git commit -m "Add optional X video sharing and creator link"
git push origin main
```

Vercel will redeploy from `main` if its GitHub integration is already active. No SQL or new environment variables.

## Testing

`npm test` passes 10 unit/backend tests on the snapshot. The complete game UI was not exercised with a live physical robot or an authenticated X session.
