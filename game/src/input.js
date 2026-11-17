// Keyboard and mouse, read once per frame. WASD/arrows move, the mouse aims, click
// fires, E enters or leaves a car, R reloads, Space is the handbrake, P/Esc pauses,
// M mutes the sound. One-shot presses are queued as bit flags and taken once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyR: ACTION_RELOAD,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let weaponRequest = null;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function isDown(code) {
    return keys.has(code);
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    if (event.code === 'Digit1') weaponRequest = 'pistol';
    if (event.code === 'Digit2') weaponRequest = 'smg';
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1/0/1 sideways and forward intent for on-foot movement. */
    move() {
      const x = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
      const y = (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Driving intent: throttle -1..1, steer -1..1, handbrake held. */
    drive() {
      const throttle = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0);
      const steer = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
      return { throttle, steer, handbrake: isDown('Space') };
    },
    running() {
      return isDown('ShiftLeft') || isDown('ShiftRight');
    },
    aiming() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown;
    },
    /** 'pistol' or 'smg' once after the 1/2 key is pressed, else null. */
    weapon() {
      const wanted = weaponRequest;
      weaponRequest = null;
      return wanted;
    },
    takeActions() {
      let actions = 0;
      for (const code of pressed) {
        if (KEY_ACTIONS[code] !== undefined) actions |= KEY_ACTIONS[code];
      }
      if (mouseClicked) actions |= ACTION_CONFIRM;
      pressed.clear();
      mouseClicked = false;
      return actions;
    },
  };
}
