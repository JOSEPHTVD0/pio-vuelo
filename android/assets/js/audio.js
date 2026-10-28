/* Motor de audio: SFX sintetizados + música procedural (WebAudio) */
window.SND = (function () {
  'use strict';

  let ctx = null, master = null, musicGain = null, sfxGain = null, started = false;
  let sfxOn = true, musicOn = true;
  let sfxVol = 1, musicVol = 1;
  let musicTimer = null, nextStep = 0, step = 0;

  const PITCH = [0, 3, 5, 7, 10, 12, 15]; // pentatonic-ish scale (semitonos desde base)

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1.0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 10;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  }

  // Debe llamarse tras un gesto del usuario para desbloquear audio en móvil
  function unlock() {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { // al reanudar el reloj, arranca la música pendiente (sin burst)
        if (musicOn && !musicTimer) startMusic();
      }).catch(() => { });
    }
    started = true;
  }

  const SFX_BOOST = 1.9;   // amplificador de efectos (el motor usa volúmenes bajos)
  const MUS_BOOST = 1.6;   // amplificador de música

  function tone(freq, dur, type, vol, when, glideTo, dest) {
    if (!ctx) return;
    if (!sfxOn && !dest) return; // la música (dest=musicGain) no depende del switch de sonido
    const t = ctx.currentTime + (when || 0);
    const v = Math.min(1, vol * (dest ? MUS_BOOST : SFX_BOOST));
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || sfxGain || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, when, filterFreq, dest) {
    if (!ctx || !sfxOn) return;
    const t = ctx.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = Math.min(1, vol * SFX_BOOST);
    src.connect(f).connect(g).connect(dest || sfxGain || master);
    src.start(t);
  }

  const S = {
    tap:   () => tone(520, 0.07, 'triangle', 0.25),
    flap:  () => { tone(380, 0.11, 'square', 0.14, 0, 760); noise(0.05, 0.05, 0, 2400); },
    score: () => { tone(880, 0.09, 'sine', 0.3); tone(1320, 0.14, 'sine', 0.28, 0.06); },
    coin:  () => { tone(1180, 0.07, 'triangle', 0.26); tone(1760, 0.16, 'triangle', 0.24, 0.07); },
    enemy: () => { tone(660, 0.06, 'square', 0.16); tone(880, 0.09, 'square', 0.14, 0.05); },
    hit:   () => { noise(0.25, 0.5, 0, 700); tone(220, 0.3, 'sawtooth', 0.3, 0, 70); },
    over:  () => { tone(392, 0.22, 'triangle', 0.3); tone(311, 0.22, 'triangle', 0.28, 0.18); tone(233, 0.5, 'triangle', 0.28, 0.36); },
    click: () => tone(640, 0.05, 'square', 0.1),
    buy:   () => { tone(780, 0.08, 'sine', 0.26); tone(1040, 0.08, 'sine', 0.26, 0.08); tone(1560, 0.22, 'sine', 0.28, 0.16); },
    deny:  () => tone(180, 0.16, 'sawtooth', 0.22, 0, 140),
    level: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.26, i * 0.09)); },
    power: () => { tone(660, 0.09, 'sine', 0.25); tone(880, 0.09, 'sine', 0.25, 0.07); tone(1320, 0.18, 'sine', 0.25, 0.14); },
    block: () => { tone(500, 0.12, 'square', 0.2, 0, 180); noise(0.12, 0.3, 0, 900); },
    achieve: () => { [660, 880, 990, 1320].forEach((f, i) => tone(f, 0.1, 'sine', 0.25, i * 0.07)); },
    medal: () => { [523, 784, 1046].forEach((f, i) => tone(f, 0.13, 'sine', 0.26, i * 0.1)); }
  };

  /* --- Música procedural ligera (loop de acordes arpegiados) --- */
  const CHORDS = [
    [220, 261.6, 329.6, 392],   // Am
    [174.6, 220, 261.6, 329.6], // F
    [196, 246.9, 293.7, 392],   // G
    [174.6, 220, 261.6, 329.6]  // F
  ];
  const STEP_LEN = 0.12;

  function musicTick() {
    if (!ctx || !musicOn) return;
    const chord = CHORDS[step % CHORDS.length];
    const idx = Math.floor(step / 2) % 4;
    tone(chord[idx] * (step % 4 === 3 ? 2 : 1), 0.16, 'triangle', (idx === 0 ? 0.09 : 0.06), 0, null, musicGain);
    if (step % 4 === 0) tone(chord[0] / 2, 0.4, 'sine', 0.07, 0, null, musicGain);
    if (step % 8 === 7) tone(chord[1] * 4, 0.08, 'sine', 0.03, 0, null, musicGain);
    step++;
    nextStep += STEP_LEN;
  }

  function startMusic() {
    ensure();
    if (!ctx || !musicOn) return;
    if (ctx.state === 'suspended') return; // no programar notas en suspendido: se arranca en el primer gesto
    if (musicTimer) return;
    nextStep = ctx.currentTime + 0.05;
    musicTimer = setInterval(musicTick, STEP_LEN * 1000);
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.85 * musicVol, ctx.currentTime + 1.5);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (ctx && musicGain) {
      try { musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5); } catch (e) { }
      setTimeout(() => { if (!musicTimer && musicGain) musicGain.gain.value = 0; }, 550);
    }
  }

  function setSfx(on) { sfxOn = on; }
  function setMusic(on) {
    musicOn = on;
    if (on && started) startMusic();
    else stopMusic();
  }
  function isMusicOn() { return musicOn; }
  function setSfxVol(v) {
    sfxVol = Math.max(0, Math.min(1, v || 0));
    if (sfxGain) { try { sfxGain.gain.value = sfxVol; } catch (e) { } }
  }
  function setMusicVol(v) {
    musicVol = Math.max(0, Math.min(1, v || 0));
    if (ctx && musicGain && musicTimer) {
      try { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.linearRampToValueAtTime(0.85 * musicVol, ctx.currentTime + 0.4); } catch (e) { }
    }
  }
  function setVolumes(sv, mv) { setSfxVol(sv); setMusicVol(mv); }

  // Reproduce todas las notas en un "click flash" al activar el switch de música desde apagado? se usa setMusic.

  return {
    unlock, ensure, setSfx, setMusic, isMusicOn, startMusic, stopMusic,
    setVolumes, setSfxVol, setMusicVol,
    sfx: S,
    hotkeys: null
  };
})();