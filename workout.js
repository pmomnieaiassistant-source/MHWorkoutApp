// MH Lift: Workout tab (live and hand-entered workouts, execution views, timers) and startup.
'use strict';

let ACT = LS.get('active', null);
const saveAct = () => LS.set('active', ACT);

// =====================================================================
// START / LIST
// =====================================================================
function startWorkout({ sessionId = null, snap = null, name = '', manual = false, date = today(), start = null, end = null }) {
  if (ACT) { toast('Finish or discard the current workout first'); TAB = 'workout'; render(); return; }
  const s = sessionId ? byId('Sessions', sessionId) : null;
  const p = snap || (s ? JSON.parse(JSON.stringify(parsed(s))) : { phases: [], notes: [] });
  ACT = { id: uid(), sessionId, name: name || (s && s.name) || 'Workout', date, startAt: Date.now(), manual, start, end, snap: p, log: {}, notes: '' };
  saveAct(); TAB = 'workout'; LS.set('tab', TAB); render(); window.scrollTo(0, 0);
}
const logOf = k => (ACT.log[k] = ACT.log[k] || {});
const cardAt = k => { const [pi, ci] = k.split('.').map(Number); return ACT.snap.phases[pi].cards[ci]; };

function vWorkout() {
  if (ACT) return vActive();
  const T = today(), items = planFor(T).filter(x => x !== 'rest' && byId('Sessions', x)), rest = planFor(T).includes('rest');
  let html = '';
  if (items.length) {
    html += `<div class="sec">Today</div>` + items.map(sid => {
      const s = byId('Sessions', sid), p = parsed(s), st = dayStatus(T, sid);
      return `<div class="card"><div class="fmt">${st === 'done' ? 'Done today' : st === 'skipped' ? 'Skipped' : 'Planned'}</div><h3 style="margin-top:4px;font-size:22px">${esc(s.name)}</h3>
        <div class="small muted" style="margin-top:2px">${estMin(p)} min · ${allCards(p).length} card${allCards(p).length === 1 ? '' : 's'}</div>
        ${p.phases.map(ph => `<div class="small" style="margin-top:8px"><span class="muted">${esc(ph.name)}:</span> ${ph.cards.map(c => esc(cardTitle(c))).join(', ')}</div>`).join('')}
        <div class="btns"><button class="btn gray sm" data-a="sesOpen" data-v="${sid}">Details</button><button class="btn sm" data-a="woStart" data-v="${sid}">${ic('play', 16)}${st === 'done' ? 'Do again' : 'Start'}</button></div></div>`;
    }).join('');
  } else {
    html += `<div class="empty" style="padding-top:50px"><b>${rest ? 'Rest day' : 'Nothing planned today'}</b>${rest ? 'Enjoy it. Or pick a session anyway.' : 'Pick a session, or plan your week in Program.'}</div>
      <div class="btns" style="max-width:420px;margin:0 auto"><button class="btn gray" data-a="woChoose">Choose a session</button><button class="btn gray" data-a="tabPlanner">Open planner</button></div>`;
  }
  const next = [1, 2, 3, 4, 5, 6].map(i => addDays(T, i)).map(d => [d, planFor(d).filter(x => x !== 'rest' && byId('Sessions', x))]).filter(x => x[1].length).slice(0, 3);
  if (next.length) html += `<div class="sec">Coming up</div>` + next.map(([d, ids]) => ids.map(id => `<div class="pitem tap" data-a="sesOpen" data-v="${id}"><span class="bar" style="background:var(--dim)"></span><div class="grow"><div class="n">${esc(byId('Sessions', id).name)}</div><div class="m">${relDay(d)}</div></div>${ic('chev', 18)}</div>`).join('')).join('');
  return html;
}
A.tabPlanner = () => { TAB = 'program'; PSUB = 'planner'; PW = mondayOf(today()); LS.set('tab', TAB); LS.set('psub', PSUB); render(); };
A.woStart = sid => startWorkout({ sessionId: sid });
A.woChoose = async () => { const id = await pickSession({ title: 'Choose a session' }); if (id) startWorkout({ sessionId: id }); };
A.woMenu = () => {
  if (!ACT) return menu('Workout', [{ label: 'Choose a session', a: 'woChoose' }, { label: 'Enter a past workout', a: 'manualStart' }]);
  menu(ACT.name, [{ label: 'Workout notes', a: 'actNotes' }, { label: 'Add or change photo', a: 'actPhoto' }, ACT.manual ? { label: 'Change date and time', a: 'actWhen' } : null, { label: 'Discard workout', a: 'actDiscard', danger: true }]);
};

function vActive() {
  const cards = allCards(ACT.snap), done = cards.filter(x => (ACT.log[x.key] || {}).status).length;
  let html = `<div class="card" style="margin-top:6px"><div class="row"><h3 class="grow" style="font-size:22px">${esc(ACT.name)}</h3><span class="small muted">${done}/${cards.length}</span></div>
    ${ACT.manual ? `<div class="small muted" style="margin-top:4px">${fmtD(ACT.date)} · ${ACT.start ? fmtClock(ACT.start) + '–' + fmtClock(ACT.end) : ''} · <a data-a="actWhen">Change</a></div>` : ''}
    <div class="progress"><div style="width:${cards.length ? done / cards.length * 100 : 0}%"></div></div></div>`;
  if (!cards.length) html += `<div class="card"><div class="small muted">No cards. Add notes about what you did, then save.</div><button class="btn gray block sm" style="margin-top:10px" data-a="actNotes">Workout notes</button></div>`;
  (ACT.snap.notes || []).forEach(n => { html += `<div class="hint">${esc(n)}</div>`; });
  ACT.snap.phases.forEach((ph, pi) => {
    html += `<div class="phase">${esc(ph.name)}</div>`;
    ph.cards.forEach((c, ci) => {
      const k = pi + '.' + ci, lg = ACT.log[k] || {}, stt = lg.status || '';
      html += `<div class="wcard ${stt}" data-k="${k}"><button class="act" data-a="${stt === 'skipped' ? 'cardUnskip' : 'cardSkip'}" data-v="${k}">${stt === 'skipped' ? 'Undo' : 'Skip'}</button>
        <div class="front"><button class="wchk" data-a="cardToggle" data-v="${k}" aria-label="Mark done"><span>${stt === 'skipped' ? ic('close', 16, 3) : ic('check', 17, 3)}</span></button>
        <div class="wbody tap" data-a="cardOpen" data-v="${k}"><div class="grow"><div class="fmt">${FMT[c.format] || ''}</div><div class="t ell">${esc(cardTitle(c))}</div><div class="s">${esc(stt === 'skipped' ? 'Skipped' + (lg.note ? ' · ' + lg.note : '') : resultLine(c, lg) || cardSummary(c))}</div></div><span class="dim" style="padding-right:12px">${ic('chev', 18)}</span></div></div></div>`;
    });
  });
  html += `<div class="btns" style="margin-top:22px"><button class="btn block" data-a="actFinish">${ACT.manual ? 'Save workout' : 'Finish workout'}</button></div>`;
  return html;
}
function resultLine(c, lg) {
  if (lg.sets && lg.sets.some(s => s.done)) { const d = lg.sets.filter(s => s.done); return `${d.length}/${lg.sets.length} sets · ` + d.map(s => s.reps + (s.load !== '' ? '@' + s.load : '')).join(', '); }
  if (lg.result) { const r = logLine({ result: lg.result }); if (r) return r; }
  return '';
}

// card interactions
A.cardToggle = k => { const lg = logOf(k); lg.status = lg.status === 'done' ? '' : 'done'; if (lg.status === 'done' && lg.sets) lg.sets.forEach(s => s.done = true); saveAct(); render(); };
A.cardSkip = async k => {
  const r = await ask({ title: 'Skip ' + cardTitle(cardAt(k)) + '?', input: { ph: 'Note (optional), e.g. knee was sore', focus: false }, buttons: [{ label: 'Skip', v: 'ok', cls: '' }] });
  closeSwipes(); if (!r) return; const lg = logOf(k); lg.status = 'skipped'; lg.note = r.text; saveAct(); render();
};
A.cardUnskip = k => { const lg = logOf(k); lg.status = ''; lg.note = ''; saveAct(); closeSwipes(); render(); };
A.cardOpen = k => openExec(k);

// swipe a card left to reveal Skip
function closeSwipes(except) { document.querySelectorAll('.wcard .front').forEach(f => { if (f !== except) f.style.transform = ''; }); }
(function () {
  let f = null, x0 = 0, y0 = 0, dx = 0, base = 0, horiz = null;
  document.addEventListener('touchstart', e => {
    const fr = e.target.closest('.wcard .front'); if (!fr) { if (!e.target.closest('.wcard .act')) closeSwipes(); return; }
    f = fr; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horiz = null; base = /-96/.test(f.style.transform) ? -96 : 0; closeSwipes(f);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!f) return; const ddx = e.touches[0].clientX - x0, ddy = e.touches[0].clientY - y0;
    if (horiz == null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) horiz = Math.abs(ddx) > Math.abs(ddy);
    if (!horiz) return;
    dx = ddx; f.parentNode.classList.add('dragging'); f.style.transform = `translateX(${Math.min(0, Math.max(-130, base + dx))}px)`;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!f) return; f.parentNode.classList.remove('dragging');
    if (horiz) { f.style.transform = base + dx < -50 ? 'translateX(-96px)' : ''; f.dataset.swiped = '1'; setTimeout(() => { if (f) delete f.dataset.swiped; }, 50); }
    f = null;
  });
  // ignore the tap that ends a swipe
  document.addEventListener('click', e => { const fr = e.target.closest('.wcard .front'); if (fr && (fr.dataset.swiped || /-96/.test(fr.style.transform))) { e.stopPropagation(); e.preventDefault(); fr.style.transform = ''; } }, true);
})();

A.actNotes = async () => { const r = await ask({ title: 'Workout notes', input: { area: true, value: ACT.notes || '' }, buttons: [{ label: 'Save', v: 'ok' }] }); if (r) { ACT.notes = r.text; saveAct(); } };
A.actPhoto = async () => { const p = await pickPhoto(); if (p) { ACT.photo = p; saveAct(); toast('Photo added'); } };
A.actDiscard = async () => { const r = await ask({ title: 'Discard this workout?', body: 'Nothing will be saved.', buttons: [{ label: 'Keep going', v: 'no', cls: 'gray' }, { label: 'Discard', v: 'yes', cls: 'danger' }] }); if (r && r.v === 'yes') { ACT = null; LS.del('active'); render(); } };
A.actWhen = () => manualWhen({ edit: true });

A.actFinish = async () => {
  const cards = allCards(ACT.snap), open = cards.filter(x => !(ACT.log[x.key] || {}).status);
  const r = await ask({
    title: ACT.manual ? 'Save this workout?' : 'Finish workout?',
    body: `${cards.length - open.length} of ${cards.length} cards marked${open.length ? `. ${open.length} not marked will be saved as not done.` : '.'}`,
    input: { area: true, ph: 'Notes (optional)', value: ACT.notes || '', focus: false },
    buttons: [{ label: ACT.photo ? 'Change photo' : 'Add photo', v: 'photo', cls: 'gray' }, { label: 'Save', v: 'save' }]
  });
  if (!r) return;
  ACT.notes = r.text;
  if (r.v === 'photo') { const p = await pickPhoto(); if (p) ACT.photo = p; saveAct(); return A.actFinish(); }
  const row = {
    id: ACT.id, date: ACT.date, sessionId: ACT.sessionId || '', name: ACT.name, status: 'done', manual: !!ACT.manual,
    start: ACT.manual ? ACT.start : new Date(ACT.startAt).toISOString(), end: ACT.manual ? ACT.end : new Date().toISOString(),
    notes: ACT.notes, photo: ACT.photo || '', snap: ACT.snap,
    log: { cards: cards.map(({ c, key, phase }) => { const lg = ACT.log[key] || {}; return { key, phase, title: cardTitle(c), format: c.format, summary: cardSummary(c), status: lg.status || '', note: lg.note || '', sets: lg.sets || null, result: lg.result || null }; }) }
  };
  ACT = null; LS.del('active'); stopRest();
  await write({ t: 'Workouts', row });
  autoMatch();
  toast('Workout saved'); TAB = 'feed'; LS.set('tab', TAB); render(); window.scrollTo(0, 0);
};

// photo: resize on the phone, then store (Drive through the back end, or on the phone in local mode)
function pickPhoto() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return res(null);
      try {
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(f); });
        const max = serverMode() ? 1400 : 700, sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const data = cv.toDataURL('image/jpeg', 0.82);
        if (!serverMode()) return res(data);
        toast('Uploading photo…'); const j = await api('photo', { data, name: 'mhlift-' + today() }); res(j.photo);
      } catch (e) { toast('Photo failed: ' + e.message); res(null); }
    };
    inp.click();
  });
}

// =====================================================================
// EXECUTION VIEWS
// =====================================================================
function openExec(k) {
  const c = cardAt(k);
  if (MHParse.TIMED.includes(c.format)) return ACT.manual ? resultForm(k) : timerView(k);
  if (c.format === 'straight') return setsView(k);
  return roundsView(k);
}

// ----- sets (lifting) -----
function initSets(c, lg) {
  if (lg.sets) return lg.sets;
  const st = c.steps[0]; let prev = 0;
  const plan = st.sets.length ? st.sets : [{ kind: 'work', reps: st.reps || '', load: st.load || null }];
  lg.sets = plan.map(s => {
    const ln = loadNum(s.load, st.name, prev); if (typeof ln === 'number') prev = ln;
    return { kind: s.kind, reps: s.amount ? '' : String(s.reps || '').replace(/\+$/, ''), amrap: /\+$/.test(s.reps || ''), time: s.amount ? mmss(s.amount.sec) : '', load: ln === '' ? '' : ln, unit: loadUnit(s.load), plan: s.load && !/^(abs)$/.test(s.load.kind) ? s.load.raw : '', rest: s.rest, drops: s.drops, done: false, rpe: s.rpe, rir: s.rir, cluster: s.cluster };
  });
  return lg.sets;
}
function lastTime(name) {
  for (const w of S.Workouts.slice().sort((a, b) => b.date.localeCompare(a.date))) {
    const c = ((w.log && w.log.cards) || []).find(x => norm(x.title) === norm(name) && x.sets && x.sets.some(s => s.done));
    if (c) return `${fmtMD(w.date)}: ${logLine(c)}`;
  }
  return '';
}
function setsView(k) {
  const c = cardAt(k), st = c.steps[0], lg = logOf(k); initSets(c, lg); saveAct();
  const o = openOv({
    full: true,
    render: () => {
      const lt = lastTime(st.name);
      return `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button><div class="t ell">${esc(st.name)}</div><span style="width:40px"></span></div>
      <div class="fbody">
        <h1 style="margin:4px 0 4px;font-size:30px;letter-spacing:-.02em">${esc(st.name)}</h1>
        <div class="muted">${esc(cardSummary(c))}</div>
        ${[st.tempo || c.tempo ? 'Tempo ' + (st.tempo || c.tempo) : '', st.technique ? st.technique : '', c.intraRest ? `Rest ${c.intraRest}s inside each cluster` : '', st.alts ? 'Options: ' + st.alts.join(' → ') : ''].filter(Boolean).map(t => `<div class="hint">${esc(t)}</div>`).join('')}
        ${(c.notes || []).concat(st.notes || []).map(n => `<div class="hint" style="color:var(--text)">${esc(n)}</div>`).join('')}
        ${lt ? `<div class="hint">Last time · ${esc(lt)}</div>` : ''}
        ${st.sets.some(s => s.load && s.load.kind === 'pct' && !maxFor(st.name, s.load.of)) ? `<div class="hint">Add your ${esc(st.name)} max on Home to turn the percentages into weights.</div>` : ''}
        <div class="setrow" style="padding-bottom:0"><span></span><div class="unit">REPS</div><div class="unit">WEIGHT</div><span></span></div>
        ${lg.sets.map((s, i) => `<div class="setrow ${s.done ? 'done' : ''}"><div class="k">${s.kind === 'warmup' ? 'Warm-up' : s.kind === 'backoff' ? 'Back-off' : s.kind === 'mini' ? 'Mini' : s.kind === 'drop' ? 'Drop' : s.kind === 'top' ? 'Top' : 'Set ' + (lg.sets.slice(0, i + 1).filter(x => !['warmup'].includes(x.kind)).length)}${s.amrap ? '<br><span style="color:var(--lime)">AMRAP</span>' : ''}</div>
          <div><input inputmode="numeric" data-set="${i}" data-f="${s.time ? 'time' : 'reps'}" value="${esc(s.time || s.reps)}" placeholder="${s.amrap ? 'max' : '–'}">${s.rpe ? `<div class="unit">RPE ${s.rpe}</div>` : s.rir != null ? `<div class="unit">RIR ${s.rir}</div>` : s.cluster ? `<div class="unit">clusters of ${s.cluster}</div>` : ''}</div>
          <div><input inputmode="decimal" data-set="${i}" data-f="load" value="${esc(s.load)}" placeholder="${esc(s.plan || '–')}"><div class="unit">${esc(s.plan && s.load !== '' ? s.plan : s.unit)}</div></div>
          <button class="setchk" data-a="setDone" data-v="${i}">${ic('check', 22, 3)}</button></div>
          ${s.drops ? `<div class="small muted" style="margin:-4px 0 6px 62px">then ${s.drops.map(d => `${d.reps} @ ${d.load ? d.load.raw : ''}`).join(' → ')}</div>` : ''}`).join('')}
        <button class="btn ghost sm" data-a="setAdd">${ic('plus', 16)}Add set</button>
      </div>
      <div class="fbottom"><button class="btn block" data-a="execDone">Done with ${esc(st.name)}</button></div>`;
    },
    after: o => o.box.querySelectorAll('input[data-set]').forEach(inp => inp.oninput = () => { const s = lg.sets[+inp.dataset.set]; s[inp.dataset.f] = inp.value; saveAct(); }),
    onClose: () => render()
  });
  o.k = k;
}
A.setDone = (i, el) => {
  const o = ovOf(el), c = cardAt(o.k), lg = logOf(o.k), s = lg.sets[+i];
  s.done = !s.done;
  if (s.done && !s.reps && !s.time && !s.amrap) s.reps = '';
  saveAct(); o.redraw();
  if (s.done && !ACT.manual) {
    const nextLeft = lg.sets.some(x => !x.done);
    const rest = s.kind === 'mini' ? (s.rest || 5) : s.rest != null ? s.rest : c.rest != null ? c.rest : +setting('rest', 90);
    if (nextLeft && rest) startRest(rest);
  }
  if (lg.sets.every(x => x.done)) { lg.status = 'done'; saveAct(); }
};
A.setAdd = (v, el) => { const o = ovOf(el), lg = logOf(o.k), last = lg.sets[lg.sets.length - 1] || { kind: 'work', reps: '', load: '', unit: UNIT() }; lg.sets.push(Object.assign({}, last, { done: false, kind: last.kind === 'warmup' ? 'work' : last.kind })); saveAct(); o.redraw(); };
A.execDone = (v, el) => { const o = ovOf(el), lg = logOf(o.k); lg.status = 'done'; if (lg.sets) lg.sets.forEach(s => { if (!s.done && (s.reps || s.time)) s.done = true; }); saveAct(); stopRest(); closeOv(o); };

// ----- rounds (superset, circuit, complex) -----
function roundsView(k) {
  const c = cardAt(k), lg = logOf(k), n = c.rounds || 1;
  lg.rounds = lg.rounds || Array(n).fill(false); saveAct();
  const o = openOv({
    full: true,
    render: () => `<div class="fbar"><button class="ibtn" data-a="closeOv">${ic('back')}</button><div class="t">${FMT[c.format]}</div><span style="width:40px"></span></div>
      <div class="fbody"><h1 style="margin:4px 0;font-size:28px;letter-spacing:-.02em">${esc(c.title)}</h1><div class="muted">${esc(cardSummary(c))}</div>
      <div class="card">${c.steps.map(st => `<div class="list-item" style="padding:10px 0"><div class="grow"><b>${esc(stepText(st))}</b>${st.alts ? `<div class="small muted">Options: ${esc(st.alts.join(' → '))}</div>` : ''}${st.parts ? `<div class="small muted">${esc(st.parts.map(p => stepText(p)).join(', '))}</div>` : ''}${(st.notes || []).map(x => `<div class="small muted">${esc(x)}</div>`).join('')}</div></div>`).join('')}</div>
      ${(c.notes || []).map(x => `<div class="hint" style="color:var(--text)">${esc(x)}</div>`).join('')}
      <div class="sec">Rounds</div>${lg.rounds.map((d, i) => `<div class="setrow ${d ? 'done' : ''}" style="grid-template-columns:1fr 48px"><b>Round ${i + 1} of ${n}</b><button class="setchk" data-a="roundDone" data-v="${i}">${ic('check', 22, 3)}</button></div>`).join('')}
      </div><div class="fbottom"><button class="btn block" data-a="execDone">Done</button></div>`,
    onClose: () => render()
  });
  o.k = k;
}
A.roundDone = (i, el) => {
  const o = ovOf(el), c = cardAt(o.k), lg = logOf(o.k); lg.rounds[+i] = !lg.rounds[+i];
  lg.result = { rounds: lg.rounds.filter(Boolean).length }; saveAct(); o.redraw();
  if (lg.rounds[+i] && lg.rounds.some(x => !x) && c.rest && !ACT.manual) startRest(c.rest);
  if (lg.rounds.every(Boolean)) { lg.status = 'done'; saveAct(); }
};

// ----- rest timer (clock-based, keeps correct time if the phone sleeps) -----
let REST = null, restTick = 0;
function startRest(sec) { REST = { end: Date.now() + sec * 1000, total: sec }; $('rest').classList.add('on'); document.body.classList.add('resting'); drawRest(); clearInterval(restTick); restTick = setInterval(drawRest, 250); }
function stopRest() { REST = null; clearInterval(restTick); $('rest').classList.remove('on'); document.body.classList.remove('resting'); }
function drawRest() {
  if (!REST) return;
  const left = (REST.end - Date.now()) / 1000;
  if (left <= -2) return stopRest();
  const el = $('rest');
  el.style.background = left <= 0 ? 'var(--lime)' : '';
  el.innerHTML = `<div class="grow"><div class="tiny" style="font-weight:800;opacity:.7">${left <= 0 ? 'Go' : 'Rest'}</div><div class="big">${left <= 0 ? '0:00' : mmss(Math.ceil(left))}</div></div><button data-a="restAdj" data-v="-15">−15s</button><button data-a="restAdj" data-v="15">+15s</button><button data-a="restSkip">Skip</button>`;
}
A.restAdj = v => { if (REST) { REST.end += +v * 1000; drawRest(); } };
A.restSkip = () => stopRest();

// ----- result form (hand-entered timed cards, and after a timer finishes) -----
function resultFields(c) {
  switch (c.format) {
    case 'amrap': return [['rounds', 'Rounds', 'numeric'], ['reps', 'Extra reps', 'numeric']];
    case 'fortime': case 'ladder': return [['time', 'Time (mm:ss)', 'text']];
    case 'rft': return [['time', 'Time (mm:ss)', 'text'], ['rounds', 'Rounds done', 'numeric']];
    case 'deathby': return [['minutes', 'Minutes completed', 'numeric']];
    case 'steady': return [['time', 'Time (mm:ss)', 'text'], ['dist', 'Distance (e.g. 5.2 km)', 'text']];
    case 'intervals': return [['rounds', 'Intervals done', 'numeric'], ['dist', 'Distance or calories (optional)', 'text']];
    case 'emom': return [['rounds', 'Rounds done', 'numeric']];
    case 'test': return [['time', 'Time (mm:ss)', 'text']];
    default: return [];
  }
}
function resultForm(k, pre) {
  const c = cardAt(k), lg = logOf(k), r = Object.assign({}, lg.result || {}, pre || {});
  if (r.time != null && typeof r.time === 'number') r.timeTxt = mmss(r.time);
  openOv({
    render: () => `<h2>${esc(c.title)}</h2><div class="small muted">${esc(cardSummary(c))}</div>
      ${resultFields(c).map(([f, l, m]) => `<div class="lbl">${l}</div><input data-rf="${f}" inputmode="${m}" value="${esc(f === 'time' ? (r.timeTxt || '') : r[f] == null ? '' : r[f])}">`).join('')}
      <div class="lbl">Note</div><input data-rf="note" value="${esc(r.note || '')}" placeholder="optional">
      <button class="btn block" style="margin-top:16px" data-a="resultSave" data-v="${k}">Save result</button>`
  });
}
A.resultSave = (k, el) => {
  const o = ovOf(el), lg = logOf(k), r = Object.assign({}, lg.result || {});
  o.box.querySelectorAll('[data-rf]').forEach(i => { const f = i.dataset.rf, v = i.value.trim(); if (f === 'time') r.time = v ? MHParse.parseTime(v, 'm') : null; else r[f] = v; });
  lg.result = r; lg.status = 'done'; saveAct(); closeOv(o); closeOv(OV.find(x => x.timerK === k)); render();
};

// ----- timer view (EMOM, intervals, AMRAP, for time, steady, run/erg intervals...) -----
function stepsForMinute(steps, k) {
  const slotted = steps.filter(s => s.slot != null);
  if (!slotted.length) return steps;
  const nums = slotted.filter(s => typeof s.slot === 'number').map(s => s.slot), cyc = nums.length ? Math.max(...nums) : 0;
  const hit = steps.filter(s => s.slot === (k % 2 ? 'odd' : 'even') || (typeof s.slot === 'number' && ((k - 1) % cyc) + 1 === s.slot));
  return hit.length ? hit : steps.filter(s => s.slot == null);
}
function buildSegs(c) {
  const segs = [], steps = c.steps || [];
  const first = c.format === 'emom' ? stepsForMinute(steps, 1) : steps;
  segs.push({ kind: 'prep', dur: 10, label: 'Get ready', steps: first });
  switch (c.format) {
    case 'emom':
      for (let k = 1; k <= c.rounds; k++) segs.push({ kind: 'work', dur: c.every, label: `${c.every === 60 ? 'Minute' : 'Round'} ${k} of ${c.rounds}`, steps: stepsForMinute(steps, k) });
      break;
    case 'intervals': {
      const slotted = steps.some(s => s.slot != null);
      for (let k = 1; k <= c.rounds; k++) {
        const work = c.pyramid ? c.works[k - 1] : c.work;
        const st = slotted ? stepsForMinute(steps, k) : steps.length > 1 ? [steps[(k - 1) % steps.length]] : steps;
        segs.push({ kind: 'work', dur: work.sec != null ? work.sec : null, target: work.sec == null ? work.raw : '', label: `${c.tabata ? 'Round' : 'Interval'} ${k} of ${c.rounds}`, steps: st, lap: work.sec == null });
        const rest = c.restEqWork ? work.sec : c.rest;
        if (k < c.rounds && (rest || c.restOpen)) segs.push({ kind: 'rest', dur: c.restOpen ? null : rest, label: 'Rest', steps: [], lap: c.restOpen });
      }
      break;
    }
    case 'amrap': segs.push({ kind: 'work', dur: c.dur, label: `AMRAP ${mmss(c.dur)}`, steps, counter: true }); break;
    case 'test': segs.push({ kind: 'work', dur: c.dur, label: `Test · ${mmss(c.dur)}`, steps, early: true }); break;
    case 'deathby': for (let k = 1; k <= 60; k++) segs.push({ kind: 'work', dur: 60, label: `Minute ${k}`, big: `${k} rep${k > 1 ? 's' : ''}`, steps }); break;
    case 'steady': segs.push({ kind: 'work', dur: c.amount && c.amount.sec != null ? c.amount.sec : null, target: c.amount && c.amount.sec == null ? c.amount.raw : '', label: c.target ? c.target : 'Steady', steps: steps.length ? steps : [{ name: c.title }], lap: !(c.amount && c.amount.sec != null), up: !(c.amount && c.amount.sec != null) }); break;
    default: // fortime, rft, ladder
      segs.push({ kind: 'work', dur: null, cap: c.cap || null, up: true, label: c.format === 'rft' ? `${c.rounds} rounds for time` : c.format === 'ladder' ? `${c.scheme.join('-')} for time` : 'For time', steps, counter: c.format === 'rft', lap: true, finish: true });
  }
  return segs;
}
// Where are we? Worked out from the clock every time, so it is right after the screen locks or the app reopens.
function timerPos(segs, run, now) {
  const t = (run.stopped || run.paused || now) - run.t0 - run.pausedMs;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    let d = s.dur != null ? s.dur * 1000 : run.laps[i] != null ? run.laps[i] : null;
    if (d == null && s.cap && t - acc >= s.cap * 1000) d = s.cap * 1000;
    if (d == null) return { i, el: t - acc, rem: null };
    if (t < acc + d) return { i, el: t - acc, rem: acc + d - t };
    acc += d;
  }
  return { done: true, i: segs.length - 1, total: acc };
}
let wakeLock = null;
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') { if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && OV.some(o => o.timerK)) wake(true); });

function timerView(k) {
  const c = cardAt(k), lg = logOf(k), segs = buildSegs(c);
  let tick = 0, lastI = -1;
  const o = openOv({
    full: true,
    render: () => {
      const run = lg.run;
      if (!run) return `<div class="timer idle"><div class="tb"><button data-a="closeOv">${ic('close')}</button><span class="lab">${FMT[c.format]}</span><span style="width:42px"></span></div>
        <div class="mid"><div class="ex">${esc(c.title)}</div><div class="det">${esc(cardSummary(c))}</div>
        <div class="steps" style="margin-top:18px">${c.steps.map(s => esc(stepText(s)) + (s.slot ? ` <span class="dim">(${s.slot})</span>` : '')).join('<br>')}</div>
        ${(c.notes || []).map(n => `<div class="small muted" style="margin-top:10px">${esc(n)}</div>`).join('')}</div>
        <div class="small muted" style="text-align:center;margin-bottom:12px">The screen stays on while the timer runs. If the phone locks, the timer keeps the right time when you come back.</div>
        <div class="ctl"><button class="main" data-a="tStart">${ic('play', 20)} Start</button></div></div>`;
      const p = timerPos(segs, run, Date.now());
      if (p.done || run.stopped) return `<div class="timer done"><div class="tb"><button data-a="closeOv">${ic('close')}</button><span class="lab">Finished</span><span style="width:42px"></span></div>
        <div class="mid"><div class="ex">${esc(c.title)}</div><div class="clock" style="font-size:72px">${mmss(workTime(segs, run) / 1000)}</div><div class="det">Total time</div></div>
        <div class="ctl"><button data-a="tReset">Reset</button><button class="main" data-a="tResult">Save result</button></div></div>`;
      const s = segs[p.i], nx = segs.slice(p.i + 1).find(x => x.kind === 'work');
      const showSteps = s.steps.length > 1 || c.format === 'amrap' || c.format === 'fortime' || c.format === 'rft' || c.format === 'ladder' || c.format === 'test';
      const main = s.kind === 'rest' ? 'Rest' : s.kind === 'prep' ? (s.steps[0] ? stepText(s.steps[0], false) : c.title) : s.big || (showSteps ? '' : s.steps[0] ? (s.steps[0].complex ? 'Complex' : s.steps[0].name) : c.title);
      const det = s.kind === 'work' && !showSteps && s.steps[0] ? [s.steps[0].complex ? s.steps[0].parts.map(x => stepText(x, false)).join(' · ') : (s.steps[0].amount ? s.steps[0].amount.raw : s.steps[0].reps ? s.steps[0].reps + (s.steps[0].side ? '/side' : '') + ' reps' : ''), s.steps[0].load ? loadText(s.steps[0].load, s.steps[0].name) : '', s.target].filter(Boolean).join(' · ') : s.target || '';
      const clock = s.dur != null ? mmss(Math.ceil(p.rem / 1000)) : mmss(p.el / 1000);
      return `<div class="timer ${s.kind}" id="tmr"><div class="tb"><button data-a="closeOv" aria-label="Close">${ic('close')}</button><span class="lab">${esc(s.label)}</span><button data-a="tPause" aria-label="Pause">${ic(run.paused ? 'play' : 'pause')}</button></div>
        <div class="mid">${main ? `<div class="ex">${esc(main)}</div>` : ''}${det ? `<div class="det">${esc(det)}</div>` : ''}
          ${showSteps && s.kind === 'work' ? `<div class="steps">${s.steps.map(x => esc(stepText(x)) + (c.format === 'ladder' ? '' : '')).join('<br>')}</div>${c.format === 'ladder' ? `<div class="det" style="margin-top:6px">Reps: ${c.scheme.join(' – ')}</div>` : ''}` : ''}
          <div class="clock" id="tclock">${run.paused ? 'II' : clock}</div>
          ${s.cap ? `<div class="det">cap ${mmss(s.cap)}</div>` : ''}
          ${s.counter ? `<div class="counter"><button data-a="tRound" data-v="-1">−</button><div><b>${lg.rc || 0}</b><div class="small" style="opacity:.7">rounds</div></div><button data-a="tRound" data-v="1">+</button></div>` : ''}
          ${nx && s.kind !== 'work' ? `<div class="next">Next: ${esc(nx.steps.map(x => stepText(x)).join(' + ') || nx.label)}</div>` : nx && s.kind === 'work' && nx !== s ? `<div class="next" id="tnext">Then: ${esc(nx.label)}</div>` : ''}</div>
        <div class="ctl">${s.lap ? `<button class="main" data-a="tLap">${s.finish ? 'Done' : s.kind === 'rest' ? 'Ready' : 'Lap done'}</button>` : ''}
          ${s.early ? `<button class="main" data-a="tStop">Done early</button>` : ''}
          ${c.format === 'deathby' ? `<button class="main" data-a="tStop">Couldn't finish</button>` : ''}
          ${!s.lap && !s.early && c.format !== 'deathby' ? `<button data-a="tSkipSeg">Skip ${s.kind === 'rest' ? 'rest' : 'ahead'}</button><button data-a="tStop">End</button>` : `<button data-a="tStop">End</button>`}</div></div>`;
    },
    after: o => {
      clearInterval(tick);
      tick = setInterval(() => {
        const run = lg.run; if (!run || run.paused) return;
        const p = timerPos(segs, run, Date.now());
        if (p.done || p.i !== lastI) {
          const prev = lastI; lastI = p.i;
          if (prev !== -1 || p.done) { o.redraw(); const t = o.box.querySelector('.timer'); if (t) { t.classList.add('flash'); } if (navigator.vibrate) try { navigator.vibrate(200); } catch (e) {} }
          return;
        }
        const s = segs[p.i], el = o.box.querySelector('#tclock');
        if (el) el.textContent = s.dur != null ? mmss(Math.ceil(p.rem / 1000)) : mmss(p.el / 1000);
      }, 200);
      if (lg.run && !lg.run.stopped) { lastI = timerPos(segs, lg.run, Date.now()).i; wake(true); }
    },
    onClose: () => { clearInterval(tick); wake(false); render(); }
  });
  o.timerK = k; o.segs = segs;
}
function workTime(segs, run) {
  const p = timerPos(segs, run, Date.now()), prep = segs[0].kind === 'prep' ? segs[0].dur * 1000 : 0;
  if (p.done) return p.total - prep;
  let acc = 0; for (let i = 0; i < p.i; i++) acc += segs[i].dur != null ? segs[i].dur * 1000 : run.laps[i] || 0;
  return acc + p.el - prep;
}
const tO = el => ovOf(el);
const tLog = el => logOf(tO(el).timerK);
A.tStart = (v, el) => { const lg = tLog(el); lg.run = { t0: Date.now(), pausedMs: 0, paused: null, laps: {}, stopped: null }; lg.rc = 0; saveAct(); wake(true); tO(el).redraw(); };
A.tPause = (v, el) => { const r = tLog(el).run; if (r.paused) { r.pausedMs += Date.now() - r.paused; r.paused = null; } else r.paused = Date.now(); saveAct(); tO(el).redraw(); };
A.tLap = (v, el) => {
  const o = tO(el), lg = tLog(el), r = lg.run, p = timerPos(o.segs, r, Date.now());
  r.laps[p.i] = p.el; saveAct();
  if (o.segs[p.i].finish) { r.stopped = Date.now(); saveAct(); }
  o.redraw();
};
A.tSkipSeg = (v, el) => {
  // skipping a timed segment: shift the start so the next segment begins now
  const o = tO(el), r = tLog(el).run, p = timerPos(o.segs, r, Date.now());
  if (p.rem != null) r.t0 -= p.rem; saveAct(); o.redraw();
};
A.tStop = (v, el) => { const r = tLog(el).run; r.stopped = Date.now(); if (r.paused) { r.pausedMs += Date.now() - r.paused; r.paused = null; } saveAct(); tO(el).redraw(); };
A.tReset = (v, el) => { const lg = tLog(el); lg.run = null; lg.rc = 0; saveAct(); tO(el).redraw(); };
A.tRound = (d, el) => { const lg = tLog(el); lg.rc = Math.max(0, (lg.rc || 0) + +d); saveAct(); tO(el).redraw(); };
A.tResult = (v, el) => {
  const o = tO(el), c = cardAt(o.timerK), lg = tLog(el), segs = o.segs, run = lg.run, p = timerPos(segs, run, Date.now());
  const pre = ['fortime', 'rft', 'ladder', 'steady', 'test'].includes(c.format) ? { time: Math.round(workTime(segs, run) / 1000) } : {};
  if (c.format === 'amrap' || c.format === 'rft') pre.rounds = lg.rc || '';
  if (c.format === 'deathby') pre.minutes = Math.max(0, p.i - 1);
  if (c.format === 'emom') pre.rounds = Math.max(0, Math.min(c.rounds, p.done ? c.rounds : p.i - 1));
  if (c.format === 'intervals') { pre.rounds = segs.slice(1, p.done ? segs.length : p.i).filter(s => s.kind === 'work').length; pre.laps = Object.keys(run.laps).filter(i => segs[i].kind === 'work').map(i => Math.round(run.laps[i] / 1000)); }
  lg.result = Object.assign({}, lg.result || {}, pre); saveAct();
  resultForm(o.timerK, pre);
};

// =====================================================================
// MANUAL ENTRY
// =====================================================================
A.manualStart = () => {
  if (ACT) return toast('Finish or discard the current workout first');
  const T = today(), planned = [];
  for (let i = 0; i < 8; i++) { const d = addDays(T, -i); planFor(d).forEach(sid => { if (sid !== 'rest' && byId('Sessions', sid) && !dayStatus(d, sid)) planned.push([d, sid]); }); }
  menu('Enter a workout', [
    ...(planned.length ? [{ html: '<div class="lbl" style="margin-top:0">Planned</div>' }] : []),
    ...planned.map(([d, sid]) => ({ label: `${relDay(d)} · ${byId('Sessions', sid).name}`, a: 'manualPlanned', v: d + '|' + sid })),
    { html: '<div class="lbl">Other</div>' },
    { label: 'Choose from your sessions', a: 'manualLib' },
    { label: 'Blank workout', a: 'manualBlank' }
  ]);
};
A.manualPlanned = v => { const [d, sid] = v.split('|'); manualWhen({ sessionId: sid, date: d }); };
A.manualLib = async () => { const id = await pickSession({ title: 'Which session?' }); if (id) manualWhen({ sessionId: id }); };
A.manualBlank = async () => {
  const st = { name: '', text: '' };
  openOv({
    full: true,
    render: () => `<div class="fbar"><button class="btn ghost sm" data-a="closeOv">Cancel</button><div class="t">Blank workout</div><button class="btn sm" data-a="blankNext">Next</button></div>
      <div class="fbody"><input id="bkN" placeholder="Name, e.g. Pickup basketball" value="${esc(st.name)}" style="font-size:19px;font-weight:700">
      <div class="lbl">What you did (optional, same format as sessions)</div><textarea id="bkT" class="code" style="min-height:40vh" placeholder="Bench Press 3x8 @ 185&#10;Run 5 km" spellcheck="false" autocapitalize="off">${esc(st.text)}</textarea></div>`,
    after: o => { o.box.querySelector('#bkN').oninput = e => st.name = e.target.value; o.box.querySelector('#bkT').oninput = e => st.text = e.target.value; }
  }).st = st;
};
A.blankNext = (v, el) => {
  const o = ovOf(el), st = o.st; if (!st.name.trim()) return toast('Give it a name');
  const p = MHParse.parse(st.text).sessions[0] || { phases: [], notes: [] };
  closeOv(o); manualWhen({ snap: p, name: st.name.trim() });
};
/** Date plus start and end in 5-minute steps. */
function manualWhen(opt) {
  const edit = opt.edit, T = today();
  const nowQ = (() => { const d = new Date(); d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0); return d; })();
  const hhmm = d => `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`;
  const st = edit ? { date: ACT.date, s: hhmm(new Date(ACT.start)), e: hhmm(new Date(ACT.end)) } : { date: opt.date || T, s: hhmm(new Date(nowQ - 3600000)), e: hhmm(nowQ) };
  const times = []; for (let m = 0; m < 1440; m += 5) times.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  const lab = t => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  openOv({
    render: () => `<h2>When was it?</h2><div class="small muted">Approximate is fine. If a Whoop workout overlaps, the times are corrected from Whoop.</div>
      <div class="lbl">Date</div><input id="mwD" type="date" value="${st.date}" max="${T}">
      <div class="row"><div class="grow"><div class="lbl">Start</div><select id="mwS">${times.map(t => `<option value="${t}" ${t === st.s ? 'selected' : ''}>${lab(t)}</option>`).join('')}</select></div>
      <div class="grow"><div class="lbl">End</div><select id="mwE">${times.map(t => `<option value="${t}" ${t === st.e ? 'selected' : ''}>${lab(t)}</option>`).join('')}</select></div></div>
      <button class="btn block" style="margin-top:16px" data-a="mwGo">${edit ? 'Save' : 'Next'}</button>`
  }).mw = { opt, st };
}
A.mwGo = (v, el) => {
  const o = ovOf(el), { opt } = o.mw;
  const d = o.box.querySelector('#mwD').value || today(), s = o.box.querySelector('#mwS').value, e = o.box.querySelector('#mwE').value;
  const iso = (date, t) => { const [y, m, dd] = date.split('-').map(Number), [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi).toISOString(); };
  let start = iso(d, s), end = iso(d, e);
  if (end <= start) end = new Date(Date.parse(end) + 864e5).toISOString();
  closeOv(o);
  if (opt.edit) { Object.assign(ACT, { date: d, start, end }); saveAct(); render(); return; }
  startWorkout({ sessionId: opt.sessionId || null, snap: opt.snap || null, name: opt.name || '', manual: true, date: d, start, end });
};

// =====================================================================
// MISSED SESSIONS
// =====================================================================
const askedMissed = new Set(LS.get('askedMissed', []));
function missedList() {
  const T = today(), first = LS.get('firstRun', T), out = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(T, -i); if (d < first) break;
    planFor(d).forEach(sid => { if (sid !== 'rest' && byId('Sessions', sid) && !dayStatus(d, sid) && !askedMissed.has(d + '|' + sid)) out.push([d, sid]); });
  }
  return out.reverse();
}
function checkMissed() {
  if (ACT || OV.length) return;
  const list = missedList(); if (!list.length) return;
  const [d, sid] = list[0], s = byId('Sessions', sid);
  const o = openOv({
    modal: true,
    render: () => `<div class="fmt" style="color:var(--orange)">${list.length > 1 ? `1 of ${list.length} not logged` : 'Not logged'}</div><h2 style="margin-top:6px">Did you miss ${esc(s.name)}?</h2><div class="muted">${fmtLong(d)}</div>
      <div class="btns col"><button class="btn" data-a="missYes" data-v="${d}|${sid}">Yes, I missed it</button><button class="btn gray" data-a="missNo" data-v="${d}|${sid}">No, I did it (log it now)</button>
      ${list.length > 1 ? `<button class="btn ghost" data-a="missAll">Mark all ${list.length} missed</button>` : ''}<button class="btn ghost" data-a="missLater">Ask me later</button></div>`
  });
  o.missed = list;
}
A.missYes = async (v, el) => {
  const [d, sid] = v.split('|'); closeOv(ovOf(el));
  const r = await ask({ title: 'Mark as missed', input: { ph: 'Note (optional), e.g. travel', focus: false }, buttons: [{ label: 'Save', v: 'ok' }] });
  if (!r) { setTimeout(checkMissed, 300); return; }
  await write({ t: 'Workouts', row: { id: uid(), date: d, sessionId: sid, name: byId('Sessions', sid).name, status: 'skipped', missed: true, note: r.text } });
  setTimeout(checkMissed, 400);
};
A.missNo = (v, el) => { const [d, sid] = v.split('|'); closeOv(ovOf(el)); manualWhen({ sessionId: sid, date: d }); };
A.missAll = async (v, el) => { const o = ovOf(el); closeOv(o); await write(o.missed.map(([d, sid]) => ({ t: 'Workouts', row: { id: uid(), date: d, sessionId: sid, name: byId('Sessions', sid).name, status: 'skipped', missed: true, note: '' } }))); };
A.missLater = (v, el) => { const o = ovOf(el); closeOv(o); MISS_LATER = true; };
let MISS_LATER = false;

// =====================================================================
// BOOT
// =====================================================================
(function boot() {
  const c = LS.get('data', null);
  if (c && c.tables) { TABLES.forEach(t => S[t] = c.tables[t] || []); ME = c.me || ''; WHOOP = c.whoop || WHOOP; if (c.shared) SHARED = c.shared; }
  render();
  if (serverMode()) loadServer().then(() => { if (!MISS_LATER) checkMissed(); });
  else setTimeout(checkMissed, 600);
  setInterval(() => { const e = $('elapsed'); if (e && ACT) e.textContent = mmss((Date.now() - ACT.startAt) / 1000); }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (serverMode()) { flush(); } render(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
})();
