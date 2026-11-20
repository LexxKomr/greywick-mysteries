// Главное меню.

import Phaser from 'phaser';
import { C, H, VERSION, W } from '../config';
import { continueCase, startDaily } from '../flow';
import { dailySeed } from '../logic/generator';
import { t } from '../services/i18n';
import { currentCase } from '../services/cases';
import { save } from '../services/save';
import { signalPlatformReady } from '../services/platformLanguage';
import { fadeIn, makeButton, txt } from '../ui/widgets';
import { confirmProgressReset } from '../ui/progress';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    fadeIn(this);
    const backdrop = this.add.image(W * 0.6, H / 2, 'menu_promenade').setOrigin(0.6, 0.5);
    const widthScale = W / backdrop.width;
    const heightScale = Math.max(widthScale, H / backdrop.height);
    backdrop.setScale(Math.max(widthScale, heightScale * 0.93), heightScale);

    const logoY = Math.round(H * 0.245);
    const scroll = this.add.image(W / 2, logoY, 'menu_scroll');
    scroll.setDisplaySize(950, 504);
    const title = txt(this, W / 2, logoY + 24, t('title.main').replace(' ', '\n'), 110, C.wineDark, { head: true, spacing: 4 });
    title.setScale(Math.min(1, 710 / title.width, 188 / title.height));
    const subtitle = txt(this, W / 2, logoY + 149, t('title.sub'), 40, C.ink, { head: true });
    subtitle.setScale(Math.min(1, 720 / subtitle.width, 38 / subtitle.height));

    const x = W / 2 - 32;
    makeButton(this, x, H * 0.545, 630, 240, t('menu.play'), () => this.scene.start('Map'), 'paper', 102,
      { key: 'menu_play', labelOffsetY: 29 });
    const dailyDone = save.data.daily?.date === dailySeed();
    makeButton(this, x, H * 0.665, 550, 116, dailyDone ? t('menu.dailyDone') : t('menu.daily'), () => void startDaily(this), 'paper', 53,
      { key: 'menu_daily', labelMaxWidth: 320 });
    makeButton(this, x, H * 0.751, 550, 116, t('menu.settings'), () => this.scene.start('Settings'), 'paper', 53,
      { key: 'menu_settings', labelMaxWidth: 320 });
    makeButton(this, x, H * 0.843, 400, 76, t('menu.restart'), () => confirmProgressReset(this, () => {
      const first = currentCase();
      if (first) continueCase(this, first);
      else this.scene.start('Map');
    }), 'dark', 35, { key: 'menu_reset', labelMaxWidth: 264 });

    const version = txt(this, W - 26, H - 15, 'v' + VERSION, 27, C.paperLight, { ox: 1, oy: 1 });
    version.setShadow(0, 2, '#10191e', 6, false, true).setAlpha(0.8);
    signalPlatformReady();
  }
}
