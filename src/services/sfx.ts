// Простые звуки (щелчки карт), сделаны кодом — без звуковых файлов.

import { save } from './save';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!save.data.sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, cutoff: number): void {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  const gain = a.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

export const sfx = {
  click: () => tone(520, 0.06, 0.05, 'triangle'),
  card: (streak = 0) => {
    noise(0.07, 0.22, 2400);
    if (streak > 1) tone(420 + Math.min(streak, 12) * 45, 0.09, 0.035, 'sine');
  },
  draw: () => noise(0.09, 0.16, 1500),
  no: () => tone(150, 0.1, 0.05, 'square'),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 0.07, 'triangle', i * 0.11)),
  lose: () => [330, 262].forEach((f, i) => tone(f, 0.3, 0.06, 'triangle', i * 0.16)),
  clue: () => [392, 494, 587].forEach((f, i) => tone(f, 0.35, 0.06, 'sine', i * 0.13)),
};
