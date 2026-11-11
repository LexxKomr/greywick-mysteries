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
    addBackground(this, 'study_board', 0.6); // кабинет Эдит, где висит доска

    let y = 96;
    ribbon(this, W / 2, y, 760, 110, data.isNew ? t('clue.found') : t('clue.number', { n: data.index + 1, total }), 60);
    y += 90;
    const stars = data.isNew ? (data.stars ?? 1) : save.progress(c.id, total).stars[data.index];
    if (data.isNew) sfx.clue();
    starsRow(this, W / 2, y + 60, stars, 56);
    y += 130;

    // улика на листе старой бумаги, приколотом латунной кнопкой (как на референсе 3)
    const sheetW = 620;
    const sheetH = Math.min(440, Math.round(H * 0.23));
    const sheet = this.add.container(W / 2, y + sheetH / 2 + 6);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-sheetW / 2 + 6, -sheetH / 2 + 12, sheetW, sheetH, 10);
    g.fillStyle(0xe9d9b4, 1);
    g.fillRoundedRect(-sheetW / 2, -sheetH / 2, sheetW, sheetH, 10);
    g.fillStyle(C.paperLight, 1);
    g.fillRoundedRect(-sheetW / 2 + 10, -sheetH / 2 + 10, sheetW - 20, sheetH - 20, 6);
    g.lineStyle(2, C.paperDark, 1);
    g.strokeRoundedRect(-sheetW / 2 + 24, -sheetH / 2 + 24, sheetW - 48, sheetH - 48, 4);
    // пятно от чашки и загнутый уголок — чтобы лист выглядел старым
    g.lineStyle(5, 0xc9a877, 0.35);
    g.strokeCircle(sheetW / 2 - 96, sheetH / 2 - 84, 44);
    g.fillStyle(0xd8c49a, 1);
    g.fillTriangle(sheetW / 2 - 10, sheetH / 2 - 10, sheetW / 2 - 64, sheetH / 2 - 10, sheetW / 2 - 10, sheetH / 2 - 64);
    // латунная кнопка
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(3, -sheetH / 2 + 14, 22);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(0, -sheetH / 2 + 8, 22);
    g.fillStyle(C.brass, 1);
    g.fillCircle(0, -sheetH / 2 + 8, 18);
    g.fillStyle(C.brassLight, 1);
    g.fillCircle(-5, -sheetH / 2 + 3, 8);
    const size = sheetH - 70;
    const icon = this.add.image(0, 14, clue.image).setDisplaySize(size, size);
    sheet.add([g, icon]);
    sheet.setAngle(-2.5);
    if (data.isNew) {
      const full = icon.scaleX;
      icon.setScale(0.1);
      this.tweens.add({ targets: icon, scale: full, duration: 450, ease: 'Back.easeOut', delay: 150 });
      sheet.setScale(0.85).setAlpha(0);
      this.tweens.add({ targets: sheet, scale: 1, alpha: 1, duration: 300, ease: 'Cubic.easeOut' });
    }
    y += sheetH + 44;

    // название и текст
    const bottom = H - 220;
    panel(this, 40, y, W - 80, bottom - y, 36);
    if (data.isNew) txt(this, W / 2, y + 62, t('clue.number', { n: data.index + 1, total }), 34, C.inkSoft, { italic: true });
    const titleY = y + (data.isNew ? 122 : 92);
    const title = txt(this, W / 2, titleY, clue.title, 62, C.wine, { head: true });
    title.setScale(Math.min(1, (W - 200) / title.width));
    // завитки по бокам названия, как на референсе
    const line = this.add.graphics();
    const half = Math.min(title.displayWidth / 2 + 24, W / 2 - 110);
    line.lineStyle(3, C.brassDark, 0.8);
    line.lineBetween(W / 2 - half - 70, titleY, W / 2 - half - 6, titleY);
    line.lineBetween(W / 2 + half + 6, titleY, W / 2 + half + 70, titleY);
    line.fillStyle(C.brassDark, 0.9);
    for (const sx of [-1, 1]) {
      const x = W / 2 + sx * (half + 80);
      line.fillPoints([new Phaser.Math.Vector2(x - 9, titleY), new Phaser.Math.Vector2(x, titleY - 9), new Phaser.Math.Vector2(x + 9, titleY), new Phaser.Math.Vector2(x, titleY + 9)], true);
    }
    // текст — на отдельной, чуть темнее, бумажной плашке
    const areaTop = titleY + 62;
    const plate = this.add.graphics();
    plate.fillStyle(C.paperDark, 0.55);
    plate.fillRoundedRect(70, areaTop - 14, W - 140, bottom - areaTop - 30, 16);
    plate.lineStyle(2, C.brassDark, 0.45);
    plate.strokeRoundedRect(70, areaTop - 14, W - 140, bottom - areaTop - 30, 16);
    const area = new ScrollArea(this, 100, areaTop + 6, W - 200, bottom - areaTop - 70);
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
