// MH Lift: Program tab (Sessions, Blocks, Planner).
'use strict';

function vProgram() {
  const seg = `<div class="seg" style="margin-top:4px">${[['sessions', 'Sessions'], ['blocks', 'Blocks'], ['planner', 'Planner']].map(([k, l]) => `<button class="${PSUB === k ? 'on' : ''}" data-a="psub" data-v="${k}">${l}</button>`).join('')}</div>`;
  return seg + ({ sessions: vSessions, blocks: vBlocks, planner: vPlanner })[PSUB]();
}
A.psub = k => { PSUB = k; LS.set('psub', k); render(); };

// =====================================================================
// SESSIONS
// =====================================================================
function vSessions() {
  let list = S.Sessions.slice();
  if (LIBOPT.tag) list = list.filter(s => (s.tags || []).includes(LIBOPT.tag));
  const sorters = {
    recent: (a, b) => (lastDone(b.id) || b.created || '').toString().localeCompare((lastDone(a.id) || a.created || '').toString()),
    name: (a, b) => a.name.localeCompare(b.name),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    last: (a, b) => (lastDone(a.id) || '0').localeCompare(lastDone(b.id) || '0')
  };
  list.sort(sorters[LIBOPT.sort] || sorters.recent);
  const mine = new Set(S.Sessions.map(s => s.fromShared).filter(Boolean));
  const shared = LIBOPT.shared !== false ? SHARED.Sessions.filter(s => !mine.has(s.owner + '|' + s.id) && (!LIBOPT.tag || (s.tags || []).includes(LIBOPT.tag))) : [];
  return `<div class="btns" style="margin-top:12px"><button class="btn sm" data-a="sesNew">${ic('plus', 18)}New session</button><button class="btn gray sm" data-a="sesImport">Import from LLM</button></div>
    ${LIBOPT.tag ? `<div class="small muted" style="margin-top:12px">Tag: <b style="color:var(--text)">${esc(LIBOPT.tag)}</b> · <a data-a="libTag" data-v="">Show all</a></div>` : ''}
    ${list.map(s => {
      const p = parsed(s), ld = lastDone(s.id), n = allCards(p).length;
      return `<div class="card tap" data-a="sesOpen" data-v="${s.id}"><div class="row"><h3 class="grow ell">${esc(s.name)}</h3>${s.public ? '<span class="chip blue" style="font-size:11px">Public</span>' : ''}${s.rating ? stars(s.rating) : ''}</div>
        <div class="small muted" style="margin-top:4px">${estMin(p)} min · ${n} card${n === 1 ? '' : 's'} · ${ld ? 'Last done ' + fmtMD(ld) : 'Not done yet'}</div>
        ${(s.tags || []).length ? `<div class="chips" style="margin-top:10px">${s.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
    }).join('') || `<div class="empty"><b>No sessions yet</b>Create one, or import one written by an LLM.</div>`}
    ${shared.length ? `<div class="sec">Shared by others</div><div class="card" style="padding:4px 16px">${shared.map(s => sharedRow(s, 'sesAdopt')).join('')}</div>` : ''}`;
}
A.libMenu = () => {
  const tags = [...new Set(S.Sessions.flatMap(s => s.tags || []))].sort();
  menu('Sessions', [{ html: '<div class="lbl" style="margin-top:0">Sort by</div>' },
    ...[['recent', 'Recently used'], ['name', 'Name'], ['rating', 'Rating'], ['last', 'Longest since done']].map(([k, l]) => ({ label: l, a: 'libSort', v: k, on: LIBOPT.sort === k })),
    { html: '<div class="lbl">Show</div>' }, { label: 'Public sessions from others', a: 'libShared', on: LIBOPT.shared !== false },
    tags.length ? { html: '<div class="lbl">Tag</div>' } : null,
    ...tags.map(t => ({ label: t, a: 'libTag', v: t, on: LIBOPT.tag === t }))]);
};
A.sesAdopt = async v => { const id = await adoptSession(v.slice(7)); if (id) A.sesOpen(id); };
A.libShared = () => { LIBOPT.shared = LIBOPT.shared === false; LS.set('libopt', LIBOPT); render(); };
A.libSort = k => { LIBOPT.sort = k; LS.set('libopt', LIBOPT); render(); };
A.libTag = t => { LIBOPT.tag = LIBOPT.tag === t ? '' : t; LS.set('libopt', LIBOPT); render(); };

/** Session preview: phases and cards. */
function sessionBody(p, opts = {}) {
  return (p.notes || []).map(n => `<div class="hint">${esc(n)}</div>`).join('') + p.phases.map(ph => `<div class="phase">${esc(ph.name)}</div>${ph.cards.map(c => `<div class="pcard">
    <div class="fmt">${FMT[c.format] || c.format}</div><div class="ttl">${esc(cardTitle(c))}</div><div class="ln">${esc(cardSummary(c))}</div>
    ${c.format !== 'straight' && c.steps.length > 1 && opts.steps !== false ? c.steps.map(st => `<div class="ln">· ${esc(stepText(st))}${st.slot ? ` <span class="dim">(${esc(st.slot)})</span>` : ''}</div>`).join('') : ''}
    ${c.notes.map(n => `<div class="ln" style="color:var(--text)">${esc(n)}</div>`).join('')}</div>`).join('')}`).join('');
}

A.sesOpen = (id, el, e, ctx) => {
  openOv({
    full: true, live: true,
    render: () => {
      const s = byId('Sessions', id);
      if (!s) return `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button></div><div class="empty">Deleted.</div>`;
      const p = parsed(s), ld = lastDone(id);
      const st = ctx ? dayStatus(ctx.d, id) : '';
      return `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button><div class="t">${ctx ? esc(relDay(ctx.d)) : ''}</div><button class="ibtn" data-a="sesMenu" data-v="${ctx ? `${id}|${ctx.d}|${ctx.j}` : id}">${ic('menu')}</button></div>
      <div class="fbody">
        <div class="hero lime"><div class="fmt">${ctx ? `Planned · ${esc(fmtD(ctx.d))}${st === 'done' ? ' · done' : st === 'skipped' ? ' · missed' : ''}` : 'Session'}</div>
        <h1>${esc(s.name)}</h1><div class="muted">${estMin(p)} min · ${allCards(p).length} card${allCards(p).length === 1 ? '' : 's'}</div></div>
        <div style="height:12px"></div>
        <div class="row">${stars(s.rating, 'sesRate')}<span class="small muted">${ld ? 'Last done ' + fmtMD(ld) : 'Not done yet'}</span></div>
        ${s.public || s.shared ? `<div class="chips" style="margin-top:10px">${s.public ? '<span class="chip blue">Public</span>' : ''}${s.shared ? '<span class="chip">Copied from a public session</span>' : ''}</div>` : ''}
        ${(s.tags || []).length ? `<div class="chips" style="margin-top:12px">${s.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${sessionBody(p)}
        <div class="sec">Comments</div>
        ${(s.comments || []).map((c, i) => `<div class="card" style="margin:8px 0"><div class="small muted">${fmtD(c.date)}</div><div style="white-space:pre-wrap;margin-top:2px">${esc(c.text)}</div></div>`).join('') || '<div class="small muted">No comments yet.</div>'}
        <div class="row" style="margin-top:10px"><input id="cmIn" placeholder="Add a comment"><button class="btn sm" data-a="sesComment" data-v="${id}">Add</button></div>
      </div>
      <div class="fbottom"><div class="btns" style="margin:0">${ctx
        ? `<button class="btn gray" data-a="dayMove" data-v="${ctx.d}|${ctx.j}">Move</button>${!st && ctx.d <= today() ? `<button class="btn" data-a="dayStart" data-v="${ctx.d}|${id}" data-close="1">${ic('play', 18)}${ctx.d === today() ? 'Start' : 'Log it'}</button>` : `<button class="btn" data-a="sesStart" data-v="${id}">${ic('play', 18)}Start</button>`}`
        : `<button class="btn gray" data-a="sesToPlan" data-v="${id}">Add to planner</button><button class="btn" data-a="sesStart" data-v="${id}">${ic('play', 18)}Start</button>`}</div></div>`;
    }
  }).sid = id;
};
A.sesRate = (n, el) => { const o = ovOf(el), s = byId('Sessions', o.sid); write({ t: 'Sessions', row: Object.assign({}, s, { rating: s.rating === +n ? 0 : +n }) }); };
A.sesComment = (id, el) => { const o = ovOf(el), t = o.box.querySelector('#cmIn').value.trim(); if (!t) return; const s = byId('Sessions', id); write({ t: 'Sessions', row: Object.assign({}, s, { comments: (s.comments || []).concat([{ date: today(), text: t }]) }) }); };
A.sesMenu = v => {
  const [id, d, j] = v.split('|');
  menu('', [d ? { label: 'Move to another day', a: 'dayMove', v: d + '|' + j } : null, d && isChanged(d) ? { label: 'Reset day to block', a: 'dayReset', v: d } : null,
    d ? { label: 'Remove from ' + fmtD(d), a: 'dayRemoveClose', v: d + '|' + j, danger: true } : null,
    d ? { html: '<div class="lbl">Session</div>' } : null,
    { label: 'Edit', a: 'sesEdit', v: id }, { label: 'Duplicate', a: 'sesDup', v: id }, { label: 'Delete session', a: 'sesDel', v: id, danger: true }]);
};
A.dayRemoveClose = async v => { closeOv(OV.find(o => o.full)); await A.dayRemove(v); };
A.sesDup = id => { const s = byId('Sessions', id); write({ t: 'Sessions', row: Object.assign({}, s, { id: uid(), name: s.name + ' (copy)', rating: 0, comments: [], created: Date.now() }) }); toast('Duplicated'); };
A.sesDel = async id => {
  const r = await ask({ title: 'Delete this session?', body: 'Past workouts stay in your Feed. It will be removed from blocks and future planner days.', buttons: [{ label: 'Cancel', v: 'no', cls: 'gray' }, { label: 'Delete', v: 'yes', cls: 'danger' }] });
  if (!r || r.v !== 'yes') return;
  const T = today(), ops = [{ t: 'Sessions', del: id }];
  S.Blocks.filter(b => b.days.some(d => d.includes(id))).forEach(b => { ops.push(...snapshotPastOps(b.id)); ops.push({ t: 'Blocks', row: Object.assign({}, b, { days: b.days.map(d => d.filter(x => x !== id)) }) }); });
  S.PlanDays.filter(d => d.id >= T && (d.items || []).includes(id)).forEach(d => ops.push({ t: 'PlanDays', row: Object.assign({}, d, { items: d.items.filter(x => x !== id) }) }));
  await write(ops); closeOv(OV.find(o => o.sid === id));
};
A.sesToPlan = async id => {
  const r = await ask({ title: 'Add to which day?', input: { type: 'date', value: today(), focus: false }, buttons: [{ label: 'Add', v: 'ok' }] });
  if (!r || !r.text) return;
  await editDays({ [r.text]: planFor(r.text).filter(x => x !== 'rest').concat([id]) });
  toast('Added to ' + fmtD(r.text));
};
A.sesStart = id => { OV.slice().forEach(o => closeOv(o)); startWorkout({ sessionId: id }); };

// Editor: name, tags, syntax text with live preview. Format chips insert a starting template.
const SNIPS = [
  ['Phase', '\n## Strength\n'], ['Sets', 'Back Squat 5x5 @ 225 rest 2:00\n'], ['Vary sets', 'Bench Press\n- warmup 5 @ 50%\n- 5 @ 75% TM\n- 3 @ 85% TM\n- 1+ @ 95% TM\nrest: 3:00\n'],
  ['Superset', 'Superset x3 rest 90s\n- A1 Pull-up 8-10\n- A2 Dip 8-10\n'], ['Circuit', 'Circuit 3 rounds rest 60s\n- 10 Push-up\n- 15 Air Squat\n- 30s Plank\n'],
  ['EMOM', 'EMOM 12\n- odd: 12 Swing @ 24kg\n- even: 6/side Goblet Lunge @ 16kg\n'], ['AMRAP', 'AMRAP 12:00\n- 5 Pull-up\n- 10 Push-up\n- 15 Air Squat\nscore: rounds+reps\n'],
  ['For time', '21-15-9 for time cap 10:00\n- Thruster @ 95 lb\n- Pull-up\n'], ['Intervals', 'Intervals 6 x 30s on / 90s off\n- Row @ damper 6\n'], ['Tabata', 'Tabata\n- Air Bike\n'],
  ['Run intervals', 'Intervals 8 x 400m on / 90s off\n- Run @ 5K pace\n'], ['Steady', 'Steady 30:00 zone 2\n- Bike\n'], ['Complex', 'Complex 5 sets @ 2x24kg rest 90s\n- 2 Double Clean\n- 1 Double Press\n- 3 Double Front Squat\n'],
  ['Note', '> '], ['Death by', 'Death by Burpee\n'], ['Test', 'Test 5:00\n- 100 Swing @ 24kg\n']
];
A.sesNew = () => sesEditor(null);
A.sesEdit = id => sesEditor(id);
function sesEditor(id) {
  const s = id ? byId('Sessions', id) : null;
  const st = { name: s ? s.name : '', tags: s ? (s.tags || []).join(', ') : '', text: s ? s.text : '## Warm-up\n\n## Main\n', view: 'text', pub: !!(s && s.public) };
  const o = openOv({
    full: true,
    render: () => {
      const r = MHParse.parse(st.text), p = r.sessions[0] || { phases: [] };
      return `<div class="fbar"><button class="btn ghost sm" data-a="closeOv">Cancel</button><div class="t">${id ? 'Edit session' : 'New session'}</div><button class="btn sm" data-a="sesSave" data-v="${id || ''}">Save</button></div>
      <div class="fbody">
        <input id="seName" placeholder="Session name" value="${esc(st.name)}" style="font-size:20px;font-weight:700">
        <input id="seTags" placeholder="Tags, comma separated (optional)" value="${esc(st.tags)}" style="margin-top:8px">
        ${pubToggle(st.pub, 'sePub', 'session')}
        <div class="seg" style="margin-top:12px"><button class="${st.view === 'text' ? 'on' : ''}" data-a="seView" data-v="text">Write</button><button class="${st.view === 'preview' ? 'on' : ''}" data-a="seView" data-v="preview">Preview${r.warnings.length ? ` <span class="warn">(${r.warnings.length})</span>` : ''}</button></div>
        ${st.view === 'text' ? `<div class="tool">${SNIPS.map(([l], i) => `<button class="chip" data-a="seSnip" data-v="${i}">${ic('plus', 13)}${l}</button>`).join('')}</div>
          <textarea id="seText" class="code" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(st.text)}</textarea>
          <div class="small muted" style="margin-top:8px">One card per line. Lines starting with “-” belong to the card above. <a data-a="syntaxHelp">Syntax help</a></div>`
        : `${r.warnings.length ? `<div class="hint warn">${r.warnings.map(w => `Line ${w.line}: “${esc(w.text)}” · ${esc(w.msg)}`).join('<br>')}</div>` : ''}${sessionBody(p) || '<div class="empty">Nothing yet.</div>'}`}
      </div>`;
    },
    after: o => {
      const n = o.box.querySelector('#seName'), t = o.box.querySelector('#seTags'), x = o.box.querySelector('#seText');
      n.oninput = () => st.name = n.value; t.oninput = () => st.tags = t.value;
      if (x) { x.oninput = () => st.text = x.value; const keep = () => { st.pos = x.selectionStart; st.posEnd = x.selectionEnd; }; ['keyup', 'click', 'select', 'blur', 'input'].forEach(ev => x.addEventListener(ev, keep)); }
    }
  });
  o.st = st;
}
A.seView = (v, el) => { const o = ovOf(el); o.st.view = v; o.redraw(); };
A.sePub = (v, el) => { const o = ovOf(el); o.st.pub = !o.st.pub; o.redraw(); };
const pubToggle = (on, a, what) => `<button class="row" data-a="${a}" style="width:100%;margin-top:10px;background:var(--card);border-radius:12px;padding:12px 14px;text-align:left">
  <div class="grow"><b>Make public</b><div class="small muted">Other MH Lift users can add a copy of this ${what} (your name will not be shown).</div></div>
  <span style="width:46px;height:28px;border-radius:14px;background:${on ? 'var(--lime)' : 'var(--card3)'};position:relative;flex:none;transition:.2s"><span style="position:absolute;top:3px;left:${on ? 21 : 3}px;width:22px;height:22px;border-radius:50%;background:${on ? 'var(--lime-ink)' : 'var(--mute)'};transition:.2s"></span></span></button>`;
A.seSnip = (i, el) => {
  const o = ovOf(el), x = o.box.querySelector('#seText'), snip = SNIPS[+i][1];
  const a = o.st.pos != null ? o.st.pos : x.value.length, b = o.st.pos != null ? o.st.posEnd : x.value.length;
  const pre = x.value.slice(0, a), lead = pre && !pre.endsWith('\n') ? '\n' : '';
  x.value = pre + lead + snip + x.value.slice(b); o.st.text = x.value;
  const pos = (pre + lead + snip).length; x.focus(); x.setSelectionRange(pos, pos); o.st.pos = o.st.posEnd = pos;
};
A.sesSave = (id, el) => {
  const o = ovOf(el), st = o.st, r = MHParse.parse(st.text);
  let name = st.name.trim() || (r.sessions[0] && r.sessions[0].name) || '';
  if (!name) return toast('Give the session a name');
  if (r.sessions.length > 1) return toast('This text has several sessions. Use Import instead.');
  const old = id ? byId('Sessions', id) : null;
  write({ t: 'Sessions', row: Object.assign({}, old || { id: uid(), created: Date.now(), rating: 0, comments: [] }, { name, tags: st.tags.split(',').map(x => x.trim()).filter(Boolean), text: st.text, public: !!st.pub }) });
  closeOv(o); toast('Saved');
};
A.syntaxHelp = () => openOv({ render: () => `<h2>Session syntax</h2><div class="export" style="font-size:12.5px">${esc(SYNTAX_SHORT)}</div><a class="btn gray block" style="margin-top:14px" href="syntax.txt" target="_blank">Full guide</a>` });
const SYNTAX_SHORT = `## Phase name          starts a phase
Back Squat 5x5 @ 225 rest 2:00
Bench Press           then one line per set:
- warmup 5 @ 50%
- 5 @ 75% TM
- 1+ @ 95% TM         (+ = as many as you can)
Superset x3 rest 90s
- A1 Pull-up 8-10
- A2 Dip 8-10
EMOM 12 / E2MOM 20    - odd: ...  - even: ...
AMRAP 12:00
21-15-9 for time cap 10:00
5 rounds for time
Intervals 8 x 400m on / 90s off
Tabata
Steady 30:00 zone 2
Death by Burpee
Test 5:00
> note shown during the workout
// private comment
Loads: @ 225 lb, @ 24kg, @ 2x24kg, @ 75% TM,
@ RPE 8, @ BW+25, @ 95/65 lb, @ red band
Options: rest: 2:00  tempo: 3-1-1-0  scaled: ...`;

// Import from LLM: paste, preview with flagged lines, save all.
A.sesImport = () => {
  const st = { text: '', step: 'paste' };
  const o = openOv({
    full: true,
    render: () => {
      if (st.step === 'paste') return `<div class="fbar"><button class="btn ghost sm" data-a="closeOv">Cancel</button><div class="t">Import from LLM</div><button class="btn sm" data-a="impPreview">Preview</button></div>
        <div class="fbody"><div class="hint" style="margin-top:0">1. Give the syntax guide to any LLM with your workout.<br>2. Paste what it returns below. Several sessions at once is fine (one “#” heading each).</div>
        <div class="btns"><a class="btn gray sm" href="syntax.txt" download="MH-Lift-session-syntax.txt">Download guide</a><button class="btn gray sm" data-a="copyGuide">${ic('copy', 17)}Copy guide</button></div>
        <textarea id="impText" class="code" style="margin-top:14px;min-height:50vh" placeholder="# Session name&#10;## Warm-up&#10;..." spellcheck="false" autocapitalize="off">${esc(st.text)}</textarea></div>`;
      const r = MHParse.parse(st.text);
      return `<div class="fbar"><button class="btn ghost sm" data-a="impBack">Back</button><div class="t">Preview</div><button class="btn sm" data-a="impSave">Save ${r.sessions.length}</button></div>
        <div class="fbody">${r.sessions.map((s, i) => `<div class="card"><div class="fmt">Session ${i + 1}</div><h3 style="margin-top:4px">${esc(s.name || 'Untitled session')}</h3><div class="small muted">${estMin(s)} min · ${allCards(s).length} card${allCards(s).length === 1 ? '' : 's'}</div>
          ${s.warnings.length ? `<div class="hint warn">Not understood (kept as notes):<br>${s.warnings.map(w => `Line ${w.line}: “${esc(w.text)}”`).join('<br>')}</div>` : ''}
          ${sessionBody(s)}</div>`).join('') || '<div class="empty">Nothing found to import.</div>'}</div>`;
    },
    after: o => { const x = o.box.querySelector('#impText'); if (x) x.oninput = () => st.text = x.value; }
  });
  o.st = st;
};
A.impPreview = (v, el) => { const o = ovOf(el); if (!o.st.text.trim()) return toast('Paste the text first'); o.st.step = 'preview'; o.redraw(); o.box.scrollTop = 0; };
A.impBack = (v, el) => { const o = ovOf(el); o.st.step = 'paste'; o.redraw(); };
A.impSave = (v, el) => {
  const o = ovOf(el), text = o.st.text;
  // split the original text by "# " headings so each session keeps its own text
  const parts = []; let cur = null;
  text.replace(/\r/g, '').split('\n').forEach(line => {
    const m = line.trim().match(/^#\s*(?!#)(.*)$/);
    if (m) { cur = { name: m[1].replace(/^session\s*:\s*/i, '').trim(), lines: [] }; parts.push(cur); }
    else { if (!cur) { cur = { name: '', lines: [] }; parts.push(cur); } cur.lines.push(line); }
  });
  const ops = parts.filter(p => p.name || p.lines.join('').trim()).map((p, i) => {
    const body = p.lines.join('\n').trim(), ps = MHParse.parse(body).sessions[0] || { tags: [] };
    const textOnly = body.split('\n').filter(l => !/^\s*tags?\s*:/i.test(l)).join('\n');
    return { t: 'Sessions', row: { id: uid() + i, name: p.name || 'Imported session ' + (i + 1), tags: ps.tags || [], text: textOnly, rating: 0, comments: [], created: Date.now() } };
  });
  if (!ops.length) return toast('Nothing to save');
  write(ops); closeOv(o); toast(`Saved ${ops.length} session${ops.length > 1 ? 's' : ''}`);
};

// =====================================================================
// BLOCKS
// =====================================================================
const weeksUsing = id => S.PlanWeeks.filter(w => w.blockId === id).length;
function vBlocks() {
  return `<div class="small muted" style="margin:14px 2px 0">A block is a reusable week of sessions. Fill planner weeks with it; linked weeks change when the block changes.</div>
    <button class="btn block sm" style="margin-top:12px" data-a="blockNew">${ic('plus', 18)}New block</button>
    ${S.Blocks.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(b => {
      const n = b.days.reduce((a, d) => a + d.filter(x => x !== 'rest').length, 0), wk = weeksUsing(b.id);
      return `<div class="card tap" data-a="blockOpen" data-v="${b.id}"><div class="row"><h3 class="grow">${esc(b.name)}</h3><span class="small muted">${n} session${n === 1 ? '' : 's'}</span></div>
        <div class="blockdays">${b.days.map((d, i) => `<div class="${d.some(x => x !== 'rest') ? 'has' : ''}">${DN[i][0]}${d.filter(x => x !== 'rest').length > 1 ? '·' + d.filter(x => x !== 'rest').length : ''}</div>`).join('')}</div>
        ${wk ? `<div class="small muted" style="margin-top:10px">Used by ${wk} planner week${wk === 1 ? '' : 's'}</div>` : ''}</div>`;
    }).join('') || `<div class="empty"><b>No blocks yet</b>Build a week here, or fill a week in the Planner and save it as a block.</div>`}
    ${sharedBlocks().length ? `<div class="sec">Shared by others</div><div class="card" style="padding:4px 16px">${sharedBlocks().map(b => sharedRow(b, 'blockAdopt')).join('')}</div>` : ''}`;
}
A.blockNew = () => blockEditor(null);
A.blockAdopt = async v => { const id = await adoptBlock(v.slice(7)); if (id) blockEditor(id); };
A.bkPub = (v, el) => { const o = ovOf(el); o.st.pub = !o.st.pub; o.redraw(); };
A.blockOpen = id => blockEditor(id);
function blockEditor(id) {
  const b = id ? byId('Blocks', id) : null;
  const st = { name: b ? b.name : 'Block ' + (S.Blocks.length + 1), days: b ? b.days.map(d => d.slice()) : [[], [], [], [], [], [], []], pub: !!(b && b.public) };
  const o = openOv({
    full: true,
    render: () => `<div class="fbar"><button class="btn ghost sm" data-a="closeOv">Cancel</button><div class="t">${id ? 'Edit block' : 'New block'}</div>${id ? `<button class="ibtn" data-a="blockMenu" data-v="${id}">${ic('menu')}</button>` : ''}<button class="btn sm" data-a="blockSave" data-v="${id || ''}">Save</button></div>
      <div class="fbody"><input id="bkName" value="${esc(st.name)}" placeholder="Block name" style="font-size:20px;font-weight:700">
      ${pubToggle(st.pub, 'bkPub', 'block (and the sessions in it)')}
      ${id && weeksUsing(id) ? `<div class="small muted" style="margin-top:8px">Saving changes ${weeksUsing(id)} linked planner week${weeksUsing(id) === 1 ? '' : 's'} from today on.</div>` : ''}
      ${st.days.map((d, i) => `<div class="day"><div class="dh"><b>${DFULL[i]}</b><button class="chip" data-a="blockAdd" data-v="${i}">${ic('plus', 14)}Add</button></div>
        ${d.map((x, j) => planItem(x, null, `data-a="blockItem" data-v="${i}|${j}"`)).join('') || '<div class="small dim" style="padding:0 2px 6px">Nothing</div>'}</div>`).join('')}</div>`,
    after: o => { const n = o.box.querySelector('#bkName'); n.oninput = () => st.name = n.value; }
  });
  o.st = st; o.bid = id;
}
A.blockAdd = async (i, el) => { const o = ovOf(el), v = await pickSession({ rest: true }); if (!v) return; const d = o.st.days[+i]; if (v === 'rest') o.st.days[+i] = ['rest']; else { o.st.days[+i] = d.filter(x => x !== 'rest').concat([v]); } o.redraw(); };
A.blockItem = (v, el) => {
  const o = ovOf(el), [i, j] = v.split('|').map(Number);
  menu('', [{ label: 'Move up', a: 'blockMv', v: `${i}|${j}|-1` }, { label: 'Remove', a: 'blockRm', v: `${i}|${j}`, danger: true }]);
  A.blockMv = w => { const [a, b, d] = w.split('|').map(Number), arr = o.st.days[a]; if (b + d < 0) return; [arr[b], arr[b + d]] = [arr[b + d], arr[b]]; o.redraw(); };
  A.blockRm = w => { const [a, b] = w.split('|').map(Number); o.st.days[a].splice(b, 1); o.redraw(); };
};
A.blockSave = async (id, el) => {
  const o = ovOf(el), st = o.st; if (!st.name.trim()) return toast('Name the block');
  const ops = id ? snapshotPastOps(id) : [];
  const old = id ? byId('Blocks', id) : null;
  ops.push({ t: 'Blocks', row: Object.assign({}, old || { id: uid() }, { name: st.name.trim(), days: st.days, public: !!st.pub }) });
  await write(ops); closeOv(o); toast('Block saved');
};
A.blockMenu = id => menu('', [{ label: 'Duplicate', a: 'blockDup', v: id }, { label: 'Delete', a: 'blockDel', v: id, danger: true }]);
A.blockDup = id => { const b = byId('Blocks', id); write({ t: 'Blocks', row: { id: uid(), name: b.name + ' (copy)', days: b.days.map(d => d.slice()) } }); closeOv(OV.find(o => o.bid === id)); toast('Duplicated'); };
A.blockDel = async id => {
  const b = byId('Blocks', id), wk = S.PlanWeeks.filter(w => w.blockId === id);
  const r = await ask({ title: `Delete ${b.name}?`, body: wk.length ? `${wk.length} planner week${wk.length === 1 ? '' : 's'} keep their sessions and become unlinked.` : '', buttons: [{ label: 'Cancel', v: 'no', cls: 'gray' }, { label: 'Delete', v: 'yes', cls: 'danger' }] });
  if (!r || r.v !== 'yes') return;
  const ops = []; wk.forEach(w => ops.push(...unlinkOps(w.id))); ops.push({ t: 'Blocks', del: id });
  await write(ops); closeOv(OV.find(o => o.bid === id));
};

// =====================================================================
// PLANNER
// =====================================================================
function dayStatus(d, sid) {
  const w = S.Workouts.find(x => x.date === d && x.sessionId === sid);
  return w ? w.status : '';
}
function planItem(x, d, attrs) {
  if (x === 'rest') return `<div class="pitem rest tap" ${attrs}><span class="bar"></span><div class="grow"><div class="n muted">Rest day</div></div></div>`;
  const s = byId('Sessions', x);
  if (!s) return '';
  const st = d ? dayStatus(d, x) : '';
  const missed = d && !st && d < today();
  return `<div class="pitem ${st} tap" ${attrs}><span class="bar"></span><div class="grow"><div class="n ell">${esc(s.name)}</div><div class="m">${estMin(parsed(s))} min${st === 'done' ? ' · done' : st === 'skipped' ? ' · missed' : missed ? ' · not logged' : ''}</div></div>${st === 'done' ? `<span style="color:var(--green)">${ic('check', 20)}</span>` : ic('chev', 18)}</div>`;
}
function vPlanner() {
  const mon = PW, T = today(), w = weekRow(mon), b = w && byId('Blocks', w.blockId);
  const changed = b ? [0, 1, 2, 3, 4, 5, 6].filter(i => isChanged(addDays(mon, i))).length : 0;
  const label = mon === mondayOf(T) ? 'This week' : mon === addDays(mondayOf(T), 7) ? 'Next week' : mon === addDays(mondayOf(T), -7) ? 'Last week' : 'Week of ' + fmtMD(mon);
  let html = `<div class="weekbar" id="weekbar" style="margin-top:12px"><button class="ibtn" data-a="pweek" data-v="-7" aria-label="Previous week">${ic('back', 20)}</button>
      <div class="wk"><b>${label}</b><span>${fmtMD(mon)} – ${fmtMD(addDays(mon, 6))}</span></div>
      <button class="ibtn" data-a="pweek" data-v="7" aria-label="Next week">${ic('chev', 20)}</button></div>
    <div class="linkline">${b ? `${ic('link', 15)}<span>Linked to <b>${esc(b.name)}</b>${changed ? ` · ${changed} day${changed > 1 ? 's' : ''} changed` : ''}</span><span style="width:100%;padding-left:21px;margin-top:-2px">Changes when the block changes · <a data-a="unlinkWeek">Unlink</a></span>` : 'Not linked to a block. Fill it with a block, or add sessions day by day.'}</div>
    <div class="btns" style="margin-top:10px"><button class="btn gray sm" data-a="fillWeek">Fill with block</button><button class="btn gray sm" data-a="fillMany">Fill several weeks</button></div>`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), items = planFor(d), ch = isChanged(d);
    html += `<div class="day ${d === T ? 'today' : ''}"><div class="dh"><b>${DN[i]}</b><span class="d">${fmtMD(d)}</span>${ch ? '<span class="chip orange" style="margin-left:0;font-size:11px;padding:3px 8px">changed</span>' : ''}<button class="chip" data-a="dayAdd" data-v="${d}">${ic('plus', 14)}Add</button></div>
      ${items.map((x, j) => planItem(x, d, `data-a="dayItem" data-v="${d}|${j}"`)).join('') || ''}</div>`;
  }
  return html;
}
A.pweek = n => { PW = addDays(PW, +n); render(); };
A.planMenu = () => {
  const w = weekRow(PW);
  menu('This week', [{ label: 'Save week as block', a: 'saveAsBlock' }, w ? { label: 'Unlink from block', a: 'unlinkWeek' } : null, { label: 'Clear week', a: 'clearWeek', danger: true }, { label: 'Go to this week', a: 'pthis' }]);
};
A.pthis = () => { PW = mondayOf(today()); render(); };
A.dayAdd = async d => { const v = await pickSession({ title: 'Add to ' + fmtD(d), rest: true }); if (!v) return; const cur = planFor(d); await editDays({ [d]: v === 'rest' ? ['rest'] : cur.filter(x => x !== 'rest').concat([v]) }); };
A.dayItem = v => {
  const [d, j] = v.split('|'), items = planFor(d), x = items[+j], s = byId('Sessions', x), st = dayStatus(d, x);
  if (s) return A.sesOpen(x, null, null, { d, j: +j });
  menu(x === 'rest' ? 'Rest day' : (s ? s.name : ''), [
    s ? { label: 'Open session', a: 'sesOpen', v: x } : null,
    s && !st && d <= today() ? { label: d === today() ? 'Start now' : 'Log this workout', a: 'dayStart', v: `${d}|${x}` } : null,
    { label: 'Move to another day', a: 'dayMove', v } ,
    isChanged(d) ? { label: 'Reset day to block', a: 'dayReset', v: d } : null,
    { label: 'Remove from this day', a: 'dayRemove', v, danger: true }
  ]);
};
A.dayStart = v => { const [d, sid] = v.split('|'); if (d === today()) { TAB = 'workout'; LS.set('tab', TAB); startWorkout({ sessionId: sid }); } else manualWhen({ sessionId: sid, date: d }); };
A.dayRemove = v => { const [d, j] = v.split('|'), items = planFor(d); items.splice(+j, 1); editDays({ [d]: items }); };
A.dayReset = d => write({ t: 'PlanDays', del: d });
A.dayMove = v => {
  const [d, j] = v.split('|'), mon = mondayOf(d);
  menu('Move to', [0, 1, 2, 3, 4, 5, 6].map(i => addDays(mon, i)).filter(x => x !== d).map(x => ({ label: fmtD(x), a: 'dayMoveTo', v: `${d}|${j}|${x}` })));
};
A.dayMoveTo = v => {
  OV.filter(o => o.full).forEach(o => closeOv(o));
  const [d, j, to] = v.split('|'), from = planFor(d), x = from.splice(+j, 1)[0];
  editDays({ [d]: from, [to]: planFor(to).filter(y => y !== 'rest' || x === 'rest').concat([x]) });
};
const sharedBlocks = () => { const mine = new Set(S.Blocks.map(b => b.fromShared).filter(Boolean)); return SHARED.Blocks.filter(b => !mine.has(b.owner + '|' + b.id)); };
A.fillWeek = () => {
  const sh = sharedBlocks();
  if (!S.Blocks.length && !sh.length) return toast('Make a block first (Program → Blocks)');
  menu('Fill this week with', S.Blocks.map(b => ({ label: b.name, a: 'fillWeekGo', v: b.id }))
    .concat(sh.length ? [{ html: '<div class="lbl">Shared by others</div>' }] : [], sh.map(b => ({ html: sharedRow(b, 'fillWeekGo', true) }))));
};
A.fillWeekGo = async id => {
  if (/^shared:/.test(id)) { id = await adoptBlock(id.slice(7)); if (!id) return; }
  await write(fillWeekOps(PW, id));
  const b = byId('Blocks', id);
  ask({ title: `Week filled with ${b.name}`, body: `This week will now change whenever ${esc(b.name)} changes, unless you unlink it.` });
};
A.unlinkWeek = async () => { await write(unlinkOps(PW)); toast('Unlinked. This week keeps its sessions.'); };
A.clearWeek = async () => {
  const r = await ask({ title: 'Clear this week?', body: 'Removes planned sessions from today on. Past days and logged workouts stay.', buttons: [{ label: 'Cancel', v: 'no', cls: 'gray' }, { label: 'Clear', v: 'yes', cls: 'danger' }] });
  if (!r || r.v !== 'yes') return;
  const T = today(), ops = [];
  for (let i = 0; i < 7; i++) { const d = addDays(PW, i); if (d < T) { if (!dayRow(d)) ops.push({ t: 'PlanDays', row: { id: d, date: d, items: planFor(d) } }); } else ops.push({ t: 'PlanDays', del: d }); }
  if (weekRow(PW)) ops.push({ t: 'PlanWeeks', del: PW });
  write(ops);
};
A.saveAsBlock = async () => {
  const r = await ask({ title: 'Save week as block', input: { ph: 'Block name', value: 'Block ' + (S.Blocks.length + 1) }, buttons: [{ label: 'Save', v: 'ok' }] });
  if (!r || !r.text) return;
  const id = uid(), days = [0, 1, 2, 3, 4, 5, 6].map(i => planFor(addDays(PW, i)));
  applyOp({ t: 'Blocks', row: { id, name: r.text, days } }); // so fillWeekOps sees it
  await write([{ t: 'Blocks', row: { id, name: r.text, days } }].concat(fillWeekOps(PW, id)));
  ask({ title: `Saved as ${r.text}`, body: `This week is now linked to ${esc(r.text)} and will change whenever it changes, unless you unlink it.` });
};
A.fillMany = () => {
  if (!S.Blocks.length && !sharedBlocks().length) return toast('Make a block first (Program → Blocks)');
  const st = { seq: [], start: PW, repeat: 1 };
  const weeks = []; for (let i = -1; i < 26; i++) weeks.push(addDays(PW, i * 7));
  const o = openOv({
    render: () => {
      const n = st.seq.length * st.repeat, end = n ? addDays(st.start, (n - 1) * 7 + 6) : null;
      return `<h2>Fill several weeks</h2><div class="small muted">Tap blocks in the order you want them. Each week stays linked to its block.</div>
        <div class="lbl">Blocks</div><div class="chips wrap" style="flex-wrap:wrap">${S.Blocks.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(b => `<button class="chip" data-a="fmAdd" data-v="${b.id}">${ic('plus', 13)}${esc(b.name)}</button>`).join('')}${sharedBlocks().map(b => `<button class="chip blue" data-a="fmAdd" data-v="shared:${esc(b.id)}">${ic('plus', 13)}${esc(b.name)} · shared</button>`).join('')}</div>
        <div class="lbl">Order</div><div class="card" style="margin:0;padding:12px 14px">${st.seq.length ? st.seq.map((id, i) => `<div class="small">Week ${i + 1}: <b>${esc((byId('Blocks', id) || {}).name || '')}</b></div>`).join('') + `<a class="small" data-a="fmClear">Clear</a>` : '<span class="small muted">Nothing yet</span>'}</div>
        <div class="row"><div class="grow"><div class="lbl">Starting</div><select id="fmStart">${weeks.map(w => `<option value="${w}" ${w === st.start ? 'selected' : ''}>Week of ${fmtMD(w)}</option>`).join('')}</select></div>
          <div style="width:110px"><div class="lbl">Repeat</div><select id="fmRep">${[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => `<option ${n === st.repeat ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        ${n ? `<div class="small muted" style="margin-top:12px">Fills ${n} week${n > 1 ? 's' : ''}: ${fmtMD(st.start)} – ${fmtMD(end)}. Weeks already planned in that range are replaced from today on.</div>` : ''}
        <button class="btn block" style="margin-top:14px" data-a="fmGo" ${n ? '' : 'disabled'}>Fill ${n || ''} week${n === 1 ? '' : 's'}</button>`;
    },
    after: o => { o.box.querySelector('#fmStart').onchange = e => { st.start = e.target.value; o.redraw(); }; o.box.querySelector('#fmRep').onchange = e => { st.repeat = +e.target.value; o.redraw(); }; }
  });
  o.st = st;
};
A.fmAdd = async (id, el) => { const o = ovOf(el); if (/^shared:/.test(id)) { id = await adoptBlock(id.slice(7)); if (!id) return; } o.st.seq.push(id); o.redraw(); };
A.fmClear = (v, el) => { const o = ovOf(el); o.st.seq = []; o.redraw(); };
A.fmGo = async (v, el) => {
  const o = ovOf(el), st = o.st, ops = [];
  const n = st.seq.length * st.repeat;
  for (let k = 0; k < n; k++) { const mon = addDays(st.start, k * 7); fillWeekOps(mon, st.seq[k % st.seq.length]).forEach(op => ops.push(op)); }
  await write(ops); closeOv(o);
  ask({ title: `Filled ${n} week${n > 1 ? 's' : ''}`, body: 'Each week is linked to its block and will change whenever that block changes, unless you unlink it.' });
};

// swipe between weeks in the planner
(function () {
  let x0 = null, y0 = 0;
  document.addEventListener('touchstart', e => { if (TAB !== 'program' || PSUB !== 'planner' || OV.length) return; const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) A.pweek(dx < 0 ? 7 : -7);
  }, { passive: true });
})();
