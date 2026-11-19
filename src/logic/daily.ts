import type { GameKind } from '../services/cases';
import { mulberry32 } from './generator';

const kinds: GameKind[] = ['tripeaks', 'pyramid', 'klondike', 'freecell'];

export function dailyKind(day: number): GameKind {
  return kinds[Math.floor(mulberry32(day ^ 0x16ab2f79)() * kinds.length)];
}

export function dailyPreset(day: number, seeds: number[]): number {
  return seeds[Math.floor(mulberry32(day ^ 0x1c786516)() * seeds.length)];
}
