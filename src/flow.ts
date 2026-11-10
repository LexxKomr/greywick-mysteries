// Переходы между экранами дела.

import Phaser from 'phaser';
import { ads } from './services/ads';
import { CaseData, caseState } from './services/cases';
import { save } from './services/save';

let switching = false;

/** Запускает партию. Если пора — сначала показывает межстраничную рекламу. */
export async function startLevel(scene: Phaser.Scene, c: CaseData, level: number): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start('Game', { mode: 'case', caseId: c.id, level });
}

export async function startDaily(scene: Phaser.Scene): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start('Game', { mode: 'daily' });
}

/** Выход в меню после партии дня: тоже подходящее место для рекламы. */
export async function toMenuAfterGame(scene: Phaser.Scene): Promise<void> {
  if (switching) return;
  switching = true;
  await ads.interstitialIfDue();
  switching = false;
  scene.scene.start('Menu');
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
