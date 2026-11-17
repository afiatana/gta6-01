// The screenshot scenes behind ?shot=cover|drive|foot|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple scripted driver (steer toward the mission marker, shoot the nearest rival),
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { angleDiff } from './entities.js';
import { EVENT_MISSION_DONE, EVENT_MISSION_FAIL } from './world.js';

const SAMPLE = STEP;

/** A fake input object the world can step, steered by the scene's pilot. */
function scriptedInput(world, plan) {
  return {
    move() {
      return plan.move || { x: 0, y: 0 };
    },
    drive() {
      return plan.drive || { throttle: 0, steer: 0, handbrake: false };
    },
    running() {
      return false;
    },
    aiming() {
      return { x: plan.aimX, y: plan.aimY };
    },
    firing() {
      return Boolean(plan.firing);
    },
    weapon() {
      return null;
    },
    takeActions() {
      return 0;
    },
  };
}

function nearestGang(world) {
  let best = null;
  let bestD = Infinity;
  for (const g of world.state.gang) {
    if (g.state === 'dead') continue;
    const d = Math.hypot(g.x - world.state.player.x, g.y - world.state.player.y);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

function driveToward(world, tx, ty) {
  const car = world.state.player.inCar;
  if (!car) return { throttle: 0, steer: 0, handbrake: false };
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  return { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.2)), handbrake: false };
}

function putPlayerInCar(world) {
  const p = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.state.cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (best) {
    best.x = p.x + 60;
    best.y = p.y;
    best.angle = 0;
    world.enterCar(best);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: a 3-star police chase in a stolen car, mid-mission. drive: cruising
 * through downtown traffic. foot: on foot at Solara Park. mission: the warehouse
 * shootout, mid-fight.
 */
export function stageShot(name, world) {
  world.reset();
  const p = world.state.player;
  const city = world.state.city;
  const plan = {};
  const input = scriptedInput(world, plan);

  if (name === 'cover') {
    // The first job (First Gear) in a stolen car with 3 stars: the drive to the
    // garage completes step one, the car completes step two, and the run to the
    // hideout plays out under a police chase.
    world.state.missionIndex = 0;
    world.startMission();
    world.state.toastTimer = 0; // keep the cover frame free of the long brief
    putPlayerInCar(world);
    const car = p.inCar;
    car.x = 600;
    car.y = 1400;
    car.angle = 0;
    car.speed = 420;
    world.setWanted(3);
    // A straight run east along the avenue. Let the patrol cars spawn, then put
    // them all behind the player — a chase, not a roadblock pile-up.
    for (let i = 0; i < 0.5 / SAMPLE; i += 1) {
      plan.drive = driveToward(world, 2800, 1400);
      plan.aimX = p.x + Math.cos(car.angle) * 300;
      plan.aimY = p.y + Math.sin(car.angle) * 300;
      world.step(SAMPLE, input, 0);
    }
    world.state.policeCars.forEach((pc, index) => {
      pc.x = car.x - 260 - index * 110;
      pc.y = 1400 + (index % 2 === 0 ? 34 : -34);
      pc.angle = 0;
      pc.speed = 470;
    });
    for (let i = 0; i < 1.8 / SAMPLE; i += 1) {
      plan.drive = driveToward(world, 2800, 1400);
      plan.aimX = p.x + Math.cos(car.angle) * 300;
      plan.aimY = p.y + Math.sin(car.angle) * 300;
      world.step(SAMPLE, input, 0);
      if (p.health <= 0) break;
    }
    return { screen: 'play' };
  }

  if (name === 'drive') {
    putPlayerInCar(world);
    const car = p.inCar;
    car.x = 600;
    car.y = 1000;
    car.angle = 0;
    car.speed = 420;
    for (let i = 0; i < 3.5 / SAMPLE; i += 1) {
      // Always aim at a point on the road ahead of the car, so a sideswipe that
      // shoves it off the asphalt steers it back onto the road.
      plan.drive = driveToward(world, car.x + 400, 1000);
      plan.aimX = p.x + Math.cos(car.angle) * 300;
      plan.aimY = p.y + Math.sin(car.angle) * 300;
      world.step(SAMPLE, input, 0);
    }
    // Driving past the garage auto-starts the first job; hide its brief so the
    // frame stays clean.
    world.state.toastTimer = 0;
    return { screen: 'play' };
  }

  if (name === 'foot') {
    const park = city.landmarkPoints.park;
    p.x = park.x;
    p.y = park.y + 60;
    for (let i = 0; i < 4 / SAMPLE; i += 1) {
      // A tight loop (about 180 px across) so the player stays on the lawn.
      const a = world.state.time * 1.2;
      plan.move = { x: Math.cos(a), y: Math.sin(a) };
      plan.aimX = p.x + Math.cos(a) * 200;
      plan.aimY = p.y + Math.sin(a) * 200;
      world.step(SAMPLE, input, 0);
    }
    return { screen: 'play' };
  }

  // mission: the warehouse shootout. The player starts on the marker, so the
  // first step completes at once and the fight is the frame.
  world.state.missionIndex = 2;
  world.startMission();
  const warehouse = city.landmarkPoints.warehouse;
  p.x = warehouse.x - 30;
  p.y = warehouse.y + 90;
  for (let i = 0; i < 6 / SAMPLE; i += 1) {
    const target = nearestGang(world);
    if (target) {
      plan.aimX = target.x;
      plan.aimY = target.y;
      plan.firing = true;
      // Strafe sideways while shooting, like a player would.
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      plan.move = { x: Math.cos(a + Math.PI / 2) * 0.6, y: Math.sin(a + Math.PI / 2) * 0.6 };
    } else {
      plan.firing = false;
      plan.move = { x: 0, y: 0 };
    }
    const events = world.step(SAMPLE, input, 0);
    if (events & (EVENT_MISSION_DONE | EVENT_MISSION_FAIL)) break;
    if (p.health <= 0) break;
  }
  return { screen: 'play' };
}
