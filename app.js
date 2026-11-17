// MH Lift app. Plain JS, no build step. Data: Google Sheets through Apps Script (backend/Code.gs), or this phone only until that is set up.
'use strict';

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const dow = s => (pd(s).getDay() + 6) % 7; // 0 = Monday
const mondayOf = s => addDays(s, -dow(s));
const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DFULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fmtD = s => pd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMD = s => pd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtLong = s => pd(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtClock = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const relDay = s => s === today() ? 'Today' : s === addDays(today(), -1) ? 'Yesterday' : s === addDays(today(), 1) ? 'Tomorrow' : fmtD(s);
const mmss = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
const durTxt = sec => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
const LS = {
  get(k, d) { try { const v = localStorage.getItem('mh_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mh_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('mh_' + k); } catch (e) {} }
};
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('in'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('in'), 2600); }

// ---------- icons ----------
const ICONS = {
  feed: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  program: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  workout: '<path d="M2.5 12h19M5.5 8v8M8.5 6.5v11M18.5 8v8M15.5 6.5v11"/>',
  home: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.4-3.8 4.4-5.5 8-5.5s6.6 1.7 8 5.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M7.5 5v14M16.5 5v14"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', sync: '<path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4"/><path d="M5 3v4h4M19 21v-4h-4"/>'
};
const ic = (n, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const stars = (n, act) => `<span class="stars">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= (n || 0) ? 'on' : ''}" ${act ? `data-a="${act}" data-v="${i}"` : ''}>${ic('star', act ? 24 : 14, 0).replace('fill="none"', 'fill="currentColor"')}</span>`).join('')}</span>`;

// ---------- data ----------
const TABLES = ['Sessions', 'Blocks', 'PlanWeeks', 'PlanDays', 'Workouts', 'Measurements', 'Maxes', 'Settings', 'WhoopDays', 'WhoopWorkouts'];
const S = {}; TABLES.forEach(t => S[t] = []);
let ME = '', WHOOP = { configured: false, connected: false, lastSync: null }, ONLINE = true, SHARED = { Sessions: [], Blocks: [] };
const CFG = window.MH_CONFIG || {};

// Personal link: ?u=<key>. Kept on the phone so the home-screen app remembers it.
(function () {
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  const u = q.get('u') || h.get('u');
  if (u && u !== LS.get('key')) { LS.set('key', u); LS.del('data'); LS.del('queue'); }
  if (h.get('url')) { LS.set('url', h.get('url')); history.replaceState(null, '', location.pathname + location.search); }
  if (!LS.get('firstRun')) LS.set('firstRun', today());
})();
const apiUrl = () => CFG.apiUrl || LS.get('url', '');
const KEY = () => LS.get('key', '');
const serverMode = () => !!(apiUrl() && KEY());

const byId = (t, id) => S[t].find(r => r.id === id);
function applyOp(o) {
  const arr = S[o.t];
  if (o.del != null) { const i = arr.findIndex(r => r.id === o.del); if (i >= 0) arr.splice(i, 1); return; }
  const i = arr.findIndex(r => r.id === o.row.id);
  if (i >= 0) arr[i] = o.row; else arr.push(o.row);
}
let saveT = 0;
const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => LS.set('data', { me: ME, whoop: WHOOP, tables: S, shared: SHARED }), 200); };
let QUEUE = LS.get('queue', []);

/** Write rows: [{t, row}] (whole row, insert or replace) or [{t, del: id}]. Applied here at once, then sent to the server. */
async function write(ops) {
  ops = [].concat(ops).filter(Boolean);
  ops.forEach(o => { if (o.row) { o.row = Object.assign({}, o.row, { updated: Date.now() }); } applyOp(o); });
  persist();
  render();
  if (serverMode()) { QUEUE.push(...ops); LS.set('queue', QUEUE); flush(); }
}
let flushing = false;
async function flush() {
  if (flushing || !QUEUE.length || !serverMode()) return;
  flushing = true;
  try {
    while (QUEUE.length) {
      const batch = QUEUE.slice(0, 40);
      await api('write', { ops: batch });
      QUEUE.splice(0, batch.length); LS.set('queue', QUEUE);
    }
    setOnline(true);
  } catch (e) { setOnline(false); setTimeout(flush, 15000); } finally { flushing = false; }
}
function setOnline(v) { if (ONLINE !== v) { ONLINE = v; renderTop(); } }

async function api(action, data = {}) {
  const res = await fetch(apiUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, key: KEY() }, data)) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Request failed');
  if (j.me) ME = j.me;
  if (j.whoop) WHOOP = j.whoop;
  return j;
}

async function loadServer() {
  if (!serverMode()) return;
  try {
    const j = await api('load');
    TABLES.forEach(t => S[t] = j.tables[t] || []);
    if (j.shared) SHARED = j.shared;
    QUEUE.forEach(applyOp);
    persist(); setOnline(true); afterData(); render();
    flush();
    if (WHOOP.connected && (!WHOOP.lastSync || Date.now() - WHOOP.lastSync > 20 * 60000)) whoopSync(true);
  } catch (e) { setOnline(false); if (/link|passcode/i.test(e.message)) toast(e.message); }
}

const setting = (k, d) => { const r = byId('Settings', k); return r && r.value != null ? r.value : d; };
const setSetting = (k, v) => write({ t: 'Settings', row: { id: k, value: v } });
const UNIT = () => setting('unit', 'lb');

// ---------- sessions ----------
const parseCache = new Map();
function parsed(ses) {
  const key = ses.text || '';
  if (!parseCache.has(key)) { const r = MHParse.parse(key); parseCache.set(key, r.sessions[0] || { name: '', phases: [], tags: [], notes: [], warnings: [] }); }
  return parseCache.get(key);
}
const allCards = p => p.phases.flatMap((ph, pi) => ph.cards.map((c, ci) => ({ c, pi, ci, key: pi + '.' + ci, phase: ph.name })));
const lastDone = sid => S.Workouts.filter(w => w.sessionId === sid && w.status === 'done').map(w => w.date).sort().pop() || '';

function estMin(p) {
  let sec = 0;
  allCards(p).forEach(({ c }) => {
    const st = c.steps || [], rest = c.rest != null ? c.rest : 75;
    switch (c.format) {
      case 'straight': sec += Math.max(1, (st[0] && st[0].sets.length) || 1) * (40 + rest); break;
      case 'superset': case 'circuit': case 'complex': sec += (c.rounds || 1) * (st.length * 40 + (c.rest || 45)); break;
      case 'emom': sec += c.rounds * c.every; break;
      case 'intervals': sec += c.rounds * (((c.work && c.work.sec) || 120) + (c.rest || 0)); break;
      case 'amrap': case 'test': sec += c.dur || 600; break;
      case 'steady': sec += (c.amount && c.amount.sec) || 1500; break;
      default: sec += c.cap || 900;
    }
  });
  return Math.max(5, Math.round(sec / 300) * 5);
}

// ---------- loads ----------
const roundStep = () => +setting('round', UNIT() === 'kg' ? 2.5 : 5);
function maxFor(name, of) {
  const m = S.Maxes.find(x => norm(x.exercise) === norm(name));
  if (!m) return null;
  const one = +m.oneRm || 0, tm = +m.tm || 0;
  return of === 'TM' ? (tm || (one ? one * 0.9 : 0)) || null : (one || (tm ? tm / 0.9 : 0)) || null;
}
const rnd = v => { const s = roundStep(); return Math.round(v / s) * s; };
/** Number to put in the weight box for a planned load, or '' when it is not a number (RPE, band, pace...). */
function loadNum(load, name, prev) {
  if (!load) return '';
  if (load.kind === 'abs') return load.val;
  if (load.kind === 'pct') { const m = maxFor(name, load.of); return m ? rnd(m * load.pct / 100) : ''; }
  if (load.kind === 'rel' && prev) return rnd(prev * (1 + load.pct / 100));
  if (load.kind === 'bw') return load.val ? (load.val > 0 ? '+' : '') + load.val : 'BW';
  return '';
}
const loadUnit = load => (load && load.unit) || UNIT();
function loadText(load, name) {
  if (!load) return '';
  if (load.kind === 'pct') { const v = loadNum(load, name); return v ? `${v} ${UNIT()} (${load.raw})` : load.raw; }
  return load.raw;
}

// Text for a movement: "12 Swing @ 24kg"
function stepText(st, withLoad = true) {
  if (!st) return '';
  const amt = st.amount ? st.amount.raw || (st.amount.sec ? mmss(st.amount.sec) : '') : '';
  const reps = st.reps ? st.reps + (st.side ? '/side' : '') : '';
  let s = [st.label, amt || reps, st.name].filter(Boolean).join(' ');
  if (st.complex && st.parts) s = 'Complex: ' + st.parts.map(p => stepText(p, false)).join(', ');
  if (withLoad && st.load) s += ' @ ' + loadText(st.load, st.name);
  return s;
}
function setsSummary(st) {
  const sets = (st.sets || []).filter(s => s.kind !== 'warmup'), wu = (st.sets || []).length - sets.length;
  if (!sets.length) return stepText(st);
  const same = sets.every(s => s.reps === sets[0].reps && JSON.stringify(s.load) === JSON.stringify(sets[0].load));
  const rp = s => s.amount ? mmss(s.amount.sec) : (s.reps || '') + (s.side ? '/side' : '');
  let txt = same ? `${sets.length} × ${rp(sets[0])}` : sets.map(rp).join(', ');
  const loads = [...new Set(sets.map(s => s.load && loadText(s.load, st.name)).filter(Boolean))];
  const pcts = sets.map(s => s.load).filter(l => l && l.kind === 'pct');
  if (loads.length === 1) txt += ' @ ' + loads[0];
  else if (pcts.length === sets.length && !pcts.some(l => maxFor(st.name, l.of))) { const v = pcts.map(l => l.pct); txt += ` @ ${Math.min(...v)}–${Math.max(...v)}% ${pcts[0].of}`; }
  else if (loads.length > 1) txt += ' @ ' + loads[0] + ' → ' + loads[loads.length - 1];
  if (sets[0].rpe) txt += ' · RPE ' + sets[0].rpe; if (sets[0].rir != null) txt += ' · RIR ' + sets[0].rir;
  if (wu) txt = `${wu} warm-up + ` + txt;
  return txt;
}
const FMT = { straight: 'Sets', superset: 'Superset', circuit: 'Circuit', complex: 'Complex', emom: 'EMOM', intervals: 'Intervals', amrap: 'AMRAP', fortime: 'For time', rft: 'Rounds for time', ladder: 'For time', deathby: 'Death by', steady: 'Steady', test: 'Test' };
function cardSummary(c) {
  const st = c.steps || [], names = st.map(s => stepText(s)).join(' · ');
  const r = c.rest ? ` · rest ${mmss(c.rest)}` : '';
  switch (c.format) {
    case 'straight': return setsSummary(st[0] || {}) + r + (c.tempo ? ' · tempo ' + c.tempo : '');
    case 'steady': return [c.amount && (c.amount.raw || mmss(c.amount.sec)), c.target, st.length > 1 || c.title !== (st[0] && st[0].name) ? names : ''].filter(Boolean).join(' · ');
    case 'superset': case 'circuit': case 'complex': return `${c.rounds || 1} round${c.rounds > 1 ? 's' : ''}${c.load ? ' @ ' + c.load.raw : ''}${r}`;
    case 'emom': return `${c.rounds * c.every / 60} min · ${names}`;
    case 'intervals': return (c.pyramid ? c.works.map(w => w.raw).join(' / ') : `${c.rounds} × ${c.work.raw || mmss(c.work.sec)}${c.rest ? ' / ' + mmss(c.rest) : ''}`) + ' · ' + names;
    case 'amrap': return `${mmss(c.dur)} · ${names}`;
    case 'deathby': return names;
    case 'test': return `${mmss(c.dur)} · ${names}`;
    default: return (c.cap ? `cap ${mmss(c.cap)} · ` : '') + names;
  }
}
function cardTitle(c) {
  if (c.format === 'straight') return c.steps[0] ? c.steps[0].name : c.title;
  if (['superset', 'circuit', 'complex'].includes(c.format) && c.steps.length) { const n = c.steps.map(s => s.complex ? 'Complex' : s.name); return n.length > 3 ? n.slice(0, 3).join(' + ') + ' + more' : n.join(' + '); }
  return c.title.replace(/,?\s*\brest\s+[\d:]+\s*\w*$/i, '').trim();
}

// ---------- planner model ----------
const weekRow = mon => byId('PlanWeeks', mon);
const dayRow = d => byId('PlanDays', d);
function blockDay(blockId, d) { const b = byId('Blocks', blockId); return b ? (b.days[dow(d)] || []).slice() : null; }
function planFor(d) {
  const r = dayRow(d); if (r) return (r.items || []).slice();
  const w = weekRow(mondayOf(d)); if (w) { const x = blockDay(w.blockId, d); if (x) return x; }
  return [];
}
const isChanged = d => { const r = dayRow(d), w = weekRow(mondayOf(d)), b = w && byId('Blocks', w.blockId); return !!(r && b && JSON.stringify(r.items || []) !== JSON.stringify(b.days[dow(d)] || [])); };
/** Before a block changes: copy its days into past dates of linked weeks, so history stays put. */
function snapshotPastOps(blockId) {
  const T = today(), ops = [];
  S.PlanWeeks.filter(w => w.blockId === blockId && w.id <= T).forEach(w => {
    for (let i = 0; i < 7; i++) { const d = addDays(w.id, i); if (d < T && !dayRow(d)) ops.push({ t: 'PlanDays', row: { id: d, date: d, items: blockDay(blockId, d) || [] } }); }
  });
  return ops;
}
/** Fill a week with a block (linked). Past days keep what they had. */
function fillWeekOps(mon, blockId) {
  const T = today(), ops = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    if (d < T) { if (!dayRow(d)) ops.push({ t: 'PlanDays', row: { id: d, date: d, items: planFor(d) } }); }
    else if (dayRow(d)) ops.push({ t: 'PlanDays', del: d });
  }
  ops.push({ t: 'PlanWeeks', row: { id: mon, date: mon, blockId } });
  return ops;
}
function unlinkOps(mon) {
  const ops = [];
  for (let i = 0; i < 7; i++) { const d = addDays(mon, i); if (!dayRow(d)) ops.push({ t: 'PlanDays', row: { id: d, date: d, items: planFor(d) } }); }
  ops.push({ t: 'PlanWeeks', del: mon });
  return ops;
}
/** Change one or more days. In a linked week, ask once whether the block should match. */
async function editDays(changes) {
  const dates = Object.keys(changes);
  await write(dates.map(d => ({ t: 'PlanDays', row: { id: d, date: d, items: changes[d] } })));
  const mon = mondayOf(dates[0]), w = weekRow(mon), b = w && byId('Blocks', w.blockId);
  if (!b) return;
  const diff = dates.filter(d => JSON.stringify(b.days[dow(d)] || []) !== JSON.stringify(changes[d]));
  const same = dates.filter(d => !diff.includes(d));
  if (same.length) await write(same.map(d => ({ t: 'PlanDays', del: d })));
  if (!diff.length) return;
  const names = diff.map(d => DFULL[dow(d)]).join(' and ');
  const r = await ask({ title: `You changed ${names}.`, body: `Update <b>${esc(b.name)}</b> to match? Every week linked to ${esc(b.name)} from today on will change too.`, buttons: [{ label: 'Just this week', v: 'no', cls: 'gray' }, { label: `Update ${b.name}`, v: 'yes' }] });
  if (!r || r.v !== 'yes') return;
  const fresh = byId('Blocks', b.id), days = fresh.days.map(x => x.slice());
  const ops = snapshotPastOps(b.id);
  diff.forEach(d => { days[dow(d)] = changes[d]; });
  ops.push({ t: 'Blocks', row: Object.assign({}, fresh, { days }) });
  diff.forEach(d => ops.push({ t: 'PlanDays', del: d }));
  // the snapshot may have just copied an edited past day; keep the edit as the day's own version instead
  diff.filter(d => d < today()).forEach(d => ops.push({ t: 'PlanDays', row: { id: d, date: d, items: changes[d] } }));
  await write(ops);
  toast(`${b.name} updated`);
}

// ---------- overlays ----------
const OV = [];
function openOv(o) {
  const wrap = document.createElement('div');
  wrap.className = o.full ? 'full' : 'shade';
  if (!o.full) { wrap.innerHTML = '<div class="sheet"></div>'; wrap.addEventListener('click', e => { if (e.target === wrap && !o.modal) closeOv(o); }); }
  o.el = wrap; o.box = o.full ? wrap : wrap.firstChild;
  o.redraw = () => { const y = o.box.scrollTop; o.box.innerHTML = o.render(o); o.box.scrollTop = y; if (o.after) o.after(o); };
  document.body.appendChild(wrap); o.redraw(); OV.push(o);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
  document.body.classList.add('noscroll');
  return o;
}
function closeOv(o) {
  o = o || OV[OV.length - 1]; if (!o) return;
  const i = OV.indexOf(o); if (i < 0) return;
  OV.splice(i, 1); o.el.classList.remove('in'); setTimeout(() => o.el.remove(), 260);
  if (!OV.length) document.body.classList.remove('noscroll');
  if (o.onClose) o.onClose(o);
}
const ovOf = el => OV.find(o => o.el.contains(el));
const redrawTop = () => { const o = OV[OV.length - 1]; if (o) o.redraw(); };

/** Bottom sheet with buttons (and an optional text field). Resolves {v, text} or null. */
function ask({ title, body = '', buttons = [{ label: 'OK', v: 'ok' }], input = null, col = false }) {
  return new Promise(res => {
    let done = false;
    const o = openOv({
      render: () => `<h2>${esc(title)}</h2>${body ? `<div class="muted" style="line-height:1.5">${body}</div>` : ''}
        ${input ? (input.area ? `<textarea id="askIn" style="margin-top:14px;min-height:90px" placeholder="${esc(input.ph || '')}">${esc(input.value || '')}</textarea>` : `<input id="askIn" style="margin-top:14px" placeholder="${esc(input.ph || '')}" value="${esc(input.value || '')}" ${input.type ? `type="${input.type}"` : ''}>`) : ''}
        <div class="btns ${col || buttons.length > 2 ? 'col' : ''}">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-a="askBtn" data-v="${i}">${esc(b.label)}</button>`).join('')}</div>`,
      onClose: () => { if (!done) res(null); }
    });
    o.pick = i => { done = true; const t = o.box.querySelector('#askIn'); res({ v: buttons[i].v, text: t ? t.value.trim() : '' }); closeOv(o); };
    if (input) setTimeout(() => { const t = o.box.querySelector('#askIn'); if (t && input.focus !== false) t.focus(); }, 280);
  });
}
/** Options menu (the three-bar button). items: [{label, a, v, danger, on}] */
function menu(title, items) {
  openOv({ render: () => `${title ? `<h2>${esc(title)}</h2>` : ''}${items.filter(Boolean).map(it => it.html ? it.html : `<button class="menu-item ${it.danger ? 'danger' : ''}" data-a="${it.a}" data-v="${esc(it.v == null ? '' : it.v)}" data-close="1"><span class="grow">${esc(it.label)}</span>${it.on != null ? `<span style="color:${it.on ? 'var(--lime)' : 'var(--dim)'}">${ic('check', 20)}</span>` : ''}</button>`).join('')}` });
}

// ---------- shared (public) sessions and blocks ----------
// Adding someone else's public session or block copies it into your own library, so their later edits never change your plan.
const sharedSes = id => SHARED.Sessions.find(s => s.id === id) || SHARED.Blocks.flatMap(b => b.sessions || []).find(s => s.id === id);
function adoptSessionOps(sh, ops) {
  const have = S.Sessions.find(s => s.fromShared === sh.owner + '|' + sh.id) || ops.map(o => o.row).find(r => r && r.fromShared === sh.owner + '|' + sh.id);
  if (have) return have.id;
  const id = uid();
  ops.push({ t: 'Sessions', row: { id, name: sh.name, tags: sh.tags || [], text: sh.text, rating: 0, comments: [], created: Date.now(), fromShared: sh.owner + '|' + sh.id, from: sh.owner } });
  return id;
}
async function adoptSession(sharedId) {
  const sh = sharedSes(sharedId); if (!sh) return null;
  const ops = [], id = adoptSessionOps(sh, ops);
  if (ops.length) { await write(ops); toast(`Added “${sh.name}” to your sessions`); }
  return id;
}
async function adoptBlock(sharedId) {
  const b = SHARED.Blocks.find(x => x.id === sharedId); if (!b) return null;
  const have = S.Blocks.find(x => x.fromShared === b.owner + '|' + b.id); if (have) return have.id;
  const ops = [], map = {};
  (b.sessions || []).forEach(s => { map[s.id] = adoptSessionOps(s, ops); });
  const id = uid();
  ops.push({ t: 'Blocks', row: { id, name: b.name, days: b.days.map(d => d.map(x => x === 'rest' ? 'rest' : map[x]).filter(Boolean)), fromShared: b.owner + '|' + b.id, from: b.owner } });
  await write(ops); toast(`Added ${b.name} to your blocks`);
  return id;
}
const sharedRow = (s, a, close) => `<button class="menu-item" data-a="${a}" data-v="shared:${esc(s.id)}" ${close ? 'data-close="1"' : ''}><span class="grow">${esc(s.name)}<div class="small muted">by ${esc(s.owner)}${s.text != null ? ' · ' + estMin(parsed(s)) + ' min' : ''}</div></span><span class="chip blue" style="font-size:11px">Public</span></button>`;

/** Pick a session from the library (yours, then other people's public ones). Resolves session id, 'rest', or null. */
function pickSession({ title = 'Add a session', rest = false } = {}) {
  return new Promise(res => {
    let q = '', done = false;
    const o = openOv({
      render: () => {
        const match = s => !q || norm(s.name + (s.tags || []).join('') + (s.owner || '')).includes(norm(q));
        const list = S.Sessions.filter(match).sort((a, b) => a.name.localeCompare(b.name));
        const mine = new Set(S.Sessions.map(s => s.fromShared).filter(Boolean));
        const shared = SHARED.Sessions.filter(s => match(s) && !mine.has(s.owner + '|' + s.id)).sort((a, b) => a.name.localeCompare(b.name));
        return `<h2>${esc(title)}</h2><input id="pickQ" placeholder="Search sessions" value="${esc(q)}" style="margin:8px 0 6px">
          ${rest ? `<button class="menu-item" data-a="pickRes" data-v="rest"><span class="grow">Rest day</span></button>` : ''}
          ${list.map(s => `<button class="menu-item" data-a="pickRes" data-v="${s.id}"><span class="grow">${esc(s.name)}<div class="small muted">${estMin(parsed(s))} min${(s.tags || []).length ? ' · ' + esc(s.tags.join(', ')) : ''}</div></span>${ic('chev', 18)}</button>`).join('') || (shared.length ? '' : '<div class="empty">No sessions yet. Create one in Program → Sessions.</div>')}
          ${shared.length ? `<div class="lbl">Shared by others</div>${shared.map(s => sharedRow(s, 'pickRes')).join('')}` : ''}`;
      },
      after: o => { const i = o.box.querySelector('#pickQ'); i.oninput = () => { q = i.value; const p = i.selectionStart; o.redraw(); const n = o.box.querySelector('#pickQ'); n.focus(); n.setSelectionRange(p, p); }; },
      onClose: () => { if (!done) res(null); }
    });
    o.pick = async v => { done = true; closeOv(o); res(/^shared:/.test(v) ? await adoptSession(v.slice(7)) : v); };
  });
}

// ---------- app shell ----------
let TAB = LS.get('tab', 'workout'), PSUB = LS.get('psub', 'planner'), PW = mondayOf(today()), FEEDN = 21;
const FEEDOPT = LS.get('feedopt', { whoopOnly: true, empty: false });
const LIBOPT = LS.get('libopt', { sort: 'recent', tag: '' });
const TITLES = { feed: 'Feed', program: 'Program', workout: 'Workout', home: 'Home' };

function renderTabs() {
  $('tabs').innerHTML = ['feed', 'program', 'workout', 'home'].map(t => `<button class="${TAB === t ? 'on' : ''}" data-a="tab" data-v="${t}">${ic(t, 24)}<span>${TITLES[t]}</span></button>`).join('');
}
function renderTop() {
  let right = '', sub = '';
  if (TAB === 'feed') right = `<button class="ibtn" data-a="feedMenu" aria-label="Options">${ic('menu')}${FEEDOPT.empty || !FEEDOPT.whoopOnly ? '<i></i>' : ''}</button>`;
  if (TAB === 'program' && PSUB !== 'blocks') right = `<button class="ibtn" data-a="${PSUB === 'planner' ? 'planMenu' : 'libMenu'}" aria-label="Options">${ic('menu')}${PSUB === 'sessions' && LIBOPT.tag ? '<i></i>' : ''}</button>`;
  if (TAB === 'workout') right = `<button class="ibtn" data-a="woMenu" aria-label="Options">${ic('menu')}</button>`;
  if (TAB === 'home') right = `<button class="ibtn" data-a="homeMenu" aria-label="Options">${ic('menu')}</button>`;
  if (TAB === 'workout' && ACT) sub = ACT.manual ? `Entered by hand · ${fmtD(ACT.date)}` : `<span id="elapsed">${mmss((Date.now() - ACT.startAt) / 1000)}</span> · ${esc(ACT.name)}`;
  else if (TAB === 'workout') sub = fmtLong(today());
  if (!ONLINE && serverMode()) sub = (sub ? sub + ' · ' : '') + '<span class="warn">Offline, will sync</span>';
  $('top').innerHTML = `<div class="row"><div class="grow"><h1>${TAB === 'workout' && ACT ? 'Workout' : TITLES[TAB]}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
}
function render() {
  renderTabs(); renderTop();
  const v = { feed: vFeed, program: vProgram, workout: vWorkout, home: vHome }[TAB];
  $('view').innerHTML = v();
  $('fab').style.display = TAB === 'workout' && !ACT ? 'grid' : 'none';
  $('fab').innerHTML = ic('plus', 28, 2.4);
  OV.forEach(o => { if (o.live) o.redraw(); });
}

// ---------- event delegation ----------
const A = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const f = A[el.dataset.a];
  if (el.dataset.close) closeOv(ovOf(el));
  if (f) { e.preventDefault(); f(el.dataset.v, el, e); }
});
A.tab = t => { if (TAB === t) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } TAB = t; LS.set('tab', t); render(); window.scrollTo(0, 0); };
A.askBtn = (v, el) => { const o = ovOf(el); if (o && o.pick) o.pick(+v); };
A.pickRes = (v, el) => { const o = ovOf(el); if (o && o.pick) o.pick(v); };
A.closeOv = (v, el) => closeOv(ovOf(el));

// =====================================================================
// FEED
// =====================================================================
const recCol = r => r >= 67 ? 'var(--green)' : r >= 34 ? 'var(--yellow)' : 'var(--red)';
const hm = ms => { const m = Math.round((ms || 0) / 60000); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const kcal = kj => kj ? Math.round(kj * 0.239006) : null;
const whoopFor = w => w && w.whoopId ? byId('WhoopWorkouts', w.whoopId) : null;

function vFeed() {
  const T = today();
  const linked = new Set(S.Workouts.map(w => w.whoopId).filter(Boolean));
  let html = '', shown = 0;
  for (let i = 0; i < FEEDN; i++) {
    const d = addDays(T, -i), wd = byId('WhoopDays', d);
    const wos = S.Workouts.filter(w => w.date === d).sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
    const wonly = FEEDOPT.whoopOnly ? S.WhoopWorkouts.filter(x => x.date === d && !linked.has(x.id)) : [];
    if (!wd && !wos.length && !wonly.length && !FEEDOPT.empty && d !== T) continue;
    shown++;
    html += dayCard(d, wd);
    const items = wos.map(w => ({ t: w.start || d, h: woCard(w) })).concat(wonly.map(x => ({ t: x.start, h: whoopOnlyCard(x) }))).sort((a, b) => String(b.t).localeCompare(String(a.t)));
    html += items.map(x => x.h).join('');
  }
  if (!shown) html += `<div class="empty"><b>Nothing here yet</b>Finish a workout or connect Whoop on Home.</div>`;
  return html + `<div style="text-align:center;margin-top:18px"><button class="btn gray sm" data-a="feedMore">Show earlier days</button></div>`;
}
function dayCard(d, wd) {
  if (!wd) return `<div class="sec" style="margin-top:22px"><span>${esc(relDay(d))}</span></div>`;
  const sl = wd.sleep || {};
  const sleepMs = sl.inBed ? sl.inBed - (sl.awake || 0) : null;
  return `<div class="card daycard"><div class="row"><div class="grow"><div class="date">${esc(relDay(d))}</div><div class="small muted">${fmtD(d)}</div></div>
    ${wd.recovery != null ? `<div class="rec" style="background:${recCol(wd.recovery)}22;color:${recCol(wd.recovery)}">${Math.round(wd.recovery)}%</div>` : ''}</div>
    <div class="kv">
      ${sleepMs ? `<div><span>Sleep</span><b>${hm(sleepMs)}</b>${sl.perf != null ? `<div class="small muted">${Math.round(sl.perf)}% perf</div>` : ''}</div>` : ''}
      ${wd.strain != null ? `<div><span>Strain</span><b>${(+wd.strain).toFixed(1)}</b></div>` : ''}
      ${wd.hrv != null ? `<div><span>HRV</span><b>${Math.round(wd.hrv)}</b><div class="small muted">ms</div></div>` : ''}
      ${wd.rhr != null ? `<div><span>Resting HR</span><b>${Math.round(wd.rhr)}</b><div class="small muted">bpm</div></div>` : ''}
    </div></div>`;
}
function woStats(w) {
  const cards = (w.log && w.log.cards) || [];
  const done = cards.filter(c => c.status === 'done').length, sk = cards.filter(c => c.status === 'skipped').length;
  return { done, sk, total: cards.length };
}
function woCard(w) {
  if (w.status === 'skipped') return `<div class="card wo tap" data-a="woOpen" data-v="${w.id}" style="opacity:.75"><div class="row"><span class="chip orange">Missed</span><div class="grow ell" style="font-weight:700">${esc(w.name)}</div></div>${w.note ? `<div class="small muted" style="margin-top:8px">${esc(w.note)}</div>` : ''}</div>`;
  const x = whoopFor(w), st = woStats(w), dur = w.start && w.end ? (Date.parse(w.end) - Date.parse(w.start)) / 1000 : 0;
  return `<div class="card wo tap" data-a="woOpen" data-v="${w.id}">
    <button class="ibtn corner" data-a="woExport" data-v="${w.id}" aria-label="Export data">${ic('share', 19)}</button>
    <div class="fmt">${w.manual ? 'Workout · entered by hand' : 'Workout'}</div>
    <h3 style="margin-top:4px;padding-right:46px">${esc(w.name)}</h3>
    <div class="small muted" style="margin-top:2px">${w.start ? fmtClock(w.start) + (w.end ? '–' + fmtClock(w.end) : '') : ''}${dur ? ' · ' + durTxt(dur) : ''}</div>
    <div class="statline"><span><b>${st.done}</b>/${st.total} done</span>${st.sk ? `<span class="warn"><b>${st.sk}</b> skipped</span>` : ''}
      ${x ? `<span><b>${x.strain != null ? (+x.strain).toFixed(1) : '–'}</b> strain</span><span><b>${x.avgHr || '–'}</b> avg HR</span>${x.kj ? `<span><b>${kcal(x.kj)}</b> kcal</span>` : ''}` : ''}</div>
    ${w.photo ? `<img class="photo" src="${esc(photoUrl(w.photo))}" alt="" loading="lazy">` : ''}</div>`;
}
function whoopOnlyCard(x) {
  const dur = (Date.parse(x.end) - Date.parse(x.start)) / 1000;
  return `<div class="card tap" data-a="whoopOpen" data-v="${esc(x.id)}"><div class="fmt" style="color:var(--blue)">Whoop</div><h3 style="margin-top:4px">${esc(x.sport)}</h3>
    <div class="small muted">${fmtClock(x.start)}–${fmtClock(x.end)} · ${durTxt(dur)}</div>
    <div class="statline"><span><b>${x.strain != null ? (+x.strain).toFixed(1) : '–'}</b> strain</span><span><b>${x.avgHr || '–'}</b> avg HR</span><span><b>${x.maxHr || '–'}</b> max</span>${x.kj ? `<span><b>${kcal(x.kj)}</b> kcal</span>` : ''}</div></div>`;
}
const photoUrl = p => /^data:/.test(p) ? p : `https://drive.google.com/thumbnail?id=${encodeURIComponent(p)}&sz=w1200`;
A.feedMore = () => { FEEDN += 21; render(); };
A.feedMenu = () => menu('Feed', [
  { label: 'Show Whoop-only workouts', a: 'feedOpt', v: 'whoopOnly', on: FEEDOPT.whoopOnly },
  { label: 'Show days with nothing logged', a: 'feedOpt', v: 'empty', on: FEEDOPT.empty },
  WHOOP.connected ? { label: 'Sync Whoop now', a: 'whoopSyncNow' } : null
]);
A.feedOpt = k => { FEEDOPT[k] = !FEEDOPT[k]; LS.set('feedopt', FEEDOPT); render(); };

// Workout detail
A.woOpen = (id, el, e) => {
  if (e && e.target.closest('[data-a="woExport"]')) return;
  const o = openOv({
    full: true, live: true,
    render: () => {
      const w = byId('Workouts', id);
      if (!w) return `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button><div class="t"></div></div><div class="empty">Deleted.</div>`;
      const x = whoopFor(w), cards = (w.log && w.log.cards) || [];
      const dur = w.start && w.end ? (Date.parse(w.end) - Date.parse(w.start)) / 1000 : 0;
      const sameDay = S.WhoopWorkouts.filter(y => y.date === w.date);
      return `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button><div class="t">${fmtD(w.date)}</div><button class="ibtn" data-a="woMenu2" data-v="${w.id}">${ic('menu')}</button></div>
      <div class="fbody">
        <h1 style="margin:6px 0 4px;font-size:28px;letter-spacing:-.02em">${esc(w.name)}</h1>
        <div class="muted">${w.status === 'skipped' ? 'Missed' : (w.start ? fmtClock(w.start) + (w.end ? '–' + fmtClock(w.end) : '') : '') + (dur ? ' · ' + durTxt(dur) : '')}${w.manual ? ' · entered by hand' : ''}</div>
        ${w.status !== 'skipped' ? `<button class="btn block" style="margin-top:16px" data-a="woExport" data-v="${w.id}">${ic('share', 19)}Export data</button>` : ''}
        ${w.status !== 'skipped' ? `<div class="card"><div class="row"><div class="grow"><div class="fmt" style="color:var(--blue)">Whoop</div>
          ${x ? `<b>${esc(x.sport)}</b> <span class="small muted">${fmtClock(x.start)}–${fmtClock(x.end)}${w.whoopLink === 'auto' ? ' · matched by time' : ''}</span>` : `<span class="muted small">${sameDay.length ? 'Not linked' : 'No Whoop workout that day'}</span>`}</div>
          ${x ? `<button class="chip" data-a="woUnlink" data-v="${w.id}">Unlink</button>` : sameDay.length ? `<button class="chip lime" data-a="woLink" data-v="${w.id}">${ic('link', 15)}Link</button>` : ''}</div>
          ${x ? `<div class="kv"><div><span>Strain</span><b>${x.strain != null ? (+x.strain).toFixed(1) : '–'}</b></div><div><span>Avg HR</span><b>${x.avgHr || '–'}</b></div><div><span>Max HR</span><b>${x.maxHr || '–'}</b></div>${x.kj ? `<div><span>Calories</span><b>${kcal(x.kj)}</b></div>` : ''}${x.dist ? `<div><span>Distance</span><b>${(x.dist / 1000).toFixed(2)}</b><div class="small muted">km</div></div>` : ''}</div>` : ''}</div>` : ''}
        ${cards.length ? `<div class="sec">What was done</div>${cards.map(c => `<div class="pcard"><div class="row"><div class="grow ttl">${esc(c.title)}</div><span class="chip ${c.status === 'done' ? 'lime' : c.status === 'skipped' ? 'orange' : ''}">${c.status === 'done' ? 'Done' : c.status === 'skipped' ? 'Skipped' : 'Not done'}</span></div><div class="ln">${esc(logLine(c))}</div>${c.note ? `<div class="ln warn">${esc(c.note)}</div>` : ''}</div>`).join('')}` : ''}
        ${w.notes || w.note ? `<div class="sec">Notes</div><div class="card" style="margin-top:0;white-space:pre-wrap">${esc(w.notes || w.note)}</div>` : ''}
        ${w.photo ? `<img class="photo" style="width:100%;border-radius:16px;margin-top:12px" src="${esc(photoUrl(w.photo))}" alt="">` : ''}
      </div>`;
    }
  });
};
A.woMenu2 = id => menu('Workout', [{ label: 'Edit notes', a: 'woNotes', v: id }, { label: 'Add or change photo', a: 'woPhoto', v: id }, { label: 'Delete workout', a: 'woDelete', v: id, danger: true }]);
A.woNotes = async id => { const w = byId('Workouts', id); const r = await ask({ title: 'Notes', input: { area: true, value: w.notes || w.note || '' }, buttons: [{ label: 'Save', v: 'ok' }] }); if (r) write({ t: 'Workouts', row: Object.assign({}, w, { notes: r.text }) }); };
A.woPhoto = async id => { const p = await pickPhoto(); if (p) { const w = byId('Workouts', id); write({ t: 'Workouts', row: Object.assign({}, w, { photo: p }) }); } };
A.woDelete = async id => { const r = await ask({ title: 'Delete this workout?', body: 'This cannot be undone.', buttons: [{ label: 'Cancel', v: 'no', cls: 'gray' }, { label: 'Delete', v: 'yes', cls: 'danger' }] }); if (r && r.v === 'yes') { await write({ t: 'Workouts', del: id }); closeOv(OV.find(o => o.live && o.full)); } };
A.woUnlink = id => { const w = byId('Workouts', id); write({ t: 'Workouts', row: Object.assign({}, w, { whoopId: '', whoopLink: 'none' }) }); };
A.woLink = id => {
  const w = byId('Workouts', id), used = new Set(S.Workouts.map(x => x.whoopId).filter(Boolean));
  const list = S.WhoopWorkouts.filter(y => y.date === w.date);
  menu('Link a Whoop workout', list.map(y => ({ label: `${y.sport} · ${fmtClock(y.start)}–${fmtClock(y.end)}${used.has(y.id) ? ' (linked elsewhere)' : ''}`, a: 'woLinkTo', v: id + '|' + y.id })));
};
A.woLinkTo = v => {
  const [id, xid] = v.split('|'), ops = [];
  S.Workouts.filter(x => x.whoopId === xid && x.id !== id).forEach(x => ops.push({ t: 'Workouts', row: Object.assign({}, x, { whoopId: '', whoopLink: 'none' }) }));
  const w = byId('Workouts', id), y = byId('WhoopWorkouts', xid);
  ops.push({ t: 'Workouts', row: Object.assign({}, w, { whoopId: xid, whoopLink: 'manual' }, w.manual ? { start: y.start, end: y.end } : {}) });
  write(ops);
};
A.whoopOpen = id => {
  const x = byId('WhoopWorkouts', id), mine = S.Workouts.filter(w => w.date === x.date && w.status === 'done');
  menu(`${x.sport} · ${fmtClock(x.start)}`, [{ html: `<div class="kv" style="margin-bottom:10px"><div><span>Strain</span><b>${x.strain != null ? (+x.strain).toFixed(1) : '–'}</b></div><div><span>Avg HR</span><b>${x.avgHr || '–'}</b></div><div><span>Max HR</span><b>${x.maxHr || '–'}</b></div>${x.kj ? `<div><span>Calories</span><b>${kcal(x.kj)}</b></div>` : ''}</div>` }]
    .concat(mine.map(w => ({ label: `Link to “${w.name}”`, a: 'woLinkTo', v: w.id + '|' + id }))));
};

// Export
function logLine(c) {
  if (c.status === 'skipped') return 'Skipped' + (c.note ? ` (${c.note})` : '');
  const r = c.result || {};
  if (c.sets && c.sets.length) {
    const done = c.sets.filter(s => s.done);
    if (!done.length) return c.summary || '';
    const fmtSet = s => `${s.reps || s.time || ''}${s.load !== '' && s.load != null ? ' @ ' + s.load + (/^[\d.]+$/.test(String(s.load)) ? ' ' + (s.unit || UNIT()) : '') : ''}`;
    const all = done.map(fmtSet), same = all.every(x => x === all[0]);
    return same ? `${done.length} × ${all[0]}` : all.join(', ');
  }
  const bits = [];
  if (r.time) bits.push(mmss(r.time));
  if (r.rounds != null && r.rounds !== '') bits.push(`${r.rounds} round${+r.rounds === 1 ? '' : 's'}${r.reps ? ' + ' + r.reps + ' reps' : ''}`);
  if (r.minutes) bits.push(`${r.minutes} minutes`);
  if (r.dist) bits.push(r.dist);
  if (r.laps && r.laps.length) bits.push('splits ' + r.laps.map(mmss).join(', '));
  if (r.note) bits.push(r.note);
  return bits.length ? bits.join(' · ') + (c.summary ? ` (${c.summary})` : '') : c.summary || '';
}
function exportText(w) {
  const x = whoopFor(w), cards = (w.log && w.log.cards) || [];
  const dur = w.start && w.end ? Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000) : null;
  const L = [];
  L.push(`Workout: ${w.name}`);
  L.push(`${fmtLong(w.date)}${w.start ? `, ${fmtClock(w.start)}${w.end ? '–' + fmtClock(w.end) : ''}` : ''}${dur ? ` (${dur} min)` : ''}${w.manual ? ', logged by hand' : ''}.`);
  L.push('');
  const done = cards.filter(c => c.status === 'done'), sk = cards.filter(c => c.status === 'skipped'), nd = cards.filter(c => !c.status);
  done.forEach(c => L.push(`- ${c.title}: ${logLine(c)}`));
  if (sk.length) { L.push(''); L.push('Skipped: ' + sk.map(c => c.title + (c.note ? ` (${c.note})` : '')).join('; ') + '.'); }
  if (nd.length) L.push('Not done: ' + nd.map(c => c.title).join('; ') + '.');
  if (w.notes) { L.push(''); L.push('Notes: ' + w.notes); }
  if (x) { L.push(''); L.push(`Whoop (${x.sport}): strain ${x.strain != null ? (+x.strain).toFixed(1) : '–'}, average HR ${x.avgHr || '–'}, max HR ${x.maxHr || '–'}${x.kj ? `, ${kcal(x.kj)} kcal` : ''}.`); }
  return L.join('\n');
}
A.woExport = (id, el, e) => {
  if (e) e.stopPropagation();
  const w = byId('Workouts', id), txt = exportText(w);
  openOv({ render: () => `<h2>Export data</h2><div class="muted small" style="margin-bottom:12px">A short log you can paste into Whoop's coach or anywhere else.</div><div class="export" id="expTxt">${esc(txt)}</div><button class="btn block" style="margin-top:14px" data-a="copyExport" data-v="${id}">${ic('copy', 19)}Copy</button>` });
};
A.copyExport = async id => { const txt = exportText(byId('Workouts', id)); try { await navigator.clipboard.writeText(txt); toast('Copied'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('expTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selected. Tap Copy.'); } };

// Whoop matching: an app workout and a Whoop workout that overlap in time are linked (allowing 15 min either side).
function autoMatch() {
  const used = new Set(S.Workouts.map(w => w.whoopId).filter(Boolean)), ops = [];
  S.Workouts.filter(w => w.status === 'done' && !w.whoopLink && w.start && w.end).forEach(w => {
    const a = Date.parse(w.start) - 15 * 60000, b = Date.parse(w.end) + 15 * 60000;
    let best = null, bestOv = 0;
    S.WhoopWorkouts.forEach(x => {
      if (used.has(x.id)) return;
      const ov = Math.min(b, Date.parse(x.end)) - Math.max(a, Date.parse(x.start));
      if (ov > bestOv) { bestOv = ov; best = x; }
    });
    if (best) { used.add(best.id); ops.push({ t: 'Workouts', row: Object.assign({}, w, { whoopId: best.id, whoopLink: 'auto' }, w.manual ? { start: best.start, end: best.end } : {}) }); }
  });
  if (ops.length) write(ops);
}

// =====================================================================
// HOME
// =====================================================================
const MTYPES = () => [['Weight', UNIT()], ['Height', UNIT() === 'kg' ? 'cm' : 'in'], ['Resting HR', 'bpm'], ['Max HR', 'bpm']].concat((setting('mtypes', []) || []).map(t => [t.name, t.unit || '']));
const latestM = type => S.Measurements.filter(m => m.type === type).sort((a, b) => (b.date + b.updated).localeCompare(a.date + a.updated))[0];
function vHome() {
  const wd = WHOOP;
  return `
  <div class="card"><div class="row"><div class="grow"><h3>${esc(ME || 'You')}</h3><div class="small muted">${serverMode() ? (ONLINE ? 'Synced with your Google Sheet' : 'Offline, changes will sync') : 'Saved on this phone only (back end not set up yet)'}</div></div></div></div>

  <div class="sec">Whoop</div>
  <div class="card">${!serverMode() ? `<div class="muted small">Connecting Whoop needs the back end. Follow backend/SETUP.md, then open the app from your personal link.</div><button class="btn block gray" style="margin-top:12px" disabled>Connect Whoop</button>`
    : wd.connected ? `<div class="row"><div class="rec" style="background:rgba(198,244,50,.12);color:var(--lime);width:44px;height:44px">${ic('heart', 22)}</div><div class="grow"><b>Whoop connected</b><div class="small muted">${wd.lastSync ? 'Last sync ' + new Date(wd.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'}</div></div></div>
      <div class="btns"><button class="btn gray sm" data-a="whoopSyncNow">${ic('sync', 17)}Sync now</button><button class="btn ghost sm" data-a="whoopDisconnect">Disconnect</button></div>`
    : `<div class="muted small">Bring in sleep, recovery, strain and workouts. You'll sign in to Whoop and come back here.</div><button class="btn block" style="margin-top:14px" data-a="whoopConnect">${ic('heart', 19)}Connect Whoop</button>`}</div>

  <div class="sec"><span>Measurements</span><a class="small" data-a="mTypeAdd">+ Type</a></div>
  <div class="card" style="padding:4px 16px">${MTYPES().map(([t, u]) => { const m = latestM(t); return `<div class="list-item tap" data-a="mOpen" data-v="${esc(t)}"><div class="grow"><b>${esc(t)}</b><div class="small muted">${m ? fmtD(m.date) + (m.src === 'whoop' ? ' · from Whoop' : '') : 'No entries yet'}</div></div><div style="font-weight:800;font-size:18px">${m ? esc(fmtMeas(t, m.value)) + ` <span class="small muted">${esc(t === 'Height' && u === 'in' ? '' : (m.unit || u))}</span>` : ''}</div>${ic('chev', 18)}</div>`; }).join('')}</div>

  <div class="sec"><span>Maxes</span><a class="small" data-a="maxEdit">+ Add</a></div>
  <div class="card" style="padding:4px 16px">${S.Maxes.length ? S.Maxes.slice().sort((a, b) => a.exercise.localeCompare(b.exercise)).map(m => `<div class="list-item tap" data-a="maxEdit" data-v="${m.id}"><div class="grow"><b>${esc(m.exercise)}</b><div class="small muted">${m.date ? 'Updated ' + fmtMD(m.date) : ''}</div></div><div class="small" style="text-align:right">${m.oneRm ? `<b>${m.oneRm}</b> 1RM` : ''}${m.oneRm && m.tm ? '<br>' : ''}${m.tm ? `<b>${m.tm}</b> TM` : ''} <span class="muted">${esc(m.unit || UNIT())}</span></div></div>`).join('') : `<div class="small muted" style="padding:12px 0">Used to turn percentages like “75% TM” into real weights.</div>`}</div>

  <div class="sec">Settings</div>
  <div class="card">
    <div class="lbl" style="margin-top:0">Units</div><div class="seg">${['lb', 'kg'].map(u => `<button class="${UNIT() === u ? 'on' : ''}" data-a="setUnit" data-v="${u}">${u}</button>`).join('')}</div>
    <div class="lbl">Round percentage weights to</div><div class="seg">${(UNIT() === 'kg' ? [2.5, 1, 0.5] : [5, 2.5, 1]).map(s => `<button class="${roundStep() === s ? 'on' : ''}" data-a="setRound" data-v="${s}">${s} ${UNIT()}</button>`).join('')}</div>
    <div class="lbl">Default rest between sets</div><div class="seg">${[60, 90, 120, 180].map(s => `<button class="${+setting('rest', 90) === s ? 'on' : ''}" data-a="setRest" data-v="${s}">${mmss(s)}</button>`).join('')}</div>
  </div>

  <div class="sec">Import from an LLM</div>
  <div class="card"><div class="small muted">Give this guide to ChatGPT, Claude or any other assistant along with your workout. Paste what it returns into Program → Sessions → Import.</div>
    <div class="btns"><a class="btn gray sm" href="syntax.txt" download="MH-Lift-session-syntax.txt">Download guide</a><button class="btn gray sm" data-a="copyGuide">${ic('copy', 17)}Copy guide</button></div></div>
  <div class="small dim" style="text-align:center;margin-top:24px">MH Lift</div>`;
}
const fmtMeas = (t, v) => t === 'Height' && UNIT() === 'lb' ? `${Math.floor(v / 12)}′${Math.round(v % 12)}″` : (Math.round(v * 10) / 10);
A.homeMenu = () => menu('Home', [{ label: 'Add a measurement type', a: 'mTypeAdd' }, serverMode() ? { label: 'Reload data from the Sheet', a: 'reload' } : null, WHOOP.connected ? { label: 'Sync Whoop now', a: 'whoopSyncNow' } : null]);
A.reload = () => { loadServer(); toast('Reloading'); };
A.setUnit = u => setSetting('unit', u).then(() => setSetting('round', u === 'kg' ? 2.5 : 5));
A.setRound = s => setSetting('round', +s);
A.setRest = s => setSetting('rest', +s);
A.copyGuide = async () => { try { const t = await (await fetch('syntax.txt')).text(); await navigator.clipboard.writeText(t); toast('Guide copied'); } catch (e) { toast('Could not copy. Use Download instead.'); } };
A.mTypeAdd = async () => {
  const r = await ask({ title: 'New measurement', input: { ph: 'Name, e.g. Waist' }, buttons: [{ label: 'Next', v: 'ok' }] }); if (!r || !r.text) return;
  const u = await ask({ title: 'Unit', input: { ph: 'e.g. in, %, cm (optional)', focus: true }, buttons: [{ label: 'Add', v: 'ok' }] });
  setSetting('mtypes', (setting('mtypes', []) || []).concat([{ name: r.text, unit: u ? u.text : '' }]));
};
A.mOpen = type => {
  const unit = (MTYPES().find(x => x[0] === type) || [])[1] || '';
  const o = openOv({
    live: true,
    render: () => {
      const list = S.Measurements.filter(m => m.type === type).sort((a, b) => b.date.localeCompare(a.date));
      return `<h2>${esc(type)}</h2>
        <div class="row" style="margin-top:10px"><input id="mDate" type="date" value="${today()}" style="flex:1.2"><input id="mVal" type="number" inputmode="decimal" step="any" placeholder="${type === 'Height' && unit === 'in' ? 'inches' : esc(unit)}" style="flex:1"></div>
        <button class="btn block" style="margin-top:10px" data-a="mAdd" data-v="${esc(type)}">Add entry</button>
        <div style="margin-top:12px">${list.map(m => `<div class="list-item"><div class="grow">${fmtD(m.date)}${m.src === 'whoop' ? ' <span class="small muted">· Whoop</span>' : ''}</div><b>${esc(fmtMeas(type, m.value))} <span class="small muted">${esc(m.unit || '')}</span></b><button class="ibtn" style="width:32px;height:32px;background:none" data-a="mDel" data-v="${m.id}">${ic('close', 16)}</button></div>`).join('') || '<div class="small muted">No entries yet.</div>'}</div>
        ${(setting('mtypes', []) || []).some(t => t.name === type) ? `<button class="btn ghost block sm" data-a="mTypeDel" data-v="${esc(type)}" data-close="1">Remove this measurement type</button>` : ''}`;
    }
  });
  o.unit = unit;
};
A.mAdd = (type, el) => {
  const o = ovOf(el), v = parseFloat(o.box.querySelector('#mVal').value), d = o.box.querySelector('#mDate').value || today();
  if (isNaN(v)) return toast('Enter a number');
  write({ t: 'Measurements', row: { id: uid(), date: d, type, value: v, unit: o.unit } });
};
A.mDel = id => write({ t: 'Measurements', del: id });
A.mTypeDel = type => setSetting('mtypes', (setting('mtypes', []) || []).filter(t => t.name !== type));
A.maxEdit = id => {
  const m = id ? byId('Maxes', id) : { exercise: '', oneRm: '', tm: '', unit: UNIT() };
  const names = [...new Set(S.Sessions.flatMap(s => allCards(parsed(s)).flatMap(({ c }) => c.steps.map(st => st.name))))].sort();
  openOv({
    render: () => `<h2>${id ? 'Edit max' : 'Add a max'}</h2>
      <div class="lbl">Exercise</div><input id="mxEx" list="exNames" value="${esc(m.exercise)}" placeholder="e.g. Back Squat"><datalist id="exNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="row"><div class="grow"><div class="lbl">1 rep max</div><input id="mx1" type="number" inputmode="decimal" value="${esc(m.oneRm)}"></div><div class="grow"><div class="lbl">Training max</div><input id="mxT" type="number" inputmode="decimal" value="${esc(m.tm)}" placeholder="90% of 1RM"></div></div>
      <div class="small muted" style="margin-top:8px">Weights in ${esc(m.unit || UNIT())}. Leave training max blank to use 90% of your 1RM.</div>
      <div class="btns">${id ? `<button class="btn danger" data-a="maxDel" data-v="${id}" data-close="1">Delete</button>` : ''}<button class="btn" data-a="maxSave" data-v="${id || ''}">Save</button></div>`
  });
};
A.maxSave = (id, el) => {
  const o = ovOf(el), ex = o.box.querySelector('#mxEx').value.trim(); if (!ex) return toast('Name the exercise');
  const one = parseFloat(o.box.querySelector('#mx1').value) || '', tm = parseFloat(o.box.querySelector('#mxT').value) || '';
  const old = id ? byId('Maxes', id) : null;
  write({ t: 'Maxes', row: { id: id || uid(), exercise: ex, oneRm: one, tm, unit: (old && old.unit) || UNIT(), date: today() } }); closeOv(o);
};
A.maxDel = id => write({ t: 'Maxes', del: id });

// Whoop actions
A.whoopConnect = async () => { try { const j = await api('whoop_start'); location.href = j.url; } catch (e) { toast(e.message); } };
A.whoopDisconnect = async () => { const r = await ask({ title: 'Disconnect Whoop?', body: 'Data already brought in stays. New data stops coming in.', buttons: [{ label: 'Cancel', v: 'no', cls: 'gray' }, { label: 'Disconnect', v: 'yes', cls: 'danger' }] }); if (r && r.v === 'yes') { try { await api('whoop_disconnect'); render(); } catch (e) { toast(e.message); } } };
A.whoopSyncNow = () => whoopSync(false);
async function whoopSync(quiet) {
  if (!quiet) toast('Syncing Whoop…');
  try {
    const j = await api('whoop_sync');
    if (j.tables) Object.keys(j.tables).forEach(t => { S[t] = j.tables[t]; });
    QUEUE.forEach(applyOp); persist(); afterData(); render();
    if (!quiet) toast('Whoop synced');
  } catch (e) { if (!quiet) toast(e.message); }
}
/** Fill measurements from Whoop: resting HR per day, and body measurements when they change. */
function whoopMeasurements() {
  const ops = [];
  S.WhoopDays.forEach(d => { if (d.rhr && !byId('Measurements', 'whoop-rhr-' + d.id)) ops.push({ t: 'Measurements', row: { id: 'whoop-rhr-' + d.id, date: d.id, type: 'Resting HR', value: Math.round(d.rhr), unit: 'bpm', src: 'whoop' } }); });
  const b = setting('whoopBody', null);
  if (b) {
    const kg = UNIT() === 'kg';
    const vals = [['Weight', b.weight ? (kg ? b.weight : b.weight * 2.20462) : null, UNIT()], ['Height', b.height ? (kg ? b.height * 100 : b.height * 39.3701) : null, kg ? 'cm' : 'in'], ['Max HR', b.maxHr, 'bpm']];
    vals.forEach(([type, v, unit]) => {
      if (!v) return; v = Math.round(v * 10) / 10;
      const last = latestM(type);
      if (!last || Math.abs(last.value - v) >= 0.5) ops.push({ t: 'Measurements', row: { id: uid(), date: today(), type, value: v, unit, src: 'whoop' } });
    });
  }
  if (ops.length) write(ops);
}
function afterData() { autoMatch(); whoopMeasurements(); }
