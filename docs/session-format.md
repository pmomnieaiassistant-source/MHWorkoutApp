# Session Format (draft v0.1)

How a session is described, stored, built and run. This is the core of the app: the builder, Import from LLM, the Workout tab and Export all read and write this one structure.

Status: **draft v0.2.** Format questions answered (Section 7). Nothing is built against it yet.

---

## 1. What has to fit

The survey of common training styles (see Sources at the end) produced this list of things a session must be able to say.

### Block formats (how a group of exercises is run)

| Format | What it means | Example |
|---|---|---|
| Straight sets | One exercise, sets done in order with rest | Back squat 5x5 |
| Superset / giant set | 2+ exercises alternated, rest after the group | A1 pull-up, A2 dip, x3 |
| Circuit / rounds | A list of exercises repeated N rounds, untimed | 3 rounds: 10 push-ups, 15 squats |
| Complex | Several moves done back to back without putting the weight down; counts as one set | KB Armor Building Complex: 2 clean, 1 press, 3 front squat |
| EMOM / E2MOM / EnMOM | Work starts every N minutes; leftover time is rest. Can rotate exercises by minute (odd/even, 1-2-3) | EMOM 12: odd 12 swings, even 6 goblet squats |
| AMRAP | As many rounds/reps as possible in a fixed time. Score = rounds + reps | AMRAP 20: 5 pull-ups, 10 push-ups, 15 squats |
| For time | Fixed work done as fast as possible, usually with a time cap. Score = time | Murph |
| Rounds for time (RFT) | N rounds of a list, for time | 5 RFT: 400 m run, 15 OHS |
| Chipper | Long one-pass list, for time | 50-40-30... down a list |
| Rep scheme / ladder | Reps change each round: descending (21-15-9), ascending (1-2-3-...), or up and down | Fran: 21-15-9 thrusters + pull-ups |
| Death by | Minute 1 = 1 rep, minute 2 = 2 reps... until you can't finish within the minute | Death by burpees |
| Intervals | Work / rest pairs repeated N times, optionally alternating exercises | 8 x (20 s on / 10 s off), Tabata |
| Steady | One continuous effort by duration or distance, optional pace/HR zone | Zone 2 bike 40:00 |
| Timed test | Fixed work against a clock target | Simple & Sinister: 100 swings in 5:00 |

Buy-in / buy-out (a fixed piece before or after the main block, e.g. Murph's two 1-mile runs) is handled by putting the pieces in order, not as its own format.

### Ways to prescribe reps / amount

- Count: `5`, range: `8-12`, AMRAP: `5+` or `max`
- Per side: `10/side` (also `each`, `/arm`, `/leg`)
- Time: `30s`, `1:00` (holds, carries, planks)
- Distance: `400m`, `1 mi`, `50 ft`
- Calories: `15 cal`
- Varying sets: `5, 3, 1+` or `12, 10, 8`

### Ways to prescribe load

- Absolute: `@ 225 lb`, `@ 24kg`, `@ 2x24kg` (double kettlebell)
- Percent of a max: `@ 75%` (of the exercise's 1RM) or `@ 75% TM` (training max, used by 5/3/1)
- Effort: `RPE 8`, `RIR 2`
- Body weight: `BW`, weighted `@ BW+25 lb`, assisted `@ BW-30 lb`
- Band / setting: `@ red band`, `@ level 6`, `@ damper 5`
- Descriptive: `@ heavy`, `@ moderate`
- Men/women or Rx/scaled pairs: `@ 95/65 lb` (first is the default, second is the alternate)

### Set techniques (lifting detail)

- Warm-up sets (shown, not counted as working sets)
- Top set + back-off sets (`1 @ RPE 8, then 3x5 @ -10%`)
- AMRAP last set (`3x5+`)
- Drop set (`8 @ 100 lb > 8 @ 80 lb > max @ 60 lb`)
- Rest-pause (`8 + 3 + 2, rest 15s`)
- Myo-reps (activation set then mini-sets)
- Cluster sets (`3 x 6/2, intra-rest 20s` = 3 sets of 6 done as 2-rep clusters)
- Tempo (`tempo 3-1-1-0` = down, pause bottom, up, pause top)
- Rest between sets (`rest 90s`, `rest 3:00`)

### Other things a step can carry

- Notes shown during the workout ("keep the hips low"), and private notes not shown
- Exercise alternatives / progression steps (the bodyweight "recommended routine" lets you pick a level: knee push-up → push-up → diamond push-up → archer push-up)
- Scaling options (Rx vs scaled)
- Equipment (barbell, KB, DB, band, rower, bike, ski, sled, vest)
- What to record: weight + reps (lifting), time, rounds + reps, distance, calories, or nothing

### Out of scope for a session (belongs to Program)

- Weekly progression (5/3/1's 65/75/85 → 70/80/90 → 75/85/95 waves, linear +5 lb per session). A session is one workout. A multi-week program is several sessions arranged into weekly Blocks on the Planner (see `docs/planner.md`). Import can bring in several sessions at once (one `#` heading each), so one paste can produce "5/3/1 Week 1 Day 1" through "Week 4 Day 4".
- Training-max math. Percent loads are worked out at workout time from the user's saved maxes (see Section 5).

---

## 2. The structure

```
Session
 ├─ name, tags, description, est. duration, notes
 └─ Phase  (Warm-up, Strength, Conditioning, Cool-down... free text)
     └─ Card  = one block, shown as one card in the Workout tab
         ├─ format   straight | superset | circuit | complex | emom | amrap |
         │           fortime | rft | ladder | deathby | intervals | steady | test
         ├─ timing   rounds, time cap, every N min, work/rest, total time
         ├─ score    what to record for the whole block
         ├─ rest, notes
         └─ Step  (one movement, or a rest / note line)
             ├─ exercise name (+ alternatives)
             ├─ sets: list of { reps, load, kind: warmup|work|backoff|drop|amrap, rest }
             ├─ tempo, side, equipment, technique (cluster / rest-pause / myo)
             ├─ minute slot (EMOM rotation) or interval slot
             └─ notes
```

A single exercise with straight sets is a Card with one Step, so the simple case stays simple.

---

## 3. The text syntax

One syntax used by Import from LLM, the "edit as text" option in the builder, and Export. The rules:

- `# Name` starts a session. Several `#` headings in one paste = several sessions.
- `## Name` starts a phase.
- A line that does **not** start with `-` is a **card**.
- Lines starting with `-` belong to the card above (sets, or exercises inside a block, or options).
- An indented `-` line belongs to the step above it (the parts of a complex, or `alt:` progressions).
- `key: value` lines under a card set options (`rest:`, `tempo:`, `notes:`, `score:`, `alt:`, `scaled:`).
- `> text` = note shown during the workout. `// text` = private comment, ignored by the parser.
- Case, spacing, `x` vs `×`, `sec`/`s`/`seconds`, `lb`/`lbs` are all accepted. Anything not understood is kept as a note and flagged in the preview, never dropped.

### Exercise line grammar (forgiving)

```
<Exercise> <sets>x<reps> [@ <load>] [rest <time>] [tempo <a-b-c-d>] [RPE n | RIR n]
<reps> <Exercise> [@ <load>]               (inside blocks: "10 Push-ups @ BW")
<Exercise>                                  (then set lines below)
```

### Block header grammar

```
Superset [x<rounds>] [rest <time>]
Circuit <n> rounds [rest <time>]
Complex <n> sets [@ <load>] [rest <time>]
EMOM <minutes> | E<n>MOM <minutes>
AMRAP <time>
For time [cap <time>]
<n> rounds for time [cap <time>]
<a-b-c...> for time [cap <time>]            (ladder, e.g. 21-15-9)
Death by <exercise> [@ <load>]
Intervals <n> x <work> on / <rest> off
Tabata [<n> rounds]                          (= Intervals 8 x 20s on / 10s off)
Steady <time | distance> [zone n | pace x]
Test <time>                                  (finish the work within the time)
```

---

## 4. Worked examples

These double as the parser's test cases. Each comes from a real program style in the survey.

### Barbell: 5/3/1 week 3 day + Boring But Big style supplement

```
# 5/3/1 W3 – Squat
tags: barbell, strength

## Warm-up
Bike 5:00 easy
Back Squat
- warmup 5 @ 40% TM
- warmup 5 @ 50% TM
- warmup 3 @ 60% TM

## Main
Back Squat
- 5 @ 75% TM
- 3 @ 85% TM
- 1+ @ 95% TM
rest: 3:00
> Last set: as many good reps as you can, stop 1 short of failure.

## Supplemental
Back Squat 5x5 @ 75% TM rest 90s
// "First set last" weight

## Accessories
Superset x3 rest 60s
- A1 Hanging Leg Raise 10-15
- A2 Back Extension 12 @ BW+25 lb
```

### Hypertrophy: tempo, RIR, drop set, myo-reps

```
# Upper Hypertrophy A

## Strength
Incline DB Press 4x8-10 @ 70 lb RIR 2 rest 2:00 tempo 3-1-1-0
Chest-Supported Row 3x10-12 RIR 1 rest 90s
Cable Lateral Raise
- 12 @ 20 lb
- 12 @ 20 lb
- drop 10 @ 20 lb > 10 @ 15 lb > max @ 10 lb
Leg Curl myo-reps
- 15 @ 90 lb
- mini 5 x 5 rest 5s
```

### Strength with cluster sets and a top set

```
# Heavy Deadlift Day

## Main
Deadlift
- 1 @ RPE 8
- backoff 3x3 @ -10%
Trap Bar Jump 3 x 6/2 @ 95 lb
intra-rest: 20s
rest: 2:00
```

### Kettlebell: Simple & Sinister (timed test)

```
# Simple & Sinister

## Practice
Test 5:00
- 100 One-Arm Swing @ 24kg
> 10 sets of 10, switching hands each set.

Test 10:00
- 10 Turkish Get-up @ 24kg
> 1 rep per side, alternating.
```

### Kettlebell: Armor Building Complex as an EMOM

```
# ABC EMOM 20

## Conditioning
EMOM 20
- Complex @ 2x24kg
-   2 Double Clean
-   1 Double Press
-   3 Double Front Squat
```

### Kettlebell: alternating-minute EMOM (the casual user's format)

```
# KB Minutes

## Work
EMOM 12
- odd: 12 Swing @ 24kg
- even: 6/side Goblet Reverse Lunge @ 16kg
```

### CrossFit: Fran (ladder for time)

```
# Fran

## WOD
21-15-9 for time cap 10:00
- Thruster @ 95/65 lb
- Pull-up
scaled: Thruster @ 65/45 lb, Ring Row
score: time
```

### CrossFit: Murph (buy-in / partition / buy-out)

```
# Murph

## WOD
For time cap 60:00 @ vest 20 lb
- 1 mi Run
- 100 Pull-up
- 200 Push-up
- 300 Air Squat
- 1 mi Run
> Partition the middle any way you like, e.g. 20 rounds of 5-10-15.
```

### CrossFit: AMRAP and Death by

```
# Cindy + Death by Burpees

## WOD
AMRAP 20:00
- 5 Pull-up
- 10 Push-up
- 15 Air Squat
score: rounds+reps

## Finisher
Death by Burpee
score: minutes completed
```

### Intervals: Tabata and custom splits

```
# Bike Intervals

## Conditioning
Tabata
- Air Bike

Intervals 6 x 30s on / 90s off
- Row @ damper 6
score: calories

Intervals 10 x 40s on / 20s off
- odd: KB Swing @ 24kg
- even: Burpee
```

### Bodyweight: recommended-routine style with progressions

```
# Bodyweight Full Body

## Warm-up
Circuit 1 round
- 10 Scapular Pull
- 10 Arch Hang
- 30s Plank

## Strength
Superset x3 rest 90s
- A1 Pull-up 5-8
-   alt: Negative Pull-up | Pull-up | Weighted Pull-up
- A2 Pistol Squat 5-8/side
-   alt: Assisted Squat | Bulgarian Split Squat | Shrimp Squat | Pistol Squat
Superset x3 rest 90s
- B1 Dip 5-8
- B2 Nordic Curl 5-8
-   alt: Romanian Deadlift | Single-Leg RDL | Nordic Curl
```

### Hybrid / HYROX-style

```
# HYROX Half Sim

## Race
For time
- 1 km Run
- 1000m SkiErg
- 1 km Run
- 50m Sled Push @ 152 kg
- 1 km Run
- 100 Wall Ball @ 9 kg
score: time + splits
```

### Steady cardio

```
# Zone 2

## Main
Steady 45:00 zone 2
- Bike
> Nose-breathing pace.
```

---

## 5. Data in the Sheet

| Tab | One row per | Key columns |
|---|---|---|
| `Sessions` | session | user, id, name, tags, json (the full parsed structure), text (the syntax), rating, comments, created, lastDone |
| `Blocks`, `BlockItems`, `PlanWeeks`, `PlanItems` | see `docs/planner.md` | |
| `Settings` | user + key | user, key, value (unit, rounding step, rest default...) |
| `Workouts` | workout done | user, id, sessionId, date, start, end, notes, photo, whoopWorkoutId (match / manual override) |
| `Sets` | logged set or block result | user, workoutId, cardIdx, stepIdx, setIdx, exercise, reps, load, unit, time, rounds, distance, cal, status (done / skipped), note |
| `Maxes` | exercise max entry | user, exercise, type (1RM / TM / e1RM), value, unit, date |
| `Exercises` | known exercise name | name, aliases, equipment, record type (weight+reps / time / distance...) |
| `Measurements`, `Whoop*` | per Home / Whoop needs | user, date, ... |

A session is stored whole as JSON in one cell (cells hold up to 50,000 characters, far more than a session needs). The text form is kept beside it so a session can be re-opened as text. Logged sets are one row each so history, charts and "last time you did 5 @ 185" are easy to query.

`Maxes` lets a `% TM` or `% 1RM` load show as a real number in the Workout tab. If no max is saved the card shows "75% TM" and asks for the max the first time.

---

## 6. Builder: complex without clunky

The aim is that a plain session takes a few taps, and depth is there only when someone opens it.

1. **Start from a format, not a blank form.** "Add card" shows the format list (Straight sets, Superset, Circuit, EMOM, AMRAP, For time, Intervals, Tabata, Steady, More...). Each one opens with sensible defaults already filled (EMOM 10, Tabata 8 x 20/10, 3x10 rest 90 s).
2. **One-line entry.** Every card has a text line that accepts the syntax: typing `Bench 5x5 @ 185 rest 2:00` fills the fields. Power users never touch the form.
3. **Summary first, detail on tap.** A card shows one line ("Bench Press · 5×5 @ 185 lb · rest 2:00"). Tap to expand sets; "More options" reveals tempo, RPE/RIR, techniques, alternatives, notes.
4. **Per-set editing only when sets differ.** `5x5 @ 185` stays one row; tap "Vary sets" to break it into individual rows (warm-ups, top set, back-offs, drop sets).
5. **Drag to reorder** cards and steps; drag a card onto another to make a superset.
6. **Edit as text** at session level: flip the whole session to the syntax, edit, flip back (same parser as Import).
7. **Exercise name autocomplete** from the user's past exercises, so logs line up over time.

---

## 7. Decisions (confirmed with Paul, 2026-11-17)

1. **Multi-week programs: yes**, through Blocks and the Planner (see `docs/planner.md`). This replaces the earlier "cycle length" idea.
2. **Percent loads round to the nearest 5 lb** (2.5 kg in kg mode). The rounding step is a per-user setting so it can be changed later (e.g. 2.5 lb with fractional plates).
3. **Units:** each user has a default (lb or kg); any line can override it (`@ 24kg` in an lb profile stays kg).
4. **Exercise names:** free text with autocomplete from the user's own history, plus a starter list. Aliases (e.g. "RDL" = "Romanian Deadlift") can be merged later so history lines up.

---

## Sources

- 5/3/1: [Lift Vault glossary](https://liftvault.com/resources/531-glossary/), [thefitness.wiki primer](https://thefitness.wiki/5-3-1-primer/), [Boostcamp methodology](https://www.boostcamp.app/methodology/5-3-1)
- CrossFit formats: [Gymdesk WOD guide](https://gymdesk.com/blog/crossfit-wods), [BOXROX formats](https://www.boxrox.com/?p=70141), [Edge: buy-in / buy-out / AFAP](https://intercom.help/findyouredge/en/articles/10011713-understanding-conditioning-abbreviations-emom-amrap-afap-buy-in-buy-out-and-more), [Murph guide](https://marathonhandbook.com/murph-workout/), [Hero WODs](https://thebattlebunker.com/blogs/logbook/hero-wods)
- Kettlebell: [StrongFirst Sinister](https://www.strongfirst.com/sinister/), [Lift Vault S&S](https://liftvault.com/programs/strength/simple-sinister-kettlebell-program-spreadsheet-pavel/), [StrongFirst ABC thread](https://www.strongfirst.com/community/goto/post?id=188338)
- Set techniques: [RP intensity techniques](https://rpstrength.com/blogs/articles/intensity-techniques-for-maximum-mass), [cluster set notation](https://rowingstronger.substack.com/p/how-to-use-cluster-sets-in-off-season), [ACE on tempo](https://acefitness.org/continuing-education/certified/april-2025/8843/repetition-tempo-and-muscular-development-what-s-the-connection), [advanced methods meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6950543)
- Bodyweight: [r/bodyweightfitness Recommended Routine](https://redditbwf.github.io/wiki/recommended_routine.html)
- GZCL tiers (weak sources): [Jefit GZCLP](https://www.jefit.com/routines/463945/gzclp-reddit)
- HYROX: [PUMA: what is HYROX](https://us.puma.com/us/en/articles/what-is-hyrox)
- Prior art for text syntax: [Liftoscript](https://www.liftosaur.com/doc/liftoscript), [Lift Ledger](https://github.com/yukaii/liftledger), [intervals.icu syntax](https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701)
