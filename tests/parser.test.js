// Run: node tests/parser.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const P = require('../parser.js');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL', name, '\n  ', e.message); } };

// Every example in docs/session-format.md section 4 must parse with no warnings.
const doc = fs.readFileSync(path.join(__dirname, '../docs/session-format.md'), 'utf8');
const sec = doc.slice(doc.indexOf('## 4. Worked examples'), doc.indexOf('## 5.'));
const blocks = [...sec.matchAll(/### (.+)\n\n```\n([\s\S]*?)```/g)];
t('found examples', () => assert.ok(blocks.length >= 12, 'only ' + blocks.length));
const parsed = {};
blocks.forEach(([, title, body]) => t('example: ' + title, () => {
  const r = P.parse(body);
  assert.strictEqual(r.sessions.length, 1);
  assert.deepStrictEqual(r.warnings.map(w => `L${w.line} ${w.text}: ${w.msg}`), []);
  parsed[r.sessions[0].name] = r.sessions[0];
}));
const cards = n => parsed[n].phases.flatMap(p => p.cards);

t('5/3/1 main sets', () => {
  const c = cards('5/3/1 W3 – Squat');
  const main = c.find(x => x.line && x.steps[0].sets.length === 3 && x.steps[0].sets[2].reps === '1+');
  assert.ok(main); assert.strictEqual(main.rest, 180); assert.strictEqual(main.steps[0].sets[0].load.of, 'TM');
  const fsl = c.find(x => x.steps[0] && x.steps[0].sets && x.steps[0].sets.length === 5);
  assert.strictEqual(fsl.rest, 90);
  const ss = c.find(x => x.format === 'superset'); assert.strictEqual(ss.rounds, 3); assert.strictEqual(ss.steps.length, 2);
  assert.strictEqual(ss.steps[1].load.kind, 'bw'); assert.strictEqual(ss.steps[1].load.val, 25);
  assert.strictEqual(c[0].format, 'steady'); assert.strictEqual(c[0].amount.sec, 300);
  assert.strictEqual(c[1].steps[0].sets[0].kind, 'warmup');
});
t('hypertrophy', () => {
  const c = cards('Upper Hypertrophy A');
  assert.strictEqual(c[0].steps[0].sets.length, 4); assert.strictEqual(c[0].steps[0].sets[0].reps, '8-10');
  assert.strictEqual(c[0].steps[0].tempo, '3-1-1-0'); assert.strictEqual(c[0].steps[0].sets[0].rir, 2); assert.strictEqual(c[0].rest, 120);
  const drop = c[2].steps[0].sets[2]; assert.strictEqual(drop.kind, 'drop'); assert.strictEqual(drop.drops.length, 2);
  assert.strictEqual(c[3].steps[0].technique, 'myo-reps'); assert.strictEqual(c[3].steps[0].sets.filter(s => s.kind === 'mini').length, 5);
});
t('cluster + top set', () => {
  const c = cards('Heavy Deadlift Day');
  assert.strictEqual(c[0].steps[0].sets[0].rpe, 8); assert.strictEqual(c[0].steps[0].sets.filter(s => s.kind === 'backoff').length, 3);
  assert.strictEqual(c[0].steps[0].sets[1].load.kind, 'rel');
  assert.strictEqual(c[1].steps[0].sets.length, 3); assert.strictEqual(c[1].steps[0].sets[0].cluster, 2); assert.strictEqual(c[1].intraRest, 20);
});
t('S&S tests', () => { const c = cards('Simple & Sinister'); assert.strictEqual(c[0].format, 'test'); assert.strictEqual(c[0].dur, 300); assert.strictEqual(c[1].dur, 600); assert.strictEqual(c[0].steps[0].reps, '100'); });
t('ABC EMOM complex', () => { const c = cards('ABC EMOM 20')[0]; assert.strictEqual(c.format, 'emom'); assert.strictEqual(c.rounds, 20); assert.ok(c.steps[0].complex); assert.strictEqual(c.steps[0].parts.length, 3); assert.strictEqual(c.steps[0].load.count, 2); });
t('alternating EMOM', () => { const c = cards('KB Minutes')[0]; assert.deepStrictEqual(c.steps.map(s => s.slot), ['odd', 'even']); assert.ok(c.steps[1].side); });
t('Fran', () => { const c = cards('Fran')[0]; assert.strictEqual(c.format, 'ladder'); assert.deepStrictEqual(c.scheme, [21, 15, 9]); assert.strictEqual(c.cap, 600); assert.strictEqual(c.steps[0].load.alt, 65); assert.ok(c.scaled); });
t('Murph', () => { const c = cards('Murph')[0]; assert.strictEqual(c.format, 'fortime'); assert.strictEqual(c.cap, 3600); assert.strictEqual(c.load.raw, 'vest 20 lb'); assert.strictEqual(c.steps.length, 5); assert.ok(c.steps[0].amount.dist > 1600); });
t('Cindy + death by', () => { const c = cards('Cindy + Death by Burpees'); assert.strictEqual(c[0].format, 'amrap'); assert.strictEqual(c[0].dur, 1200); assert.strictEqual(c[1].format, 'deathby'); assert.strictEqual(c[1].steps[0].name, 'Burpee'); });
t('intervals', () => {
  const c = cards('Bike Intervals');
  assert.ok(c[0].tabata); assert.strictEqual(c[0].rounds, 8);
  assert.strictEqual(c[1].work.sec, 30); assert.strictEqual(c[1].rest, 90); assert.strictEqual(c[1].steps[0].load.raw, 'damper 6');
  assert.strictEqual(c[2].rounds, 10); assert.deepStrictEqual(c[2].steps.map(s => s.slot), ['odd', 'even']);
});
t('bodyweight alts', () => { const c = cards('Bodyweight Full Body'); assert.strictEqual(c[0].format, 'circuit'); assert.strictEqual(c[1].steps[0].label, 'A1'); assert.strictEqual(c[1].steps[1].alts.length, 4); assert.ok(c[1].steps[1].side); });
t('hyrox', () => { const c = cards('HYROX Half Sim')[0]; assert.strictEqual(c.steps.length, 6); assert.strictEqual(c.steps[3].amount.dist, 50); assert.strictEqual(c.steps[3].load.unit, 'kg'); });
t('steady', () => { const c = cards('Zone 2')[0]; assert.strictEqual(c.format, 'steady'); assert.strictEqual(c.amount.sec, 2700); assert.strictEqual(c.target, 'zone 2'); });

// Run / erg intervals and pyramids
t('run intervals by distance', () => { const c = P.parse('Intervals 8 x 400m on / 90s off\n- Run @ 5K pace').sessions[0].phases[0].cards[0]; assert.strictEqual(c.work.dist, 400); assert.strictEqual(c.rest, 90); assert.strictEqual(c.steps[0].load.raw, '5K pace'); });
t('row intervals', () => { const c = P.parse('Intervals 5 x 500m on / 2:00 off\n- Row @ split 1:55, 28 spm').sessions[0].phases[0].cards[0]; assert.strictEqual(c.rest, 120); assert.strictEqual(c.steps[0].load.raw, 'split 1:55, 28 spm'); });
t('pyramid', () => { const c = P.parse('Pyramid 1:00 / 2:00 / 3:00 / 2:00 / 1:00 on, rest = work\n- Bike @ 250 W').sessions[0].phases[0].cards[0]; assert.strictEqual(c.works.length, 5); assert.ok(c.restEqWork); });
t('cal intervals', () => { const c = P.parse('Intervals 6 x 15 cal on / 1:00 off\n- Echo Bike').sessions[0].phases[0].cards[0]; assert.strictEqual(c.work.cal, 15); });
t('E2MOM', () => { const c = P.parse('E2MOM 20\n- 5 Power Clean @ 135 lb').sessions[0].phases[0].cards[0]; assert.strictEqual(c.every, 120); assert.strictEqual(c.rounds, 10); });
t('rft', () => { const c = P.parse('5 rounds for time\n- 400m Run\n- 15 Overhead Squat @ 95 lb').sessions[0].phases[0].cards[0]; assert.strictEqual(c.format, 'rft'); assert.strictEqual(c.rounds, 5); });
t('3x5+ amrap last', () => { const s = P.parse('Press 3x5+ @ 115').sessions[0].phases[0].cards[0].steps[0].sets; assert.deepStrictEqual(s.map(x => x.reps), ['5', '5', '5+']); });
t('multi-session import', () => { const r = P.parse('# A\nSquat 5x5\n# B\nBench 5x5'); assert.strictEqual(r.sessions.length, 2); assert.strictEqual(r.sessions[1].phases[0].cards[0].title, 'Bench'); });
t('unknown lines flagged not dropped', () => { const r = P.parse('## Main\nBench 5x5\n- ???'); assert.strictEqual(r.warnings.length, 1); assert.ok(r.sessions[0].phases[0].cards[0].notes.includes('???')); });
t('session meta', () => { const s = P.parse('# X\ntags: kb, short\nnotes: easy day\n## A\nSwing 10x10').sessions[0]; assert.deepStrictEqual(s.tags, ['kb', 'short']); assert.deepStrictEqual(s.notes, ['easy day']); });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
