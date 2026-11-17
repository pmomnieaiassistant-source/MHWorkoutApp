/**
 * MH Lift back end (Google Apps Script web app).
 * Setup steps: backend/SETUP.md.
 *
 * Script Properties used:
 *   USERS                 "Paul=longRandomKey1, Dan=longRandomKey2"  (name=key pairs; the key goes in each person's link)
 *   WHOOP_CLIENT_ID       from the Whoop Developer Dashboard
 *   WHOOP_CLIENT_SECRET   from the Whoop Developer Dashboard (never put this in the repo)
 *   APP_URL               e.g. https://<you>.github.io/MHWorkoutApp/  (link shown after Whoop connects)
 *   REDIRECT_URI          optional; defaults to this web app's /exec URL
 *
 * Every table is a sheet tab with columns: user | id | date | updated | data (JSON).
 */

const TABLES = ['Sessions', 'Blocks', 'PlanWeeks', 'PlanDays', 'Workouts', 'Measurements', 'Maxes', 'Settings', 'WhoopDays', 'WhoopWorkouts'];
const HEAD = ['user', 'id', 'date', 'updated', 'data'];
const WHOOP = 'https://api.prod.whoop.com';
const SCOPES = 'offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement';

const props = () => PropertiesService.getScriptProperties();
const prop = k => props().getProperty(k) || '';
const json = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function users() {
  const out = {};
  prop('USERS').split(/[,\n]/).forEach(p => { const [n, k] = p.split('=').map(s => (s || '').trim()); if (n && k) out[k] = n; });
  return out;
}

// ---------- entry points ----------

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    const user = users()[b.key];
    if (!user) return json({ ok: false, error: 'Unknown personal link (passcode). Open the app from your own link.' });
    const res = route(user, b) || {};
    return json(Object.assign({ ok: true, me: user }, res));
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code || p.error) return whoopCallback(p);
  return ContentService.createTextOutput('MH Lift back end is running.');
}

function route(user, b) {
  switch (b.action) {
    case 'load': return { tables: loadAll(user), whoop: whoopStatus(user) };
    case 'write': write(user, b.ops || []); return {};
    case 'whoop_start': return { url: whoopAuthUrl(user) };
    case 'whoop_sync': return whoopSync(user, b.days);
    case 'whoop_disconnect': props().deleteProperty('whoop_' + user); return { whoop: whoopStatus(user) };
    case 'photo': return { photo: savePhoto(user, b.data, b.name) };
    default: throw new Error('Unknown action: ' + b.action);
  }
}

// ---------- table storage ----------

function sheet(name) {
  const ss = prop('SHEET_ID') ? SpreadsheetApp.openById(prop('SHEET_ID')) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange('A:C').setNumberFormat('@'); }
  return sh;
}

function rowsOf(name) {
  const sh = sheet(name), n = sh.getLastRow();
  return { sh, vals: n > 1 ? sh.getRange(2, 1, n - 1, HEAD.length).getValues() : [] };
}

function loadAll(user) {
  const out = {};
  TABLES.forEach(t => {
    out[t] = rowsOf(t).vals.filter(r => r[0] === user).map(r => { try { return JSON.parse(r[4]); } catch (e) { return null; } }).filter(Boolean);
  });
  return out;
}

/** ops: [{t, row}] to insert/replace by id, [{t, del: id}] to delete. Rows are always whole. */
function write(user, ops) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const byTable = {};
    ops.forEach(o => { if (TABLES.indexOf(o.t) < 0) throw new Error('Unknown table ' + o.t); (byTable[o.t] = byTable[o.t] || []).push(o); });
    Object.keys(byTable).forEach(t => writeTable(user, t, byTable[t]));
  } finally { lock.releaseLock(); }
}

function writeTable(user, t, ops) {
  const { sh, vals } = rowsOf(t);
  const idx = {};
  vals.forEach((r, i) => { if (r[0] === user) idx[String(r[1])] = i; });
  const dels = [], appends = [], appIdx = {};
  ops.forEach(o => {
    if (o.del != null) {
      if (idx[o.del] != null) dels.push(idx[o.del]);
      if (appIdx[o.del] != null) appends[appIdx[o.del]] = null;
      delete idx[o.del]; delete appIdx[o.del]; return;
    }
    const row = o.row; if (!row || row.id == null) return;
    const id = String(row.id);
    const line = [user, id, row.date || '', new Date(row.updated || Date.now()), JSON.stringify(row)];
    if (idx[id] != null) sh.getRange(idx[id] + 2, 1, 1, HEAD.length).setValues([line]);
    else if (appIdx[id] != null) appends[appIdx[id]] = line;
    else { appIdx[id] = appends.length; appends.push(line); }
  });
  const add = appends.filter(Boolean);
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, HEAD.length).setValues(add);
  dels.sort((a, b) => b - a).forEach(i => sh.deleteRow(i + 2));
}

function upsert(user, t, rows) { if (rows.length) write(user, rows.map(r => ({ t, row: r }))); }

// ---------- photos ----------

function savePhoto(user, dataUrl, name) {
  const m = String(dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) throw new Error('Bad photo');
  const it = DriveApp.getFoldersByName('MH Lift Photos');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('MH Lift Photos');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (name || 'photo') + '.jpg'));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return file.getId();
}

// ---------- Whoop ----------

const redirectUri = () => prop('REDIRECT_URI') || ScriptApp.getService().getUrl();

function whoopStatus(user) {
  const tok = getTok(user);
  return { configured: !!(prop('WHOOP_CLIENT_ID') && prop('WHOOP_CLIENT_SECRET')), connected: !!tok, lastSync: tok ? tok.lastSync || null : null };
}

function whoopAuthUrl(user) {
  if (!prop('WHOOP_CLIENT_ID')) throw new Error('Whoop is not set up yet (WHOOP_CLIENT_ID missing in Script Properties).');
  const state = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('ws_' + state, user, 1800);
  const q = { client_id: prop('WHOOP_CLIENT_ID'), redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES, state };
  return WHOOP + '/oauth/oauth2/auth?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
}

function page(title, msg) {
  const app = prop('APP_URL');
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:-apple-system,system-ui,sans-serif;background:#0A0B0D;color:#F2F4F7;min-height:100vh;padding:48px 24px;box-sizing:border-box">' +
    '<h2 style="margin:0 0 12px">' + title + '</h2><p style="color:#9AA3AF;line-height:1.5">' + msg + '</p>' +
    (app ? '<p><a href="' + app + '" style="color:#C6F432">Back to MH Lift</a></p>' : '') + '</div>').setTitle('MH Lift');
}

function whoopCallback(p) {
  if (p.error) return page('Whoop was not connected', String(p.error_description || p.error));
  const user = CacheService.getScriptCache().get('ws_' + p.state);
  if (!user) return page('Link expired', 'Please go back to MH Lift and tap Connect Whoop again.');
  const r = UrlFetchApp.fetch(WHOOP + '/oauth/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'authorization_code', code: p.code, client_id: prop('WHOOP_CLIENT_ID'), client_secret: prop('WHOOP_CLIENT_SECRET'), redirect_uri: redirectUri() }
  });
  if (r.getResponseCode() !== 200) return page('Whoop was not connected', 'Whoop said: ' + r.getContentText().slice(0, 300));
  saveTok(user, JSON.parse(r.getContentText()));
  try { whoopSync(user, 30); } catch (e) {}
  return page('Whoop connected', 'You can close this page and go back to MH Lift. Your last 30 days are loading.');
}

function getTok(user) { try { return JSON.parse(prop('whoop_' + user) || 'null'); } catch (e) { return null; } }
function saveTok(user, t, keep) {
  const old = getTok(user) || {};
  const tok = Object.assign({}, old, keep || {});
  if (t) Object.assign(tok, { access: t.access_token, refresh: t.refresh_token || old.refresh, exp: Date.now() + (t.expires_in || 3600) * 1000 - 60000 });
  props().setProperty('whoop_' + user, JSON.stringify(tok));
  return tok;
}

function accessToken(user) {
  let tok = getTok(user);
  if (!tok) throw new Error('Whoop is not connected.');
  if (tok.exp > Date.now()) return tok.access;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    tok = getTok(user);
    if (tok.exp > Date.now()) return tok.access;
    const r = UrlFetchApp.fetch(WHOOP + '/oauth/oauth2/token', {
      method: 'post', muteHttpExceptions: true,
      payload: { grant_type: 'refresh_token', refresh_token: tok.refresh, client_id: prop('WHOOP_CLIENT_ID'), client_secret: prop('WHOOP_CLIENT_SECRET'), scope: 'offline' }
    });
    if (r.getResponseCode() !== 200) { props().deleteProperty('whoop_' + user); throw new Error('Whoop sign-in expired. Connect Whoop again from Home.'); }
    return saveTok(user, JSON.parse(r.getContentText())).access;
  } finally { lock.releaseLock(); }
}

function whoopGet(user, path, params) {
  const out = [];
  let next = null, guard = 0;
  do {
    const q = Object.assign({ limit: 25 }, params || {}, next ? { nextToken: next } : {});
    const url = WHOOP + path + '?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + accessToken(user) }, muteHttpExceptions: true });
    if (r.getResponseCode() === 404) return out;
    if (r.getResponseCode() !== 200) throw new Error('Whoop ' + path + ' ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    const j = JSON.parse(r.getContentText());
    if (!j.records) return j; // single object (body measurement)
    out.push.apply(out, j.records);
    next = j.next_token || j.nextToken || null;
  } while (next && ++guard < 40);
  return out;
}

/** Local calendar date of a Whoop timestamp using its timezone_offset ("-05:00"). */
function localDate(iso, off) {
  const m = String(off || '+00:00').match(/([+-])(\d{2}):?(\d{2})/);
  const mins = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
  return new Date(Date.parse(iso) + mins * 60000).toISOString().slice(0, 10);
}

function whoopSync(user, days) {
  const tok = getTok(user);
  if (!tok) return { whoop: whoopStatus(user) };
  const since = new Date(Date.now() - (days || (tok.lastSync ? Math.min(30, Math.ceil((Date.now() - tok.lastSync) / 864e5) + 2) : 30)) * 864e5).toISOString();
  const range = { start: since, end: new Date().toISOString() };
  const cycles = whoopGet(user, '/developer/v2/cycle', range);
  const recs = whoopGet(user, '/developer/v2/recovery', range);
  const sleeps = whoopGet(user, '/developer/v2/activity/sleep', range);
  const wos = whoopGet(user, '/developer/v2/activity/workout', range);
  let body = null;
  try { body = whoopGet(user, '/developer/v2/user/measurement/body'); } catch (e) {}

  const dayMap = {};
  const day = d => dayMap[d] = dayMap[d] || { id: d, date: d };
  const cycleDate = {};
  cycles.forEach(c => {
    const d = localDate(c.start, c.timezone_offset); cycleDate[c.id] = d;
    const s = c.score || {}, o = day(d);
    Object.assign(o, { strain: s.strain, kj: s.kilojoule, avgHr: s.average_heart_rate, maxHr: s.max_heart_rate, cycleStart: c.start, cycleEnd: c.end });
  });
  recs.forEach(r => {
    const d = cycleDate[r.cycle_id]; if (!d || !r.score) return;
    Object.assign(day(d), { recovery: r.score.recovery_score, rhr: r.score.resting_heart_rate, hrv: r.score.hrv_rmssd_milli, spo2: r.score.spo2_percentage, skinTemp: r.score.skin_temp_celsius, sleepId: r.sleep_id });
  });
  sleeps.filter(s => !s.nap).forEach(s => {
    const d = localDate(s.end, s.timezone_offset), sc = s.score || {}, st = sc.stage_summary || {};
    day(d).sleep = {
      start: s.start, end: s.end, perf: sc.sleep_performance_percentage, eff: sc.sleep_efficiency_percentage, resp: sc.respiratory_rate,
      inBed: st.total_in_bed_time_milli, awake: st.total_awake_time_milli, light: st.total_light_sleep_time_milli, deep: st.total_slow_wave_sleep_time_milli, rem: st.total_rem_sleep_time_milli
    };
  });
  const now = Date.now();
  const dayRows = Object.keys(dayMap).map(k => Object.assign(dayMap[k], { updated: now }));
  const woRows = wos.map(w => {
    const s = w.score || {};
    return {
      id: String(w.id), date: localDate(w.start, w.timezone_offset), start: w.start, end: w.end, sport: w.sport_name || ('Sport ' + w.sport_id),
      strain: s.strain, avgHr: s.average_heart_rate, maxHr: s.max_heart_rate, kj: s.kilojoule, dist: s.distance_meter, zones: s.zone_durations || s.zone_duration || null, updated: now
    };
  });
  upsert(user, 'WhoopDays', dayRows);
  upsert(user, 'WhoopWorkouts', woRows);
  if (body && body.height_meter) upsert(user, 'Settings', [{ id: 'whoopBody', value: { height: body.height_meter, weight: body.weight_kilogram, maxHr: body.max_heart_rate, at: now }, updated: now }]);
  saveTok(user, null, { lastSync: now });
  const t = loadAll(user);
  return { tables: { WhoopDays: t.WhoopDays, WhoopWorkouts: t.WhoopWorkouts, Settings: t.Settings }, whoop: whoopStatus(user) };
}
