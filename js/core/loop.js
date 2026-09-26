// Fixed-timestep loop: physics always advances in identical STEP slices, rendering
// interpolates between the last two steps. Feels the same at 60, 120 and 144 Hz.
window.Dangle = window.Dangle || {};

(function () {
  // The accumulator on its own (no requestAnimationFrame), so tests can drive it with any
  // frame timing. hooks: { frame(dt) once per frame (input), step() per physics step }.
  function createStepper(hooks) {
    const c = Dangle.config;
    let acc = 0;
    const st = {
      paused: false,
      lastSteps: 0,
      // Advance one rendered frame of dt seconds. Returns the render alpha in [0, 1).
      advance(dt) {
        dt = Math.min(Math.max(dt, 0), c.MAX_FRAME_DT);   // clamp tab-switch/breakpoint gaps
        hooks.frame(dt);
        let steps = 0;
        if (!st.paused) {
          acc += dt;
          while (acc >= c.STEP && steps < c.MAX_STEPS_PER_FRAME) {
            hooks.step();
            acc -= c.STEP;
            steps++;
          }
          if (acc >= c.STEP) acc %= c.STEP; // too slow: drop time rather than spiral
        }
        st.lastSteps = steps;
        return acc / c.STEP;
      },
    };
    return st;
  }

  // hooks: frame(dt), step(), render(alpha, dt)
  function start(hooks) {
    const stepper = createStepper(hooks);
    let last = performance.now();
    let raf = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, Dangle.config.MAX_FRAME_DT);
      last = now;
      hooks.render(stepper.advance(dt), dt);
    }

    raf = requestAnimationFrame(frame);
    return {
      // Run one frame of dt seconds by hand (tests and tools; no requestAnimationFrame needed).
      advance(dt) { hooks.render(stepper.advance(dt), dt); },
      setPaused(v) { stepper.paused = v; last = performance.now(); },
      isPaused() { return stepper.paused; },
      stop() { cancelAnimationFrame(raf); },
    };
  }

  Dangle.Loop = { start, createStepper };
})();
