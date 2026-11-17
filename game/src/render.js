// Drawing only: the city, the cars and people in it, the particles, and the HUD
// (health, cash, wanted stars, weapon, the minimap, the mission objective, the
// speedometer) plus the title, pause and help screens. The camera follows the
// player; the world is drawn in world coordinates, the HUD in screen coordinates.
import { CAR, PLAYER, WEAPON, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = 208;
const MINIMAP_SCALE = MINIMAP / WORLD.size;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, camX: 0, camY: 0, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.w = canvas.width;
    view.h = canvas.height;
    view.scale = Math.max(canvas.width / 1100, canvas.height / 800);
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}:${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function worldToScreen(x, y) {
    return { x: (x - view.camX) * view.scale + view.w / 2, y: (y - view.camY) * view.scale + view.h / 2 };
  }

  function drawGround() {
    // Grass base for the whole city.
    ctx.fillStyle = '#7fae5f';
    ctx.fillRect(-60, -60, WORLD.size + 120, WORLD.size + 120);
    // Beach sand, then the sea.
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(0, WORLD.beachTop, WORLD.size, 150);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(0, WORLD.beachTop + 150, WORLD.size, WORLD.size - WORLD.beachTop - 150);
    ctx.fillStyle = '#3a92c9';
    for (let x = 0; x < WORLD.size; x += 260) {
      ctx.fillRect(x, WORLD.beachTop + 170 + ((x / 260) % 2) * 40, 130, 5);
    }
    // Blocks: pale pavement between the roads.
    ctx.fillStyle = '#c9c2b2';
    for (let bx = 0; bx < 7; bx += 1) {
      for (let by = 0; by < 7; by += 1) {
        const x0 = city.roadLines[bx] + WORLD.roadWidth / 2;
        const y0 = city.roadLines[by] + WORLD.roadWidth / 2;
        ctx.fillRect(x0, y0, WORLD.roadGap - WORLD.roadWidth, WORLD.roadGap - WORLD.roadWidth);
      }
    }
    // The park block is green lawn.
    const park = city.landmarkPoints.park.building;
    ctx.fillStyle = '#5f8a4d';
    ctx.fillRect(park.x - 20, park.y - 20, park.w + 40, park.h + 40);
    // Roads: asphalt with a dashed centre line.
    ctx.fillStyle = '#3a3f47';
    for (const line of city.roadLines) {
      ctx.fillRect(0, line - WORLD.roadWidth / 2, WORLD.size, WORLD.roadWidth);
      ctx.fillRect(line - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.size);
    }
    ctx.fillStyle = '#e8e8e8';
    for (const line of city.roadLines) {
      for (let t = 0; t < WORLD.size; t += 80) {
        ctx.fillRect(t, line - 2, 40, 4);
        ctx.fillRect(line - 2, t, 4, 40);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = '#d9d9d9';
    for (const lx of city.roadLines) {
      for (const ly of city.roadLines) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(lx + i * 12 - 4, ly - WORLD.roadWidth / 2 + 6, 8, 14);
          ctx.fillRect(lx + i * 12 - 4, ly + WORLD.roadWidth / 2 - 20, 8, 14);
        }
      }
    }
  }

  function drawBuildings() {
    for (const b of city.buildings) {
      // Soft shadow, offset to the south-east.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Roof details: a few vents and a skylight.
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(b.x + 14, b.y + 14, 18, 12);
      ctx.fillRect(b.x + b.w - 34, b.y + b.h - 28, 20, 14);
      if (b.name) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `700 ${Math.max(13, Math.min(20, b.w / 9))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    for (const t of city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#4f9d5f' : '#3d7a3d';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(t.x - t.r / 3, t.y - t.r / 3, t.r / 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = car.police ? '#1f2a44' : car.color;
    rr(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-8, -CAR.width / 2, 16, CAR.width);
      ctx.fillStyle = '#d94f3d';
      ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 2, 10, 6);
      ctx.fillStyle = '#3d7dd9';
      ctx.fillRect(-CAR.length / 2 + 4, CAR.width / 2 - 8, 10, 6);
    }
    // Windshield, roof, rear window.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(CAR.length / 2 - 20, -CAR.width / 2 + 4, 12, CAR.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-6, -CAR.width / 2 + 4, 16, CAR.width - 8);
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 4, 10, CAR.width - 8);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 6);
    if (car.burning || car.health < 35) {
      ctx.fillStyle = 'rgba(255,122,42,0.8)';
      ctx.beginPath();
      ctx.arc(-CAR.length / 4, 0, 8 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ped) {
    if (ped.state === 'dead') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-11, -4, 22, 8);
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(13, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.cop) {
      ctx.fillStyle = '#d9d9d9';
      ctx.fillRect(ped.x - 7, ped.y - 3, 14, 3);
    }
    if (ped.gang) {
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(ped.x - 2, ped.y - 12, 4, 5);
    }
  }

  function drawPlayer(state, aimScreen) {
    const p = state.player;
    if (p.inCar) return;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mara Voss: teal jacket, dark jeans, her aim follows the mouse.
    const aim = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(aim);
    ctx.fillStyle = '#1f8a8a';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(3, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2.5, 16, 5);
    ctx.restore();
    if (p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0) {
      ctx.fillStyle = 'rgba(217,79,61,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    void aimScreen;
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(state.time * 4 + pickup.x) * 3;
      if (pickup.kind === 'health') {
        ctx.fillStyle = '#e8e8e8';
        rr(ctx, pickup.x - 13, pickup.y - 13 + bob, 26, 26, 6);
        ctx.fill();
        ctx.fillStyle = '#d94f3d';
        ctx.fillRect(pickup.x - 3, pickup.y - 8 + bob, 6, 16);
        ctx.fillRect(pickup.x - 8, pickup.y - 3 + bob, 16, 6);
      } else {
        ctx.fillStyle = '#2f7d3d';
        rr(ctx, pickup.x - 12, pickup.y - 8 + bob, 24, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#ffd23a';
        ctx.font = `700 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$', pickup.x, pickup.y + 4 + bob);
      }
    }
  }

  function drawMissionMarker(state) {
    const mission = state.missionActive && state.missionIndex < state.missions.length
      ? state.missions[state.missionIndex]
      : null;
    let target = null;
    let color = '#e8b23a';
    if (mission) {
      const stepDef = mission.steps[state.missionStep];
      if (stepDef && stepDef.x !== undefined) target = { x: stepDef.x, y: stepDef.y, r: stepDef.radius || 90 };
    } else if (state.missionIndex < state.missions.length && !state.storyDone) {
      const g = city.landmarkPoints.garage;
      target = { x: g.x, y: g.y, r: 95 };
      color = '#7ddb8a';
    }
    if (!target) return;
    const pulse = 0.5 + 0.3 * Math.sin(state.time * 3);
    ctx.strokeStyle = color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A beacon column so the marker is visible from far away.
    const grad = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
    grad.addColorStop(0, 'rgba(232,178,58,0)');
    grad.addColorStop(1, 'rgba(232,178,58,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 8, target.y - 260, 16, 260);
  }

  function drawMinimap(state) {
    const x0 = view.w - MINIMAP - 16;
    const y0 = 16;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, x0 - 6, y0 - 6, MINIMAP + 12, MINIMAP + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    rr(ctx, x0, y0, MINIMAP, MINIMAP, 8);
    ctx.clip();
    ctx.fillStyle = '#6f8f5a';
    ctx.fillRect(x0, y0, MINIMAP, MINIMAP);
    // Pavement blocks between the roads, so the road grid reads at a glance.
    ctx.fillStyle = '#b8b0a0';
    for (let bx = 0; bx < 7; bx += 1) {
      for (let by = 0; by < 7; by += 1) {
        ctx.fillRect(x0 + (city.roadLines[bx] + WORLD.roadWidth / 2) * MINIMAP_SCALE, y0 + (city.roadLines[by] + WORLD.roadWidth / 2) * MINIMAP_SCALE, (WORLD.roadGap - WORLD.roadWidth) * MINIMAP_SCALE, (WORLD.roadGap - WORLD.roadWidth) * MINIMAP_SCALE);
      }
    }
    ctx.fillStyle = '#4f7d3d';
    const parkB = city.landmarkPoints.park.building;
    ctx.fillRect(x0 + parkB.x * MINIMAP_SCALE, y0 + parkB.y * MINIMAP_SCALE, parkB.w * MINIMAP_SCALE, parkB.h * MINIMAP_SCALE);
    ctx.fillStyle = '#3a3f47';
    for (const line of city.roadLines) {
      const rx = x0 + line * MINIMAP_SCALE;
      const ry = y0 + line * MINIMAP_SCALE;
      ctx.fillRect(rx - 3.5, y0, 7, MINIMAP);
      ctx.fillRect(x0, ry - 3.5, MINIMAP, 7);
    }
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(x0, y0 + WORLD.beachTop * MINIMAP_SCALE, MINIMAP, 10);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x0, y0 + (WORLD.beachTop + 150) * MINIMAP_SCALE, MINIMAP, MINIMAP);
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + x * MINIMAP_SCALE, y0 + y * MINIMAP_SCALE, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const mission = state.missionActive && state.missionIndex < state.missions.length
      ? state.missions[state.missionIndex]
      : null;
    if (mission) {
      const stepDef = mission.steps[state.missionStep];
      if (stepDef && stepDef.x !== undefined) dot(stepDef.x, stepDef.y, '#e8b23a', 6);
    } else if (state.missionIndex < state.missions.length && !state.storyDone) {
      dot(city.landmarkPoints.garage.x, city.landmarkPoints.garage.y, '#7ddb8a', 6);
    }
    for (const g of state.gang) if (g.state !== 'dead') dot(g.x, g.y, '#d94f3d', 3);
    for (const car of state.policeCars) if (!car.dead) dot(car.x, car.y, '#3d7dd9', 3.5);
    for (const cop of state.cops) if (cop.state !== 'dead') dot(cop.x, cop.y, '#3d7dd9', 3);
    dot(state.player.x, state.player.y, '#ffffff', 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + state.player.x * MINIMAP_SCALE, y0 + state.player.y * MINIMAP_SCALE, 6.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(state, screen, best) {
    const p = state.player;
    const weapon = WEAPON[p.weapon];
    // Top-left: health bar, cash, weapon.
    const panelH = p.inCar ? 112 : 86;
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    rr(ctx, 14, 14, 250, panelH, 10);
    ctx.fill();
    ctx.fillStyle = '#3a3f47';
    rr(ctx, 26, 28, 180, 16, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 40 ? '#7ddb8a' : '#d94f3d';
    rr(ctx, 26, 28, Math.max(0, 180 * p.health / PLAYER.health), 16, 6);
    ctx.fill();
    text(`$${p.money.toLocaleString('en-US')}`, 26, 72, 24, '#ffd23a', 'left', true);
    const ammo = p.reloading > 0 ? 'RELOADING' : `${p.ammo} / ${weapon.mag}`;
    text(`${weapon.name}  ${ammo}`, 26, 94, 16, '#eef1f5', 'left', true);
    if (p.inCar) {
      text(`${p.inCar.name} — ${Math.abs(Math.round(p.inCar.speed * 0.12))} mph`, 26, 118, 16, '#8b93a3', 'left');
    }
    // Wanted stars, top centre.
    if (state.wanted > 0) {
      const starSize = 30;
      const total = 5 * (starSize + 8);
      const sx = (view.w - total) / 2;
      for (let i = 0; i < 5; i += 1) {
        const cx = sx + i * (starSize + 8) + starSize / 2;
        const cy = 34;
        ctx.fillStyle = i < state.wanted ? '#ffd23a' : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        for (let k = 0; k < 5; k += 1) {
          const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
          const r = k % 2 === 0 ? starSize / 2 : starSize / 4.5;
          const px2 = cx + Math.cos(a) * r;
          const py2 = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px2, py2);
          else ctx.lineTo(px2, py2);
        }
        ctx.closePath();
        ctx.fill();
      }
      if (state.wanted >= 3) text('THE PD IS ON YOU — LOSE THEM', view.w / 2, 78, 15, '#ff8a7a', 'center', true);
    }
    drawMinimap(state);
    // Mission objective, bottom-left.
    const mission = state.missionIndex < state.missions.length ? state.missions[state.missionIndex] : null;
    if (mission) {
      const stepDef = state.missionActive ? mission.steps[state.missionStep] : null;
      let label = state.missionActive
        ? (stepDef.type === 'kill'
          ? `Take out the Breaker crew (${state.killsDone}/${state.killsLeft})`
          : stepDef.label)
        : `Next job: ${mission.title} — go to Otto's Garage`;
      if (stepDef && stepDef.type === 'wait' && state.missionWait > 0) {
        label += `  ${Math.ceil(stepDef.seconds - state.missionWait)}s`;
      }
      if (stepDef && stepDef.type === 'escape') {
        label += `  ${Math.ceil(state.missionTimer)}s left`;
      }
      ctx.font = `15px ${FONT}`;
      const w = Math.min(560, 24 + ctx.measureText(label).width + 24);
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      rr(ctx, 14, view.h - 66, w, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#e8b23a';
      ctx.fillRect(14, view.h - 66, 5, 52);
      text(state.missionActive ? mission.title : 'FREE ROAM', 34, view.h - 44, 13, '#e8b23a', 'left', true);
      text(label, 34, view.h - 24, 15, '#eef1f5', 'left');
    } else if (state.storyDone) {
      text('Story complete — Solara Bay is yours. Free roam!', 20, view.h - 30, 16, '#7ddb8a', 'left', true);
    }
    // Toast, centre-top under the stars.
    if (state.toastTimer > 0 && state.toast) {
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      const tw = Math.min(view.w - 40, ctx.measureText(state.toast).width + 36);
      rr(ctx, (view.w - tw) / 2, 92, tw, 40, 10);
      ctx.fill();
      text(state.toast, view.w / 2, 119, 16, '#eef1f5', 'center');
    }
    // Controls hint, bottom-right.
    text('WASD move/drive · Mouse aim · Click shoot · E car · R reload · 1/2 weapon · P pause · M mute', view.w - 16, view.h - 16, 13, 'rgba(238,241,245,0.75)', 'right');
    // Crosshair at the mouse.
    if (screen === SCREEN_PLAY) {
      const aim = state.player;
      const s = worldToScreen(aim.aimX, aim.aimY);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y);
      ctx.lineTo(s.x - 6, s.y);
      ctx.moveTo(s.x + 6, s.y);
      ctx.lineTo(s.x + 14, s.y);
      ctx.moveTo(s.x, s.y - 14);
      ctx.lineTo(s.x, s.y - 6);
      ctx.moveTo(s.x, s.y + 6);
      ctx.lineTo(s.x, s.y + 14);
      ctx.stroke();
    }
    void best;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (view.w - width) / 2;
    const y = (view.h - height) / 2;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    rr(ctx, x, y, width, height, 16);
    ctx.fill();
    ctx.fillStyle = accent || '#e8b23a';
    ctx.fillRect(x, y, width, 6);
    text(title, view.w / 2, y + 64, 44, '#eef1f5', 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.w / 2, y + 108 + i * 30, 18, '#c9cdd6', 'center');
    }
    text(prompt, view.w / 2, y + height - 26, 18, '#e8b23a', 'center', true);
  }

  function drawTitle(state, save) {
    // A living backdrop: the city behind the title, camera drifting over downtown.
    const t = state.time;
    view.camX = 1600 + Math.cos(t * 0.05) * 500;
    view.camY = 1600 + Math.sin(t * 0.04) * 400;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.scale, 0, 0, view.scale, -view.camX * view.scale + view.w / 2, -view.camY * view.scale + view.h / 2);
    drawGround();
    drawBuildings();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(10,14,20,0.45)';
    ctx.fillRect(0, 0, view.w, view.h);
    const lines = [
      'Solara Bay. Sun, sea, and everyone owing someone.',
      'Mara "Rook" Voss drove getaway cars — until she quit. Now Otto Vale',
      'needs one last driver, and the Breakers want her off the streets.',
      '',
      'WASD move and drive · Mouse aim · Click shoot · E steal a car',
      'R reload · 1/2 switch weapon · P pause · M mute · Shift run',
      '',
      save ? `Save found: $${save.money.toLocaleString('en-US')} · ${save.missionIndex} job(s) done — press Enter to continue` : 'A new story in Solara Bay — five jobs, one big score.',
    ];
    drawPanel('SOLARA HEAT', lines, 'Press Enter or click to start', '#e8b23a');
  }

  function drawPaused(state) {
    const lines = [
      'The city waits for you.',
      '',
      'WASD move/drive · Mouse aim · Click shoot · E car · R reload',
      '1/2 weapon · Shift run · M mute · H help',
      '',
      `Cash $${state.player.money.toLocaleString('en-US')} · Jobs done ${state.stats.missionsDone} · Cars stolen ${state.stats.carsStolen}`,
    ];
    drawPanel('PAUSED', lines, 'Press P or Esc to resume', '#3d7dd9');
  }

  function drawHelp() {
    const lines = [
      'On foot: WASD to move, Shift to run, mouse to aim, click to shoot.',
      'Cars: walk up and press E to steal one. W/S accelerate and brake,',
      'A/D steer, Space is the handbrake. Press E again to get out.',
      '',
      'Wanted: stealing cars, shooting people and killing cops raise your',
      'stars. The PD sends patrol cars, then cops on foot. Stay quiet and',
      'the stars fall. Get caught on foot and you are BUSTED.',
      '',
      'Jobs: go to Otto\'s Garage (green marker) to start the next job.',
      'Finish all five and the city is yours.',
    ];
    drawPanel('HOW TO PLAY', lines, 'Press H or Esc to go back', '#7ddb8a');
  }

  /** Paint one frame: the world through the camera, then the HUD or a screen panel. */
  function draw(state, screen, save, overlay) {
    const p = state.player;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, save);
      return;
    }
    // Camera follows the player (or their car), with a shake kick on impacts.
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    view.camX = p.x + shakeX;
    view.camY = p.y + shakeY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.scale, 0, 0, view.scale, -view.camX * view.scale + view.w / 2, -view.camY * view.scale + view.h / 2);
    drawGround();
    drawBuildings();
    drawMissionMarker(state);
    drawPickups(state);
    // Draw order: cars, then people, then the player, then particles.
    for (const car of state.cars) if (!car.dead) drawCar(car);
    for (const car of state.policeCars) if (!car.dead) drawCar(car);
    for (const ped of state.peds) drawPed(ped);
    for (const cop of state.cops) drawPed(cop);
    for (const g of state.gang) drawPed(g);
    drawPlayer(state);
    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.maxLife);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of state.tracers) {
      ctx.globalAlpha = Math.max(0, t.life / 0.07);
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      text(f.text, f.x, f.y, 18, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
    // Warm late-afternoon sun over everything.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const glow = ctx.createLinearGradient(0, 0, view.w, view.h);
    glow.addColorStop(0, 'rgba(255,190,90,0.05)');
    glow.addColorStop(1, 'rgba(255,120,60,0.08)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.w, view.h);
    // A red flash while hurt.
    if (p.hurtTimer > 0) {
      ctx.fillStyle = `rgba(217,79,61,${0.12 * p.hurtTimer})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    drawHud(state, screen, null);
    if (overlay && overlay.timer > 0) {
      ctx.fillStyle = `rgba(10,14,20,${Math.min(0.75, overlay.timer)})`;
      ctx.fillRect(0, 0, view.w, view.h);
      text(overlay.text, view.w / 2, view.h / 2 - 10, 64, overlay.color || '#ff8a7a', 'center', true);
      if (overlay.sub) text(overlay.sub, view.w / 2, view.h / 2 + 40, 20, '#eef1f5', 'center');
    }
    if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_HELP) drawHelp();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, worldToScreen, view };
}
