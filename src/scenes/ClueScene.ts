// Найдена улика (и перечитывание улики с доски).

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { startLevel } from '../flow';
import { ScrollArea, addBackground, fadeIn, makeButton, panel, ribbon, starsRow, txt } from '../ui/widgets';

interface ClueData {
  caseId: string;
  index: number;
  isNew?: boolean;
  stars?: number;
  from?: string;
}

export class ClueScene extends Phaser.Scene {
  constructor() {
    super('Clue');
  }

  create(data: ClueData): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    const clue = c.clues[data.index];
    const total = c.clues.length;
    addBackground(this, 'bg_fog', 0.2);

    let y = 96;
    ribbon(this, W / 2, y, 760, 110, data.isNew ? t('clue.found') : t('clue.number', { n: data.index + 1, total }), 60);
    y += 90;
    const stars = data.isNew ? (data.stars ?? 1) : save.progress(c.id, total).stars[data.index];
    if (data.isNew) sfx.clue();
    starsRow(this, W / 2, y + 60, stars, 44);
    y += 130;

    // карточка с предметом
    const cardH = 300;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(W / 2 - 250 + 4, y + 10, 500, cardH, 14);
    g.fillStyle(C.paperLight, 1);
    g.fillRoundedRect(W / 2 - 250, y, 500, cardH, 14);
    g.lineStyle(3, C.paperDark, 1);
    g.strokeRoundedRect(W / 2 - 232, y + 18, 464, cardH - 36, 8);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(W / 2, y + 4, 17);
    g.fillStyle(C.brassLight, 1);
    g.fillCircle(W / 2 - 3, y + 1, 9);
    const icon = this.add.image(W / 2, y + cardH / 2 + 8, clue.image).setDisplaySize(240, 240);
    if (data.isNew) {
      icon.setScale(0.1);
      this.tweens.add({ targets: icon, scale: 240 / 400, duration: 450, ease: 'Back.easeOut', delay: 150 });
    }
    y += cardH + 30;

    // название и текст
    const bottom = H - 220;
    panel(this, 40, y, W - 80, bottom - y, 36);
    if (data.isNew) txt(this, W / 2, y + 62, t('clue.number', { n: data.index + 1, total }), 34, C.inkSoft, { italic: true });
    const titleY = y + (data.isNew ? 122 : 92);
    const title = txt(this, W / 2, titleY, clue.title, 62, C.wine, { head: true });
    title.setScale(Math.min(1, (W - 200) / title.width));
    const line = this.add.graphics();
    line.lineStyle(3, C.brassDark, 0.7);
    line.lineBetween(W / 2 - 220, titleY + 52, W / 2 + 220, titleY + 52);
    const areaTop = titleY + 82;
    const area = new ScrollArea(this, 90, areaTop, W - 180, bottom - areaTop - 50);
    area.addParagraphs(clue.text, 46);
    area.addSpace(20);

    const toBoard = () => this.scene.start('Board', { caseId: c.id, from: data.from, highlight: data.isNew ? data.index : undefined });
    if (data.isNew) {
      makeButton(this, W / 2, H - 112, 700, 150, t('clue.toBoard'), toBoard, 'primary', 60);
    } else {
      // пройденную партию можно переиграть ради звёзд
      makeButton(this, W / 2 - 250, H - 112, 480, 140, t('clue.replay'), () => void startLevel(this, c, data.index + 1), 'paper', 46);
      makeButton(this, W / 2 + 250, H - 112, 480, 140, t('clue.back'), toBoard, 'primary', 46);
    }
  }
}
