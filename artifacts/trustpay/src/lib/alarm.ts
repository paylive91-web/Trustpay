let lastPlayedAt = 0;

export function playAlarm() {
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    const beepCount = 4;
    const beepDur = 0.32;
    const gap = 0.08;
    for (let i = 0; i < beepCount; i++) {
      const t = start + i * (beepDur + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(1480, t + beepDur);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.02);
      gain.gain.setValueAtTime(0.55, t + beepDur - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beepDur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + beepDur + 0.02);
    }
    setTimeout(() => ctx.close().catch(() => {}), (beepDur + gap) * beepCount * 1000 + 200);
  } catch (_) {
    // ignore
  }
}
