# Solara Heat — an open-world crime game
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/afiatana/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/afiatana/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for the [**make.fun gta6-01 bounty**](https://make.fun/bounty/gta6-01) ("Make GTA 6"): https://make.fun

## What it is

**Solara Heat** is a complete 2D top-down open-world crime game set in **Solara Bay**,
a sun-soaked fictional coastal city. You are **Mara "Rook" Voss**, an ex-getaway driver
pulled back into the streets by her old fixer, **Otto Vale**. Run five story jobs,
steal cars, outrun the Solara PD, and take the Big Score — or just cruise the city
and make your own trouble.

Everything is original: the city, the characters, the vehicles, the story, the art
and the synthesized sound. Nothing is taken from any commercial game.

## What's in the game

- **A city to explore on foot and by car** — an 8×8 road grid with named landmarks
  (Otto's Garage, Solara Bank, St. Marina Hospital, the Breaker Warehouse, your
  Hideout, Solara Park), a beach and the sea.
- **Traffic and pedestrians** — cars cruise the road grid and turn at intersections;
  walkers stroll the sidewalks and run from gunfire.
- **Cars to steal and drive** — walk up to any car, press E, and drive it. Arcade
  handling with acceleration, braking, reverse, steering and a handbrake.
- **A wanted level with police who respond** — stars rise for stealing cars, shooting
  people and killing cops. Patrol cars chase and ram you; cops on foot close in and
  shoot. Stay quiet and the stars fall. Get caught on foot and you're **BUSTED**;
  run out of health and you're **WASTED** — either way you wake up at St. Marina
  Hospital, 10% lighter.
- **Missions and a story** — five jobs for Otto: First Gear, The Pickup, Breaker Block,
  Hot Pursuit and The Big Score, with objective markers, a beacon, timers, a holdout
  and a shootout. Finishing jobs pays cash and unlocks the VK-9 SMG.
- **Combat** — mouse-aimed shooting with two weapons (P9 Sidearm, VK-9 SMG), reloads,
  tracers, muzzle flashes and raycast hits blocked by buildings and cars.
- **HUD with a minimap** — health, cash, weapon and ammo, speed, wanted stars, a
  live minimap (roads, mission marker, police, rivals, you) and the current objective.
- **Start screen, pause and help screens, and a save** — progress (cash, jobs done,
  unlocked weapons) is saved in the browser and continues on the next visit.
- **Effects and sound** — particles, screen shake, skid behaviour, car explosions,
  and fully synthesized WebAudio sound: engine hum, two-tone sirens, gunshots,
  pickups, mission stings and a bass groove. No audio files, no network requests.

## How to play

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, or drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run on foot |
| Mouse | Aim |
| Click | Shoot |
| E | Steal / enter a car, or get out of one |
| R | Reload |
| 1 / 2 | Switch weapon (SMG unlocks after the third job) |
| Space | Handbrake |
| P / Esc | Pause |
| H | Help |
| M | Mute |

## How to run it

No build step, no install, no network. Serve the `game/` folder with any static
server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

`?seed=N` fixes the city layout and traffic; `?shot=cover|drive|foot|mission`
stages a deterministic screenshot scene instead of the live game.

## Files

- `game/index.html` — the page; `game/src/` — the game's own source, one job per file
  (`city.js`, `world.js`, `entities.js`, `missions.js`, `render.js`, `audio.js`,
  `input.js`, `shots.js`, `main.js`, `config.js`, `random.js`).
- `screenshots/` — four real renders of the game (cover: a 3-star police chase).
- `shots.json` — the scene each screenshot was taken from.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json`.
- `LICENSE` — MIT.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=3ywr8vjw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>