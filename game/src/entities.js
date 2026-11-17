// The moving things in Solara Bay: traffic cars that follow the road grid, walkers
// on the sidewalks who run from gunfire, and the Solara PD, who chase a wanted
// player on foot and in patrol cars. No drawing here — world.js owns the rules that
// call these updates, render.js owns the pixels.
import { CAR, WORLD } from './config.js';
import { isInWater, isOnRoad, nearestRoadPoint, randomRoadPoint } from './city.js';
import { pick, range } from './random.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b23a', '#4f9d5f', '#8a5fc9', '#d9d9d9', '#3a3a3a', '#e07a9a'];
export const CAR_NAMES = ['Vento GT', 'Marina LX', 'Solstice', 'Brava 4x4', 'Corsa S', 'Palma Van', 'Duna Coupe', 'Tide Runner'];
const PED_SHIRTS = ['#e8e8e8', '#d94f3d', '#3d7dd9', '#4f9d5f', '#e8b23a', '#8a5fc9', '#e07a9a', '#5f8a6d'];
const PED_SKINS = ['#e8b98a', '#c98a5f', '#8a5f3d', '#f0c8a0'];

export function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    id: o.id ?? 0,
    x, y, angle,
    speed: 0,
    color: o.color ?? pick(rng, CAR_COLORS),
    name: o.name ?? pick(rng, CAR_NAMES),
    police: Boolean(o.police),
    driver: o.driver ?? 'traffic', // 'traffic' | 'player' | 'police' | 'none'
    health: 100,
    burning: false,
    steer: 0,
    targetSpeed: o.targetSpeed ?? range(rng, 130, 210),
    turnAt: 0, // seconds until the next possible turn
    dead: false,
  };
}

export function makePed(rng, x, y) {
  return {
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 45, 75),
    shirt: pick(rng, PED_SHIRTS),
    skin: pick(rng, PED_SKINS),
    state: 'walk', // 'walk' | 'flee' | 'dead'
    targetX: x, targetY: y,
    retarget: 0,
    health: 100,
    cop: false,
    gang: false,
  };
}

/** Angle difference wrapped to [-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clampToWorld(car) {
  car.x = Math.max(30, Math.min(WORLD.size - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.size - 30, car.y));
  if (isInWater(car.x, car.y)) car.y = WORLD.beachTop + 140;
}

/** Arcade driving: throttle, steering and drag, with off-road slowing. */
export function driveCar(car, dt, throttle, steer, handbrake) {
  const onRoad = isOnRoad(car.x, car.y);
  const grip = onRoad ? 1 : 0.55;
  if (throttle > 0) car.speed += CAR.accel * grip * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * grip * throttle * dt;
  } else {
    car.speed -= car.speed * 1.1 * dt;
  }
  if (handbrake) car.speed -= car.speed * 3.2 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const steerFactor = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * CAR.turnRate * steerFactor * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car);
}

/**
 * A traffic car: cruise along its road, slow for the car ahead, and at an
 * intersection sometimes turn onto the crossing road.
 */
export function updateTraffic(car, dt, rng, cars) {
  car.turnAt -= dt;
  const onH = Math.abs(car.y - Math.round(car.y / WORLD.roadGap) * WORLD.roadGap) < 4;
  const nearIntersection = isOnRoad(car.x, car.y) && Math.abs(car.x % WORLD.roadGap) < 60 && Math.abs(car.y % WORLD.roadGap) < 60;
  if (nearIntersection && car.turnAt <= 0) {
    car.turnAt = range(rng, 2, 6);
    if (rng() < 0.45) {
      // Turn left or right onto the crossing road.
      const turn = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.angle += turn;
    }
  }
  // Ease back onto the centre line of the road we are on.
  const road = nearestRoadPoint(car.x, car.y);
  const wantAngle = Math.abs(road.x - car.x) < Math.abs(road.y - car.y)
    ? (car.y > road.y ? -Math.PI / 2 : Math.PI / 2)
    : (car.x > road.x ? Math.PI : 0);
  // Only correct when roughly aligned already, so turns feel like turns.
  if (Math.abs(angleDiff(wantAngle, car.angle)) < 0.9) {
    car.angle += angleDiff(wantAngle, car.angle) * Math.min(1, 2.2 * dt);
  }
  // Slow down for the car ahead.
  let desired = car.targetSpeed;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 90 && side < 40) desired = Math.min(desired, 40);
  }
  car.speed += (desired - car.speed) * Math.min(1, 1.6 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car);
}

/** A police car: steer hard at the target and ram it. */
export function updatePoliceCar(car, dt, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const throttle = dist > 60 ? 1 : 0.4;
  driveCar(car, dt, throttle, steer, false);
  if (car.speed > 520) car.speed = 520; // a getaway car can outrun the PD
}

/**
 * A walker: stroll along the sidewalk to a random nearby point, or sprint away
 * from `danger` when fleeing. Returns nothing; mutates the ped.
 */
export function updatePed(ped, dt, rng, danger) {
  if (ped.state === 'dead') return;
  if (danger) {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < 320) ped.state = 'flee';
  }
  if (ped.state === 'flee') {
    if (!danger) {
      ped.state = 'walk';
    } else {
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.angle += angleDiff(away, ped.angle) * Math.min(1, 6 * dt);
      ped.x += Math.cos(ped.angle) * 190 * dt;
      ped.y += Math.sin(ped.angle) * 190 * dt;
      ped.x = Math.max(24, Math.min(WORLD.size - 24, ped.x));
      ped.y = Math.max(24, Math.min(WORLD.beachTop + 140, ped.y));
      if (Math.hypot(ped.x - danger.x, ped.y - danger.y) > 520) ped.state = 'walk';
      return;
    }
  }
  ped.retarget -= dt;
  if (ped.retarget <= 0) {
    ped.retarget = range(rng, 3, 8);
    const road = randomRoadPoint(rng);
    ped.targetX = road.x + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2);
    ped.targetY = road.y;
    if (rng() < 0.5) {
      const tmp = ped.targetX;
      ped.targetX = road.x;
      ped.targetY = road.y + (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2);
      void tmp;
    }
  }
  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 8) {
    const want = Math.atan2(dy, dx);
    ped.angle += angleDiff(want, ped.angle) * Math.min(1, 8 * dt);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
}
