// Развязка дела.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { ScrollArea, addBackground, drawStar, fadeIn, makeButton, panel, starsRow, txt } from '../ui/widgets';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(data: { caseId: string; fresh?: boolean }): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    const total = c.clues.length;
    const accused = save.progress(c.id, total).accused;
    const right = accused === c.culprit;
    addBackground(this, 'bg_harbor', 0.55);
    if (data.fresh) (right ? sfx.win : sfx.lose)();

    // заголовок
    const title = txt(this, W / 2, 84, right ? t('ending.right') : t('ending.wrong'), 84, right ? C.gold : C.paperLight, { head: true });
    title.setShadow(0, 4, '#000000', 10, false, true);
    let y = 150;
    if (right) {
      starsRow(this, W / 2, y + 70, 3, 50);
      y += 150;
    }
    const sub = txt(this, W / 2, y + 24, right ? t('ending.rightSub') : t('ending.wrongSub'), 44, C.brassLight, { head: true });
    sub.setShadow(0, 3, '#000000', 8, false, true);
    y += 70;

    // звёзды за партии
    const got = save.totalStars(c.id, total);
    const sg = this.add.graphics();
    const st = txt(this, W / 2 + 26, y + 26, t('ending.stars', { n: got, total: total * 3 }), 36, C.paperLight);
    drawStar(sg, W / 2 - st.width / 2 - 12, y + 24, 20);
    y += 70;

    // текст
    const bottom = H - 220;
    panel(this, 40, y, W - 80, bottom - y, 36);
    const area = new ScrollArea(this, 90, y + 50, W - 180, bottom - y - 100);
    if (!right && accused && c.wrong[accused]) {
      const who = c.suspects.find((s) => s.id === accused);
      if (who) {
        const h = txt(this, 0, 0, who.name, 50, C.wine, { head: true, ox: 0, oy: 0, align: 'left' });
        area.add(h, h.height, 16);
      }
      area.addParagraphs(c.wrong[accused], 46);
      area.addSpace(10);
    }
    const head = this.add.container(0, 0);
    const line = this.add.graphics();
    const aw = W - 180 - 28;
    line.lineStyle(3, C.brassDark, 0.7);
    line.lineBetween(0, 36, aw / 2 - 190, 36);
    line.lineBetween(aw / 2 + 190, 36, aw, 36);
    head.add(line);
    head.add(txt(this, aw / 2, 36, t('ending.resolution'), 44, C.wine, { head: true }));
    area.add(head, 72, 24);
    area.addParagraphs(c.ending, 46);
    area.addSpace(20);

    makeButton(this, W / 2, H - 112, 820, 150, t('ending.toMap'), () => this.scene.start('Map'), 'primary', 56);
  }
}
