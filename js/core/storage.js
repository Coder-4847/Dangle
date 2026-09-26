// Persistence: settings and progress in localStorage (always in try/catch; falls back to memory when
// storage is blocked, and remembers that so the UI can say progress won't be kept).
// Also the unlock rules. Pure logic + storage: no DOM, so tools/progress-test.js can run it under node.
window.Dangle = window.Dangle || {};

(function () {
  const KEY_SETTINGS = 'dangle.v1.settings';
  const KEY_PROGRESS = 'dangle.v1.progress';

  const DEFAULT_SETTINGS = {
    volume: 0.8,
    toggleGrab: false,
    assist: false,
    reduceShake: false,
    mouseAim: false,
    chars: [0, 1],
    // Per player: which keyboard scheme ('auto' | 'wasd' | 'ijkl' | 'none') and gamepad ('auto' | 0..3 | 'none').
    controls: [{ kb: 'auto', pad: 'auto' }, { kb: 'auto', pad: 'auto' }],
  };

  let persistent = true;              // false when localStorage is unavailable
  const memory = {};                  // fallback store
  let settings = null;
  let progress = null;
  let dev = false;                    // ?dev=1 unlocks everything

  function read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { persistent = false; return memory[key] ? JSON.parse(memory[key]) : null; }
  }
  function write(key, value) {
    const raw = JSON.stringify(value);
    memory[key] = raw;
    try { window.localStorage.setItem(key, raw); } catch (e) { persistent = false; }
  }

  // Merge saved values over defaults, keeping only keys we know (a corrupted or older save can't break us).
  function sanitizeSettings(raw) {
    const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (!raw || typeof raw !== 'object') return s;
    const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    s.volume = num(raw.volume, 0, 1, s.volume);
    for (const k of ['toggleGrab', 'assist', 'reduceShake', 'mouseAim']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
    if (Array.isArray(raw.chars)) s.chars = [0, 1].map((i) => num(raw.chars[i], 0, 99, s.chars[i]) | 0);
    if (Array.isArray(raw.controls)) {
      s.controls = [0, 1].map((i) => {
        const c = raw.controls[i] || {};
        return {
          kb: ['auto', 'wasd', 'ijkl', 'none'].indexOf(c.kb) >= 0 ? c.kb : 'auto',
          pad: c.pad === 'auto' || c.pad === 'none' || (Number.isInteger(c.pad) && c.pad >= 0 && c.pad < 4) ? c.pad : 'auto',
        };
      });
    }
    return s;
  }

  function sanitizeProgress(raw) {
    const p = { solo: {}, coop: {} };
    if (!raw || typeof raw !== 'object') return p;
    for (const mode of ['solo', 'coop']) {
      const src = raw[mode];
      if (!src || typeof src !== 'object') continue;
      for (const id of Object.keys(src)) {
        const r = src[id];
        if (!r || typeof r !== 'object') continue;
        p[mode][id] = { done: !!r.done, best: typeof r.best === 'number' && r.best > 0 ? r.best : 0, clean: !!r.clean };
      }
    }
    return p;
  }

  function init(opts) {
    dev = !!(opts && opts.dev);
    settings = sanitizeSettings(read(KEY_SETTINGS));
    progress = sanitizeProgress(read(KEY_PROGRESS));
  }

  function getSettings() { if (!settings) init(); return settings; }
  function saveSettings() { write(KEY_SETTINGS, settings); }

  function record(mode, id) { if (!progress) init(); return progress[mode][id] || null; }

  // Called when a level is finished. Returns { newBest, first, clean, best }.
  function recordResult(mode, id, time, deaths) {
    if (!progress) init();
    const prev = progress[mode][id] || { done: false, best: 0, clean: false };
    const first = !prev.done;
    const newBest = !prev.done || time < prev.best;
    const clean = deaths === 0;
    progress[mode][id] = { done: true, best: newBest ? time : prev.best, clean: prev.clean || clean };
    write(KEY_PROGRESS, progress);
    return { first, newBest, clean, best: progress[mode][id].best, prevBest: prev.best };
  }

  // ---- unlock rules ------------------------------------------------------------------------
  // Levels unlock in order inside a campaign; a campaign unlocks when the one before it is fully done.
  function isDone(mode, id) { const r = record(mode, id); return !!(r && r.done); }

  function campaignDone(mode, c) {
    const C = Dangle.Campaigns;
    for (let n = 1; n <= C.list[c - 1].levels; n++) if (!isDone(mode, C.levelId(mode, c, n))) return false;
    return true;
  }
  function campaignUnlocked(mode, c) { return dev || c === 1 || campaignDone(mode, c - 1); }
  function levelUnlocked(mode, c, n) {
    if (dev) return true;
    if (!campaignUnlocked(mode, c)) return false;
    return n === 1 || isDone(mode, Dangle.Campaigns.levelId(mode, c, n - 1));
  }
  function campaignProgress(mode, c) {
    const C = Dangle.Campaigns;
    let done = 0, clean = 0;
    const total = C.list[c - 1].levels;
    for (let n = 1; n <= total; n++) {
      const r = record(mode, C.levelId(mode, c, n));
      if (r && r.done) { done++; if (r.clean) clean++; }
    }
    return { done, clean, total };
  }
  // The level "Continue" should open: the first unfinished unlocked one.
  function nextUp(mode) {
    const C = Dangle.Campaigns;
    for (let c = 1; c <= C.list.length; c++) {
      if (!campaignUnlocked(mode, c)) break;
      for (let n = 1; n <= C.list[c - 1].levels; n++) if (!isDone(mode, C.levelId(mode, c, n))) return { c, n };
    }
    return { c: 1, n: 1 };
  }

  function reset() { progress = { solo: {}, coop: {} }; write(KEY_PROGRESS, progress); }

  Dangle.Storage = {
    init, getSettings, saveSettings, record, recordResult, reset, sanitizeSettings, sanitizeProgress,
    campaignUnlocked, levelUnlocked, campaignDone, campaignProgress, nextUp, isDone,
    get persistent() { return persistent; },
    get dev() { return dev; },
    DEFAULT_SETTINGS,
  };
})();
