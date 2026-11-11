// Игровой стол «Свободная ячейка» (стол смотрителя на маяке).

import Phaser from 'phaser';
import { H, W } from '../config';
import { FSource, FreeCellGame, freecellStars } from '../logic/freecell';
import { freecellSeed } from '../logic/seeds';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_W } from '../ui/cards';
import { CardLayer, Placement, cardId, drawSlot } from '../ui/cardLayer';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, icons, levelCtx, lostDialog, winLevel } from '../ui/table';
import { fadeIn } from '../ui/widgets';

const CS = 1.2;
const CW = CARD_W * CS;
const CH = CARD_H * CS;
const STEP = 132;
const X0 = (W - 7 * STEP) / 2;
const FAN = 72;
const FREE_HINTS = 3;

export class FreeCellScene extends Phaser.Scene {
  private ctx!: LevelCtx;
  private ui!: TableUi;
  private fc!: FreeCellGame;
  private layer!: CardLayer;
  private hint!: Helper;
  private undoBtn!: Helper;
  private topY = 0;
  private tabY = 0;
  private tabBottom = 0;
  private hintsLeft = FREE_HINTS;
  private finished = false;
  private busy = false;

  constructor() {
    super('FreeCell');
  }

  init(data: LevelData): void {
    this.ctx = levelCtx('FreeCell', data);
    this.hintsLeft = FREE_HINTS;
    this.finished = false;
    this.busy = false;
  }

  create(): void {
    fadeIn(this);
    const ctx = this.ctx;
    const difficulty = ctx.caseData?.levels?.[ctx.level - 1]?.difficulty ?? 1;
    this.fc = new FreeCellGame(freecellSeed(ctx.caseData?.number ?? 0, ctx.level, difficulty));
    (window as unknown as { __fc: unknown }).__fc = { game: this.fc, scene: this };

    this.ui = buildTable(this, 'table_lighthouse', ctx, () => !this.finished && exitDialog(this, ctx), 0.5, 0);

    this.topY = STRIP_H + 26 + CH / 2;
    this.tabY = this.topY + CH + 34;
    const helpersY = H - 178;
    this.tabBottom = helpersY - 250; // над кнопками оставлено место для облачка с мыслями Эдит

    // четыре свободные ячейки слева, четыре дома справа
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      drawSlot(g, X0 + i * STEP, this.topY, CW, CH, 0.55);
      drawSlot(g, X0 + (4 + i) * STEP, this.topY, CW, CH, 0.35);
      this.add.image(X0 + (4 + i) * STEP, this.topY, 'suit_' + i).setAlpha(0.4).setScale(0.9);
    }
    for (let c = 0; c < 8; c++) drawSlot(g, X0 + c * STEP, this.tabY, CW, CH, 0.18);

    this.layer = new CardLayer(this, CS, { x: W / 2, y: this.topY }, (id) => this.tapCard(id));
    this.layer.apply(this.places(), true, 12);

    this.undoBtn = helperButton(this, W / 2 - 170, helpersY, t('game.undo'), null, icons.undo, () => this.tapUndo());
    this.hint = helperButton(this, W / 2 + 170, helpersY, t('game.hint'), String(FREE_HINTS), icons.hint, () => void this.tapHint());
    this.refreshHud();
    this.ui.thoughts(helpersY - 178, () => !this.finished && !this.busy);
    // тузы, лежащие сверху, сразу уходят в дома
    this.time.delayedCall(900, () => this.afterMove());
  }

  private places(): Map<number, Placement> {
    const m = new Map<number, Placement>();
    const fc = this.fc;
    fc.cells.forEach((c, i) => {
      if (c) m.set(cardId(c), { x: X0 + i * STEP, y: this.topY, depth: 100, up: true });
    });
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= fc.found[suit]; rank++) m.set(cardId({ rank, suit }), { x: X0 + (4 + suit) * STEP, y: this.topY, depth: 200 + rank, up: true });
    }
    const room = this.tabBottom - (this.tabY - CH / 2);
    fc.cols.forEach((pile, col) => {
      let step = FAN;
      if ((pile.length - 1) * step + CH > room) step = Math.max(36, (room - CH) / (pile.length - 1));
      pile.forEach((c, i) => m.set(cardId(c), { x: X0 + col * STEP, y: this.tabY + i * step, depth: 300 + col * 30 + i, up: true }));
    });
    return m;
  }

  private sync(): void {
    this.layer.apply(this.places());
    this.refreshHud();
  }

  private refreshHud(): void {
    this.undoBtn.button.setAlpha(this.fc.canUndo ? 1 : 0.55);
    this.hint.setBadge(this.hintsLeft > 0 ? String(this.hintsLeft) : t('game.ad'));
    this.ui.setStars(freecellStars(this.fc.moves));
  }

  private locate(id: number): FSource | null {
    const fc = this.fc;
    for (let i = 0; i < 4; i++) if (fc.cells[i] && cardId(fc.cells[i]!) === id) return { type: 'cell', i };
    for (let col = 0; col < 8; col++) {
      const index = fc.cols[col].findIndex((c) => cardId(c) === id);
      if (index >= 0) return { type: 'col', col, index };
    }
    return null;
  }

  // ---------- ходы ----------

  private tapCard(id: number): void {
    if (this.finished || this.busy) return;
    const src = this.locate(id);
    if (!src) return;
    const dests = this.fc.destinations(src);
    if (!dests.length) {
      sfx.no();
      this.layer.shake(id);
      return;
    }
    this.fc.move(src, dests[0]);
    sfx.card(dests[0].type === 'found' ? 3 : 0);
    this.sync();
    this.afterMove();
  }

  /** После хода: ненужные карты сами уходят в дома; проверяем победу и тупик. */
  private afterMove(): void {
    const fc = this.fc;
    if (this.finished) return;
    if (fc.won) return this.onWin();
    if (fc.autoStep()) {
      this.busy = true;
      this.layer.apply(this.places());
      this.time.delayedCall(90, () => {
        this.busy = false;
        this.afterMove();
      });
      return;
    }
    this.refreshHud();
    if (fc.stuck) this.time.delayedCall(700, () => fc.stuck && !this.finished && this.onStuck());
  }

  private onWin(): void {
    if (this.finished) return;
    this.finished = true;
    winLevel(this, this.ctx, freecellStars(this.fc.moves));
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
    if (!this.fc.undo()) {
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
    const m = this.fc.hintMove();
    if (!m) return;
    const ids = this.fc.cardsAt(m.from).map(cardId);
    if (m.to.type === 'col') {
      const pile = this.fc.cols[m.to.col];
      if (pile.length) ids.push(cardId(pile[pile.length - 1]));
    }
    this.layer.pulse(ids);
  }
}
