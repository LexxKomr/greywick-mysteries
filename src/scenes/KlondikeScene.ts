// Игровой стол «Косынка» (чайная «Морской вид»).

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { KDest, KSource, KlondikeGame, klondikeStars } from '../logic/klondike';
import { klondikeSeed } from '../logic/seeds';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_W } from '../ui/cards';
import { CardLayer, Placement, cardId, drawSlot } from '../ui/cardLayer';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, icons, levelCtx, lostDialog, winLevel } from '../ui/table';
import { fadeIn, toast } from '../ui/widgets';

const CS = 1.35; // карты крупнее: столбиков всего семь
const CW = CARD_W * CS;
const CH = CARD_H * CS;
const STEP = 150;
const X0 = (W - 6 * STEP) / 2;
const FREE_HINTS = 3;

export class KlondikeScene extends Phaser.Scene {
  private ctx!: LevelCtx;
  private ui!: TableUi;
  private kg!: KlondikeGame;
  private layer!: CardLayer;
  private hint!: Helper;
  private undoBtn!: Helper;
  private stockRing!: Phaser.GameObjects.Graphics;
  private topY = 0;
  private tabY = 0;
  private tabBottom = 0;
  private hintsLeft = FREE_HINTS;
  private finished = false;
  private busy = false;

  constructor() {
    super('Klondike');
  }

  init(data: LevelData): void {
    this.ctx = levelCtx('Klondike', data);
    this.hintsLeft = FREE_HINTS;
    this.finished = false;
    this.busy = false;
  }

  create(): void {
    fadeIn(this);
    const ctx = this.ctx;
    const difficulty = ctx.caseData?.levels?.[ctx.level - 1]?.difficulty ?? 1;
    this.kg = new KlondikeGame(klondikeSeed(ctx.caseData?.number ?? 0, ctx.level, difficulty));
    (window as unknown as { __kl: unknown }).__kl = { game: this.kg, scene: this };

    this.ui = buildTable(this, 'table_tearoom', ctx, () => !this.finished && exitDialog(this, ctx), 0.5, 0);

    this.topY = STRIP_H + 26 + CH / 2;
    this.tabY = this.topY + CH + 34;
    const helpersY = H - 178;
    this.tabBottom = helpersY - 120;

    // места под дома, сброс и колоду
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      drawSlot(g, X0 + i * STEP, this.topY, CW, CH);
      this.add.image(X0 + i * STEP, this.topY, 'suit_' + i).setAlpha(0.4);
    }
    drawSlot(g, X0 + 5 * STEP, this.topY, CW, CH, 0.25);
    drawSlot(g, X0 + 6 * STEP, this.topY, CW, CH, 0.5);
    for (let c = 0; c < 7; c++) drawSlot(g, X0 + c * STEP, this.tabY, CW, CH, 0.18);
    // круговая стрелка на пустой колоде: перевернуть сброс
    this.stockRing = this.add.graphics();
    const sx = X0 + 6 * STEP;
    this.stockRing.lineStyle(9, C.brassLight, 0.75);
    this.stockRing.beginPath();
    this.stockRing.arc(sx, this.topY, 34, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(110), false);
    this.stockRing.strokePath();
    this.stockRing.fillStyle(C.brassLight, 0.75);
    this.stockRing.fillTriangle(sx - 50, this.topY - 22, sx - 16, this.topY - 32, sx - 38, this.topY + 8);
    const zone = this.add.zone(sx, this.topY, CW + 10, CH + 10).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tapStock());

    this.layer = new CardLayer(this, CS, { x: sx, y: this.topY }, (id) => this.tapCard(id));
    this.layer.apply(this.places(), true, 14);

    this.undoBtn = helperButton(this, W / 2 - 170, helpersY, t('game.undo'), null, icons.undo, () => this.tapUndo());
    this.hint = helperButton(this, W / 2 + 170, helpersY, t('game.hint'), String(FREE_HINTS), icons.hint, () => void this.tapHint());
    this.refreshHud();
  }

  /** Где сейчас должна лежать каждая карта. */
  private places(): Map<number, Placement> {
    const m = new Map<number, Placement>();
    const kg = this.kg;
    kg.stock.forEach((c, i) => m.set(cardId(c), { x: X0 + 6 * STEP - Math.min(i, 2) * 3, y: this.topY - Math.min(i, 2) * 2, depth: i, up: false }));
    kg.waste.forEach((c, i) => m.set(cardId(c), { x: X0 + 5 * STEP, y: this.topY, depth: 100 + i, up: true }));
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= kg.found[suit]; rank++) m.set(cardId({ rank, suit }), { x: X0 + suit * STEP, y: this.topY, depth: 200 + rank, up: true });
    }
    kg.tableau.forEach((pile, col) => {
      const downs = pile.filter((c) => !c.up).length;
      const ups = pile.length - downs;
      let stepUp = 80;
      const need = downs * 30 + Math.max(0, ups - 1) * stepUp + CH;
      const room = this.tabBottom - (this.tabY - CH / 2);
      if (need > room && ups > 1) stepUp = Math.max(40, (room - CH - downs * 30) / (ups - 1));
      let y = this.tabY;
      pile.forEach((c, i) => {
        m.set(cardId(c), { x: X0 + col * STEP, y, depth: 300 + col * 30 + i, up: c.up });
        y += c.up ? stepUp : 30;
      });
    });
    return m;
  }

  private sync(): void {
    this.layer.apply(this.places());
    this.refreshHud();
  }

  private refreshHud(): void {
    this.stockRing.setVisible(this.kg.stock.length === 0 && this.kg.waste.length > 0);
    this.undoBtn.button.setAlpha(this.kg.canUndo ? 1 : 0.55);
    this.hint.setBadge(this.hintsLeft > 0 ? String(this.hintsLeft) : t('game.ad'));
    this.ui.setStars(klondikeStars(this.kg.recycles));
  }

  private locate(id: number): KSource | 'stock' | null {
    const kg = this.kg;
    if (kg.stock.some((c) => cardId(c) === id)) return 'stock';
    if (kg.waste.length && cardId(kg.waste[kg.waste.length - 1]) === id) return { type: 'waste' };
    for (let col = 0; col < 7; col++) {
      const index = kg.tableau[col].findIndex((c) => cardId(c) === id);
      if (index >= 0) return kg.tableau[col][index].up ? { type: 'tab', col, index } : null;
    }
    return null;
  }

  // ---------- ходы ----------

  private tapCard(id: number): void {
    if (this.finished || this.busy) return;
    const src = this.locate(id);
    if (src === 'stock') return this.tapStock();
    if (!src) return;
    const dests = this.kg.destinations(src);
    if (!dests.length) {
      sfx.no();
      this.layer.shake(id);
      return;
    }
    this.kg.move(src, dests[0]);
    sfx.card(dests[0].type === 'found' ? 3 : 0);
    this.sync();
    this.afterMove();
  }

  private tapStock(): void {
    if (this.finished || this.busy) return;
    const r = this.kg.draw();
    if (r === null) {
      sfx.no();
      return;
    }
    sfx.draw();
    this.sync();
    this.afterMove();
  }

  private afterMove(): void {
    const kg = this.kg;
    if (kg.won) return this.onWin();
    if (kg.canAutoFinish) {
      // все карты открыты — пасьянс сходится, дособираем сами
      this.busy = true;
      this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => {
          if (this.finished) return;
          if (!kg.won) kg.autoStep();
          this.layer.apply(this.places());
          if (kg.won) this.onWin();
        },
      });
      return;
    }
    if (kg.stuck) this.time.delayedCall(700, () => kg.stuck && !this.finished && this.onStuck());
  }

  private onWin(): void {
    if (this.finished) return;
    this.finished = true;
    this.time.removeAllEvents();
    winLevel(this, this.ctx, klondikeStars(this.kg.recycles));
  }

  private onStuck(): void {
    lostDialog(this, this.ctx, t('klondike.stuckText'), {
      label: t('game.undoMove'),
      style: 'primary',
      onClick: () => this.tapUndo(),
    });
  }

  // ---------- помощники ----------

  private tapUndo(): void {
    if (this.finished || this.busy) return;
    if (!this.kg.undo()) {
      sfx.no();
      return;
    }
    sfx.draw();
    this.sync();
  }

  private async tapHint(): Promise<void> {
    if (this.finished || this.busy) return;
    if (this.hintsLeft > 0) {
      this.hintsLeft--;
    } else {
      this.busy = true;
      const ok = await ads.showRewarded();
      this.busy = false;
      if (!ok || this.finished) return;
    }
    this.refreshHud();
    sfx.clue();
    const moves = this.kg.usefulMoves().sort((a, b) => b.weight - a.weight);
    if (!moves.length) {
      // полезных ходов на столе нет — подсказываем колоду
      const top = this.kg.stock[this.kg.stock.length - 1];
      if (top) this.layer.pulse([cardId(top)]);
      else toast(this, t('klondike.hintRecycle'));
      return;
    }
    const m = moves[0];
    const ids = this.kg.cardsAt(m.from).map(cardId);
    const to: KDest = m.to;
    if (to.type === 'tab') {
      const pile = this.kg.tableau[to.col];
      if (pile.length) ids.push(cardId(pile[pile.length - 1]));
    }
    this.layer.pulse(ids);
  }
}
