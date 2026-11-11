// Карта городка: выбор дела. Картинка карты чистая, метки и подписи рисует код.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { CaseData, caseByNumber, caseState, world } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { Button, drawHome, drawPanel, drawStar, fadeIn, makeButton, roundButton, txt } from '../ui/widgets';

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
    const map = this.add.image(0, 0, 'map').setOrigin(0, 0);
    map.setDisplaySize(W, world.mapHeight);

    // заголовок прямо на бумаге карты
    txt(this, W / 2, 66, world.town, 80, C.wine, { head: true });
    txt(this, W / 2, 136, world.date, 36, C.inkSoft, { italic: true });
    roundButton(this, 82, 82, 50, drawHome, () => this.scene.start('Menu'));

    // подписи мест
    for (const p of world.places) {
      const label = txt(this, p.x, p.y, p.name, 30, C.paperLight, { head: true });
      const w = label.width + 40;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(p.x - w / 2 + 2, p.y - 24 + 5, w, 52, 11);
      g.fillStyle(C.brassDark, 1);
      g.fillRoundedRect(p.x - w / 2, p.y - 27, w, 54, 11);
      g.fillStyle(C.wood, 1);
      g.fillRoundedRect(p.x - w / 2 + 3, p.y - 24, w - 6, 48, 9);
      label.setDepth(2);
    }

    // метки дел
    for (const slot of world.slots) this.addMarker(slot.number, slot.x, slot.y);

    // нижняя панель выбранного дела
    const py = Math.max(1560, H - 470);
    const g = this.add.graphics().setDepth(5);
    drawPanel(g, -20, py, W + 40, H - py + 40, 40);
    this.infoTitle = txt(this, 60, py + 56, '', 36, C.inkSoft, { ox: 0, bold: true }).setDepth(6);
    this.infoName = txt(this, 60, py + 116, '', 58, C.wine, { head: true, ox: 0 }).setDepth(6);
    this.infoStatus = txt(this, 60, py + 178, '', 36, C.ink, { ox: 0 }).setDepth(6);
    const by = H - 92;
    this.mainButton = makeButton(this, W / 2 - 235, by, 560, 124, '', () => this.onMain(), 'primary', 52);
    this.boardButton = makeButton(this, W / 2 + 300, by, 420, 124, t('map.board'), () => this.onBoard(), 'paper', 46);
    this.mainButton.setDepth(6);
    this.boardButton.setDepth(6);

    const firstOpen = world.slots.find((s) => {
      const c = caseByNumber(s.number);
      return c && caseState(c) !== 'closed';
    });
    this.select(firstOpen?.number ?? 1);
  }

  /** Метка дела: медальон и табличка «Дело N · Улики · звёзды». (x, y) — центр медальона. */
  private addMarker(n: number, x: number, y: number): void {
    const c = caseByNumber(n);
    const state = c ? caseState(c) : null;
    const R = 58;
    const ring = this.add.graphics();
    ring.lineStyle(10, C.gold, 1);
    ring.strokeCircle(x, y, R + 14);
    ring.setVisible(false);
    this.rings[n] = ring;
    this.tweens.add({ targets: ring, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    const g = this.add.graphics();
    // табличка под медальоном
    const pw = c ? 284 : 190;
    const ph = c ? 152 : 100;
    const top = y + R - 14;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - pw / 2 + 3, top + 7, pw, ph, 16);
    g.fillStyle(C.brassDark, 1);
    g.fillRoundedRect(x - pw / 2, top, pw, ph, 16);
    g.fillStyle(c ? C.paperLight : 0xcfd3d2, 1);
    g.fillRoundedRect(x - pw / 2 + 4, top + 4, pw - 8, ph - 8, 13);
    // медальон
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(x + 2, y + 7, R);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(x, y, R);
    g.fillStyle(c ? C.brassLight : 0x8d949a, 1);
    g.fillCircle(x, y, R - 5);
    g.fillStyle(c ? (state === 'closed' ? C.wine : C.gold) : 0x5d666d, 1);
    g.fillCircle(x, y, R - 14);
    if (c) {
      g.lineStyle(8, state === 'closed' ? C.paperLight : C.wineDark, 1);
      g.strokeCircle(x - 5, y - 6, 18);
      g.lineBetween(x + 8, y + 8, x + 23, y + 23);
    } else {
      g.lineStyle(7, 0xd4d9dc, 1);
      g.beginPath();
      g.arc(x, y - 8, 12, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(0xd4d9dc, 1);
      g.fillRoundedRect(x - 19, y - 7, 38, 30, 5);
    }

    if (c) {
      const total = c.clues.length;
      txt(this, x, top + 54, t('map.caseShort', { n }), 34, C.wine, { head: true });
      txt(this, x, top + 90, t('map.cluesShort', { found: save.found(c.id, total), total }), 30, C.ink);
      const st = txt(this, x + 18, top + 124, t('map.starsShort', { n: save.totalStars(c.id, total), total: total * 3 }), 30, C.ink, { bold: true });
      drawStar(g, x - st.width / 2 - 6, top + 122, 15);
    } else {
      txt(this, x, top + 48, t('map.caseShort', { n }), 30, 0x4b545b, { head: true });
      txt(this, x, top + 78, t('map.soon'), 26, 0x4b545b, { italic: true });
    }

    const zone = this.add.zone(x, y + ph / 2, pw + 20, R * 2 + ph + 10).setInteractive({ useHandCursor: true });
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
      this.infoName.setText(t('map.soon')).setScale(1);
      this.infoStatus.setText(t('map.soonText'));
      this.mainButton.setVisible(false);
      this.boardButton.setVisible(false);
      return;
    }
    const total = c.clues.length;
    const found = save.found(c.id, total);
    const state = caseState(c);
    this.infoName.setScale(1).setText(c.title);
    this.infoName.setScale(Math.min(1, (W - 120) / this.infoName.width));
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
