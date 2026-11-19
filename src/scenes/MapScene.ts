// Карта городка: выбор дела. Картинка карты чистая, метки и подписи рисует код.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { CaseData, caseByNumber, caseState, caseUnlocked, world } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { makeMapHalo } from '../ui/mapHalo';
import { Button, drawPanel, drawStar, fadeIn, makeButton, roundButton, txt } from '../ui/widgets';

type MapMarker = {
  medal: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  texture: string;
};

export class MapScene extends Phaser.Scene {
  private selected = 1;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoName!: Phaser.GameObjects.Text;
  private infoStatus!: Phaser.GameObjects.Text;
  private mainButton!: Button;
  private boardButton!: Button;
  private markers: MapMarker[] = [];

  constructor() {
    super('Map');
  }

  create(): void {
    fadeIn(this);
    this.markers = [];
    this.add.rectangle(W / 2, H / 2, W, H, C.paper);
    const map = this.add.image(0, 0, 'map').setOrigin(0, 0);
    map.setDisplaySize(W, world.mapHeight);

    // заголовок прямо на бумаге карты
    txt(this, W / 2, 66, t('map.town'), 80, C.wine, { head: true });
    txt(this, W / 2, 136, t('map.date'), 36, C.inkSoft, { italic: true });
    roundButton(this, 82, 82, 50, 'home', () => this.scene.start('Menu'));

    // подписи мест
    for (const p of world.places) {
      const label = txt(this, p.x, p.y, t(p.label), 30, C.paperLight, { head: true });
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
      return c && caseUnlocked(s.number) && caseState(c) !== 'closed';
    });
    this.select(firstOpen?.number ?? 1);
  }

  /** Метка дела: медальон и табличка «Дело N · Улики · звёзды». (x, y) — центр медальона. */
  private addMarker(n: number, x: number, y: number): void {
    const unlocked = caseUnlocked(n);
    const c = unlocked ? caseByNumber(n) : null;
    const state = c ? caseState(c) : null;
    const R = 66;
    const halo = makeMapHalo(this, x, y);
    const g = this.add.graphics();
    const ribbonY = y - R - 30;
    const half = c ? 88 : 73;
    const pts = [
      new Phaser.Math.Vector2(x - half, ribbonY - 23),
      new Phaser.Math.Vector2(x + half, ribbonY - 23),
      new Phaser.Math.Vector2(x + half - 12, ribbonY),
      new Phaser.Math.Vector2(x + half, ribbonY + 23),
      new Phaser.Math.Vector2(x - half, ribbonY + 23),
      new Phaser.Math.Vector2(x - half + 12, ribbonY),
    ];
    g.fillStyle(0x221b14, 0.35);
    g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x + 1, p.y + 4)), true);
    g.fillStyle(c ? C.wineDark : 0x454b4d, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2, c ? C.brass : 0x868d8e, 0.9);
    g.strokePoints(pts, true);
    txt(this, x, ribbonY - 1, t('map.caseShort', { n }), 28, C.paperLight, { head: true });

    const pw = c ? 249 : 144;
    const ph = c ? 80 : 43;
    const top = y + R + 8;
    g.fillStyle(0x211a16, 0.50);
    g.fillRoundedRect(x - pw / 2 + 2, top + 4, pw, ph, 11);
    g.fillStyle(c ? 0x422b21 : 0x454b4d, 0.97);
    g.fillRoundedRect(x - pw / 2, top, pw, ph, 10);
    g.lineStyle(2, c ? C.brass : 0x929798, 0.82);
    g.strokeRoundedRect(x - pw / 2 + 3, top + 3, pw - 6, ph - 6, 8);

    const texture = !c ? 'map_medal_locked' : state === 'closed' ? 'map_medal_closed' : 'map_medal_available';
    g.fillStyle(0x20170f, 0.4);
    g.fillEllipse(x + 3, y + 50, 125, 38);
    const medal = this.add.image(x, y, texture).setDisplaySize(2 * R, 2 * R);
    this.markers[n] = { medal, halo, texture };

    if (c) {
      const total = c.clues.length;
      txt(this, x, top + 23, t('map.cluesShort', { found: save.found(c.id, total), total }), 28, C.paperLight);
      const st = txt(this, x + 13, top + 55, t('map.starsShort', { n: save.totalStars(c.id, total), total: total * 3 }), 26, C.brassLight, { bold: true });
      drawStar(g, x - st.width / 2 - 7, top + 54, 12);
    } else {
      txt(this, x, top + 21, t(unlocked ? 'map.soon' : 'map.locked'), 24, C.paper, { italic: true });
    }

    const hitTop = ribbonY - 24;
    const hitBottom = top + ph;
    const zone = this.add.zone(x, (hitTop + hitBottom) / 2, pw + 18, hitBottom - hitTop).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      sfx.click();
      this.select(n);
    });
  }

  private select(n: number): void {
    this.selected = n;
    this.markers.forEach(({ medal, halo, texture }, i) => {
      const selected = i === n;
      const locked = texture === 'map_medal_locked';
      if (selected) {
        halo.setDisplaySize(locked ? 195 : 228, locked ? 195 : 228);
      }
      halo.setVisible(selected);
      medal.setTexture(selected && texture === 'map_medal_available' ? 'map_medal_selected' : texture);
      medal.setDisplaySize(selected && !locked ? 140 : 132, selected && !locked ? 140 : 132);
    });
    const c = caseByNumber(n);
    const unlocked = caseUnlocked(n);
    this.infoTitle.setText(t('map.case', { n }));
    if (!c || !unlocked) {
      this.infoName.setText(t(unlocked ? 'map.soon' : 'map.locked')).setScale(1);
      this.infoStatus.setText(t(unlocked ? 'map.soonText' : 'map.lockedText'));
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
    return caseUnlocked(this.selected) ? caseByNumber(this.selected) : null;
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
