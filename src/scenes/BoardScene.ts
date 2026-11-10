// Доска улик.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { caseState, getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { ScrollArea, addBackground, drawBack, fadeIn, makeButton, roundButton, txt } from '../ui/widgets';

interface BoardData {
  caseId: string;
  from?: string;
  highlight?: number;
}

const CELL_W = 470;
const CELL_H = 350;

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('Board');
  }

  create(data: BoardData): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    const total = c.clues.length;
    const stars = save.progress(c.id, total).stars;
    const found = save.found(c.id, total);
    const state = caseState(c);
    addBackground(this, 'bg_fog', 0.35);

    const back = data.from === 'Accuse' ? 'Accuse' : data.from === 'Ending' ? 'Ending' : 'Map';
    roundButton(this, 82, 82, 50, drawBack, () => this.scene.start(back, { caseId: c.id }));
    txt(this, W / 2, 62, t('board.title'), 70, C.paperLight, { head: true });
    txt(this, W / 2, 130, c.title, 36, C.brassLight, { italic: true });

    // пробковая доска в деревянной раме
    const top = 190;
    const bottom = H - 300;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(24, top + 10, W - 40, bottom - top, 18);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(20, top, W - 40, bottom - top, 18);
    g.fillStyle(C.cork, 1);
    g.fillRoundedRect(38, top + 18, W - 76, bottom - top - 36, 8);
    g.fillStyle(0x000000, 0.1);
    let seed = 7;
    for (let i = 0; i < 260; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const x = 44 + (seed % (W - 96));
      seed = (seed * 1103515245 + 12345) >>> 0;
      const y = top + 24 + (seed % (bottom - top - 56));
      g.fillCircle(x, y, 2 + (seed % 3));
    }

    const area = new ScrollArea(this, 50, top + 26, W - 100, bottom - top - 52, C.paperLight);
    const rows = Math.ceil(total / 2);
    const holder = this.add.container(0, 0);
    for (let i = 0; i < total; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 20 + CELL_W / 2 + col * (CELL_W + 20);
      const cy = 20 + CELL_H / 2 + row * (CELL_H + 24);
      holder.add(this.makeNote(c.id, i, cx, cy, stars[i] > 0, c.clues[i].title, c.clues[i].image, area, data));
    }
    area.add(holder, rows * (CELL_H + 24) + 30);

    // низ: сколько найдено и что делать дальше
    txt(this, W / 2, H - 252, t('board.found', { found, total }) + (found > 0 ? '  ·  ' + t('board.hint') : ''), 34, C.paperLight);
    const label = state === 'closed' ? t('board.ending') : state === 'accuse' ? t('board.accuse') : t('board.continue');
    makeButton(this, W / 2, H - 130, 900, 150, label, () => {
      if (data.from === 'Accuse' && state === 'accuse') this.scene.start('Accuse', { caseId: c.id });
      else continueCase(this, c);
    }, 'primary', 56);
  }

  private makeNote(caseId: string, index: number, cx: number, cy: number, found: boolean, title: string, image: string, area: ScrollArea, data: BoardData): Phaser.GameObjects.Container {
    const cont = this.add.container(cx, cy);
    const g = this.add.graphics();
    const w = CELL_W - 30;
    const h = CELL_H - 24;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 5, -h / 2 + 9, w, h, 8);
    g.fillStyle(found ? C.paperLight : 0xb7a37f, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    if (found) {
      g.lineStyle(2, C.paperDark, 1);
      g.strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 5);
    }
    // кнопка-гвоздик
    g.fillStyle(found ? C.wine : 0x6d6048, 1);
    g.fillCircle(0, -h / 2 + 6, 15);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(-4, -h / 2 + 2, 6);
    cont.add(g);
    cont.setAngle(((index * 37) % 5) - 2);

    if (found) {
      cont.add(this.add.image(0, -38, image).setDisplaySize(176, 176));
      cont.add(txt(this, 0, 66, t('board.clue', { n: index + 1 }), 28, C.inkSoft, { italic: true }));
      const tt = txt(this, 0, 110, title, 36, C.wine, { head: true, wrap: w - 36, spacing: -2 });
      if (tt.height > 96) tt.setScale(96 / tt.height);
      cont.add(tt);
      cont.setSize(w, h);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (area.moved || !area.contains(p)) return;
        sfx.click();
        this.scene.start('Clue', { caseId, index, from: data.from });
      });
      if (data.highlight === index) {
        cont.setScale(1.25);
        this.tweens.add({ targets: cont, scale: 1, duration: 500, ease: 'Bounce.easeOut', delay: 200 });
      }
    } else {
      cont.add(txt(this, 0, -24, '?', 150, 0x6d6048, { head: true }));
      cont.add(txt(this, 0, 104, t('board.clue', { n: index + 1 }), 32, 0x6d6048, { italic: true }));
    }
    return cont;
  }
}
