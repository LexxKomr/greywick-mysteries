// Вступление к делу.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { ScrollArea, addBackground, drawBack, fadeIn, makeButton, panel, roundButton, txt } from '../ui/widgets';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create(data: { caseId: string }): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    addBackground(this, 'bg_harbor', 0.45);
    roundButton(this, 82, 82, 50, drawBack, () => this.scene.start('Map'));

    txt(this, W / 2, 72, t('map.case', { n: c.number }), 44, C.brassLight, { head: true });
    const title = txt(this, W / 2, 158, c.title, 76, C.paperLight, { head: true });
    title.setScale(Math.min(1, (W - 220) / title.width));
    title.setShadow(0, 4, '#000000', 10, false, true);

    const top = 240;
    const bottom = H - 230;
    panel(this, 40, top, W - 80, bottom - top, 36);
    const area = new ScrollArea(this, 90, top + 50, W - 180, bottom - top - 100);
    area.addParagraphs(c.intro, 47);
    area.addSpace(20);

    makeButton(this, W / 2, H - 118, 820, 150, t('intro.start'), () => {
      save.markIntroSeen(c.id, c.clues.length);
      continueCase(this, c);
    }, 'primary', 58);
  }
}
