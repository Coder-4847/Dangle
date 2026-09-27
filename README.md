# Dangle

A 2D physics platformer for the browser: a blobby head with two stretchy arms. Grab, swing, heave and fling
yourself — and your friend — to the goal. Inspired by the *formula* of games like Heave Ho (a head, two arms,
grab-and-swing physics), but every name, character, sound and piece of art here is original.

Solo mode (one player) and local co-op (two players, one screen), 10 campaigns per mode, 75 levels per mode
(150 levels in total).

## Playing it

**Play in your browser:** https://coder-4847.github.io/Dangle/

Dangle is a fully static site: plain HTML, CSS and JavaScript, no build step, no server required, and no
internet connection needed once you have the files. There are two ways to run it:

- **Double-click `index.html`.** It opens straight in your browser and works completely offline. This is why
  the code uses classic `<script>` tags instead of ES modules — modules are blocked on the `file://` protocol.
- **Serve it locally** (needed only if you want the browser's dev tools network tab, or you're editing the
  code and don't want to fight cached JavaScript): `python tools/serve.py 8000`, then open
  `http://localhost:8000/`.

No installation, no `npm install`, no accounts. Progress (unlocked campaigns, best times) is saved to your
browser's `localStorage`; if that's unavailable (private browsing, some embedded contexts), the game still
plays fine, it just can't remember your progress between visits, and Settings tells you so.

## Controls

**Solo, keyboard:** WASD or arrow keys aim your arms; `Q` = left glove grab, `E` = right glove grab. You can
also aim with the mouse and grab with the left/right mouse buttons (toggle in Settings).

**Co-op, keyboard:** player 1 is WASD + Q/E as above; player 2 is `I J K L` + `U`/`O`. Two people sharing one
keyboard sometimes runs into how many keys it can register at once — a gamepad each is more comfortable.

**Gamepad:** the left stick aims, the left and right triggers (or bumpers) grab. Plug in mid-game and it's
picked up automatically; Settings lets you assign a specific pad to a specific player.

**Either mode:** `Esc` or `P` (or Start on a pad) pauses; hold `R` for a moment to restart the level.

Settings also has toggle-to-grab (tap instead of hold), a bigger grab tolerance ("assist"), reduced screen
shake, and a volume slider for the game's sound.

## Modes and campaigns

| # | Campaign | Levels | Idea |
|---|---|---|---|
| 1 | Sunny Meadow | 5 | Learn to grab, swing, heave |
| 2 | Bamboo Grove | 5 | Vines, ropes, pendulums |
| 3 | Lantern Caves | 5 | Dark, narrow swings |
| 4 | Salt Flats | 5 | Long gaps, wind, crates |
| 5 | Frozen Peaks | 5 | Ice and vertical climbs |
| 6 | Tidal Ruins | 10 | Rising water, timed sections |
| 7 | Clockwork Works | 10 | Moving platforms, timing |
| 8 | Sky Islands | 10 | Trampolines, wind, big drops |
| 9 | Ember Depths | 10 | Lava, no-grab walls |
| 10 | The Big Dangle | 10 | Everything at once |

Co-op has the same ten campaigns, redesigned so two players are genuinely needed: hold-open gates, counterweight
lifts, crates too heavy to push alone, and gaps only crossed by climbing over your partner.

Campaigns unlock in order as you finish the one before; levels within a campaign unlock in order too.
`?dev=1` on the URL unlocks everything, for testing.

## Project layout

```
index.html  css/style.css        entry point and styling
js/lib/matter.min.js             vendored physics engine (offline, no CDN)
js/config.js                     every tunable number in the game, in one place
js/core/                         loop, input, camera, characters, save data, audio
js/physics/                      the player, grabbing, world geometry, level rules, co-op devices
js/levels/                       level format, the segment library levels are built from, the 150 level defs
js/render/                       the hand-drawn "crayon" look, scenery, characters, particles
js/ui/                           menus, screens, HUD
js/dev/                          physics stress-test harness (?stress=1)
tools/                           Node scripts that check the game without a browser (see below)
docs/MASTER_PROMPT.md            the full design brief this project was built from
```

## For developers

There's no build step and nothing to install, but there is a battery of offline checks. From the project
folder, with Node installed:

```bash
node tools/check-all.js          # runs everything below; must print "everything passes"
node tools/sim-test.js           # physics stress tests (grabbing, swinging, chains, tunneling, low frame rate...)
node tools/lint-levels.js        # every level has a spawn, a goal, fair gap sizes, etc.
node tools/level-smoke.js --all  # every level loads, can be finished, respawns correctly, and unloads cleanly
node tools/level-bot.js          # scripted players cross every obstacle of all 150 levels
node tools/coop-bots.js          # two scripted players cross each co-op obstacle; one alone can't
```

In the browser, `?dev=1` unlocks everything and adds a debug overlay (backtick toggles it), a live tuning panel,
`L` to skip to the next level and `R` to restart. `?level=solo-3-2` jumps straight into a level, and
`?stress=1` opens the physics stress-test table.

`docs/MASTER_PROMPT.md` is the full design specification, and `PROGRESS.md` is a running log of what was
built in each development phase and why particular numbers were chosen.

## Credits

Built by Claude Code (Anthropic) working with Ettan Bansal, following the design brief in
`docs/MASTER_PROMPT.md`. Inspired by the formula of Heave Ho (Le Cartel Studio) — no assets, names, art,
music or characters from that game are used; everything here is original.
