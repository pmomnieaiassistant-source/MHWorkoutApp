# Program tab: Sessions, Blocks, Planner (draft v0.1)

Status: **draft for review.** Open questions at the end.

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
  - **Fill with block…** → pick a block → the week takes that block's sessions and stays linked to it.
  - **Fill weeks with blocks…** → pick blocks in order (e.g. 1, 2, 3, 4), a start week, and how many times to repeat. Fills that many weeks in one go.
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

## Open questions

1. Is linked-with-prompt the only way to fill a week, or do you also want a **"copy, never linked"** option? (Proposed: one mode, plus "Unlink" for when you want a copy.)
2. **Fill weeks with blocks** (several weeks at once with repeat) — wanted now, or just one week at a time?
3. Should a block edit also change **past** linked weeks? (Proposed: no, today onward.)
4. Can a day hold **more than one session** (e.g. AM run, PM lift)? (Proposed: yes.)
5. Should a session planned for a past day that wasn't done show as **missed**, or just stay quietly as planned?
