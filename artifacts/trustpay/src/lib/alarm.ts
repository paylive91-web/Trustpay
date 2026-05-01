let lastPlayedAt = 0;

export function playAlarm() {
  _playBeeps(2, 0.18, "sine", 520, 620);
}

// Soft, pleasant two-note chime (C6 → E6) for payment-confirm prompts.
// Replaces the previous loud square-wave alarm — that one was too harsh
// and caused complaints. Volume capped at 0.22 so it stays gentle.
export function playLoudAlarm() {
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;
  _playSoftChime();
  if ("vibrate" in navigator) {
    // Single short pulse only — no aggressive multi-buzz pattern.
    navigator.vibrate(120);
  }
}

function _playSoftChime() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    // Two soft sine notes: C6 (1046.5Hz), then E6 (1318.5Hz).
    const notes: Array<{ freq: number; offset: number; dur: number }> = [
      { freq: 1046.5, offset: 0,    dur: 0.35 },
      { freq: 1318.5, offset: 0.18, dur: 0.45 },
    ];
    for (const n of notes) {
      const t = start + n.offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch (_) {}
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
