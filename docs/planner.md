# Program tab: Sessions, Blocks, Planner (draft v0.1)

Status: **draft v0.2.** Questions answered by Paul (see Decisions).

## The three sections

| Section | What it is | Main actions |
|---|---|---|
| **Sessions** | Library of single workouts (see `session-format.md`) | Create, Import from LLM, rate, comment |
| **Blocks** | Named reusable weeks. Each block has Mon–Sun; each day holds zero or more sessions, or is a rest day | Create block, edit days, duplicate ("Block 2 from Block 1"), rename, delete |
| **Planner** | The calendar. Real weeks with real dates | Swipe between weeks, add sessions to days, fill a week with a block, save a week as a block |

## Planner layout (modeled on the Momnie family Planner)

- Week bar at the top: `‹  This week · Nov 16–22  ›`. Swipe left/right (or tap the arrows) to move weeks. A tag under it shows how the week is filled, e.g. **Block 2 · linked**, **Block 2 · 1 change**, or **Custom**.
- Seven day rows, Monday first. Each shows its session cards (name, est. time, done/skipped status for past days) and a **+ Add** chip. Rest days show "Rest".
- Week menu (⋯ on the week bar):
  - **Fill with block…** → pick a block → the week takes that block's sessions and is always linked to it. A pop-up confirms: *"This week will now change whenever Block 2 changes, unless you unlink it."* The same reminder sits under the week bar ("Linked to Block 2 · changes with the block · Unlink").
  - **Fill several weeks…** (also a button under the week) → pick blocks in order (e.g. 1, 2, 3, 4), a start week, and how many times to repeat. Fills that many weeks in one go, all linked.
  - **Save week as block…** → name it → creates a new block from this week. The week becomes linked to the new block.
  - **Unlink from block** → keeps the current sessions, but future block edits no longer reach this week.
  - **Clear week.**
- Per session card: open, move to another day (drag or "Move to…"), remove.

## How linking works

A week is either **linked** to a block or **custom**.

- **Linked week:** what you see on each day is the block's day, unless that day has its own change.
- **Edit the block** (Blocks section) → every linked week **from today on** shows the change. Past days keep what was planned at the time; what you actually did is in the workout log anyway.
- **Edit a day in the Planner** (add, remove, swap or move a session in a linked week) → saved for that day only, then a prompt:

  > You changed Tuesday. Update **Block 2** to match?
  > **Just this week**  ·  **Update Block 2**

  - *Just this week*: the day keeps its own version; the week tag shows "Block 2 · 1 change". Other weeks using Block 2 are untouched.
  - *Update Block 2*: the block changes, the day's own version is dropped, and every linked week from today on shows it.
- **Reset day to block** removes a day's own change.
- If a block is deleted, linked weeks keep their sessions and become custom.

This is the same pattern the family app uses for repeating activities with one-off date overrides.

## Workout tab

Today's sessions come from the Planner. If there is more than one, they are listed in order; the user can always pick a different session from the library instead.

## Data in the Sheet

| Tab | One row per | Columns |
|---|---|---|
| `Blocks` | block | user, id, name, notes, created |
| `BlockItems` | session on a block day | user, blockId, day (1–7), order, sessionId, rest (y/n) |
| `PlanWeeks` | linked week | user, weekStart (Monday), blockId |
| `PlanItems` | session on a real date, for custom weeks and for changed days of linked weeks | user, date, order, sessionId, rest |
| `PlanDays` | day that has its own version | user, date, overridden (y), note |

Rule for a date: if `PlanDays` says the day is overridden, or the week is not linked, use `PlanItems` for that date. Otherwise use the linked block's `BlockItems` for that weekday. When a block changes, days already in the past get their planned sessions copied into `PlanItems` first, so history doesn't shift.

## Public sessions and blocks

- Session and block editors have a **Make public** toggle. Public items show a blue "Public" chip.
- Other users see them under **Shared by others**: in the session picker (adding to a day, a block, starting or logging a workout), in the Sessions list (on by default; ☰ → "Public sessions from others"), in the Blocks list, and in **Fill with block** / **Fill several weeks**.
- Owner names are never shown or sent to other users (the back end sends an anonymous token instead).
- Adding one makes a **copy** in your own library, marked "Copied from a public session". A public block also copies its sessions. Adding the same item twice reuses the copy you already have. The owner's later edits do not reach copies.

## Missed sessions

When the app opens and a past day has a planned session with no workout recorded (done in the app or entered by hand), a pop-up asks:

> **Did you miss Upper Strength A?** Tue, Nov 18
> **Yes, missed**  ·  **No, I did it**

- **Yes, missed** → the session is marked skipped for that day (optional note, e.g. "travel"). It is not moved to another day.
- **No, I did it** → opens that session as a workout for that date, showing what was planned, so the user can change anything that was different and save.
- Several missed days are asked one after another (or "Mark all missed").
- Only asked once per planned session.

## Manual workout entry

For logging a workout after it happened.

- **Workout tab: a + button in the bottom corner → "Enter a workout".**
- Choose: a planned session (today or earlier), any session from the library, or a blank workout (free text plus exercises).
- Set the **date**, plus approximate **start and end times** picked in 5-minute steps (e.g. 6:15 to 6:55).
- The session's cards appear pre-filled with the plan. Edit reps, weights, times, rounds; mark items done or skipped; add notes and a photo; Save.
- Saved workouts look the same in the Feed as ones run live, with a small "entered by hand" label.
- **Whoop matching:** if a Whoop workout overlaps the entered window (allowing 15 minutes either side, since entered times are approximate), the two link automatically and the Whoop data (heart rate, strain, calories, exact start/end) is pulled into the workout. The workout's times are then corrected to Whoop's exact times. Manual link/unlink is still available if the match is wrong.

## Decisions (Paul, 2026-11-17)

1. Fill with block **always links**, with a pop-up and a note under the week saying it will change with the block unless unlinked.
2. **Fill several weeks** button under the week in the Planner.
3. Block edits **do not** change past weeks.
4. **More than one session per day** is fine.
5. Missed sessions → "Did you miss…?" pop-up: Yes marks it skipped; No opens manual entry. Plus a general manual entry via the + button on the Workout tab.
