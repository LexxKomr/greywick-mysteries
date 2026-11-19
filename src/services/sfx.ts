// Короткие звуки бумаги, дерева и приглушённых музыкальных нот.

import { save } from './save';

let ctx: AudioContext | null = null;
let paper: AudioBuffer | undefined;

function audio(): AudioContext | null {
  if (!save.data.sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
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
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function rustle(dur: number, vol: number, cutoff: number): void {
  const a = audio();
  if (!a) return;
  if (!paper) {
    paper = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = paper.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = paper;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cutoff * (0.9 + Math.random() * 0.2);
  filter.Q.value = 0.8;
  const gain = a.createGain();
  const now = a.currentTime;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(vol, now + dur * 0.18);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(now, Math.random() * 0.75, dur);
}

export const sfx = {
  click: () => {
    tone(205, 0.075, 0.042, 'triangle');
    rustle(0.045, 0.060, 1200);
  },
  card: (streak = 0) => {
    rustle(0.11, 0.13, 1550);
    tone(160 + Math.random() * 34, 0.065, 0.035);
    if (streak > 1) tone([261.63, 293.66, 329.63, 392, 440][Math.min(streak - 2, 4)], 0.17, 0.028);
  },
  draw: () => rustle(0.17, 0.15, 1150),
  no: () => tone(131, 0.11, 0.034, 'triangle'),
  win: () => [293.66, 349.23, 440, 523.25].forEach((f, i) => tone(f, 0.57, 0.058, 'triangle', i * 0.12)),
  lose: () => [246.94, 196].forEach((f, i) => tone(f, 0.45, 0.037, 'sine', i * 0.17)),
  clue: () => [349.23, 440, 587.33].forEach((f, i) => tone(f, 0.46, 0.049, 'sine', i * 0.14)),
};
