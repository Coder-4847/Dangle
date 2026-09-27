// Level registry and compiler: definitions in, specs (plain data) out.
//   { id, name, theme, direction: 'right'|'up', coop, difficulty, seed, segments: [[name, opts], ...] }
window.Dangle = window.Dangle || {};

(function () {
  const defs = [];
  const cache = {};

  function register(def) {
    if (defs.some((d) => d.id === def.id)) throw new Error('duplicate level id ' + def.id);
    defs.push(def);
  }

  // Run the segments in order, dropping a checkpoint whenever enough safe progress has been made.
  function compile(def) {
    const c = Dangle.config;
    const b = Dangle.Builder.create(def);
    for (const [name, opts] of def.segments) {
      const seg = Dangle.Segments.get(name);
      if (!seg) throw new Error(`${def.id}: unknown segment '${name}'`);
      if (seg.dir !== b.dir) throw new Error(`${def.id}: segment '${name}' is for ${seg.dir} levels, this one goes ${b.dir}`);
      const p0 = b.progress();
      const y0 = b.y;
      b.safe = false;
      seg.fn(b, opts || {});
      b.spec.segments.push({ name, p0, p1: b.progress(), y0, y1: b.y });
      const wantsCp = !(opts && opts.cp === false);
      if (wantsCp && b.safe && b.cpAt && b.progress() - b.lastCp >= c.CHECKPOINT_SPACING * c.REACH) {
        b.checkpoint(b.cpAt.x, b.cpAt.y);
      }
    }
    return Dangle.Builder.finish(b);
  }

  // Compiled specs are cached; the loader never mutates them.
  function spec(id) {
    if (!cache[id]) {
      const def = get(id);
      if (!def) throw new Error('unknown level ' + id);
      cache[id] = compile(def);
    }
    return cache[id];
  }

  // A registered (authored or test) definition, or null.
  function get(id) { return defs.find((d) => d.id === id) || null; }
  function list() { return defs.slice(); }

  // Every playable definition. Every campaign slot must be authored: a missing one is an error, not a silent gap.
  function all() {
    if (Dangle.Campaigns) for (const mode of ['solo', 'coop']) for (const id of Dangle.Campaigns.allIds(mode)) if (!get(id)) throw new Error('no level authored for ' + id);
    return defs.slice();
  }

  Dangle.Levels = { register, compile, spec, get, find: get, list, all };
})();
