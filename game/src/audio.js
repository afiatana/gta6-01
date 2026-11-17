// Every sound is synthesized with WebAudio: no audio files, no network. A tiny
// step sequencer plays a bass groove under the game, and one-shots cover the
// gunshots, the siren, pickups and mission stings. Nothing sounds until the first
// user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let stepIndex = 0;

  // A slow, sunny-city bass groove: A minor, 96 BPM, one bar of eight steps.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27];
  const HAT = [0, 1, 0, 1, 0, 1, 0, 1];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function musicStep() {
    if (!ctx || muted) return;
    const bass = BASS[stepIndex % BASS.length];
    if (bass > 0) tone(bass, 0.28, 0.5, 'triangle');
    if (HAT[stepIndex % HAT.length]) noiseBurst(0.04, 0.08, 6000);
    stepIndex += 1;
  }

  return {
    /** Call from any user gesture: unlocks audio and starts the groove. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') void ctx.resume();
      if (!musicTimer) musicTimer = window.setInterval(musicStep, 312);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      if (!ctx || muted) return;
      noiseBurst(0.12, 0.5, 2400);
      tone(140, 0.1, 0.35, 'square', 50);
    },
    enemyShot() {
      if (!ctx || muted) return;
      noiseBurst(0.1, 0.22, 1800);
    },
    crash() {
      if (!ctx || muted) return;
      noiseBurst(0.25, 0.45, 900);
      tone(90, 0.2, 0.3, 'sine', 40);
    },
    pickup() {
      if (!ctx || muted) return;
      tone(660, 0.09, 0.3, 'sine');
      window.setTimeout(() => tone(990, 0.14, 0.3, 'sine'), 90);
    },
    cash() {
      if (!ctx || muted) return;
      tone(880, 0.08, 0.25, 'triangle');
      window.setTimeout(() => tone(1174, 0.08, 0.25, 'triangle'), 80);
      window.setTimeout(() => tone(1568, 0.16, 0.25, 'triangle'), 160);
    },
    missionStart() {
      if (!ctx || muted) return;
      tone(392, 0.12, 0.3, 'triangle');
      window.setTimeout(() => tone(523, 0.12, 0.3, 'triangle'), 120);
      window.setTimeout(() => tone(659, 0.2, 0.3, 'triangle'), 240);
    },
    missionFail() {
      if (!ctx || muted) return;
      tone(220, 0.25, 0.3, 'sawtooth', 110);
    },
    busted() {
      if (!ctx || muted) return;
      tone(330, 0.2, 0.3, 'sawtooth', 165);
      window.setTimeout(() => tone(247, 0.35, 0.3, 'sawtooth', 123), 200);
    },
    /** Engine pitch follows speed 0..1; call every frame while driving. */
    engine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.075 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
    },
    /** Two-tone siren while police are close; call every frame. */
    siren(on, time) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.1);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(time * 4.2) > 0 ? 920 : 660, ctx.currentTime, 0.05);
    },
  };
}
