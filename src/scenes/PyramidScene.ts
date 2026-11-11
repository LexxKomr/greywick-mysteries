// Игровой стол «Пирамида» (кухня Эдит).

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { PYRAMID_SIZE, PYRAMID_TARGETS, PyramidDeal, PyramidGame, Spot, generateRatedPyramid, pyramidStars, rowOfPyramid, solvePyramidFrom } from '../logic/pyramid';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_TEX_SCALE, CARD_W, cardInteractive, cardKey, tableAngle } from '../ui/cards';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, icons, levelCtx, lostDialog, persp, watchDead, winLevel } from '../ui/table';
import { fadeIn, toast, txt } from '../ui/widgets';
import { CardDrag } from '../ui/drag';

const PS = 1.1; // карты пирамиды крупнее обычных
const STEP = 132;
const DY = 76; // стол в перспективе — ряды ближе
const BIG = 1.35;
const FREE_HINTS = 3;

export class PyramidScene extends Phaser.Scene {
  private ctx!: LevelCtx;
  private ui!: TableUi;
  private deal!: PyramidDeal;
  private py!: PyramidGame;
  private sprites: Phaser.GameObjects.Image[] = [];
  private home: { x: number; y: number }[] = [];
  /** масштаб каждой карты пирамиды: дальние ряды чуть мельче */
  private hs: number[] = [];
  private wasteSprite!: Phaser.GameObjects.Image;
  private stockBacks: Phaser.GameObjects.Image[] = [];
  private stockEmpty!: Phaser.GameObjects.Graphics;
  private stockCount!: Phaser.GameObjects.Text;
  private passText!: Phaser.GameObjects.Text;
  private undo!: Helper;
  private hint!: Helper;
  private stockPos = { x: 0, y: 0 };
  private wastePos = { x: 0, y: 0 };
  private selected: Spot | null = null;
  private drag!: CardDrag<Spot>;
  private hintsLeft = FREE_HINTS;
  private finished = false;
  /** «проверь тупик» после хода: окно «Ходов больше нет» появляется само */
  private checkDead: (delay?: number) => void = () => {};
  private adBusy = false;

  constructor() {
    super('Pyramid');
  }

  init(data: LevelData): void {
    this.ctx = levelCtx('Pyramid', data);
    this.sprites = [];
    this.home = [];
    this.hs = [];
    this.stockBacks = [];
    this.selected = null;
    this.hintsLeft = FREE_HINTS;
    this.finished = false;
    this.adBusy = false;
  }

  create(): void {
    fadeIn(this);
    const ctx = this.ctx;
    const number = ctx.caseData?.number ?? 0;
    const difficulty = ctx.caseData?.levels?.[ctx.level - 1]?.difficulty ?? 2;
    this.deal = generateRatedPyramid(number * 1000 + ctx.level, PYRAMID_TARGETS[Math.max(0, Math.min(2, difficulty - 1))]);
    this.py = new PyramidGame(this.deal);
    (window as unknown as { __py: unknown }).__py = { game: this.py, deal: this.deal, scene: this };

    // раскладка снизу вверх: помощники, колода, пирамида — всё на столе
    const helpersY = H - 178;
    const deckY = Math.round(helpersY - 100 - (CARD_H * BIG) / 2);
    const bottom = deckY - (CARD_H * BIG) / 2 - 40;
    const top = Math.round(bottom - (6 * DY + CARD_H * PS));
    this.stockPos = { x: W / 2 - 130, y: deckY };
    this.wastePos = { x: W / 2 + 130, y: deckY };
    this.ui = buildTable(this, 'table_kitchen', ctx, () => !this.finished && exitDialog(this, ctx), top);
    this.checkDead = watchDead(this, { stop: () => this.finished, wait: () => this.adBusy, dead: () => this.isDead(), onDead: () => this.onLost() });


    // карту можно перетащить на пару (сумма 13) или нажать по очереди на обе
    this.drag = new CardDrag<Spot>(this, {
      enabled: () => !this.finished && !this.adBusy,
      pick: (spot) => {
        if (!this.py.cardAt(spot)) return null;
        this.select(null);
        return [this.spriteOf(spot)];
      },
      drop: (spot, x, y) => this.dropOn(spot, x, y),
      tap: (spot) => this.tapSpot(spot),
    });
    this.buildDeck();
    for (let i = 0; i < PYRAMID_SIZE; i++) {
      const r = rowOfPyramid(i);
      const c = i - (r * (r + 1)) / 2;
      const k = persp.s(top + r * DY + (CARD_H * PS) / 2);
      const x = W / 2 + (c - r / 2) * STEP * k;
      const y = top + r * DY + (CARD_H * PS) / 2;
      this.home.push({ x, y });
      this.hs.push(k);
      const s = this.add.image(W / 2, top - 200, cardKey(this.deal.pyramid[i])).setScale(CARD_TEX_SCALE * PS * k).setDepth(10 + i).setAlpha(0).setAngle(tableAngle(i * 5 + ctx.level));
      cardInteractive(s);
      this.drag.add(s, i);
      this.sprites.push(s);
      this.tweens.add({ targets: s, x, y, alpha: 1, duration: 280, delay: 40 + i * 24, ease: 'Cubic.easeOut' });
    }

    this.undo = helperButton(this, W / 2 - 290, helpersY, t('game.undo'), '3', icons.undo, () => this.tapUndo());
    this.hint = helperButton(this, W / 2, helpersY, t('game.hint'), String(FREE_HINTS), icons.hint, () => void this.tapHint());
    helperButton(this, W / 2 + 290, helpersY, t('game.plusPass'), t('game.ad'), icons.plusCards, () => void this.tapPlusPass());
    this.refreshHud();
    this.ui.thoughts(STRIP_H + 96, () => !this.finished && !this.adBusy);
  }

  private buildDeck(): void {
    const { x, y } = this.stockPos;
    const cw = CARD_W * BIG;
    const ch = CARD_H * BIG;
    this.stockEmpty = this.add.graphics();
    this.stockEmpty.lineStyle(5, C.brassLight, 0.5);
    this.stockEmpty.strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 18);
    // круговая стрелка: колоду можно пройти ещё раз
    this.stockEmpty.lineStyle(9, C.brassLight, 0.7);
    this.stockEmpty.beginPath();
    this.stockEmpty.arc(x, y, 34, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(110), false);
    this.stockEmpty.strokePath();
    this.stockEmpty.fillStyle(C.brassLight, 0.7);
    this.stockEmpty.fillTriangle(x - 50, y - 22, x - 16, y - 32, x - 38, y + 8);
    for (let i = 0; i < 3; i++) {
      this.stockBacks.push(this.add.image(x - 14 + i * 7, y - 6 + i * 3, 'card_back').setScale(CARD_TEX_SCALE * BIG).setAngle(tableAngle(90 + i)));
    }
    const zone = this.add.zone(x, y, cw + 40, ch + 40).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tapStock());

    const bx = x - cw / 2 - 78;
    const badge = this.add.graphics();
    badge.fillStyle(C.night, 0.85);
    badge.fillRoundedRect(bx - 52, y - 34, 104, 68, 34);
    badge.lineStyle(3, C.brass, 1);
    badge.strokeRoundedRect(bx - 52, y - 34, 104, 68, 34);
    this.stockCount = txt(this, bx, y - 3, '', 46, C.paperLight, { head: true });

    const w = this.add.graphics();
    w.lineStyle(5, C.brassLight, 0.3);
    w.strokeRoundedRect(this.wastePos.x - cw / 2, y - ch / 2, cw, ch, 18);
    this.wasteSprite = this.add.image(this.wastePos.x, this.wastePos.y, 'card_back').setScale(CARD_TEX_SCALE * BIG).setDepth(100).setVisible(false);
    cardInteractive(this.wasteSprite);
    this.drag.add(this.wasteSprite, 'waste');

    this.passText = txt(this, this.wastePos.x + cw / 2 + 24, y, '', 36, C.paperLight, { head: true, ox: 0, align: 'left' });
    this.passText.setShadow(0, 3, '#000000', 8, false, true);
  }

  private spriteOf(spot: Spot): Phaser.GameObjects.Image {
    return spot === 'waste' ? this.wasteSprite : this.sprites[spot];
  }

  // ---------- ходы ----------

  private tapSpot(spot: Spot): void {
    if (this.finished || this.adBusy) return;
    const card = this.py.cardAt(spot);
    if (!card) {
      if (spot !== 'waste' && this.py.pyramid[spot]) {
        sfx.no();
        const s = this.sprites[spot];
        this.tweens.add({ targets: s, x: this.home[spot].x + 7, duration: 45, yoyo: true, repeat: 2, onComplete: () => s.setX(this.home[spot].x) });
      }
      return;
    }
    if (card.rank === 13) {
      this.removeSpots([spot]);
    } else if (this.selected === null) {
      this.select(spot);
    } else if (this.selected === spot) {
      this.select(null);
    } else if (this.py.canRemove([this.selected, spot])) {
      this.removeSpots([this.selected, spot]);
    } else {
      sfx.click();
      this.select(spot);
    }
  }

  /** Карту отпустили: король уходит сам, остальным нужна пара с суммой 13 под ними. */
  private dropOn(spot: Spot, x: number, y: number): boolean {
    const card = this.py.cardAt(spot);
    if (!card) return false;
    if (card.rank === 13) {
      const home = spot === 'waste' ? this.wastePos : this.home[spot];
      if (Math.hypot(x - home.x, y - home.y) < 50) return false;
      this.removeSpots([spot]);
      return true;
    }
    let target: Spot | null = null;
    let depth = -Infinity;
    for (const sp of this.py.spots()) {
      if (sp === spot) continue;
      const s = this.spriteOf(sp);
      if (s.depth > depth && Math.abs(x - s.x) < s.displayWidth * 0.42 && Math.abs(y - s.y) < s.displayHeight * 0.42) {
        target = sp;
        depth = s.depth;
      }
    }
    if (target === null || !this.py.canRemove([spot, target])) return false;
    this.removeSpots([spot, target]);
    return true;
  }

  private select(spot: Spot | null): void {
    if (this.selected !== null) {
      const old = this.spriteOf(this.selected);
      old.clearTint();
      if (this.selected === 'waste') old.setY(this.wastePos.y);
      else old.setY(this.home[this.selected].y);
    }
    this.selected = spot;
    if (spot !== null) {
      const s = this.spriteOf(spot);
      s.setTint(0xffe2a0);
      s.setY(s.y - 18);
      sfx.click();
    }
  }

  private removeSpots(spots: Spot[]): void {
    this.select(null);
    // улетающие копии карт
    for (const sp of spots) {
      const src = this.spriteOf(sp);
      const ghost = this.add.image(src.x, src.y, src.texture.key).setScale(src.scaleX).setDepth(300);
      this.tweens.add({ targets: ghost, y: src.y - 90, alpha: 0, scale: src.scaleX * 1.15, duration: 280, ease: 'Cubic.easeOut', onComplete: () => ghost.destroy() });
    }
    this.py.remove(spots);
    sfx.card(spots.length);
    this.sync();
    this.afterMove();
  }

  private tapStock(): void {
    if (this.finished || this.adBusy) return;
    this.select(null);
    const r = this.py.draw();
    if (r === null) {
      sfx.no();
      return;
    }
    sfx.draw();
    if (r === 'pass') toast(this, t('game.newPass'));
    this.sync();
    if (r === 'card') {
      this.wasteSprite.setPosition(this.stockPos.x, this.stockPos.y);
      this.tweens.add({ targets: this.wasteSprite, x: this.wastePos.x, y: this.wastePos.y, duration: 170, ease: 'Cubic.easeOut' });
    }
    this.afterMove();
  }

  private afterMove(): void {
    const status = this.py.status;
    if (status === 'won') {
      if (this.finished) return;
      this.finished = true;
      winLevel(this, this.ctx, pyramidStars(this.py.pass));
    } else this.checkDead();
  }

  /** Выиграть уже нельзя: ходов и проходов нет, или решатель доказал тупик. */
  private isDead(): boolean {
    return this.py.status === 'lost' || solvePyramidFrom(this.py, 40_000).result === false;
  }


  /** Приводит стол в соответствие с состоянием игры. */
  private sync(): void {
    for (let i = 0; i < PYRAMID_SIZE; i++) {
      const s = this.sprites[i];
      this.tweens.killTweensOf(s);
      const card = this.py.pyramid[i];
      s.setVisible(!!card).setAlpha(1).clearTint();
      s.setPosition(this.home[i].x, this.home[i].y).setScale(CARD_TEX_SCALE * PS * this.hs[i]);
    }
    this.tweens.killTweensOf(this.wasteSprite);
    const top = this.py.cardAt('waste');
    this.wasteSprite.setVisible(!!top).clearTint().setPosition(this.wastePos.x, this.wastePos.y).setScale(CARD_TEX_SCALE * BIG);
    if (top) this.wasteSprite.setTexture(cardKey(top)).setAngle(tableAngle(top.rank * 4 + top.suit + this.py.waste.length));
    this.selected = null;
    this.refreshHud();
  }

  private refreshHud(): void {
    const n = this.py.stock.length;
    this.stockCount.setText(String(n));
    this.stockBacks[2].setVisible(n > 0);
    this.stockBacks[1].setVisible(n > 1);
    this.stockBacks[0].setVisible(n > 2);
    this.stockEmpty.setVisible(n === 0);
    this.stockEmpty.setAlpha(this.py.canDraw ? 1 : 0.35);
    this.passText.setText(t('game.pass', { n: this.py.pass, total: this.py.maxPasses }).replace(' ', '\n'));
    this.undo.setBadge(String(this.py.undosLeft));
    this.undo.button.setAlpha(this.py.canUndo ? 1 : 0.55);
    this.hint.setBadge(this.hintsLeft > 0 ? String(this.hintsLeft) : t('game.ad'));
    this.ui.setStars(pyramidStars(this.py.pass));
  }

  // ---------- помощники ----------

  private tapUndo(): void {
    if (this.finished || this.adBusy) return;
    if (!this.py.undo()) {
      sfx.no();
      return;
    }
    sfx.draw();
    this.sync();
  }

  private async tapHint(): Promise<void> {
    if (this.finished || this.adBusy) return;
    // сначала решатель: если выиграть уже нельзя, подсказку не тратим, а сразу говорим об этом
    const plan = solvePyramidFrom(this.py, 150_000);
    if (plan.result === false || this.py.status === 'lost') {
      this.select(null);
      this.onLost();
      return;
    }
    if (this.hintsLeft > 0) {
      this.hintsLeft--;
    } else {
      this.adBusy = true;
      const ok = await ads.showRewarded();
      this.adBusy = false;
      if (!ok || this.finished) return;
    }
    this.select(null);
    this.refreshHud();
    sfx.clue();
    // ход из найденного решения; если решатель не успел — любой пара/король, иначе колода
    const first = plan.first ?? this.py.findRemoval() ?? 'draw';
    if (first !== 'draw') {
      for (const s of first.map((sp) => this.spriteOf(sp))) {
        s.setTint(0xffd36b);
        const base = s.scaleX;
        this.tweens.add({ targets: s, scale: base * 1.12, duration: 220, yoyo: true, repeat: 2, onComplete: () => s.clearTint().setScale(base) });
      }
      return;
    }
    if (this.py.stock.length > 0) {
      const backs = this.stockBacks.filter((b) => b.visible);
      for (const b of backs) {
        b.setTint(0xffd36b);
        const base = b.scaleX;
        this.tweens.add({ targets: b, scale: base * 1.12, duration: 220, yoyo: true, repeat: 2, onComplete: () => b.clearTint().setScale(base) });
      }
    } else {
      // колода пуста: подсказка — начать новый проход
      toast(this, t('pyramid.hintRecycle'));
      this.tweens.add({ targets: this.stockEmpty, alpha: 0.3, duration: 220, yoyo: true, repeat: 2, onComplete: () => this.stockEmpty.setAlpha(1) });
    }
  }

  private async tapPlusPass(): Promise<void> {
    if (this.finished || this.adBusy) return;
    this.adBusy = true;
    const ok = await ads.showRewarded();
    this.adBusy = false;
    if (!ok || this.finished) return;
    this.py.addPass();
    sfx.clue();
    this.sync();
    this.checkDead();
  }

  private onLost(): void {
    const text = this.py.status === 'lost' ? t('pyramid.lostText') : t('game.deadText');
    lostDialog(this, this.ctx, text, {
      extra: {
        label: t('game.lostPass'),
        style: 'primary',
        onClick: async () => {
          this.adBusy = true;
          const ok = await ads.showRewarded();
          this.adBusy = false;
          if (ok) {
            this.py.addPass();
            this.sync();
            this.checkDead();
          } else this.onLost();
        },
      },
      undo: this.py.canUndo ? () => this.undoToLive() : undefined,
    });
  }

  /** «Отменить ходы»: откатываемся, пока снова можно выиграть (или пока есть отмены). */
  private undoToLive(): void {
    while (this.py.canUndo) {
      this.py.undo();
      if (!this.isDead()) break;
    }
    sfx.draw();
    this.sync();
    this.checkDead();
  }
}
