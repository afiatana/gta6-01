// Solara Heat — every tuning number in one place: the city, the cars, the police,
// the weapons and the missions. Nothing here knows about drawing or input.
export const STEP = 1 / 60;

export const WORLD = {
  size: 3200, // the city is a square, in pixels
  roadGap: 400, // distance between road centre lines
  roadWidth: 96,
  sidewalk: 16,
  beachTop: 2960, // south of here is sand, then the sea
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 215,
  runSpeed: 305,
  health: 100,
};

export const CAR = {
  length: 66,
  width: 30,
  accel: 430,
  brake: 720,
  reverseAccel: 270,
  maxSpeed: 570,
  maxReverse: 185,
  turnRate: 2.7, // radians per second at full lock, scaled by speed
};

export const WEAPON = {
  pistol: { name: 'P9 Sidearm', damage: 34, range: 470, rate: 0.22, mag: 12, spread: 0.05, reload: 1.1, auto: false },
  smg: { name: 'VK-9 SMG', damage: 18, range: 390, rate: 0.085, mag: 30, spread: 0.11, reload: 1.4, auto: true },
};

export const WANTED = {
  decayDelay: 9, // quiet seconds before stars start falling
  decayInterval: 7, // seconds per star lost while quiet
  stealCar: 1,
  shootPed: 1,
  killPed: 2,
  killCop: 2,
  maxStars: 5,
};

export const SAVE_KEY = 'solara-heat-save-v1';
