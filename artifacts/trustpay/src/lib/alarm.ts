let lastPlayedAt = 0;

export function playAlarm() {
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    const beepCount = 2;
    const beepDur = 0.22;
    const gap = 0.12;
    for (let i = 0; i < beepCount; i++) {
      const t = start + i * (beepDur + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.linearRampToValueAtTime(620, t + beepDur);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.03);
      gain.gain.setValueAtTime(0.14, t + beepDur - 0.03);
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
