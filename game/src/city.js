// Solara Bay, the game's city: a road grid, the blocks between the roads, the
// buildings that fill them, the park, the beach and the sea, and the landmarks the
// story uses. Everything is placed from the seed, so the same seed is the same city.
import { WORLD } from './config.js';
import { pick, range, shuffled } from './random.js';

const ROAD_LINES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
const HALF_ROAD = WORLD.roadWidth / 2;

const ROOFS = ['#c96f4a', '#d9a05b', '#7d8ba0', '#b0524f', '#5f8a6d', '#a87fbf', '#8a6f4d', '#4f7d8a'];
const WALLS = ['#e8dcc8', '#d8c9a8', '#c9b8a0', '#b8c4c9', '#e0c9b0'];

/** True when the point is on asphalt (a road or an intersection). */
export function isOnRoad(x, y) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) <= HALF_ROAD || Math.abs(y - line) <= HALF_ROAD) return true;
  }
  return false;
}

/** True when the point is in the sea (south edge): nothing drives or walks there. */
export function isInWater(x, y) {
  return y > WORLD.beachTop + 150;
}

/** True when the point is on the sand strip. */
export function isOnSand(x, y) {
  return y > WORLD.beachTop && y <= WORLD.beachTop + 150;
}

/** The nearest point on a road centre line, for spawning traffic and police. */
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_LINES[0];
  let bestY = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - x) < Math.abs(bestX - x)) bestX = line;
    if (Math.abs(line - y) < Math.abs(bestY - y)) bestY = line;
  }
  // Snap to the closer axis: keep the point on the road the caller is nearer.
  return Math.abs(bestX - x) < Math.abs(bestY - y) ? { x: bestX, y } : { x, y: bestY };
}

/** A random point on a road, for spawning traffic. */
export function randomRoadPoint(rng) {
  const vertical = rng() < 0.5;
  const line = pick(rng, ROAD_LINES);
  const along = range(rng, 80, WORLD.size - 80);
  return vertical ? { x: line, y: along, angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 } : { x: along, y: line, angle: rng() < 0.5 ? 0 : Math.PI };
}

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  // Landmark blocks, keyed by block index (bx, by) between the road lines.
  const landmarks = {
    garage: { bx: 1, by: 1, name: "Otto's Garage", color: '#e8b23a' },
    bank: { bx: 4, by: 2, name: 'Solara Bank', color: '#d9d9d9' },
    hospital: { bx: 1, by: 5, name: 'St. Marina Hospital', color: '#7fc4c9' },
    hideout: { bx: 5, by: 5, name: "Rook's Hideout", color: '#e8b23a' },
    warehouse: { bx: 5, by: 1, name: 'Breaker Warehouse', color: '#8a5a4a' },
    park: { bx: 3, by: 3, name: 'Solara Park', color: '#5f8a4d' },
  };
  const landmarkAt = {};
  for (const [key, lm] of Object.entries(landmarks)) landmarkAt[`${lm.bx},${lm.by}`] = key;
  const landmarkPoints = {};

  // One building per block, sized to the block, with a yard gap around it. The park
  // block gets trees instead of a building; landmark blocks get a wide low building.
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const x0 = ROAD_LINES[bx] + HALF_ROAD + WORLD.sidewalk + 8;
      const y0 = ROAD_LINES[by] + HALF_ROAD + WORLD.sidewalk + 8;
      const x1 = ROAD_LINES[bx + 1] - HALF_ROAD - WORLD.sidewalk - 8;
      const y1 = ROAD_LINES[by + 1] - HALF_ROAD - WORLD.sidewalk - 8;
      const key = landmarkAt[`${bx},${by}`];
      if (key === 'park') {
        for (let i = 0; i < 14; i += 1) {
          trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 15) });
        }
        // The park has no building, but missions and the renderer still need a
        // landmark point (and a lawn rectangle) for it.
        const parkBuilding = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, roof: '#5f8a4d', wall: '#5f8a4d', landmark: 'park', name: 'Solara Park' };
        landmarkPoints.park = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, building: parkBuilding };
        continue;
      }
      const wide = key !== undefined;
      const bw = wide ? (x1 - x0) * 0.82 : range(rng, 110, 190);
      const bh = wide ? (y1 - y0) * 0.62 : range(rng, 90, 170);
      const bx0 = x0 + (x1 - x0 - bw) / 2 + range(rng, -8, 8);
      const by0 = y0 + (y1 - y0 - bh) / 2 + range(rng, -8, 8);
      buildings.push({
        x: bx0, y: by0, w: bw, h: bh,
        roof: key ? landmarks[key].color : pick(rng, ROOFS),
        wall: pick(rng, WALLS),
        landmark: key ?? null,
        name: key ? landmarks[key].name : null,
      });
    }
  }
  // A few palm trees along the beach.
  for (let i = 0; i < 22; i += 1) {
    trees.push({ x: range(rng, 60, WORLD.size - 60), y: range(rng, WORLD.beachTop + 12, WORLD.beachTop + 130), r: range(rng, 8, 13), palm: true });
  }
  // Scattered street trees on the grassy outer ring.
  for (let i = 0; i < 18; i += 1) {
    const edge = Math.floor(rng() * 4);
    const t = range(rng, 40, WORLD.size - 40);
    trees.push(edge === 0 ? { x: t, y: range(rng, 30, 130), r: range(rng, 9, 14) }
      : edge === 1 ? { x: t, y: range(rng, WORLD.size - 260, WORLD.size - 160), r: range(rng, 9, 14) }
      : edge === 2 ? { x: range(rng, 30, 130), y: t, r: range(rng, 9, 14) }
      : { x: range(rng, WORLD.size - 130, WORLD.size - 30), y: t, r: range(rng, 9, 14) });
  }

  for (const building of buildings) {
    if (building.landmark) {
      landmarkPoints[building.landmark] = { x: building.x + building.w / 2, y: building.y + building.h + 46, building };
    }
  }

  /** Push a circle (x, y, radius) out of every building it overlaps; returns true on a hit. */
  function collideCircle(pos, radius) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.y = cy + (dy / d) * radius;
        } else {
          pos.y = b.y - radius;
        }
      }
    }
    return hit;
  }

  /** Push a car (a rectangle, length along `angle`) out of buildings, roughly, by its centre. */
  function collideCar(car) {
    const half = 20;
    const pos = { x: car.x, y: car.y };
    if (collideCircle(pos, half)) {
      car.x = pos.x;
      car.y = pos.y;
      return true;
    }
    return false;
  }

  return { buildings, trees, landmarks, landmarkPoints, roadLines: ROAD_LINES, collideCircle, collideCar };
}
