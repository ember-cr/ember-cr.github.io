/**
 * Synthesized UI sounds using WebAudio.
 * Avoids external assets and works instantly.
 */

function getMasterVolume(): number {
  try {
    const raw = localStorage.getItem("ember.prefs");
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs.muteSounds) return 0;
      return (prefs.volume ?? 80) / 100;
    }
  } catch { /* ignore */ }
  return 0.8;
}

function createAudioCtx() {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctx) return null;
  return new Ctx();
}

/**
 * Rich two-tone notification chime.
 */
export function playDing(volume?: number) {
  try {
    const ctx = createAudioCtx();
    if (!ctx) return;
    
    const vol = volume ?? getMasterVolume();
    if (vol <= 0) return;

    const master = ctx.createGain();
    master.gain.value = vol;
    master.connect(ctx.destination);

    const tone = (freq: number, start: number, dur: number, peak: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.connect(g).connect(master);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur + 0.05);
    };

    tone(880, 0, 0.5, 0.9);
    tone(1320, 0.09, 0.5, 0.7);

    setTimeout(() => ctx.close(), 1200);
  } catch { /* ignore */ }
}

/**
 * Subtle, short UI click sound.
 */
export function playClick(volume?: number) {
  try {
    const raw = localStorage.getItem("ember.prefs");
    if (raw && JSON.parse(raw).disableClickSounds) return;

    const ctx = createAudioCtx();
    if (!ctx) return;

    const vol = volume ?? getMasterVolume();
    if (vol <= 0) return;

    const master = ctx.createGain();
    master.gain.value = vol * 0.4; // Click is naturally quieter
    master.connect(ctx.destination);

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    
    o.type = "sine";
    o.frequency.setValueAtTime(1200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.1);
    
    setTimeout(() => ctx.close(), 200);
  } catch { /* ignore */ }
}

/**
 * "Swoosh" style sound for navigation/entering rooms.
 */
export function playNav(volume?: number) {
  try {
    const ctx = createAudioCtx();
    if (!ctx) return;

    const vol = volume ?? getMasterVolume();
    if (vol <= 0) return;

    const master = ctx.createGain();
    master.gain.value = vol * 0.6;
    master.connect(ctx.destination);

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    
    o.type = "triangle";
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    
    setTimeout(() => ctx.close(), 400);
  } catch { /* ignore */ }
}
