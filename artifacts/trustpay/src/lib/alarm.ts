let lastPlayedAt = 0;

export function playAlarm() {
  _playBeeps(2, 0.18, "sine", 520, 620);
}

export function playLoudAlarm() {
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;
  _playBeepsRaw(6, 0.7, "square", 880, 660);
  if ("vibrate" in navigator) {
    navigator.vibrate([400, 150, 400, 150, 400, 150, 600, 200, 600]);
  }
}

function _playBeeps(count: number, volume: number, type: OscillatorType, freqStart: number, freqEnd: number) {
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;
  _playBeepsRaw(count, volume, type, freqStart, freqEnd);
}

function _playBeepsRaw(count: number, volume: number, type: OscillatorType, freqStart: number, freqEnd: number) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    const beepDur = 0.25;
    const gap = 0.1;
    for (let i = 0; i < count; i++) {
      const t = start + i * (beepDur + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t);
      osc.frequency.linearRampToValueAtTime(freqEnd, t + beepDur);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.03);
      gain.gain.setValueAtTime(volume, t + beepDur - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beepDur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + beepDur + 0.02);
    }
    setTimeout(() => ctx.close().catch(() => {}), (beepDur + gap) * count * 1000 + 300);
  } catch (_) {}
}
