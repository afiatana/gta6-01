// The story of Solara Heat: five jobs for Mara "Rook" Voss, an ex-getaway driver
// pulled back into Solara Bay by her old fixer, Otto Vale. Each mission is a list of
// steps the world drives: go somewhere, get in a car, wait somewhere, take out a
// number of rivals, or shake the police. world.js interprets the steps; this file
// only says what the story is.
export function buildMissions(points) {
  const garage = points.garage;
  const bank = points.bank;
  const hideout = points.hideout;
  const warehouse = points.warehouse;
  const park = points.park;
  return [
    {
      id: 'first-gear',
      title: 'First Gear',
      giver: 'Otto Vale',
      brief: 'Otto needs a driver again. Steal a car — any car — and bring it to your hideout.',
      reward: 500,
      steps: [
        { type: 'goto', x: garage.x, y: garage.y, radius: 90, label: "Go to Otto's Garage" },
        { type: 'enterCar', label: 'Steal a car (walk up and press E)' },
        { type: 'goto', x: hideout.x, y: hideout.y, radius: 110, label: 'Drive to your Hideout' },
      ],
    },
    {
      id: 'the-pickup',
      title: 'The Pickup',
      giver: 'Otto Vale',
      brief: 'A package is waiting at Solara Park. Grab it and bring it to the garage — the PD will be watching.',
      reward: 1200,
      steps: [
        { type: 'goto', x: park.x, y: park.y, radius: 90, label: 'Meet the contact at Solara Park' },
        { type: 'wait', x: park.x, y: park.y, radius: 80, seconds: 2, label: 'Pick up the package' },
        { type: 'goto', x: garage.x, y: garage.y, radius: 100, label: 'Deliver the package to the Garage' },
      ],
      wantedOnStep: { step: 1, stars: 2 },
    },
    {
      id: 'breaker-block',
      title: 'Breaker Block',
      giver: 'Otto Vale',
      brief: 'The Breakers took Otto\'s turf. Clear their crew out of the warehouse and get out clean.',
      reward: 2000,
      unlock: 'smg',
      steps: [
        { type: 'goto', x: warehouse.x, y: warehouse.y, radius: 110, label: 'Reach the Breaker Warehouse' },
        { type: 'kill', count: 4, x: warehouse.x, y: warehouse.y, radius: 260, label: 'Take out the Breaker crew (0/4)' },
        { type: 'goto', x: hideout.x, y: hideout.y, radius: 110, label: 'Escape to your Hideout' },
      ],
    },
    {
      id: 'hot-pursuit',
      title: 'Hot Pursuit',
      giver: 'Mara Voss',
      brief: 'The PD has your plate. Three stars and counting — lose them or reach the hideout before they box you in.',
      reward: 2500,
      steps: [
        { type: 'escape', x: hideout.x, y: hideout.y, radius: 120, seconds: 75, label: 'Reach the Hideout before the timer runs out' },
      ],
      wantedOnStep: { step: 0, stars: 3 },
    },
    {
      id: 'the-big-score',
      title: 'The Big Score',
      giver: 'Otto Vale',
      brief: 'Solara Bank, Friday, one vault. Hold the bank while the drill works, then vanish. This is the one that sets us free.',
      reward: 8000,
      steps: [
        { type: 'goto', x: bank.x, y: bank.y, radius: 100, label: 'Reach Solara Bank' },
        { type: 'wait', x: bank.x, y: bank.y, radius: 90, seconds: 20, label: 'Hold the bank while the drill works' },
        { type: 'goto', x: hideout.x, y: hideout.y, radius: 120, label: 'Escape to your Hideout' },
      ],
      wantedOnStep: { step: 1, stars: 4 },
    },
  ];
}

export const STORY_COMPLETE = 'The Big Score is done. Solara Bay is yours — free roam, Rook. Otto owes you a drink.';
