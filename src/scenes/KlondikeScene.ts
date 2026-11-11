// Игровой стол «Косынка» (чайная «Морской вид»).

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { KDest, KSource, KlondikeGame, klondikeStars, solveKlondikeFrom } from '../logic/klondike';
import { klondikeSeed } from '../logic/seeds';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_W, tableAngle } from '../ui/cards';
import { CardLayer, Placement, cardId, drawSlot } from '../ui/cardLayer';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, icons, levelCtx, lostDialog, naturalTableTop, persp, watchDead, winLevel } from '../ui/table';
import { fadeIn, toast } from '../ui/widgets';

const CS = 1.25; // карты крупнее: столбиков всего семь
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
  /** «проверь тупик» после хода: окно «Ходов больше нет» появляется само */
  private checkDead: (delay?: number) => void = () => {};
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

    // раскладка снизу вверх: кнопки, столбики, ряд домов и колоды; всё — на столешнице
    const helpersY = H - 178;
    this.tabBottom = helpersY - 112;
    const room = Math.max(630, this.tabBottom - (naturalTableTop('table_tearoom') + 10 + CH + 28));
    this.tabY = this.tabBottom - room + CH / 2;
    this.topY = this.tabY - CH - 28;
    this.ui = buildTable(this, 'table_tearoom', ctx, () => !this.finished && exitDialog(this, ctx), this.topY - CH / 2);
    this.checkDead = watchDead(this, { stop: () => this.finished, wait: () => this.busy, dead: () => this.isDead(), onDead: () => this.onStuck() });


    // места под дома, сброс и колоду
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      drawSlot(g, X0 + i * STEP, this.topY, CW, CH);
      this.add.image(persp.x(X0 + i * STEP, this.topY), this.topY, 'suit_' + i).setAlpha(0.4).setScale(persp.s(this.topY), persp.s(this.topY) * 0.88);
    }
    drawSlot(g, X0 + 5 * STEP, this.topY, CW, CH, 0.25);
    drawSlot(g, X0 + 6 * STEP, this.topY, CW, CH, 0.5);
    for (let c = 0; c < 7; c++) drawSlot(g, X0 + c * STEP, this.tabY, CW, CH, 0.18);
    // круговая стрелка на пустой колоде: перевернуть сброс
    this.stockRing = this.add.graphics();
    const sx = persp.x(X0 + 6 * STEP, this.topY);
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
    this.ui.thoughts(STRIP_H + 96, () => !this.finished && !this.busy);
  }

  /** Где сейчас должна лежать каждая карта. */
  private places(): Map<number, Placement> {
    const m = new Map<number, Placement>();
    const kg = this.kg;
    kg.stock.forEach((c, i) => m.set(cardId(c), { x: X0 + 6 * STEP - Math.min(i, 2) * 3, y: this.topY - Math.min(i, 2) * 2, depth: i, up: false, angle: tableAngle(i) * 0.6 }));
    kg.waste.forEach((c, i) => m.set(cardId(c), { x: X0 + 5 * STEP, y: this.topY, depth: 100 + i, up: true, angle: tableAngle(cardId(c)) }));
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= kg.found[suit]; rank++) m.set(cardId({ rank, suit }), { x: X0 + suit * STEP, y: this.topY, depth: 200 + rank, up: true, angle: tableAngle(cardId({ rank, suit })) });
    }
    kg.tableau.forEach((pile, col) => {
      const downs = pile.filter((c) => !c.up).length;
      const ups = pile.length - downs;
      let stepUp = 68;
      let stepDown = 25;
      const room = this.tabBottom - (this.tabY - CH / 2);
      if (downs * stepDown + Math.max(0, ups - 1) * stepUp + CH > room && ups > 1) stepUp = Math.max(40, (room - CH - downs * stepDown) / (ups - 1));
      if (downs * stepDown + Math.max(0, ups - 1) * stepUp + CH > room && downs > 0) stepDown = Math.max(14, (room - CH - Math.max(0, ups - 1) * stepUp) / downs);
      let y = this.tabY;
      pile.forEach((c, i) => {
        m.set(cardId(c), { x: X0 + col * STEP, y, depth: 300 + col * 30 + i, up: c.up });
        y += c.up ? stepUp : stepDown;
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
    this.checkDead();
  }

  /** Выиграть уже нельзя: полезных ходов нет совсем, или решатель перебрал все варианты. */
  private isDead(): boolean {
    return this.kg.stuck || solveKlondikeFrom(this.kg, 3000).result === false;
  }


  private onWin(): void {
    if (this.finished) return;
    this.finished = true;
    this.time.removeAllEvents();
    winLevel(this, this.ctx, klondikeStars(this.kg.recycles));
  }

  private onStuck(): void {
    lostDialog(this, this.ctx, t('game.deadTextNoHelp'), { undo: this.kg.canUndo ? () => this.undoToLive() : undefined });
  }

  /** «Отменить ходы»: откатываемся, пока снова можно выиграть. */
  private undoToLive(): void {
    for (let n = 0; n < 60 && this.kg.canUndo; n++) {
      this.kg.undo();
      if (!this.isDead()) break;
    }
    sfx.draw();
    this.sync();
    this.checkDead();
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
    // сначала решатель: если выиграть уже нельзя, подсказку не тратим, а сразу говорим об этом
    const plan = solveKlondikeFrom(this.kg, 15_000);
    if (plan.result === false || this.kg.stuck) {
      this.onStuck();
      return;
    }
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
    const f = plan.first;
    if (f?.type === 'draw') return this.hintStock();
    const moves = f ? [f] : this.kg.usefulMoves().sort((a, b) => b.weight - a.weight);
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

  /** Подсказка «возьмите карту из колоды» (или переверните её). */
  private hintStock(): void {
    const top = this.kg.stock[this.kg.stock.length - 1];
    if (top) this.layer.pulse([cardId(top)]);
    else toast(this, t('klondike.hintRecycle'));
  }
}
