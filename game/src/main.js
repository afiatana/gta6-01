// Solara Heat — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and help. Sounds are wired here
// from the world's event flags, so the world never knows about audio.
//
// ?seed=N fixes the city. ?shot=cover|drive|foot|mission stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_ENEMY_SHOT, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_MISSION_START, EVENT_PICKUP, EVENT_SHOT, EVENT_STOLEN, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed));
const world = createWorld(createRandom(seed ^ 0x9e3779b9), city);
const renderer = createRenderer(canvas, city);
const audio = createAudio();
// A read-only hook for play-testing and debugging in the browser console.
window.__world = world;
window.__renderer = renderer;

function announce(message) {
  status.textContent = message;
}

/** Screen coordinates of the mouse, turned into world coordinates for aiming. */
function aimWorld(input) {
  const mouse = input.aiming();
  const view = renderer.view;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  const sx = mouse.x * scaleX;
  const sy = mouse.y * scaleY;
  return {
    x: view.camX + (sx - view.w / 2) / view.scale,
    y: view.camY + (sy - view.h / 2) / view.scale,
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, world.loadSave(), null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let overlay = null;
  let overlayTimer = 0;
  const save = world.loadSave();

  function playEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_ENEMY_SHOT) audio.enemyShot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION_START) audio.missionStart();
    if (events & EVENT_MISSION_DONE) audio.cash();
    if (events & EVENT_MISSION_FAIL) audio.missionFail();
    if (events & EVENT_BUSTED) {
      audio.busted();
      overlay = { text: 'BUSTED', sub: 'The PD caught you — you wake up at St. Marina Hospital, 10% lighter.', color: '#7db3ff', timer: 2.4 };
      overlayTimer = 2.4;
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      overlay = { text: 'WASTED', sub: 'You wake up at St. Marina Hospital, 10% lighter.', color: '#ff8a7a', timer: 2.4 };
      overlayTimer = 2.4;
    }
    if (events & EVENT_STOLEN) announce('Car stolen. The PD noticed.');
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Get to Otto\'s Garage to start the first job.');
  }

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_CONFIRM) audio.unlock();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startGame();
      } else {
        // The title screen's city stays alive behind the panel.
        while (accumulator >= STEP) {
          world.step(STEP, {
            move: () => ({ x: 0, y: 0 }),
            drive: () => ({ throttle: 0, steer: 0, handbrake: false }),
            running: () => false,
            aiming: () => ({ x: world.state.player.x, y: world.state.player.y }),
            firing: () => false,
            weapon: () => null,
          }, 0);
          accumulator -= STEP;
        }
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        const aim = aimWorld(input);
        const liveInput = {
          move: () => input.move(),
          drive: () => input.drive(),
          running: () => input.running(),
          aiming: () => aim,
          firing: () => input.firing(),
          weapon: () => input.weapon(),
        };
        while (accumulator >= STEP) {
          const events = world.step(STEP, liveInput, actions);
          playEvents(events);
          accumulator -= STEP;
        }
        const p = world.state.player;
        audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 570 : 0, Boolean(p.inCar));
        audio.siren(world.state.wanted > 0 && (world.state.policeCars.length > 0 || world.state.cops.length > 0), world.state.time);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_HELP) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
    }
    accumulator = 0;

    if (overlayTimer > 0) {
      overlayTimer -= 1 / 60;
      if (overlay) overlay.timer = overlayTimer;
      if (overlayTimer <= 0) overlay = null;
    }
    // H is read from the raw key set: the input module only queues the actions above.
    if (screen === SCREEN_PLAY && window.__helpKey) {
      screen = SCREEN_HELP;
      window.__helpKey = false;
    }
    renderer.draw(world.state, screen, save, overlay);
  }

  // H for help, read here because the input module does not own it.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && !event.repeat) window.__helpKey = true;
  });

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
