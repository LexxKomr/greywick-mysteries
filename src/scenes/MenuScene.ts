// Главное меню.

import Phaser from 'phaser';
import { C, H, VERSION, W } from '../config';
import { continueCase, startDaily } from '../flow';
import { dailySeed } from '../logic/generator';
import { caseState, currentCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { addBackground, drawPanel, fadeIn, makeButton, txt } from '../ui/widgets';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    fadeIn(this);
    addBackground(this, 'bg_harbor', 0.12);

    // логотип на бумажном свитке
    const ly = Math.round(H * 0.1);
    const g = this.add.graphics();
    drawPanel(g, 90, ly, W - 180, 440, 40);
    g.fillStyle(C.wine, 1);
    g.fillCircle(W / 2, ly + 6, 20);
    g.fillStyle(C.brass, 1);
    g.fillCircle(W / 2, ly + 6, 11);
    txt(this, W / 2, ly + 170, t('title.main').replace(' ', '\n'), 124, C.wine, { head: true, spacing: -14 });
    g.lineStyle(3, C.brassDark, 0.8);
    g.lineBetween(250, ly + 322, 440, ly + 322);
    g.lineBetween(W - 440, ly + 322, W - 250, ly + 322);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(W / 2, ly + 322, 8);
    g.fillCircle(W / 2 - 40, ly + 322, 5);
    g.fillCircle(W / 2 + 40, ly + 322, 5);
    txt(this, W / 2, ly + 372, t('title.sub'), 54, C.inkSoft, { head: true });

    // кнопки
    const cur = currentCase();
    let y = Math.round(H * 0.47);
    let sub = t('menu.allClosed');
    let started = false;
    if (cur) {
      const total = cur.clues.length;
      const found = save.found(cur.id, total);
      const state = caseState(cur);
      started = state !== 'new';
      sub = state === 'accuse' ? t('menu.accuse', { n: cur.number }) : t('menu.progress', { n: cur.number, found, total });
    }
    makeButton(this, W / 2, y, 700, 190, started ? t('menu.continue') : t('menu.play'), () => (cur ? continueCase(this, cur) : this.scene.start('Map')), 'primary', 88);
    const subText = txt(this, W / 2, y + 138, sub, 38, C.paperLight, { bold: true });
    subText.setShadow(0, 3, '#000000', 8, false, true);

    y += 290;
    makeButton(this, W / 2, y, 600, 130, t('menu.cases'), () => this.scene.start('Map'));
    y += 165;
    const dailyDone = save.data.daily?.date === dailySeed();
    makeButton(this, W / 2, y, 600, 130, dailyDone ? t('menu.dailyDone') : t('menu.daily'), () => void startDaily(this));
    y += 165;
    makeButton(this, W / 2, y, 600, 130, t('menu.settings'), () => this.scene.start('Settings'));

    txt(this, W - 24, H - 20, 'v' + VERSION, 30, C.paperLight, { ox: 1, oy: 1 }).setAlpha(0.6);
  }
}
