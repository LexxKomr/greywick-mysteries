// Выбор виновного.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { Button, addBackground, drawBack, fadeIn, makeButton, roundButton, txt } from '../ui/widgets';

const CARD_W = 470;
const CARD_H = 700;

export class AccuseScene extends Phaser.Scene {
  private selected: string | null = null;
  private frames: Record<string, Phaser.GameObjects.Graphics> = {};
  private cards: Record<string, Phaser.GameObjects.Container> = {};
  private confirm!: Button;

  constructor() {
    super('Accuse');
  }

  create(data: { caseId: string }): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    this.selected = null;
    this.frames = {};
    this.cards = {};
    addBackground(this, 'bg_harbor', 0.55);
    roundButton(this, 82, 82, 50, drawBack, () => this.scene.start('Map'));

    // тёмная табличка с вопросом
    const g = this.add.graphics();
    g.fillStyle(C.brassDark, 1);
    g.fillRoundedRect(170, 28, W - 250, 124, 24);
    g.fillStyle(C.brass, 1);
    g.fillRoundedRect(173, 31, W - 256, 118, 22);
    g.fillStyle(0x1b1612, 1);
    g.fillRoundedRect(180, 38, W - 270, 104, 18);
    txt(this, 170 + (W - 250) / 2, 88, t('accuse.title'), 72, C.paperLight, { head: true });

    const intro = txt(this, W / 2, 0, c.accuse.join('\n'), 38, C.paperLight, { wrap: W - 140, italic: true });
    intro.setY(170 + intro.height / 2);
    intro.setShadow(0, 3, '#000000', 8, false, true);

    const gridTop = 170 + intro.height + 30;
    const gridBottom = H - 330;
    const scale = Math.min(1, (gridBottom - gridTop - 30) / (CARD_H * 2 + 30));
    c.suspects.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = W / 2 + (col === 0 ? -1 : 1) * (CARD_W / 2 + 15) * scale;
      const y = gridTop + (CARD_H / 2 + row * (CARD_H + 30)) * scale;
      this.cards[s.id] = this.makeCard(s.id, s.short, s.role, s.portrait, x, y, scale);
    });

    makeButton(this, W / 2, H - 250, 560, 96, t('accuse.board'), () => this.scene.start('Board', { caseId: c.id, from: 'Accuse' }), 'dark', 40);
    this.confirm = makeButton(this, W / 2, H - 118, 820, 150, t('accuse.choose'), () => {
      if (!this.selected) return;
      save.accuse(c.id, this.selected, c.clues.length);
      this.scene.start('Ending', { caseId: c.id, fresh: true });
    }, 'primary', 56);
    this.confirm.setEnabled(false);
  }

  private makeCard(id: string, name: string, role: string, portrait: string, x: number, y: number, scale: number): Phaser.GameObjects.Container {
    const cont = this.add.container(x, y).setScale(scale);
    const g = this.add.graphics();
    const w = CARD_W;
    const h = CARD_H;
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 22);
    g.fillStyle(C.nightSoft, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.fillStyle(C.paper, 1);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 14);
    cont.add(g);

    const pw = w - 48;
    const ph = 480;
    const img = this.add.image(0, -h / 2 + 24 + ph / 2, portrait);
    const s = Math.max(pw / img.width, ph / img.height);
    img.setScale(s);
    img.setCrop((img.width - pw / s) / 2, 0, pw / s, ph / s);
    img.setY(-h / 2 + 24 + (img.height * s) / 2);
    cont.add(img);
    const fr = this.add.graphics();
    fr.lineStyle(4, C.brassDark, 1);
    fr.strokeRect(-pw / 2, -h / 2 + 24, pw, ph);
    // лента с именем
    const ry = -h / 2 + 24 + ph;
    fr.fillStyle(C.brassDark, 1);
    fr.fillRoundedRect(-w / 2 + 10, ry - 36, w - 20, 84, 12);
    fr.fillStyle(C.wine, 1);
    fr.fillRoundedRect(-w / 2 + 14, ry - 32, w - 28, 76, 10);
    cont.add(fr);
    const nameText = txt(this, 0, ry + 4, name, 44, C.paperLight, { head: true });
    nameText.setScale(Math.min(1, (w - 60) / nameText.width));
    cont.add(nameText);
    const roleText = txt(this, 0, ry + 100, role, 38, C.ink, { wrap: w - 60 });
    cont.add(roleText);

    const frame = this.add.graphics();
    frame.lineStyle(12, C.gold, 1);
    frame.strokeRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 26);
    frame.setVisible(false);
    cont.add(frame);
    this.frames[id] = frame;

    cont.setSize(w, h);
    cont.setInteractive({ useHandCursor: true });
    cont.on('pointerdown', () => {
      sfx.click();
      this.pick(id, scale);
    });
    return cont;
  }

  private pick(id: string, scale: number): void {
    this.selected = id;
    for (const k in this.frames) {
      this.frames[k].setVisible(k === id);
      this.cards[k].setAlpha(k === id ? 1 : 0.72);
      this.cards[k].setDepth(k === id ? 5 : 1);
      this.tweens.add({ targets: this.cards[k], scale: k === id ? scale * 1.04 : scale * 0.97, duration: 140 });
    }
    this.confirm.setEnabled(true).setLabel(t('accuse.confirm'));
  }
}
