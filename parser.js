// MH Lift session parser. Turns the session text syntax (docs/session-format.md) into a structure.
// Works in the browser (window.MHParse) and in Node (require('./parser.js')) for tests.
(function (root) {
  'use strict';

  const TIMED = ['emom', 'intervals', 'amrap', 'fortime', 'rft', 'ladder', 'deathby', 'steady', 'test'];
  const OPT_KEYS = ['rest', 'tempo', 'note', 'notes', 'score', 'scaled', 'alt', 'alts', 'intra-rest', 'intrarest', 'cap', 'tags', 'tag',
    'load', 'equipment', 'description', 'desc', 'target', 'rounds', 'sets', 'every'];

  // ---------- small value parsers ----------

  /** Seconds from "90s", "3:00", "1:00:00", "20 min", "2m". A bare number uses `bare` ('s' or 'm'). */
  function parseTime(str, bare) {
    const s = String(str == null ? '' : str).trim().toLowerCase();
    let m;
    if ((m = s.match(/^(\d+):(\d{2}):(\d{2})$/))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
    if ((m = s.match(/^(\d+):(\d{2})$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)$/))) return Math.round(+m[1]);
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)$/))) return Math.round(+m[1] * 60);
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)$/))) return Math.round(+m[1] * 3600);
    if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) return Math.round(+m[1] * (bare === 'm' ? 60 : 1));
    return null;
  }

  const DIST = { m: 1, meter: 1, meters: 1, metre: 1, metres: 1, km: 1000, k: 1000, mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, feet: 0.3048, yd: 0.9144, yds: 0.9144, yards: 0.9144 };
  const AMOUNT_RE = /^(\d+:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds|min|mins|minutes|m|meters?|metres?|km|k|mi|miles?|ft|feet|yds?|yards|cal|cals|calories|kcal))$/i;

  /** Work amount: {sec} for time, {dist (meters), unit} for distance, {cal}. "m" here means meters. */
  function parseAmount(str) {
    const s = String(str || '').trim().toLowerCase();
    let m;
    if (/^\d+:\d{2}(:\d{2})?$/.test(s)) return { sec: parseTime(s), raw: str.trim() };
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds|min|mins|minutes)$/))) return { sec: parseTime(m[1] + m[2]), raw: str.trim() };
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(cal|cals|calories|kcal)$/))) return { cal: +m[1], raw: str.trim() };
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(m|meters?|metres?|km|k|mi|miles?|ft|feet|yds?|yards)$/))) return { dist: Math.round(+m[1] * DIST[m[2]] * 10) / 10, unit: m[2], raw: str.trim() };
    return null;
  }

  const normUnit = u => { u = String(u || '').toLowerCase(); return /^(lb|lbs|pound|pounds)$/.test(u) ? 'lb' : /^(kg|kgs|kilo|kilos)$/.test(u) ? 'kg' : ''; };

  /** Load after "@": absolute, percent, relative, RPE, body weight, or free text (band, pace, damper...). */
  function parseLoad(str) {
    const s = String(str || '').trim().replace(/[,;]\s*$/, '');
    const L = { raw: s };
    let m;
    if (!s) return null;
    if ((m = s.match(/^([+-])\s*(\d+(?:\.\d+)?)\s*%$/))) return Object.assign(L, { kind: 'rel', pct: +(m[1] + m[2]) });
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*%\s*(tm|1rm|e1rm|training max|max)?$/i))) return Object.assign(L, { kind: 'pct', pct: +m[1], of: /tm|training/i.test(m[2] || '') ? 'TM' : '1RM' });
    if ((m = s.match(/^rpe\s*(\d+(?:\.\d+)?)$/i))) return Object.assign(L, { kind: 'rpe', rpe: +m[1] });
    if ((m = s.match(/^rir\s*(\d+)$/i))) return Object.assign(L, { kind: 'rir', rir: +m[1] });
    if ((m = s.match(/^(?:bw|bodyweight|body weight)\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)?)?$/i))) return Object.assign(L, { kind: 'bw', val: m[1] ? +(m[1] + m[2]) : 0, unit: normUnit(m[3]) });
    if ((m = s.match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(lb|lbs|pounds?|kg|kgs|kilos?)?$/i)))
      return Object.assign(L, { kind: 'abs', count: m[1] ? +m[1] : 1, val: +m[2], alt: m[3] ? +m[3] : null, unit: normUnit(m[4]) });
    return Object.assign(L, { kind: 'text' });
  }

  // Pull "rest 90s", "tempo 3-1-1-0", "RPE 8", "RIR 2" out of a line. Returns the rest of the line.
  function pullMods(s, o) {
    s = s.replace(/,?\s*\bintra-?rest\s+(\d+(?::\d{2})?\s*(?:s|sec|secs|seconds|min|mins|m)?)(?=\s|,|$)/i, (_, t) => { o.intraRest = parseTime(t, 's'); return ' '; });
    s = s.replace(/,?\s*\brest\s+(\d+(?::\d{2})?\s*(?:s|sec|secs|seconds|min|mins|m)?)(?=\s|,|$)/i, (_, t) => { o.rest = parseTime(t, 's'); return ' '; });
    s = s.replace(/,?\s*\btempo\s+([\dx]{1,2}\s*-\s*[\dx]{1,2}\s*-\s*[\dx]{1,2}(?:\s*-\s*[\dx]{1,2})?|\d{4})(?=\s|,|$)/i, (_, t) => { o.tempo = t.replace(/\s/g, '').replace(/^(\d)(\d)(\d)(\d)$/, '$1-$2-$3-$4'); return ' '; });
    s = s.replace(/,?\s*(?:@\s*)?\brpe\s*(\d+(?:\.\d+)?)(?=\s|,|$)/i, (_, t) => { o.rpe = +t; return ' '; });
    s = s.replace(/,?\s*(?:@\s*)?\brir\s*(\d+)(?=\s|,|$)/i, (_, t) => { o.rir = +t; return ' '; });
    return s.replace(/\s+/g, ' ').trim();
  }

  const SIDE_RE = /^(?:\/\s*(?:side|arm|leg|s)|each(?:\s+(?:side|arm|leg))?|per\s+(?:side|arm|leg)|e\/s)$/i;
  const TECH = [[/\bmyo[- ]?reps?\b/i, 'myo-reps'], [/\brest[- ]pause\b/i, 'rest-pause'], [/\bdrop[- ]?sets?\b/i, 'drop set'], [/\bcluster(?:s| sets?)?\b/i, 'cluster']];

  /**
   * One movement line: "Back Squat 5x5 @ 225 lb rest 3:00", "10 Push-up", "6/side Goblet Lunge @ 16kg",
   * "1 mi Run", "A1 Pull-up 8-10 RIR 2", "Row 500m easy".
   */
  function parseExercise(line) {
    const st = { raw: line.trim() };
    let s = pullMods(line.trim(), st);
    // load after the first "@"
    const at = s.indexOf('@');
    if (at >= 0) { st.load = parseLoad(s.slice(at + 1)); s = s.slice(0, at).trim(); }
    let m;
    if ((m = s.match(/^([A-Za-z]\d{1,2})[.):]?\s+(.+)$/))) { st.label = m[1].toUpperCase(); s = m[2]; }
    for (const [re, name] of TECH) if (re.test(s)) { st.technique = name; s = s.replace(re, ' ').replace(/\s+/g, ' ').trim(); }
    // leading amount: "1 mi Run", "500m Row", "30s Plank", "1:00 Plank", "15 cal Bike"
    if ((m = s.match(/^(\d+:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds|min|mins|minutes|m|meters?|km|mi|miles?|ft|feet|yds?|yards|cal|cals|calories|kcal))\s+(.+)$/i)) && parseAmount(m[1])) {
      st.amount = parseAmount(m[1]); s = m[2];
    } else if ((m = s.match(/^(\d+(?:-\d+)?\+?|max)\s*((?:\/\s*(?:side|arm|leg|s)|each(?:\s+(?:side|arm|leg))?|per\s+(?:side|arm|leg)|e\/s))?\s+(.+)$/i))) {
      st.reps = m[1].toLowerCase(); if (m[2]) st.side = true; s = m[3];
    }
    // trailing "5x5", "4x8-10", "3 x 6/2", "3x5+", "2x15/side", "3x30s"
    if ((m = s.match(/\s(\d+)\s*[x×]\s*(\d+(?:-\d+)?\+?|max|\d+(?::\d{2})?\s*(?:s|sec|secs)?)(?:\s*\/\s*(\d+)(?!\s*(?:side|arm|leg)))?\s*((?:\/\s*(?:side|arm|leg|s)|each(?:\s+side)?|per\s+side))?\s*$/i))) {
      st.sets = +m[1];
      const r = m[2].toLowerCase().replace(/\s/g, '');
      if (/s$|sec|:/.test(r)) st.amount = { sec: parseTime(r, 's'), raw: m[2] }; else st.reps = r;
      if (m[3]) st.cluster = +m[3];
      if (m[4]) st.side = true;
      s = s.slice(0, m.index).trim();
    } else if ((m = s.match(/\s(\d+(?:-\d+)?\+?|max)\s*((?:\/\s*(?:side|arm|leg|s)|each(?:\s+side)?|per\s+side))?\s*$/i)) && !st.reps) {
      st.reps = m[1].toLowerCase(); if (m[2]) st.side = true; s = s.slice(0, m.index).trim();
    }
    // trailing / middle amount with a descriptor: "Row 500m easy", "Bike 5:00 easy"
    if (!st.amount && (m = s.match(/\s(\d+:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds|min|mins|minutes|m|meters?|km|mi|miles?|ft|yds?|cal|cals|calories))\b(.*)$/i)) && parseAmount(m[1])) {
      st.amount = parseAmount(m[1]); const extra = m[2].trim(); if (extra) st.desc = extra; s = s.slice(0, m.index).trim();
    }
    st.name = s.replace(/[:,\-–\s]+$/, '').replace(/^[:,\-–\s]+/, '').trim();
    return st;
  }

  /** A set line under an exercise: "5 @ 75% TM", "warmup 3 @ 60% TM", "backoff 3x3 @ -10%", "drop 10 @ 20 lb > 8 @ 15 lb", "mini 5 x 5 rest 5s". */
  function parseSetLine(line) {
    let s = line.trim(), kind = 'work', m;
    if ((m = s.match(/^(warm-?\s?up|wu|work(?:ing)?|top(?:\s+set)?|back-?\s?off|drop|mini|amrap)\b\s*:?\s*/i))) {
      const k = m[1].toLowerCase().replace(/[\s-]/g, '');
      kind = k.startsWith('warm') || k === 'wu' ? 'warmup' : k.startsWith('back') ? 'backoff' : k.startsWith('top') ? 'top' : k.startsWith('work') ? 'work' : k;
      s = s.slice(m[0].length);
    }
    if (kind === 'drop') {
      const parts = s.split('>').map(p => parseSetLine(p)[0]).filter(Boolean);
      if (!parts.length) return null;
      return [Object.assign({}, parts[0], { kind: 'drop', drops: parts.slice(1).map(p => ({ reps: p.reps, load: p.load })) })];
    }
    const o = {};
    s = pullMods(s, o);
    let load = null;
    const at = s.indexOf('@');
    if (at >= 0) { load = parseLoad(s.slice(at + 1)); s = s.slice(0, at).trim(); }
    let count = 1, reps = null, amount = null;
    if ((m = s.match(/^(\d+)\s*[x×]\s*(\d+(?:-\d+)?\+?|max|\d+(?::\d{2})?\s*(?:s|sec)?)(?:\s*\/\s*(\d+))?\s*((?:\/\s*side|each))?$/i))) {
      count = +m[1]; const r = m[2].replace(/\s/g, '').toLowerCase();
      if (/s$|sec|:/.test(r)) amount = { sec: parseTime(r, 's') }; else reps = r;
      if (m[3]) o.cluster = +m[3];
      if (m[4]) o.side = true;
    } else if ((m = s.match(/^(\d+(?:-\d+)?\+?|max)\s*((?:\/\s*side|each))?$/i))) { reps = m[1].toLowerCase(); if (m[2]) o.side = true; }
    else if ((m = s.match(/^(\d+:\d{2}|\d+\s*(?:s|sec|secs))$/i))) amount = { sec: parseTime(m[1], 's') };
    else if (!s && load) reps = '';
    else return null;
    const out = [];
    for (let i = 0; i < count; i++) {
      const set = Object.assign({ kind: kind === 'amrap' ? 'work' : kind, reps, load }, o);
      if (amount) set.amount = amount;
      if (kind === 'amrap' && reps && !/\+$/.test(reps)) set.reps = reps + '+';
      out.push(set);
    }
    return out;
  }

  /** Block headers. Returns a card shell, or null when the line is an exercise. */
  function parseHeader(line) {
    let s = line.trim().replace(/:\s*$/, '').trim();
    const c = {};
    let m;
    s = s.replace(/\bcap\s+(\d+(?::\d{2})?\s*(?:min|mins|minutes|m|s|sec)?)(?=\s|,|$)/i, (_, t) => { c.cap = parseTime(t, 'm'); return ' '; });
    s = s.replace(/,?\s*\brest\s*=\s*work\b/i, () => { c.restEqWork = true; return ' '; });
    s = s.replace(/,?\s*\brest\s+(\d+(?::\d{2})?\s*(?:s|sec|secs|seconds|min|mins|m)?)(?=\s|,|$)/i, (_, t) => { c.rest = parseTime(t, 's'); return ' '; });
    const at = s.indexOf('@');
    if (at >= 0) { c.load = parseLoad(s.slice(at + 1)); s = s.slice(0, at); }
    s = s.replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
    const R = (re) => (m = s.match(re));
    const n = v => (v == null || v === '' ? null : +v);
    if (R(/^super\s?set(?:\s*[x×]\s*(\d+)|\s+(\d+)\s*(?:rounds?|sets?))?$/i)) return Object.assign(c, { format: 'superset', rounds: n(m[1] || m[2]) || 1 });
    if (R(/^(?:circuit|giant\s?set)(?:\s*[x×]\s*(\d+)|\s+(\d+)\s*(?:rounds?|sets?)?)?$/i)) return Object.assign(c, { format: 'circuit', rounds: n(m[1] || m[2]) || 1 });
    if (R(/^complex(?:\s*[x×]\s*(\d+)|\s+(\d+)\s*(?:rounds?|sets?)?)?$/i)) return Object.assign(c, { format: 'complex', rounds: n(m[1] || m[2]) || 1 });
    if (R(/^e(\d*)mom\s*(\d+(?::\d{2})?)\s*(min|mins|minutes|m)?$/i)) {
      const every = (n(m[1]) || 1) * 60, total = parseTime(m[2], 'm');
      return Object.assign(c, { format: 'emom', every, rounds: Math.max(1, Math.round(total / every)) });
    }
    if (R(/^every\s+(\d+(?::\d{2})?\s*(?:s|sec|min|mins|m)?)\s*(?:[x×]|for)\s*(\d+)\s*(?:rounds?|sets?)?$/i)) return Object.assign(c, { format: 'emom', every: parseTime(m[1], 'm'), rounds: +m[2] });
    if (R(/^amrap\s*(\d+(?::\d{2})?\s*(?:min|mins|minutes|m|s)?)$/i)) return Object.assign(c, { format: 'amrap', dur: parseTime(m[1], 'm') });
    if (R(/^(\d+)\s*(?:rounds?\s*for\s*time|rft)$/i)) return Object.assign(c, { format: 'rft', rounds: +m[1] });
    if (R(/^(\d+(?:\s*-\s*\d+)+)\s*(?:reps?)?\s*(?:for\s*time)?$/i)) return Object.assign(c, { format: 'ladder', scheme: m[1].split('-').map(x => +x.trim()) });
    if (R(/^(?:for\s*time|chipper|afap)$/i)) return Object.assign(c, { format: 'fortime' });
    if (R(/^death\s*by\s+(.+)$/i)) return Object.assign(c, { format: 'deathby', step: parseExercise(m[1] + (c.load ? ' @ ' + c.load.raw : '')) });
    if (R(/^tabata(?:\s*[x×]?\s*(\d+)\s*(?:rounds?)?)?$/i)) return Object.assign(c, { format: 'intervals', rounds: n(m[1]) || 8, work: { sec: 20 }, rest: 10, tabata: true });
    if (R(/^intervals?\s*(\d+)\s*[x×]\s*\(?\s*(.+?)\s*(?:on|work)?\s*(?:\/\s*(.+?)\s*(?:off|rest)?\s*)?\)?$/i)) {
      const work = parseAmount(m[2]); if (!work) return null;
      const restTxt = (m[3] || '').trim();
      const rest = restTxt ? parseTime(restTxt, 's') : (c.rest != null ? c.rest : 0);
      if (restTxt && rest == null && !/open|ready/i.test(restTxt)) return null;
      return Object.assign(c, { format: 'intervals', rounds: +m[1], work, rest: rest == null ? null : rest, restOpen: /open|ready/i.test(restTxt) });
    }
    if (R(/^(?:pyramid|ladder|intervals?)\s+(.+?)\s*(?:on)?$/i) && /[\/,]/.test(m[1])) {
      const works = m[1].split(/\s*[\/,]\s*/).map(parseAmount);
      if (works.some(w => !w)) return null;
      return Object.assign(c, { format: 'intervals', pyramid: true, works, rounds: works.length, work: works[0], rest: c.rest || 0 });
    }
    if (R(/^steady(?:\s+(.*))?$/i)) {
      let rest = (m[1] || '').trim();
      const sc = Object.assign(c, { format: 'steady' });
      const tok = rest.match(/^(\S+(?:\s*(?:min|mins|minutes|km|mi|miles|m|cal|s|sec))?)\s*(.*)$/i);
      if (tok && parseAmount(tok[1])) { sc.amount = parseAmount(tok[1]); rest = tok[2]; }
      else if (tok && parseTime(tok[1], 'm') != null && /:/.test(tok[1])) { sc.amount = { sec: parseTime(tok[1], 'm'), raw: tok[1] }; rest = tok[2]; }
      if (rest) sc.target = rest;
      return sc;
    }
    if (R(/^test\s+(\d+(?::\d{2})?\s*(?:min|mins|minutes|m|s)?)$/i)) return Object.assign(c, { format: 'test', dur: parseTime(m[1], 'm') });
    return null;
  }

  // ---------- main ----------

  function newSession(name) { return { name: name || '', tags: [], notes: [], phases: [], warnings: [] }; }

  /** Parse text into { sessions: [...], warnings: [...] }. Never throws; unknown lines are kept as notes and flagged. */
  function parse(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const sessions = [];
    let ses = null, phase = null, card = null, step = null;
    const warn = (ln, raw, msg) => { const w = { line: ln, text: raw, msg }; (ses || ensureSes()).warnings.push(w); };
    function ensureSes() { if (!ses) { ses = newSession(''); sessions.push(ses); } return ses; }
    function ensurePhase() { ensureSes(); if (!phase) { phase = { name: 'Workout', cards: [] }; ses.phases.push(phase); } return phase; }
    function addNote(t) { if (step) (step.notes = step.notes || []).push(t); else if (card) card.notes.push(t); else if (phase) (phase.notes = phase.notes || []).push(t); else ensureSes().notes.push(t); }
    function applyOpt(key, val, ln, raw, toStep) {
      key = key.toLowerCase().replace(/\s+/g, '-');
      const tgt = toStep && step ? step : card;
      if (!tgt) {
        if (key === 'tags' || key === 'tag') ensureSes().tags.push(...val.split(',').map(t => t.trim()).filter(Boolean));
        else if (key === 'notes' || key === 'note' || key === 'description' || key === 'desc') ensureSes().notes.push(val);
        else warn(ln, raw, 'Option outside a card');
        return;
      }
      switch (key) {
        case 'rest': { const t = parseTime(val, 's'); if (t == null) warn(ln, raw, 'Could not read rest time'); else tgt.rest = t; break; }
        case 'intra-rest': case 'intrarest': tgt.intraRest = parseTime(val, 's'); break;
        case 'tempo': tgt.tempo = val.replace(/\s/g, ''); break;
        case 'note': case 'notes': case 'description': case 'desc': (tgt.notes = tgt.notes || []).push(val); break;
        case 'score': card.score = val; break;
        case 'scaled': card.scaled = val; break;
        case 'cap': card.cap = parseTime(val, 'm'); break;
        case 'load': tgt.load = parseLoad(val); break;
        case 'equipment': tgt.equipment = val; break;
        case 'target': tgt.target = val; break;
        case 'rounds': case 'sets': card.rounds = +val || card.rounds; break;
        case 'tags': case 'tag': ensureSes().tags.push(...val.split(',').map(t => t.trim()).filter(Boolean)); break;
        case 'alt': case 'alts': {
          const alts = val.split(/\s*\|\s*|\s*,\s*/).filter(Boolean);
          if (step) step.alts = alts; else if (card.steps.length) card.steps[card.steps.length - 1].alts = alts; else card.alts = alts;
          break;
        }
        default: warn(ln, raw, 'Unknown option "' + key + '"');
      }
    }
    function startCard(c, ln, raw) { card = Object.assign({ line: ln, title: raw.trim().replace(/:\s*$/, ''), notes: [], steps: [] }, c); step = null; ensurePhase().cards.push(card); }

    lines.forEach((rawLine, i) => {
      const ln = i + 1;
      let line = rawLine.replace(/\t/g, '  ');
      // comments: whole line or trailing " // ..."
      if (/^\s*\/\//.test(line)) return;
      line = line.replace(/\s+\/\/.*$/, '');
      if (!line.trim()) return;
      const t = line.trim();
      let m;
      if ((m = t.match(/^#\s*(?!#)(.*)$/))) { ses = newSession(m[1].replace(/^session\s*:\s*/i, '').trim()); sessions.push(ses); phase = card = step = null; return; }
      if ((m = t.match(/^#{2,}\s*(.*)$/))) { ensureSes(); phase = { name: m[1].trim() || 'Phase', cards: [] }; ses.phases.push(phase); card = step = null; return; }
      if ((m = t.match(/^>\s?(.*)$/))) { addNote(m[1]); return; }
      const dash = t.match(/^[-*•]\s*/);
      if (dash) {
        const lead = line.match(/^\s*/)[0].length, after = line.slice(lead + 1).match(/^\s*/)[0].length;
        const nested = lead >= 2 || after >= 2;
        const body = t.slice(dash[0].length).trim();
        if (!body) return;
        if (!card) {
          if ((m = body.match(/^([a-z][a-z -]*?)\s*:\s*(.+)$/i)) && OPT_KEYS.includes(m[1].toLowerCase().replace(/\s+/g, '-'))) { applyOpt(m[1], m[2], ln, t); return; }
          startCard({ format: 'straight' }, ln, body); addStepToStraight(card, parseExercise(body)); return;
        }
        if (nested && step) {
          if ((m = body.match(/^(alt|alts|note|notes|rest|tempo|load)\s*:\s*(.+)$/i))) { applyOpt(m[1], m[2], ln, t, true); return; }
          const part = parseExercise(body);
          if (part.name) { (step.parts = step.parts || []).push(part); return; }
          warn(ln, t, 'Could not read this line'); addNote(body); return;
        }
        if ((m = body.match(/^([a-z][a-z -]*?)\s*:\s*(.+)$/i)) && OPT_KEYS.includes(m[1].toLowerCase().replace(/\s+/g, '-'))) { applyOpt(m[1], m[2], ln, t, false); return; }
        if (card.format === 'straight') {
          const sets = parseSetLine(body);
          if (sets) { const st = card.steps[0]; if (st._planned) { st.sets = []; delete st._planned; } st.sets.push(...sets); return; }
          if (card.steps[0] && !card.steps[0].sets.length && !card.steps[0]._planned) {
            // A name-only card followed by exercises: treat as a circuit of one round.
            card.format = 'circuit'; card.rounds = 1; card.steps = [];
          } else { warn(ln, t, 'Could not read this set line; kept as a note'); addNote(body); return; }
        }
        // block step
        let slot = null;
        if ((m = body.match(/^(odd|even|min(?:ute)?\s*\d+|\d+(?:st|nd|rd|th)?\s*min(?:ute)?|\d+)\s*:\s+(.+)$/i))) {
          const k = m[1].toLowerCase();
          slot = k === 'odd' || k === 'even' ? k : +k.match(/\d+/)[0];
          var stepText = m[2];
        } else var stepText = body;
        let st;
        if ((m = stepText.match(/^complex\b\s*(.*)$/i))) { st = { name: 'Complex', complex: true, parts: [], raw: stepText }; const mm = m[1].match(/@\s*(.+)$/); if (mm) st.load = parseLoad(mm[1]); }
        else st = parseExercise(stepText);
        if (slot != null) st.slot = slot;
        if (!st.name) { warn(ln, t, 'Could not find an exercise name'); addNote(body); return; }
        card.steps.push(st); step = st;
        return;
      }
      // option lines without a dash, e.g. "rest: 3:00"
      if (card && (m = t.match(/^([a-z][a-z -]*?)\s*:\s*(.+)$/i)) && OPT_KEYS.includes(m[1].toLowerCase().replace(/\s+/g, '-'))) { applyOpt(m[1], m[2], ln, t, false); return; }
      if (!card && !phase && (m = t.match(/^([a-z][a-z -]*?)\s*:\s*(.+)$/i)) && OPT_KEYS.includes(m[1].toLowerCase().replace(/\s+/g, '-'))) { applyOpt(m[1], m[2], ln, t, false); return; }
      // a card
      const h = parseHeader(t);
      if (h) {
        const st = h.step; delete h.step;
        startCard(h, ln, t);
        if (st) { card.steps.push(st); step = null; }
        return;
      }
      const ex = parseExercise(t);
      if (!ex.name) { warn(ln, t, 'Could not read this line; kept as a note'); addNote(t); return; }
      startCard({ format: 'straight' }, ln, ex.name);
      addStepToStraight(card, ex);
    });

    sessions.forEach(finish);
    const warnings = [].concat(...sessions.map(s => s.warnings));
    return { sessions, warnings };
  }

  // A single-exercise card. "5x5 @ 225" becomes five planned sets; set lines below replace them.
  function addStepToStraight(card, ex) {
    const count = typeof ex.sets === 'number' ? ex.sets : null;
    ex.sets = [];
    card.steps = [ex];
    if (ex.rest != null) card.rest = ex.rest;
    if (ex.amount && count == null && ex.reps == null) {
      // "Bike 5:00 easy", "Row 500m" on their own line: a steady piece
      card.format = 'steady'; card.amount = ex.amount;
      if (ex.desc || (ex.load && ex.load.kind === 'text')) card.target = [ex.load && ex.load.kind === 'text' ? ex.load.raw : '', ex.desc || ''].filter(Boolean).join(', ');
      return;
    }
    if (count == null && ex.reps == null && !ex.load) return;
    const n = count || 1;
    for (let i = 0; i < n; i++) {
      let reps = ex.reps == null ? null : ex.reps;
      if (reps && /\+$/.test(reps) && n > 1 && i < n - 1) reps = reps.slice(0, -1); // "3x5+": only the last set is AMRAP
      const set = { kind: 'work', reps, load: ex.load || null };
      if (ex.amount) set.amount = ex.amount;
      ['rpe', 'rir', 'cluster', 'side'].forEach(k => { if (ex[k] != null) set[k] = ex[k]; });
      ex.sets.push(set);
    }
    ex._planned = true;
  }

  function finish(ses) {
    ses.phases = ses.phases.filter(ph => ph.cards.length || (ph.notes && ph.notes.length));
    ses.phases.forEach(ph => ph.cards.forEach(card => {
      card.steps.forEach(st => { delete st._planned; });
      if (card.format === 'straight' && card.steps[0] && card.steps[0].tempo) card.tempo = card.tempo || card.steps[0].tempo;
    }));
    return ses;
  }

  root = root || {};
  const api = { parse, parseExercise, parseSetLine, parseHeader, parseLoad, parseTime, parseAmount, TIMED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MHParse = api;
})(typeof window !== 'undefined' ? window : this);
