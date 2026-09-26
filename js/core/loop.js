// Fixed-timestep loop: physics always advances in identical STEP slices, rendering
// interpolates between the last two steps. Feels the same at 60, 120 and 144 Hz.
window.Dangle = window.Dangle || {};

(function () {
  // hooks: { frame(dt) once per rendered frame (input), step() per physics step, render(alpha, dt) }
  function start(hooks) {
    const c = Dangle.config;
    let last = performance.now();
    let acc = 0;
    let paused = false;
    let raf = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      // Clamp huge gaps (tab switch, breakpoint) so we never "catch up" for seconds.
      const dt = Math.min((now - last) / 1000, c.MAX_FRAME_DT);
      last = now;
      hooks.frame(dt);
      if (!paused) {
        acc += dt;
        let steps = 0;
        while (acc >= c.STEP && steps < c.MAX_STEPS_PER_FRAME) {
          hooks.step();
          acc -= c.STEP;
          steps++;
        }
        if (acc >= c.STEP) acc %= c.STEP; // too slow: drop time rather than spiral
      }
      hooks.render(acc / c.STEP, dt);
    }

    raf = requestAnimationFrame(frame);
    return {
      setPaused(v) { paused = v; last = performance.now(); },
      isPaused() { return paused; },
      stop() { cancelAnimationFrame(raf); },
    };
  }

  Dangle.Loop = { start };
})();
