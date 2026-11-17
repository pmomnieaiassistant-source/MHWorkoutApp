# MH Lift back end setup

About 15 minutes. Until this is done, the app still works but keeps everything on the phone only.

## 1. Sheet and script

1. Create a new Google Sheet named **MH Lift** (separate from the family app's Sheet).
2. In the Sheet: **Extensions → Apps Script**.
3. Delete what is in `Code.gs`, paste in the contents of `backend/Code.gs` from this repo, and save.
4. The tabs (Sessions, Blocks, Workouts, ...) are created automatically the first time they are used.

## 2. Script properties (Project Settings → Script properties)

| Property | Value |
|---|---|
| `USERS` | One entry per person, `Name=key`, separated by commas. Example: `Paul=k7Fq2xP9mW, Dan=Zr4tY8bN1c`. Use long random keys; the key is what keeps each person's data separate. |
| `APP_URL` | `https://pmomnieaiassistant-source.github.io/MHWorkoutApp/` |
| `WHOOP_CLIENT_ID` | From the Whoop Developer Dashboard (step 4). |
| `WHOOP_CLIENT_SECRET` | From the Whoop Developer Dashboard. Only ever put this here, never in the repo or a chat. |

## 3. Deploy

1. **Deploy → New deployment → Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. Authorize when asked (Sheets, Drive for photos, external requests for Whoop).
4. Copy the **Web app URL** (ends in `/exec`).
5. Put it in `config.js` as `apiUrl` (or send it to Claude to commit). It is not a secret; the per-person key is.

When you change `Code.gs` later: **Deploy → Manage deployments → edit → Version: New version**. This keeps the same URL.

## 4. Whoop

1. In the [Whoop Developer Dashboard](https://developer-dashboard.whoop.com), open your app (or create one).
2. Scopes: `read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:profile`, `read:body_measurement` (offline access is requested by the app).
3. **Redirect URL:** the Web app URL from step 3 (the `/exec` address), exactly.
4. Copy the Client ID and Client Secret into the Script properties above.
5. In the app: **Home → Connect Whoop**. Sign in to Whoop, approve, then switch back to MH Lift. The last 30 days load in; after that the app syncs when opened (at most every 20 minutes) or with **Sync now**.

New Whoop apps start in a sandbox that allows up to 10 members, which covers personal use.

## 5. Each person's link

Each person opens their own link once, then adds it to the home screen (Safari → Share → Add to Home Screen):

```
https://pmomnieaiassistant-source.github.io/MHWorkoutApp/?u=THEIR_KEY
```

The key is remembered on the phone. Data entered before the back end existed stays on that phone; it is not moved to the Sheet automatically.
