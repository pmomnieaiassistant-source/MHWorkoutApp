# Workout App — Project Brief

This file captures a brainstorm session for a new iPhone workout app. It is the starting spec. Nothing has been built yet. Read this fully before writing code, and confirm open questions with Paul before locking them in.

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

## Navigation: four bottom tabs

1. **Feed**
2. **Program**
3. **Workout**
4. **Home**

Visual direction: very sleek, modern, card-based, app-like. Emphasis on swipeable, movable cards. Dark theme with one bright accent was used in the mockups (lime `#C6F432`, rest-timer blue `#5AB0FF`, skip orange `#FF8A3D`); not final.

## Feed tab

A private, scrolling timeline.
- **Daily overview card** for every day: sleep, recovery, and headline Whoop numbers.
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
- **Schedule:** assign sessions to days of the week to form a program.
- Terminology: "Program" = the overall plan; "Session" = one workout.

## Workout tab

Runs today's scheduled session (user can also pick a different session).

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
  - **Color flashes** at each transition so the user knows when to switch, plus sound and haptic cues.
  - Keep the screen awake during timed blocks (iPhone suspends web apps when the screen locks; this needs careful handling).
- **Steady cardio:** duration or distance, with a timer.

### Workout formats to support

Straight sets, EMOM, custom work/rest intervals, steady duration/distance. Likely also circuits, supersets, AMRAP (to confirm).

## Home tab

- **Connect Whoop** button.
- Personal tracking over time: weight, height, resting heart rate, max heart rate, plus custom user-defined measurements.
- Whoop can auto-fill height, weight, max HR (body measurements) and resting HR (recovery).
- Trend charts per measurement (to confirm; at minimum a log of entries).

## Import from LLM (session syntax)

- The app provides a **downloadable syntax instructions file** describing the exact session format, with examples.
- A user gives that file to any LLM (ChatGPT, Claude, etc.) along with their workout in any form; the LLM returns text in the app's syntax.
- In Program → Create session → **Import from LLM**, the user pastes that text into a text box.
- The Apps Script back end parses the fixed syntax into a session.
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

## Open questions

- Confirm requirements with the lifter friend before building (Paul is meeting him first).
- Which additional formats (circuit, superset, AMRAP) are needed.
- Should a proposed session be suggested (accept/swap) or simply assigned for the day.
- Home tab: charts vs. simple log to start.
- User sign-in method for separating users.
