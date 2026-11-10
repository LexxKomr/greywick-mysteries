// Настройки: звук, язык, сброс прогресса.

import Phaser from 'phaser';
import { C, H, VERSION, W } from '../config';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { Button, addBackground, fadeIn, makeButton, panel, showDialog, toast, txt } from '../ui/widgets';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    fadeIn(this);
    addBackground(this, 'bg_harbor', 0.5);
    const top = Math.round(H * 0.12);
    panel(this, 60, top, W - 120, 1120, 40);
    txt(this, W / 2, top + 110, t('settings.title'), 84, C.wine, { head: true });

    // звук
    let y = top + 270;
    txt(this, W / 2, y - 80, t('settings.sound'), 44, C.inkSoft, { bold: true });
    const soundLabel = () => (save.data.sound ? t('settings.on') : t('settings.off'));
    const sound: Button = makeButton(this, W / 2, y + 10, 620, 130, soundLabel(), () => {
      save.data.sound = !save.data.sound;
      save.persist();
      sound.setLabel(soundLabel());
      sfx.click();
    });

    // язык
    y += 270;
    txt(this, W / 2, y - 80, t('settings.lang'), 44, C.inkSoft, { bold: true });
    makeButton(this, W / 2 - 215, y + 10, 400, 130, t('settings.langRu'), () => {}, 'primary', 46);
    makeButton(this, W / 2 + 215, y + 10, 400, 130, t('settings.langEn'), () => {}, 'paper', 40).setEnabled(false);

    // сброс
    y += 250;
    makeButton(this, W / 2, y + 10, 620, 120, t('settings.reset'), () => {
      showDialog(this, t('settings.resetTitle'), t('settings.resetText'), [
        { label: t('settings.resetNo'), style: 'primary', onClick: () => {} },
        {
          label: t('settings.resetYes'),
          onClick: () => {
            save.reset();
            toast(this, t('settings.resetDone'));
          },
        },
      ]);
    }, 'paper', 46);

    makeButton(this, W / 2, top + 1000, 620, 140, t('settings.back'), () => this.scene.start('Menu'), 'primary', 56);
    txt(this, W / 2, top + 1160, `${t('title.main')} · v${VERSION}`, 32, C.paperLight).setAlpha(0.7);
  }
}
