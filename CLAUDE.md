# MH Lift — Project Brief

This file captures the brainstorm for MH Lift, an iPhone workout app, and the decisions since. Version 1 is built (see "Code map"). Read this fully before changing code, and confirm open questions with Paul before locking them in.

## Code map

- `index.html`: shell and all styles. `app.js`: data layer, helpers, overlays, Feed, Home, Whoop. `program.js`: Sessions, Blocks, Planner. `workout.js`: Workout tab, execution views, timers, manual entry, missed sessions, startup.
- `parser.js`: session syntax parser (browser and Node). Tests: `node tests/parser.test.js` (runs every example in `docs/session-format.md`).
- `backend/Code.gs`: Apps Script back end (generic per-user tables, Whoop OAuth and sync, photo upload). Setup: `backend/SETUP.md`.
- `syntax.txt`: the guide users give to an LLM. `sw.js`: offline shell (bump `VERSION` when shipping changes). `config.js`: `apiUrl`.
- Without `apiUrl` and a personal key the app runs in local mode (phone storage only).
- Use the three-bar options button for filters and screen options rather than adding visible controls.

## Summary

A personal workout app for iPhone. Each person builds their own training program, the app lays out each day's session, and it guides them through the workout step by step. Whoop data (sleep, recovery, workouts) flows in automatically.

Two primary users to design for:
- A serious lifter (detailed sets, reps, weights, rest).
- A casual-to-intermediate exerciser who uses timed formats such as EMOM (every minute on the minute).

## Architecture (decided)

- **Front end:** web app installed to the iPhone home screen, hosted from Paul's own GitHub repository (same pattern as his other apps, e.g. the Momnie family/household app and the BC Dads app).
- **Back end:** Google Sheets as the data store, accessed through a Google Apps Script web app.
- **Whoop:** official Whoop developer API (OAuth 2.0, v2 endpoints). Each user connects their own Whoop account. The official API is read-only.
- **No AI calls inside the app.** Session import uses a fixed text syntax (see "Import from LLM") so there are no API keys or per-use costs.

## Users and privacy

- Multiple people can use the app.
- Each user is fully private: no awareness of other users, no visibility into anyone else's data.
- Data is not sensitive; app-level separation within one sheet is acceptable. Keep every record keyed by user and date.
- **No social features for now.** Design so an opt-in feed and leaderboard can be added later without restructuring data.
- **Exception: public sessions and blocks.** A session or block can be marked **Make public**. Other users then see it (without the owner's name; the toggle says "your name will not be shown") under "Shared by others" when adding sessions or filling weeks. Adding one **copies** it into their own library (blocks bring copies of their sessions), so the owner's later edits never change anyone else's plan. Everything else stays private.

## Navigation: four bottom tabs

1. **Feed**
2. **Program**
3. **Workout**
4. **Home**

Visual direction: very sleek, modern, card-based, app-like. Emphasis on swipeable, movable cards. Dark theme with one bright accent was used in the mockups (lime `#C6F432`, rest-timer blue `#5AB0FF`, skip orange `#FF8A3D`); not final.

## Feed tab

A private, scrolling timeline.
- **Daily overview card** for every day: sleep (with bedtime and wake time), recovery, and headline Whoop numbers.
- **Workout cards** placed between the daily cards:
  - Workouts done in the app. If a Whoop workout overlaps in time, attach its data (heart rate, strain, etc.).
  - Workouts that exist only in Whoop show as their own cards with whatever Whoop recorded.
  - Provide a manual link/unlink if auto-matching guesses wrong.
- Opening a workout card shows what was done, notes, an optional attached photo, and Whoop stats.
- Every workout card has an **Export data** button in the corner (see Export).

## Program tab

- **Sessions:** a single designed workout made of phases and cards (exercises, sets, reps, weights, timers).
  - Browsable library, modeled on the recipe database in the household app: star rating, full details, last date performed, user comments. Sessions are reusable over time.
  - **Create session** by hand.
  - **Import from LLM** (see below).
- Three sections: **Sessions**, **Blocks**, **Planner** (full design in `docs/planner.md`, draft).
- **Blocks:** a named week of sessions (Mon–Sun, any number of sessions per day, rest days allowed), e.g. "Block 1"–"Block 4" of a 4-week wave.
- **Planner:** modeled on the Momnie family Planner. Week bar at the top (swipe left/right between weeks), days of the week below, each day with "+ Add".
  - Add a session to a day, or **Fill week with block**.
  - A filled week stays **linked** to its block: editing the block updates every linked week from today on.
  - Editing a day in the Planner changes only that week, then asks "Update Block 2 to match?".
  - **Save week as block** turns a week you built by hand into a new block.
- Terminology: "Program" = the tab / overall plan; "Session" = one workout; "Block" = a reusable week of sessions.

## Workout tab

Runs today's planned session(s) from the Planner (user can also pick a different session).

- **+ button (bottom corner): enter a workout by hand** after the fact (planned session, library session, or blank). See `docs/planner.md`.
- **Missed sessions:** on opening the app, a past planned session with nothing recorded triggers "Did you miss…?" Yes = mark skipped; No = open manual entry pre-filled with the plan.

- The session is organized into **phases** (e.g. Warm-up, Strength, Conditioning), each containing **cards** (one per step).
- **Card interaction:**
  - Tap the **left side** → checkbox, marks the step done.
  - Tap the **right side** → opens the step in its execution view.
  - **Swipe** → reveals **Skip**. Skips are recorded in the workout log, with an optional note (e.g. "knee was sore"). Skipped items are not carried over to another day.
- Finishing a step in its execution view marks it complete and returns to the card list.

### Execution views by card type

- **Sets (lifting):** list of sets with reps and weight, adjustable in place. Checking off a set automatically starts a **rest timer** (e.g. 90 seconds) with −15s / +15s / Skip rest.
- **Timed / intervals (EMOM, work/rest splits, timed runs):**
  - Full-screen view with the current minute ("Minute 4 of 12") and the exercise name in large bold text, plus reps/weight and a big countdown.
  - Supports detailed custom intervals, e.g. 30s work / 90s rest, alternating exercises on odd/even minutes.
  - **Color flashes** at each transition so the user knows when to switch. Sound cues are a later build (see Decisions log); iPhone web apps cannot vibrate.
  - Keep the screen awake during timed blocks (iPhone suspends web apps when the screen locks; this needs careful handling).
- **Steady cardio:** duration or distance, with a timer.

### Workout formats to support

Full list in `docs/session-format.md` (straight sets, supersets, circuits, complexes, EMOM, AMRAP, for time, ladders, intervals/Tabata, steady, run/erg intervals).

## Home tab

- **Connect Whoop** button.
- Personal tracking over time: weight, height, resting heart rate, max heart rate, plus custom user-defined measurements.
- Whoop can auto-fill height, weight, max HR (body measurements) and resting HR (recovery). Each is a switch under Home → Whoop → "Update measurements from Whoop"; **all off by default**.
- Start simple: a log of entries per measurement (charts can come later).
- The section is called **Status**. It starts with **sleep averages** from Whoop (bedtime, wake time, sleep per night; 7 or 30 days), then the measurements.

## Import from LLM (session syntax)

Full draft spec: `docs/session-format.md` (formats, syntax, examples, Sheet layout, builder approach).

- The app provides a **downloadable syntax instructions file** describing the exact session format, with examples.
- A user gives that file to any LLM (ChatGPT, Claude, etc.) along with their workout in any form; the LLM returns text in the app's syntax.
- In Program → Create session → **Import from LLM**, the user pastes that text into a text box.
- The app parses the fixed syntax (`parser.js`) so the preview is instant; sessions are stored as text.
- Show a **preview before saving**, flagging any lines that could not be understood. Keep the format forgiving.

## Export data

- On any workout card: an **Export data** button opens a plain summary screen — date, session name, time, duration, each exercise with sets/reps/weights, skipped items, notes, and matched Whoop numbers.
- One-tap **Copy**, written as a short natural-language log so it can be pasted into Whoop's coach or elsewhere (since Whoop's API cannot accept workouts).

## Whoop integration notes

- Scopes: `read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:profile`, `read:body_measurement`, plus `offline` for refresh tokens.
- Available: recovery score, resting HR, HRV, SpO2 and skin temp (4.0+), sleep stage durations, day strain (0–21), workouts with sport type, duration, heart rate and workout strain, height/weight/max HR.
- Not available: GPS, write access, Strength Trainer sets/reps/weights.
- Recovery only exists after the user wakes and the sleep cycle closes.
- Rate limits: 100 requests/minute, 10,000/day per client. New apps start in a sandbox tier (up to 10 members).
- A Whoop membership is required to build; register the app in the Whoop Developer Dashboard.
- Using recovery to adjust the day's proposed workout is a **nice-to-have, not core**.

## Future (design for, don't build yet)

- Optional social feed.
- Leaderboard.

## Decisions log

- **Name:** MH Lift. **Icon:** a simple barbell for now.
- **Hosting:** GitHub Pages on this repo (public repo is fine).
- **Whoop:** Paul has Whoop developer API access. Linking Whoop is done from the **Home tab** in the app (Connect Whoop button). The OAuth flow runs through Apps Script: the client secret lives in Script Properties (never in the repo), the Apps Script web app URL is the redirect URI, and tokens are stored per user and refreshed server-side.
- **Program:** Sessions / Blocks / Planner (replaces the earlier cycle-length idea). See `docs/planner.md`. See `docs/session-format.md` section 7 for rounding, units and exercise names.
- **Timed screen, phase 1:** no audio cues, no push. The clock is computed from timestamps so it is correct after the screen locks or the app is reopened; screen kept awake during timed blocks. Locked-screen audio cues (pre-rendered audio track) and music handling are a later build.
- **Run / erg intervals:** in scope for the timed screen (work by time, distance or calories; targets for pace, split, watts, zone). Distance/calorie reps use a "Lap done" button.
- **Home tab tracking:** keep it simple to start, a log of entries per measurement; charts later.
- **Public sessions/blocks:** opt-in per item; others add a copy (see Users and privacy).
- **Lifter friend:** no need to wait; he will test the app and changes come later.

## Open questions

- Adding users: add `Name=key` to the `USERS` script property (no redeploy) and send them `…/?u=key`. See `backend/SETUP.md`.
