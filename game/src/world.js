// Solara Heat's rules and state, with no drawing and no browser in it: the player
// on foot and in cars, traffic, walkers, the police and the wanted level, shooting,
// missions and the story, pickups, particles, busted and wasted, and the save file.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can play sounds without the world knowing about audio.
import { CAR, PLAYER, SAVE_KEY, STEP, WANTED, WEAPON, WORLD } from './config.js';
import { angleDiff, driveCar, makeCar, makePed, updatePed, updatePoliceCar, updateTraffic } from './entities.js';
import { ACTION_ENTER, ACTION_RELOAD } from './input.js';
import { isInWater, isOnRoad, isOnSand, nearestRoadPoint, randomRoadPoint } from './city.js';
import { buildMissions, STORY_COMPLETE } from './missions.js';
import { pick, range } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_ENEMY_SHOT = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION_START = 32;
export const EVENT_MISSION_DONE = 64;
export const EVENT_MISSION_FAIL = 128;
export const EVENT_BUSTED = 256;
export const EVENT_WASTED = 512;
export const EVENT_STOLEN = 1024;

const TRAFFIC_COUNT = 14;
const PED_COUNT = 26;
const MAX_POLICE_CARS = 5;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(rng, city) {
  const missions = buildMissions(city.landmarkPoints);
  const state = {
    time: 0,
    city,
    missions,
    player: null,
    cars: [],
    peds: [],
    policeCars: [],
    cops: [],
    gang: [],
    particles: [],
    tracers: [],
    pickups: [],
    floaters: [],
    wanted: 0,
    quietTimer: 0,
    lastCrimeAt: -999,
    missionIndex: 0,
    missionStep: 0,
    missionActive: false,
    missionTimer: 0,
    missionWait: 0,
    killsLeft: 0,
    killsDone: 0,
    storyDone: false,
    toast: '',
    toastTimer: 0,
    shake: 0,
    bustedTimer: 0,
    pickupTimer: 6,
    stats: { kills: 0, carsStolen: 0, missionsDone: 0 },
    save: null,
  };
  let nextCarId = 1;

  function saveData() {
    return {
      money: state.player.money,
      missionIndex: state.missionIndex,
      unlocked: state.player.unlocked.slice(),
      stats: state.stats,
      storyDone: state.storyDone,
    };
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData()));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function spawnTrafficCar(near) {
    const spot = near ? nearestRoadPoint(near.x + range(rng, -500, 500), near.y + range(rng, -500, 500)) : randomRoadPoint(rng);
    const angle = near ? range(rng, 0, Math.PI * 2) : (Math.abs(spot.x - Math.round(spot.x / 400) * 400) < 10 ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI));
    const car = makeCar(rng, spot.x, spot.y, angle, { id: nextCarId });
    nextCarId += 1;
    car.speed = car.targetSpeed;
    return car;
  }

  function spawnPed(near) {
    const spot = near ? nearestRoadPoint(near.x + range(rng, -600, 600), near.y + range(rng, -600, 600)) : randomRoadPoint(rng);
    const ped = makePed(rng, spot.x + range(rng, -40, 40), spot.y + range(rng, -40, 40));
    return ped;
  }

  function spawnPoliceCar() {
    const p = state.player;
    const angle = range(rng, 0, Math.PI * 2);
    const spot = nearestRoadPoint(p.x + Math.cos(angle) * 700, p.y + Math.sin(angle) * 700);
    const car = makeCar(rng, spot.x, spot.y, 0, { id: nextCarId, police: true, driver: 'police', color: '#1f2a44', name: 'PD Interceptor' });
    nextCarId += 1;
    car.speed = 320;
    state.policeCars.push(car);
  }

  function spawnCop() {
    const p = state.player;
    const angle = range(rng, 0, Math.PI * 2);
    const cop = makePed(rng, p.x + Math.cos(angle) * 420, p.y + Math.sin(angle) * 420);
    cop.cop = true;
    cop.shirt = '#1f2a44';
    cop.speed = 150;
    state.cops.push(cop);
  }

  function spawnGang(count, x, y) {
    for (let i = 0; i < count; i += 1) {
      const g = makePed(rng, x + range(rng, -140, 140), y + range(rng, -140, 140));
      g.gang = true;
      g.shirt = '#7a2a2a';
      g.speed = 120;
      state.gang.push(g);
    }
  }

  function addParticle(x, y, vx, vy, life, color, size) {
    state.particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = range(rng, 0, Math.PI * 2);
      const s = range(rng, speed * 0.3, speed);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, range(rng, 0.3, 0.7), color, range(rng, 2, 5));
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.4 });
  }

  function toast(text) {
    state.toast = text;
    state.toastTimer = 4;
  }

  function addWanted(stars) {
    if (stars <= 0) return;
    state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
    state.lastCrimeAt = state.time;
    state.quietTimer = 0;
  }

  function setWanted(stars) {
    state.wanted = Math.max(state.wanted, stars);
    state.lastCrimeAt = state.time;
    state.quietTimer = 0;
  }

  function explodeCar(car) {
    burst(car.x, car.y, '#ff7a2a', 26, 320);
    burst(car.x, car.y, '#3a3a3a', 18, 180);
    burst(car.x, car.y, '#ffd23a', 14, 260);
    state.shake = 10;
    car.dead = true;
    if (car.driver === 'player') exitCar(true);
  }

  function killPed(ped, byPlayer) {
    if (ped.state === 'dead') return;
    ped.state = 'dead';
    ped.health = 0;
    burst(ped.x, ped.y, '#c94f4f', 10, 140);
    if (byPlayer) {
      state.stats.kills += 1;
      if (ped.cop) addWanted(WANTED.killCop);
      else if (ped.gang) {
        state.killsDone += 1;
        state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: 150, life: 30 });
      } else addWanted(WANTED.killPed);
    }
  }

  function reset() {
    const save = loadSave();
    state.save = save;
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.policeCars = [];
    state.cops = [];
    state.gang = [];
    state.particles = [];
    state.tracers = [];
    state.pickups = [];
    state.floaters = [];
    state.wanted = 0;
    state.quietTimer = 0;
    state.lastCrimeAt = -999;
    state.missionIndex = save ? save.missionIndex : 0;
    state.missionStep = 0;
    state.missionActive = false;
    state.missionTimer = 0;
    state.missionWait = 0;
    state.killsLeft = 0;
    state.killsDone = 0;
    state.storyDone = save ? Boolean(save.storyDone) : false;
    state.toast = '';
    state.toastTimer = 0;
    state.shake = 0;
    state.bustedTimer = 0;
    state.pickupTimer = 6;
    state.stats = save ? { ...save.stats } : { kills: 0, carsStolen: 0, missionsDone: 0 };
    const hideout = city.landmarkPoints.hideout;
    state.player = {
      x: hideout.x, y: hideout.y + 30, angle: -Math.PI / 2,
      health: PLAYER.health, money: save ? save.money : 250,
      weapon: 'pistol', ammo: WEAPON.pistol.mag, reloading: 0, fireTimer: 0,
      inCar: null, aimX: hideout.x, aimY: hideout.y - 100,
      unlocked: save ? save.unlocked.slice() : ['pistol'],
      hurtTimer: 0,
    };
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed());
    // A parked car outside the hideout, so the first job is always startable.
    const parked = makeCar(rng, hideout.x + 120, hideout.y + 40, 0, { id: nextCarId, driver: 'none', color: '#e8b23a', name: 'Vento GT' });
    nextCarId += 1;
    state.cars.push(parked);
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    for (const car of state.policeCars) {
      if (car.dead) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    const wasDriver = car.driver;
    p.inCar = car;
    car.driver = 'player';
    if (car.police || wasDriver === 'traffic') addWanted(WANTED.stealCar);
    state.stats.carsStolen += 1;
    return EVENT_STOLEN;
  }

  function exitCar(forced) {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    car.driver = 'none';
    car.speed *= 0.3;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.inCar = null;
    void forced;
  }

  function fireWeapon() {
    const p = state.player;
    const weapon = WEAPON[p.weapon];
    if (p.reloading > 0 || p.fireTimer > 0) return 0;
    if (p.ammo <= 0) {
      p.reloading = weapon.reload;
      return 0;
    }
    p.ammo -= 1;
    p.fireTimer = weapon.rate;
    const ox = p.inCar ? p.inCar.x : p.x;
    const oy = p.inCar ? p.inCar.y : p.y;
    const baseAngle = Math.atan2(p.aimY - oy, p.aimX - ox);
    const angle = baseAngle + range(rng, -weapon.spread, weapon.spread);
    const mx = ox + Math.cos(angle) * 14;
    const my = oy + Math.sin(angle) * 14;
    addParticle(mx, my, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.08, '#ffd23a', 5);
    // Walk the ray: buildings stop it, the first living thing it meets is hit.
    let endX = ox + Math.cos(angle) * weapon.range;
    let endY = oy + Math.sin(angle) * weapon.range;
    let hitSomething = false;
    for (let t = 16; t <= weapon.range; t += 12) {
      const x = ox + Math.cos(angle) * t;
      const y = oy + Math.sin(angle) * t;
      let blocked = false;
      for (const b of city.buildings) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
          blocked = true;
          endX = x;
          endY = y;
          break;
        }
      }
      if (blocked) break;
      const targets = [];
      for (const ped of state.peds) if (ped.state !== 'dead') targets.push(ped);
      for (const cop of state.cops) if (cop.state !== 'dead') targets.push(cop);
      for (const g of state.gang) if (g.state !== 'dead') targets.push(g);
      for (const target of targets) {
        if (dist(x, y, target.x, target.y) < 15) {
          target.health -= weapon.damage;
          burst(target.x, target.y, '#c94f4f', 6, 120);
          if (target.health <= 0) killPed(target, true);
          else if (!target.cop && !target.gang) {
            target.state = 'flee';
            addWanted(WANTED.shootPed);
          }
          endX = x;
          endY = y;
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) break;
      for (const car of state.cars.concat(state.policeCars)) {
        if (car.dead || car.driver === 'player') continue;
        const along = (x - car.x) * Math.cos(car.angle) + (y - car.y) * Math.sin(car.angle);
        const side = Math.abs(-(x - car.x) * Math.sin(car.angle) + (y - car.y) * Math.cos(car.angle));
        if (Math.abs(along) < CAR.length / 2 + 4 && side < CAR.width / 2 + 4) {
          car.health -= weapon.damage;
          burst(x, y, '#ffd23a', 5, 120);
          if (car.health <= 0) explodeCar(car);
          endX = x;
          endY = y;
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) break;
    }
    state.tracers.push({ x1: mx, y1: my, x2: endX, y2: endY, life: 0.07 });
    return EVENT_SHOT;
  }

  function currentMission() {
    return state.missionIndex < missions.length ? missions[state.missionIndex] : null;
  }

  function startMission() {
    const mission = currentMission();
    if (!mission) return 0;
    state.missionActive = true;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionWait = 0;
    state.killsDone = 0;
    state.killsLeft = 0;
    applyStepEntry(mission.steps[0], 0);
    toast(`${mission.title} — ${mission.brief}`);
    return EVENT_MISSION_START;
  }

  function applyStepEntry(step, index) {
    const mission = currentMission();
    if (mission && mission.wantedOnStep && mission.wantedOnStep.step === index) {
      setWanted(mission.wantedOnStep.stars);
    }
    if (step.type === 'kill') {
      state.killsLeft = step.count;
      state.killsDone = 0;
      spawnGang(step.count + 1, step.x, step.y);
    }
    if (step.type === 'escape') state.missionTimer = step.seconds;
    state.missionWait = 0;
  }

  function advanceStep() {
    const mission = currentMission();
    if (!mission) return 0;
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      return completeMission();
    }
    applyStepEntry(mission.steps[state.missionStep], state.missionStep);
    return 0;
  }

  function completeMission() {
    const mission = currentMission();
    state.missionActive = false;
    state.player.money += mission.reward;
    state.stats.missionsDone += 1;
    if (mission.unlock && !state.player.unlocked.includes(mission.unlock)) {
      state.player.unlocked.push(mission.unlock);
      state.player.weapon = mission.unlock;
      state.player.ammo = WEAPON[mission.unlock].mag;
    }
    floater(state.player.x, state.player.y - 40, `+$${mission.reward}`, '#7ddb8a');
    state.missionIndex += 1;
    if (state.missionIndex >= missions.length) {
      state.storyDone = true;
      toast(STORY_COMPLETE);
    } else {
      toast(`Job done. Next: ${missions[state.missionIndex].title} at Otto's Garage.`);
    }
    state.gang = state.gang.filter((g) => g.state === 'dead');
    save();
    return EVENT_MISSION_DONE | EVENT_CASH;
  }

  function failMission(reason) {
    state.missionActive = false;
    state.gang = [];
    toast(`Job failed: ${reason} — head back to Otto's Garage to try again.`);
    return EVENT_MISSION_FAIL;
  }

  function respawn(reason) {
    const p = state.player;
    const hospital = city.landmarkPoints.hospital;
    const lost = Math.floor(p.money * 0.1);
    p.money -= lost;
    p.health = PLAYER.health;
    p.x = hospital.x;
    p.y = hospital.y + 40;
    p.inCar = null;
    state.wanted = 0;
    state.policeCars = [];
    state.cops = [];
    state.missionActive = false;
    state.gang = [];
    save();
    return reason === 'busted' ? EVENT_BUSTED : EVENT_WASTED;
  }

  function stepMission(dt) {
    const mission = currentMission();
    if (!mission || !state.missionActive) return 0;
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const stepDef = mission.steps[state.missionStep];
    if (!stepDef) return 0;
    if (stepDef.type === 'goto') {
      if (dist(px, py, stepDef.x, stepDef.y) < stepDef.radius) return advanceStep();
    } else if (stepDef.type === 'enterCar') {
      if (p.inCar) return advanceStep();
    } else if (stepDef.type === 'wait') {
      if (dist(px, py, stepDef.x, stepDef.y) < stepDef.radius) {
        state.missionWait += dt;
        if (state.missionWait >= stepDef.seconds) return advanceStep();
      } else {
        state.missionWait = 0;
      }
    } else if (stepDef.type === 'kill') {
      if (state.killsDone >= state.killsLeft) return advanceStep();
    } else if (stepDef.type === 'escape') {
      state.missionTimer -= dt;
      if (dist(px, py, stepDef.x, stepDef.y) < stepDef.radius) return advanceStep();
      if (state.missionTimer <= 0) return failMission('the PD boxed you in');
    }
    return 0;
  }

  function step(dt, input, actions) {
    let events = 0;
    state.time += dt;
    const p = state.player;

    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) p.ammo = WEAPON[p.weapon].mag;
    }
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

    // --- Player movement: on foot, or driving. ---
    const aim = input.aiming();
    p.aimX = aim.x;
    p.aimY = aim.y;
    if (p.inCar) {
      const car = p.inCar;
      const drive = input.drive();
      driveCar(car, dt, drive.throttle, drive.steer, drive.handbrake);
      if (city.collideCar(car)) {
        if (Math.abs(car.speed) > 240) {
          events |= EVENT_CRASH;
          burst(car.x, car.y, '#ffd23a', 8, 160);
          state.shake = 6;
        }
        car.speed *= -0.25;
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
      if (actions & ACTION_ENTER) exitCar(false); // E leaves the car
      if (input.firing()) events |= fireWeapon();
    } else {
      const move = input.move();
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(move.x, move.y);
      if (len > 0) {
        p.x += (move.x / len) * speed * dt;
        p.y += (move.y / len) * speed * dt;
        p.angle = Math.atan2(move.y, move.x);
      }
      const pos = { x: p.x, y: p.y };
      city.collideCircle(pos, PLAYER.radius);
      p.x = pos.x;
      p.y = pos.y;
      p.x = Math.max(20, Math.min(WORLD.size - 20, p.x));
      p.y = Math.max(20, Math.min(WORLD.beachTop + 140, p.y));
      if (isInWater(p.x, p.y)) p.y = WORLD.beachTop + 140;
      if (actions & ACTION_ENTER) {
        const car = nearestCar(p.x, p.y, 78);
        if (car) events |= enterCar(car);
      }
      if (input.firing()) events |= fireWeapon();
    }
    if (actions & ACTION_RELOAD) {
      // ACTION_RELOAD
      const weapon = WEAPON[p.weapon];
      if (p.ammo < weapon.mag && p.reloading <= 0) p.reloading = weapon.reload;
    }
    // Switch weapon with 1 / 2 when unlocked.
    const weaponWant = input.weapon();
    if (weaponWant) {
      const want = weaponWant;
      if (state.player.unlocked.includes(want) && want !== p.weapon) {
        p.weapon = want;
        p.ammo = WEAPON[want].mag;
        p.reloading = 0;
      }
    }

    // --- Traffic, walkers, police. ---
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.driver === 'player') continue;
      if (car.driver === 'none') continue; // a parked car stays parked
      updateTraffic(car, dt, rng, state.cars.concat(state.policeCars));
      city.collideCar(car);
    }
    // Keep traffic topped up near the player.
    if (state.cars.filter((c) => !c.dead).length < TRAFFIC_COUNT) {
      state.cars.push(spawnTrafficCar(p));
    }
    if (state.peds.filter((x) => x.state !== 'dead').length < PED_COUNT) {
      state.peds.push(spawnPed(p));
    }
    const danger = state.time - state.lastCrimeAt < 2 ? { x: p.x, y: p.y } : null;
    for (const ped of state.peds) {
      updatePed(ped, dt, rng, danger);
      const pos = { x: ped.x, y: ped.y };
      city.collideCircle(pos, 10);
      ped.x = pos.x;
      ped.y = pos.y;
    }

    // Wanted decay: quiet for a while, then a star falls every few seconds.
    if (state.wanted > 0) {
      state.quietTimer += dt;
      if (state.quietTimer > WANTED.decayDelay + WANTED.decayInterval) {
        state.wanted -= 1;
        state.quietTimer = WANTED.decayDelay;
      }
    }

    // Police response scales with the wanted level.
    const wantCars = state.wanted === 0 ? 0 : Math.min(MAX_POLICE_CARS, state.wanted + (state.wanted >= 3 ? 1 : 0));
    while (state.policeCars.filter((c) => !c.dead).length < wantCars) spawnPoliceCar();
    for (const car of state.policeCars) {
      if (car.dead) continue;
      updatePoliceCar(car, dt, p.x, p.y);
      city.collideCar(car);
      // A police car ramming the player hurts, on foot or in a car.
      if (dist(car.x, car.y, p.x, p.y) < 52 && Math.abs(car.speed) > 120) {
        if (p.inCar) {
          p.inCar.health -= 10;
          events |= EVENT_CRASH;
          if (p.inCar.health <= 0) explodeCar(p.inCar);
        } else {
          p.health -= 22;
          p.hurtTimer = 0.5;
          state.shake = 7;
        }
        car.speed *= -0.3;
      }
    }
    const wantCops = state.wanted >= 2 && !p.inCar ? Math.min(3, state.wanted - 1) : 0;
    while (state.cops.filter((c) => c.state !== 'dead').length < wantCops) spawnCop();
    for (const cop of state.cops) {
      if (cop.state === 'dead') continue;
      const d = dist(cop.x, cop.y, p.x, p.y);
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle += angleDiff(want, cop.angle) * Math.min(1, 5 * dt);
      if (d > 46) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
        const pos = { x: cop.x, y: cop.y };
        city.collideCircle(pos, 10);
        cop.x = pos.x;
        cop.y = pos.y;
      } else if (d < 260 && rng() < dt * 0.9) {
        // A cop close enough takes a shot.
        events |= EVENT_ENEMY_SHOT;
        if (rng() < 0.45) {
          p.health -= 9;
          p.hurtTimer = 0.4;
          burst(p.x, p.y, '#c94f4f', 4, 100);
        }
      }
      // Busted: a cop stands next to you for a while.
      if (d < 46) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 2.2) {
          state.bustedTimer = 0;
          events |= respawn('busted');
          return events;
        }
      } else {
        state.bustedTimer = 0;
      }
    }

    // Gang members hunt the player during the warehouse job.
    for (const g of state.gang) {
      if (g.state === 'dead') continue;
      const d = dist(g.x, g.y, p.x, p.y);
      const want = Math.atan2(p.y - g.y, p.x - g.x);
      g.angle += angleDiff(want, g.angle) * Math.min(1, 5 * dt);
      if (d > 300) {
        g.x += Math.cos(g.angle) * g.speed * dt;
        g.y += Math.sin(g.angle) * g.speed * dt;
        const pos = { x: g.x, y: g.y };
        city.collideCircle(pos, 10);
        g.x = pos.x;
        g.y = pos.y;
      } else if (rng() < dt * 0.7) {
        events |= EVENT_ENEMY_SHOT;
        if (rng() < 0.35) {
          p.health -= 7;
          p.hurtTimer = 0.4;
          burst(p.x, p.y, '#c94f4f', 4, 100);
        }
      }
    }

    // Car-on-car and car-on-pedestrian collisions.
    const allCars = state.cars.concat(state.policeCars);
    for (const car of allCars) {
      if (car.dead || car.driver === 'player') continue;
      const playerCar = p.inCar;
      if (playerCar && !playerCar.dead) {
        if (dist(car.x, car.y, playerCar.x, playerCar.y) < 56) {
          const push = 56 - dist(car.x, car.y, playerCar.x, playerCar.y);
          const a = Math.atan2(playerCar.y - car.y, playerCar.x - car.x);
          // The player's car is shoved less than the other car, so a sideswipe
          // does not knock the player off the road.
          playerCar.x += Math.cos(a) * push * 0.25;
          playerCar.y += Math.sin(a) * push * 0.25;
          car.x -= Math.cos(a) * push * 0.75;
          car.y -= Math.sin(a) * push * 0.75;
          if (Math.abs(playerCar.speed) > 200 || Math.abs(car.speed) > 200) {
            events |= EVENT_CRASH;
            car.health -= 12;
            playerCar.health -= 8;
            if (car.health <= 0) explodeCar(car);
            if (playerCar.health <= 0) explodeCar(playerCar);
          }
          car.speed *= 0.6;
          playerCar.speed *= 0.7;
        }
      } else if (!p.inCar) {
        // A moving car that hits the player on foot knocks them down hard.
        if (dist(car.x, car.y, p.x, p.y) < 44 && Math.abs(car.speed) > 140) {
          p.health -= 26;
          p.hurtTimer = 0.6;
          state.shake = 8;
          burst(p.x, p.y, '#c94f4f', 8, 160);
          car.speed *= 0.4;
        }
      }
      // Running over a walker is a crime, and it is messy.
      for (const ped of state.peds) {
        if (ped.state === 'dead') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 40 && Math.abs(car.speed) > 60) {
          killPed(ped, car.driver === 'player');
          events |= EVENT_CRASH;
        }
      }
      if (p.inCar && dist(car.x, car.y, p.x, p.y) < 40) {
        // The player's car running over walkers.
        for (const ped of state.peds) {
          if (ped.state === 'dead') continue;
          if (dist(p.inCar.x, p.inCar.y, ped.x, ped.y) < 42 && Math.abs(p.inCar.speed) > 60) {
            killPed(ped, true);
          }
        }
      }
    }

    // Pickups: cash from the fallen, health at the hospital and the park.
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0) {
      state.pickupTimer = 14;
      const spot = rng() < 0.5 ? city.landmarkPoints.hospital : city.landmarkPoints.park;
      state.pickups.push({ x: spot.x + range(rng, -60, 60), y: spot.y + range(rng, -60, 60), kind: 'health', amount: 40, life: 40 });
    }
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      if (dist(px, py, pickup.x, pickup.y) < 56) {
        pickup.life = 0;
        if (pickup.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + pickup.amount);
          floater(p.x, p.y - 30, `+${pickup.amount} HP`, '#7ddb8a');
        } else {
          p.money += pickup.amount;
          floater(p.x, p.y - 30, `+$${pickup.amount}`, '#ffd23a');
          events |= EVENT_CASH;
        }
        events |= EVENT_PICKUP;
      }
    }
    state.pickups = state.pickups.filter((x) => x.life > 0);

    // Particles, tracers, floaters age out.
    for (const part of state.particles) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 0.92;
      part.vy *= 0.92;
      part.life -= dt;
    }
    state.particles = state.particles.filter((x) => x.life > 0);
    for (const t of state.tracers) t.life -= dt;
    state.tracers = state.tracers.filter((x) => x.life > 0);
    for (const f of state.floaters) {
      f.y -= 26 * dt;
      f.life -= dt;
    }
    state.floaters = state.floaters.filter((x) => x.life > 0);

    // Slow health regen when the heat is off.
    if (state.wanted === 0 && p.health > 0 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + 2.5 * dt);
    }

    // Missions: auto-start at the garage, then drive the steps.
    const mission = currentMission();
    if (mission && !state.missionActive && !state.storyDone) {
      const g = city.landmarkPoints.garage;
      if (dist(p.x, p.y, g.x, g.y) < 95) events |= startMission();
    }
    events |= stepMission(dt);

    // Wasted: out of health, wake up at St. Marina.
    if (p.health <= 0) {
      events |= respawn('wasted');
      return events;
    }

    return events;
  }

  reset();
  return {
    state,
    missions,
    reset,
    step,
    save,
    loadSave,
    currentMission,
    startMission,
    addWanted,
    setWanted,
    spawnGang,
    spawnPoliceCar,
    toast,
    killPed,
    enterCar,
    exitCar,
  };
}
