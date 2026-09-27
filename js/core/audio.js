// Synthesized Web Audio SFX (Phase 10). No audio files: every sound is oscillators/noise built at
// call time from short envelopes, so the whole game stays a static site. Starts silent; the context
// is created (and only ever resumed) after a real user gesture, per browser autoplay rules.
// Safe to load anywhere `Dangle.*` loads, including headless tools under Node (no `window.AudioContext`
// there, so every trigger below is a silent no-op; nothing here assumes a DOM beyond feature-checks).
window.Dangle = window.Dangle || {};

Dangle.Audio = (function () {
  const cfg = () => Dangle.config;
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let volume = 0.8;        // 0..1, set by Settings (core/storage.js) via setVolume()

  // ---- lifecycle: create only after a gesture; suspend/resume with tab focus ------------------------
  function makeGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                          // no Web Audio here: every call below stays a no-op
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume * cfg().AUDIO_MASTER_TRIM;
    master.connect(ctx.destination);
  }

  const GESTURES = ['pointerdown', 'keydown', 'touchstart'];
  function onGesture() {
    if (!ctx) makeGraph();
    if (ctx && ctx.state !== 'running') ctx.resume();
    if (ctx) for (const e of GESTURES) window.removeEventListener(e, onGesture);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    for (const e of GESTURES) window.addEventListener(e, onGesture, { passive: true });
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume * cfg().AUDIO_MASTER_TRIM;
  }
  // Tab hidden/blurred: stop the clock so nothing queues up silently and bursts on refocus.
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  // Only schedule sound while the context genuinely has an open, running clock and isn't muted.
  function ready() { return !!ctx && ctx.state === 'running' && volume > 0.003; }

  function noise() {
    if (!noiseBuf) {
      const n = ctx.sampleRate; // 1 s of white noise, reused (and filtered/shaped) by every burst
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // ---- primitives: a gain envelope (linear attack, exponential decay) feeding the master bus ----------
  function env(peak, attack, decay, delay) {
    const g = ctx.createGain();
    const t0 = ctx.currentTime + (delay || 0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.006), t0 + attack + decay);
    g.connect(master);
    return { g, t0, end: t0 + attack + decay };
  }

  function filterInto(src, t0, end, f) {
    const node = ctx.createBiquadFilter();
    node.type = f.type || 'lowpass';
    node.Q.value = f.q || 1;
    node.frequency.setValueAtTime(f.freq, t0);
    if (f.glideTo) node.frequency.exponentialRampToValueAtTime(Math.max(20, f.glideTo), end);
    src.connect(node);
    return node;
  }

  // A short tone: sine/triangle/sawtooth, optional pitch glide and lowpass/bandpass shaping.
  function tone(freq, o) {
    if (!ready()) return;
    o = o || {};
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    const { g, t0, end } = env(o.gain === undefined ? 0.2 : o.gain, o.attack === undefined ? 0.004 : o.attack, o.decay === undefined ? 0.12 : o.decay, o.delay);
    osc.frequency.setValueAtTime(freq, t0);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), end);
    (o.filter ? filterInto(osc, t0, end, o.filter) : osc).connect(g);
    osc.start(t0); osc.stop(end + 0.03);
  }

  // A short burst of filtered noise (whooshes, crunches).
  function burst(o) {
    if (!ready()) return;
    o = o || {};
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const { g, t0, end } = env(o.gain === undefined ? 0.2 : o.gain, o.attack === undefined ? 0.003 : o.attack, o.decay === undefined ? 0.15 : o.decay, o.delay);
    (o.filter ? filterInto(src, t0, end, o.filter) : src).connect(g);
    src.start(t0); src.stop(end + 0.03);
  }

  // ---- named sounds, each restrained on purpose (this is ambience, not an arcade) ----------------------
  function grab() {
    const f = 185 + (Math.random() * 24 - 12);
    tone(f, { type: 'triangle', gain: 0.28, attack: 0.002, decay: 0.08, glideTo: f * 0.7 });
  }
  function release() {
    burst({ gain: 0.16, attack: 0.003, decay: 0.13, filter: { type: 'bandpass', freq: 1200, glideTo: 380, q: 0.9 } });
  }
  // Rate-limited by the caller (draw-player.js): only while a stretched grip is held.
  function creak() {
    tone(85 + Math.random() * 25, { type: 'sawtooth', gain: 0.05, attack: 0.02, decay: 0.3, filter: { type: 'lowpass', freq: 500, q: 0.6 } });
  }
  function land(impact) {
    const k = Math.min(1, impact / 1400);
    tone(95 - k * 30, { type: 'sine', gain: 0.16 + k * 0.16, attack: 0.002, decay: 0.13 + k * 0.06 });
  }
  function death() {
    burst({ gain: 0.22, attack: 0.001, decay: 0.11, filter: { type: 'lowpass', freq: 900, glideTo: 220, q: 0.8 } });
    tone(170, { type: 'sine', gain: 0.2, attack: 0.003, decay: 0.3, glideTo: 65, delay: 0.02 });
  }
  function revive() {
    tone(520, { type: 'sine', gain: 0.16, attack: 0.006, decay: 0.14, glideTo: 700 });
  }
  function bounce() {
    tone(230, { type: 'sine', gain: 0.24, attack: 0.003, decay: 0.16, glideTo: 660 });
  }
  function checkpoint() {
    tone(659.25, { type: 'triangle', gain: 0.22, attack: 0.004, decay: 0.16 });
    tone(880, { type: 'triangle', gain: 0.2, attack: 0.004, decay: 0.22, delay: 0.08 });
  }
  function goal() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: 'triangle', gain: 0.17, attack: 0.006, decay: 0.45, delay: i * 0.1 }));
  }
  function uiMove() { tone(720, { type: 'sine', gain: 0.08, attack: 0.001, decay: 0.035 }); }
  function uiConfirm() { tone(880, { type: 'triangle', gain: 0.12, attack: 0.001, decay: 0.06, glideTo: 1040 }); }
  function uiBack() { tone(540, { type: 'triangle', gain: 0.1, attack: 0.001, decay: 0.07, glideTo: 400 }); }

  // ---- level events: the same queue particles.js drains (js/game.js calls both, same frame) -----------
  function consume(W) {
    const L = W.level;
    if (!L || !ready()) return;
    for (const e of L.events) {
      if (e.type === 'death') death();
      else if (e.type === 'revive') revive();
      else if (e.type === 'checkpoint') checkpoint();
      else if (e.type === 'bounce') bounce();
      else if (e.type === 'complete') goal();
      else if (e.type === 'grab') grab();
      else if (e.type === 'release') release();
    }
  }

  return { setVolume, suspend, resume, consume, land, creak, uiMove, uiConfirm, uiBack };
})();
