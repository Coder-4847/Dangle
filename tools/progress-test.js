// Saves and unlock rules: node tools/progress-test.js
// Uses a fake localStorage so "refresh" (re-init) really reloads what was written.
global.window = global;
const store = {};
let blocked = false;
global.localStorage = {
  getItem(k) { if (blocked) throw new Error('blocked'); return k in store ? store[k] : null; },
  setItem(k, v) { if (blocked) throw new Error('blocked'); store[k] = String(v); },
};
require('../js/config.js');
require('../js/levels/campaigns.js');
require('../js/core/storage.js');
const S = Dangle.Storage;
const C = Dangle.Campaigns;
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
const id = (mode, c, n) => C.levelId(mode, c, n);
function finishCampaign(mode, c) { for (let n = 1; n <= C.list[c - 1].levels; n++) S.recordResult(mode, id(mode, c, n), 10 + n, 0); }

check(C.totalLevels() === 75, 'each mode has 75 levels (5x5 + 5x10)');
check(C.list.slice(0, 5).every((c) => c.levels === 5) && C.list.slice(5).every((c) => c.levels === 10), 'campaigns 1-5 have 5 levels, 6-10 have 10');
check(C.allIds('solo').length === 75 && C.allIds('coop').length === 75, 'ids exist for all 150 slots');
check(C.parse('solo-3-2') && C.parse('solo-3-2').c === 3 && !C.parse('solo-1-6') && !C.parse('solo-11-1') && !C.parse('x-1-1'), 'level id parsing accepts valid ids only');

// Fresh save: only campaign 1 level 1 is open.
S.init({ dev: false });
check(S.campaignUnlocked('solo', 1) && !S.campaignUnlocked('solo', 2), 'fresh: only campaign 1 unlocked');
check(S.levelUnlocked('solo', 1, 1) && !S.levelUnlocked('solo', 1, 2), 'fresh: only level 1 unlocked');
check(!S.levelUnlocked('solo', 2, 1), 'fresh: campaign 2 level 1 locked');

// Finishing a level unlocks the next; modes are independent.
let r = S.recordResult('solo', id('solo', 1, 1), 42.5, 3);
check(r.first && r.newBest && !r.clean, 'first finish: new best, not clean (3 deaths)');
check(S.levelUnlocked('solo', 1, 2) && !S.levelUnlocked('solo', 1, 3), 'finishing 1-1 unlocks 1-2 only');
check(!S.levelUnlocked('coop', 1, 2), 'co-op progress is separate from solo');
r = S.recordResult('solo', id('solo', 1, 1), 50, 0);
check(!r.newBest && r.clean && S.record('solo', id('solo', 1, 1)).best === 42.5 && S.record('solo', id('solo', 1, 1)).clean, 'slower clean run: keeps best time, earns the clean medal');
r = S.recordResult('solo', id('solo', 1, 1), 30, 5);
check(r.newBest && S.record('solo', id('solo', 1, 1)).best === 30 && S.record('solo', id('solo', 1, 1)).clean, 'faster run with deaths: new best, medal is kept');

// Campaign unlock needs every level of the previous one.
for (let n = 2; n < 5; n++) S.recordResult('solo', id('solo', 1, n), 20, 1);
check(!S.campaignUnlocked('solo', 2), 'campaign 2 stays locked with 4/5 done');
S.recordResult('solo', id('solo', 1, 5), 20, 1);
check(S.campaignUnlocked('solo', 2) && S.levelUnlocked('solo', 2, 1) && !S.levelUnlocked('solo', 2, 2), 'finishing campaign 1 opens campaign 2 level 1');
check(S.campaignProgress('solo', 1).done === 5 && S.campaignProgress('solo', 1).total === 5 && S.campaignProgress('solo', 1).clean === 1, 'campaign progress counts done and clean');
check(S.nextUp('solo').c === 2 && S.nextUp('solo').n === 1, 'Continue points at the first unfinished level');

// Refresh: everything written is read back.
S.init({ dev: false });
check(S.record('solo', id('solo', 1, 1)).best === 30 && S.campaignUnlocked('solo', 2), 'progress survives a refresh');
const s = S.getSettings();
s.volume = 0.3; s.toggleGrab = true; s.chars = [4, 2]; s.controls[1].kb = 'ijkl'; S.saveSettings();
S.init({ dev: false });
check(S.getSettings().volume === 0.3 && S.getSettings().toggleGrab && S.getSettings().chars[0] === 4 && S.getSettings().controls[1].kb === 'ijkl', 'settings survive a refresh');

// The longest chain: finish everything in order.
S.reset();
for (let c = 1; c <= 10; c++) { check(S.campaignUnlocked('solo', c), `campaign ${c} opens in order`); finishCampaign('solo', c); }
check(S.nextUp('solo').c === 1, 'all done: Continue wraps to the start');

// Dev mode opens everything.
S.reset(); S.init({ dev: true });
check(S.campaignUnlocked('solo', 10) && S.levelUnlocked('coop', 10, 10), '?dev=1 unlocks all campaigns and levels');

// Corrupted saves cannot break the game.
store['dangle.v1.settings'] = '{"volume": "loud", "chars": "x", "controls": [{"kb":"banana","pad":9}], "toggleGrab": 1}';
store['dangle.v1.progress'] = '[1,2,3]';
S.init({ dev: false });
check(S.getSettings().volume === 0.8 && S.getSettings().controls[0].kb === 'auto' && S.getSettings().toggleGrab === false, 'garbage settings fall back to defaults');
check(S.record('solo', id('solo', 1, 1)) === null && S.campaignUnlocked('solo', 1), 'garbage progress falls back to a fresh start');
store['dangle.v1.progress'] = 'not json {';
S.init({ dev: false });
check(S.persistent === false || S.record('solo', 'solo-1-1') === null, 'unparseable progress is survived');

// localStorage blocked (private window, disabled): everything still works in memory.
blocked = true;
S.init({ dev: false });
S.recordResult('solo', id('solo', 1, 1), 33, 0);
check(S.persistent === false && S.record('solo', id('solo', 1, 1)).best === 33 && S.levelUnlocked('solo', 1, 2), 'blocked localStorage: works in memory and reports it');

console.log(fails ? `${fails} failed` : 'saves and unlocks ok');
process.exit(fails ? 1 : 0);
