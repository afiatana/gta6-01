// A small seeded RNG (mulberry32) so a ?seed=N run and a ?shot= scene are
// reproducible, while a normal game just seeds from the clock.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from the seeded stream. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** One element of an array, from the seeded stream. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A shuffled copy of an array, from the seeded stream. */
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
