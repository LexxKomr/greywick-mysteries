// Карта городка: выбор дела.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { CaseData, caseByNumber, caseState, world } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { Button, drawHome, drawPanel, fadeIn, makeButton, roundButton, txt } from '../ui/widgets';

const MAP_Y = 170;

export class MapScene extends Phaser.Scene {
  private selected = 1;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoName!: Phaser.GameObjects.Text;
  private infoStatus!: Phaser.GameObjects.Text;
  private mainButton!: Button;
  private boardButton!: Button;
  private rings: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('Map');
  }

  create(): void {
    fadeIn(this);
    this.rings = [];
    this.add.rectangle(W / 2, H / 2, W, H, C.paper);
    const map = this.add.image(W / 2, MAP_Y, 'map').setOrigin(0.5, 0);
    map.setDisplaySize(W, world.mapHeight);

    // шапка
    const head = this.add.graphics();
    head.fillStyle(0x000000, 0.3);
    head.fillRect(0, 0, W, MAP_Y + 8);
    head.fillStyle(C.paper, 1);
    head.fillRect(0, 0, W, MAP_Y);
    head.fillStyle(C.brass, 1);
    head.fillRect(0, MAP_Y - 5, W, 5);
    txt(this, W / 2, 62, world.town, 76, C.wine, { head: true });
    txt(this, W / 2, 128, world.date, 36, C.inkSoft, { italic: true });
    roundButton(this, 82, 82, 50, drawHome, () => this.scene.start('Menu'));

    // таблички мест
    for (const p of world.places) {
      const label = txt(this, p.x, MAP_Y + p.y, p.name, 32, C.paperLight, { head: true });
      const w = label.width + 44;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(p.x - w / 2 + 2, MAP_Y + p.y - 28 + 5, w, 58, 12);
      g.fillStyle(C.brassDark, 1);
      g.fillRoundedRect(p.x - w / 2, MAP_Y + p.y - 30, w, 60, 12);
      g.fillStyle(C.wood, 1);
      g.fillRoundedRect(p.x - w / 2 + 3, MAP_Y + p.y - 27, w - 6, 54, 10);
      label.setDepth(2);
    }

    // метки дел
    for (const slot of world.slots) this.addMarker(slot.number, slot.x, MAP_Y + slot.y);

    // нижняя панель выбранного дела
    const py = MAP_Y + world.mapHeight - 30;
    const ph = H - py + 40;
    const g = this.add.graphics();
    drawPanel(g, -20, py, W + 40, ph, 40);
    this.infoTitle = txt(this, 70, py + 70, '', 40, C.inkSoft, { ox: 0, bold: true });
    this.infoName = txt(this, 70, py + 138, '', 64, C.wine, { head: true, ox: 0 });
    this.infoStatus = txt(this, 70, py + 212, '', 40, C.ink, { ox: 0 });
    const by = Math.min(H - 110, py + 350);
    this.mainButton = makeButton(this, W / 2 - 235, by, 560, 140, '', () => this.onMain(), 'primary', 54);
    this.boardButton = makeButton(this, W / 2 + 300, by, 420, 140, t('map.board'), () => this.onBoard(), 'paper', 48);

    // по умолчанию выбрано первое незакрытое дело
    const firstOpen = world.slots.find((s) => {
      const c = caseByNumber(s.number);
      return c && caseState(c) !== 'closed';
    });
    this.select(firstOpen?.number ?? 1);
  }

  private addMarker(n: number, x: number, y: number): void {
    const c = caseByNumber(n);
    const state = c ? caseState(c) : null;
    const g = this.add.graphics();
    const ring = this.add.graphics();
    ring.lineStyle(10, C.gold, 1);
    ring.strokeCircle(x, y, 86);
    ring.setVisible(false);
    this.rings[n] = ring;
    this.tweens.add({ targets: ring, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    g.fillStyle(0x000000, 0.4);
    g.fillCircle(x + 2, y + 8, 72);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(x, y, 72);
    g.fillStyle(c ? C.brassLight : 0x8d949a, 1);
    g.fillCircle(x, y, 67);
    g.fillStyle(c ? (state === 'closed' ? C.wine : C.gold) : 0x5d666d, 1);
    g.fillCircle(x, y, 56);
    if (c) {
      // лупа
      g.lineStyle(9, state === 'closed' ? C.paperLight : C.wineDark, 1);
      g.strokeCircle(x - 6, y - 8, 22);
      g.lineBetween(x + 10, y + 9, x + 28, y + 28);
    } else {
      // замок
      g.lineStyle(8, 0xd4d9dc, 1);
      g.beginPath();
      g.arc(x, y - 10, 15, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(0xd4d9dc, 1);
      g.fillRoundedRect(x - 23, y - 8, 46, 36, 6);
    }
    // ленточка с номером
    const label = txt(this, x, y + 84, c ? t('map.caseShort', { n }) : t('map.soon'), 32, C.paperLight, { head: true }).setDepth(3);
    const w = label.width + 40;
    const rb = this.add.graphics().setDepth(2);
    rb.fillStyle(C.brassDark, 1);
    rb.fillRoundedRect(x - w / 2 - 2, y + 84 - 28, w + 4, 56, 10);
    rb.fillStyle(c ? C.wine : 0x4b545b, 1);
    rb.fillRoundedRect(x - w / 2, y + 84 - 26, w, 52, 9);

    const zone = this.add.zone(x, y + 16, 200, 220).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      sfx.click();
      this.select(n);
    });
  }

  private select(n: number): void {
    this.selected = n;
    this.rings.forEach((r, i) => r?.setVisible(i === n));
    const c = caseByNumber(n);
    this.infoTitle.setText(t('map.case', { n }));
    if (!c) {
      this.infoName.setText(t('map.soon'));
      this.infoStatus.setText(t('map.soonText'));
      this.mainButton.setVisible(false);
      this.boardButton.setVisible(false);
      return;
    }
    const total = c.clues.length;
    const found = save.found(c.id, total);
    const state = caseState(c);
    this.infoName.setText(c.title);
    this.infoName.setScale(Math.min(1, (W - 140) / (this.infoName.width / this.infoName.scaleX)));
    let status = t('map.clues', { found, total });
    if (state === 'new') status = t('map.notStarted');
    if (state === 'closed') status = save.progress(c.id, total).accused === c.culprit ? t('map.closedGold') : t('map.closed');
    this.infoStatus.setText(status);
    const labels = { new: 'map.start', playing: 'map.continue', accuse: 'map.accuse', closed: 'map.ending' } as const;
    this.mainButton.setVisible(true).setLabel(t(labels[state]));
    this.boardButton.setVisible(found > 0);
    this.mainButton.setX(found > 0 ? W / 2 - 235 : W / 2);
  }

  private current(): CaseData | null {
    return caseByNumber(this.selected);
  }

  private onMain(): void {
    const c = this.current();
    if (c) continueCase(this, c);
  }

  private onBoard(): void {
    const c = this.current();
    if (c) this.scene.start('Board', { caseId: c.id, from: 'Map' });
  }
}
