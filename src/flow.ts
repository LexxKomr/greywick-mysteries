// Переходы между экранами дела.

import Phaser from 'phaser';
import { ads } from './services/ads';
import { CaseData, caseState } from './services/cases';
import { save } from './services/save';

/** Какой экран играет какой пасьянс. Пока пасьянс не готов, вместо него идут «Три пика». */
const SCENES: Record<string, string> = { tripeaks: 'Game', pyramid: 'Pyramid' };

export function sceneForLevel(c: CaseData, level: number): string {
  return SCENES[c.levels?.[level - 1]?.game ?? 'tripeaks'] ?? 'Game';
}

let switching = false;

/** Запускает партию. Если пора — сначала показывает межстраничную рекламу. */
export async function startLevel(scene: Phaser.Scene, c: CaseData, level: number): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start(sceneForLevel(c, level), { mode: 'case', caseId: c.id, level });
}

export async function startDaily(scene: Phaser.Scene): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start('Game', { mode: 'daily' });
}

/** Выход после партии (в меню или к доске): тоже подходящее место для рекламы. */
export async function toMenuAfterGame(scene: Phaser.Scene, key = 'Menu', data?: object): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start(key, data);
}

/** Следующий шаг дела: вступление → партии → выбор виновного → развязка. */
export function continueCase(scene: Phaser.Scene, c: CaseData): void {
  const total = c.clues.length;
  const state = caseState(c);
  if (state === 'closed') {
    scene.scene.start('Ending', { caseId: c.id });
  } else if (!save.progress(c.id, total).introSeen) {
    scene.scene.start('Intro', { caseId: c.id });
  } else if (state === 'accuse') {
    scene.scene.start('Accuse', { caseId: c.id });
  } else {
    void startLevel(scene, c, save.nextLevel(c.id, total));
  }
}
