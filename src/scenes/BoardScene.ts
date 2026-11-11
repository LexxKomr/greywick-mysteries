// Доска улик в кабинете Эдит: пробковая доска на картинке art\study_board.png,
// улики приколоты кнопками, между найденными — красная нить; ненайденные — бумажный силуэт с «?».

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { caseState, getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { drawBack, drawStar, fadeIn, makeButton, panel, roundButton, txt } from '../ui/widgets';

interface BoardData {
  caseId: string;
  from?: string;
  highlight?: number;
}

/** Где на картинке кабинета пробка (доли ширины и высоты, внутри деревянной рамы). */
const CORK = { x0: 0.085, x1: 0.915, y0: 0.285, y1: 0.765 };
const COLS = 3;

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

    // фон-кабинет: картинка на весь экран, лишнее по краям обрезается
    const bg = this.add.image(W / 2, H / 2, 'study_board');
    const scale = Math.max(W / bg.width, H / bg.height);
    bg.setScale(scale);
    const sw = bg.width * scale;
    const sh = bg.height * scale;
    const left = W / 2 - sw / 2;
    const top = H / 2 - sh / 2;
    const cork = {
      x0: Math.max(24, left + CORK.x0 * sw),
      x1: Math.min(W - 24, left + CORK.x1 * sw),
      y0: top + CORK.y0 * sh,
      y1: top + CORK.y1 * sh,
    };

    // затемнение сверху под заголовок
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x0a1014, 0x0a1014, 0x0a1014, 0x0a1014, 0.85, 0.85, 0, 0);
    shade.fillRect(0, 0, W, 230);

    const back = data.from === 'Accuse' ? 'Accuse' : data.from === 'Ending' ? 'Ending' : 'Map';
    roundButton(this, 82, 82, 50, drawBack, () => this.scene.start(back, { caseId: c.id }));
    const title = txt(this, W / 2, 62, t('board.title'), 70, C.paperLight, { head: true });
    title.setShadow(0, 4, '#000000', 10, false, true);
    const sub = txt(this, W / 2, 130, c.title, 36, C.brassLight, { italic: true });
    sub.setShadow(0, 3, '#000000', 8, false, true);

    // сетка мест на пробке: 3 столбца
    const rows = Math.ceil(total / COLS);
    const pad = 14;
    const cellW = (cork.x1 - cork.x0 - 2 * pad) / COLS;
    const cellH = (cork.y1 - cork.y0 - 2 * pad) / rows;
    const noteW = Math.min(300, cellW - 24);
    const noteH = Math.min(260, cellH - 20);
    const pins: { x: number; y: number; found: boolean }[] = [];
    const notes: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < total; i++) {
      // «змейкой»: чётные ряды слева направо, нечётные справа налево — нить идёт без диагоналей
      const row = Math.floor(i / COLS);
      const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
      // чуть вразнобой, как прикалывают от руки
      const jx = (((i * 53) % 7) - 3) * 3;
      const jy = (((i * 31) % 5) - 2) * 3;
      const cx = cork.x0 + pad + cellW * (col + 0.5) + jx;
      const cy = cork.y0 + pad + cellH * (row + 0.5) + jy;
      const isFound = stars[i] > 0;
      notes.push(this.makeNote(c.id, i, cx, cy, noteW, noteH, stars[i], c.clues[i].title, c.clues[i].image, data));
      pins.push({ x: cx, y: cy - noteH / 2 + 14, found: isFound });
    }

    // красная нить между найденными уликами (по порядку), поверх листков
    const thread = this.add.graphics().setDepth(20);
    for (let i = 0; i + 1 < total; i++) {
      const a = pins[i];
      const b = pins[i + 1];
      if (!a.found || !b.found) continue;
      const sag = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2 + sag), new Phaser.Math.Vector2(b.x, b.y));
      const pts = curve.getPoints(24);
      thread.lineStyle(6, 0x000000, 0.28);
      thread.strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x + 3, p.y + 5)));
      thread.lineStyle(4, 0xa3202a, 1);
      thread.strokePoints(pts);
    }
    // кнопки-гвоздики — поверх нити
    const pg = this.add.graphics().setDepth(21);
    for (const p of pins) {
      pg.fillStyle(0x000000, 0.35);
      pg.fillCircle(p.x + 4, p.y + 6, 15);
      pg.fillStyle(p.found ? C.wine : 0x6d6048, 1);
      pg.fillCircle(p.x, p.y, 15);
      pg.fillStyle(0xffffff, 0.35);
      pg.fillCircle(p.x - 5, p.y - 5, 6);
    }

    if (data.highlight !== undefined && notes[data.highlight]) {
      const n = notes[data.highlight];
      n.setScale(1.25);
      this.tweens.add({ targets: n, scale: 1, duration: 500, ease: 'Bounce.easeOut', delay: 200 });
    }

    // нижняя панель: прогресс и что делать дальше (закрывает край стола и кусок лампы)
    const panelTop = Math.max(cork.y1 + 40, H - 330);
    panel(this, 30, panelTop, W - 60, H - panelTop - 24, 30).setDepth(30);
    txt(this, W / 2, panelTop + 52, t('board.found', { found, total }), 38, C.ink, { head: true }).setDepth(31);
    if (found > 0) txt(this, W / 2, panelTop + 100, t('board.hint'), 28, C.inkSoft, { italic: true, wrap: W - 140 }).setDepth(31);
    const label = state === 'closed' ? t('board.ending') : state === 'accuse' ? t('board.accuse') : t('board.continue');
    const btnY = Math.min(H - 110, panelTop + 200);
    makeButton(this, W / 2, btnY, 860, 140, label, () => {
      if (data.from === 'Accuse' && state === 'accuse') this.scene.start('Accuse', { caseId: c.id });
      else continueCase(this, c);
    }, 'primary', 52).setDepth(31);
  }

  private makeNote(caseId: string, index: number, cx: number, cy: number, w: number, h: number, starCount: number, title: string, image: string, data: BoardData): Phaser.GameObjects.Container {
    const found = starCount > 0;
    const cont = this.add.container(cx, cy).setDepth(10);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.38);
    g.fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 6);
    if (found) {
      g.fillStyle(C.paperLight, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      g.lineStyle(2, C.paperDark, 1);
      g.strokeRoundedRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 4);
    } else {
      // бумажный силуэт: лист ещё пустой
      g.fillStyle(0xc9b58c, 0.78);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      g.lineStyle(3, 0x7d6a48, 0.6);
      g.strokeRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 4);
    }
    cont.add(g);
    cont.setAngle(((index * 37) % 5) - 2);

    if (found) {
      for (let k = 0; k < 3; k++) drawStar(g, (k - 1) * 34 + (k - 1) * 4, -h / 2 + 40, 13, k < starCount);
      const img = Math.min(h - 120, w - 60);
      cont.add(this.add.image(0, -h / 2 + 62 + img / 2, image).setDisplaySize(img, img));
      const tt = txt(this, 0, h / 2 - 34, title, 26, C.wine, { head: true, wrap: w - 28, spacing: -4 });
      if (tt.height > 58) tt.setScale(58 / tt.height);
      cont.add(tt);
      cont.setSize(w, h);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerup', () => {
        sfx.click();
        this.scene.start('Clue', { caseId, index, from: data.from });
      });
    } else {
      cont.add(txt(this, 0, -14, '?', 110, 0x6d5a3c, { head: true }));
      cont.add(txt(this, 0, h / 2 - 36, t('board.clue', { n: index + 1 }), 28, 0x6d5a3c, { italic: true }));
    }
    return cont;
  }
}
