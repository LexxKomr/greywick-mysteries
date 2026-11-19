// Игровой стол «Косынка» (чайная «Морской вид»).

import Phaser from 'phaser';
import { H, W } from '../config';
import { KDest, KSource, KlondikeGame, klondikeStars, solveKlondikeFrom } from '../logic/klondike';
import { dailyPreset } from '../logic/daily';
import { KLONDIKE_SEEDS, klondikeSeed } from '../logic/seeds';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_W, tableAngle } from '../ui/cards';
import { CardLayer, Placement, cardId, drawSlot } from '../ui/cardLayer';
import { CardDrag } from '../ui/drag';
import { HintFlash, hintCard, hintSlot } from '../ui/hints';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, levelCtx, lostDialog, naturalTableTop, persp, watchDead, winLevel } from '../ui/table';
import { fadeIn, toast } from '../ui/widgets';

const CS = 1.3; // карты крупнее: столбиков всего семь
const CW = CARD_W * CS;
const CH = CARD_H * CS;
const STEP = 152;
const X0 = (W - 6 * STEP) / 2;
const STOCK_X = X0 + 6 * STEP;
const FREE_HINTS = 3;

export class KlondikeScene extends Phaser.Scene {
  private ctx!: LevelCtx;
  private ui!: TableUi;
  private kg!: KlondikeGame;
  private layer!: CardLayer;
  private hint!: Helper;
  private undoBtn!: Helper;
  private stockRing!: Phaser.GameObjects.Image;
  private flash!: HintFlash;
  private suggested?: { cardId: number; to: KDest };
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
    this.suggested = undefined;
  }

  create(): void {
    fadeIn(this);
    const ctx = this.ctx;
    const difficulty = ctx.caseData?.levels?.[ctx.level - 1]?.difficulty ?? 1;
    const seed = ctx.data.dailyDate === undefined
      ? klondikeSeed(ctx.caseData?.number ?? 0, ctx.level, difficulty)
      : dailyPreset(ctx.data.dailyDate, KLONDIKE_SEEDS[1]);
    this.kg = new KlondikeGame(seed);
    this.flash = new HintFlash(this);
    (window as unknown as { __kl: unknown }).__kl = { game: this.kg, scene: this };

    // раскладка снизу вверх: кнопки, столбики, ряд домов и колоды; всё — на столешнице
    const helpersY = H - 178;
    this.tabBottom = helpersY - 112;
    const room = Math.max(630, this.tabBottom - (naturalTableTop('table_tearoom') + 10 + CH + 28));
    this.tabY = this.tabBottom - room + CH / 2;
    this.topY = this.tabY - CH - 28;
    this.ui = buildTable(this, 'table_tearoom', ctx, () => !this.finished && exitDialog(this, ctx), this.topY - CH / 2, this.tabBottom);
    // по центру столешницы; низ столбиков остаётся у кнопок — места для длинных столбиков больше
    this.topY += this.ui.dy;
    this.tabY += this.ui.dy;
    this.checkDead = watchDead(this, { stop: () => this.finished, wait: () => this.busy, dead: () => this.isDead(), onDead: () => this.onStuck() });


    // места под дома, сброс и колоду
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      drawSlot(g, X0 + i * STEP, this.topY, CW, CH);
      this.add.image(persp.x(X0 + i * STEP, this.topY), this.topY, 'suit_' + i)
        .setAlpha(0.84).setScale(persp.s(this.topY) * 0.84, persp.s(this.topY) * 0.74);
    }
    drawSlot(g, X0 + 5 * STEP, this.topY, CW, CH, 0.25);
    drawSlot(g, STOCK_X, this.topY, CW, CH, 0.5);
    for (let c = 0; c < 7; c++) drawSlot(g, X0 + c * STEP, this.tabY, CW, CH, 0.18);
    const sx = persp.x(STOCK_X, this.topY);
    const iconSize = CW * persp.s(this.topY) * 0.86;
    this.stockRing = this.add.image(sx, this.topY, 'glyph_recycle').setDisplaySize(iconSize, iconSize);
    const zone = this.add.zone(sx, this.topY, CW + 10, CH + 10).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tapStock());

    const drag = new CardDrag<number>(this, {
      enabled: () => !this.finished && !this.busy,
      pick: (id) => this.pickStack(id),
      drop: (id, x, y) => this.dropStack(id, x, y),
      tap: (id) => this.tapCard(id),
    });
    this.layer = new CardLayer(this, CS, { x: sx, y: this.topY }, (img, id) => drag.add(img, id));
    this.layer.apply(this.places(), true, 14);

    this.undoBtn = helperButton(this, W / 2 - 170, helpersY, t('game.undo'), null, 'undo', () => this.tapUndo());
    this.hint = helperButton(this, W / 2 + 170, helpersY, t('game.hint'), String(FREE_HINTS), 'hint', () => void this.tapHint());
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
      let stepUp = 60;
      let stepDown = 22;
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
    this.flash.clear();
    this.suggested = undefined;
    this.layer.apply(this.places());
    this.refreshHud();
  }

  private refreshHud(): void {
    this.stockRing.setVisible(this.kg.stock.length === 0 && this.kg.waste.length > 0);
    this.undoBtn.setEnabled(this.kg.canUndo);
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
    const suggested = this.suggested?.cardId === id ? this.suggested.to : undefined;
    const to = suggested && this.kg.canMove(src, suggested) ? suggested : this.kg.destinations(src)[0];
    if (!to) {
      sfx.no();
      this.layer.shake(id);
      return;
    }
    this.kg.move(src, to);
    sfx.card(to.type === 'found' ? 3 : 0);
    this.sync();
    this.afterMove();
  }

  // ---------- перетаскивание ----------

  /** Карта и все карты на ней — поднимаются вместе. */
  private pickStack(id: number): Phaser.GameObjects.Image[] | null {
    this.flash.clear();
    this.suggested = undefined;
    const src = this.locate(id);
    if (!src || src === 'stock') return null;
    const imgs = this.kg.cardsAt(src).map((c) => this.layer.get(cardId(c))!);
    return imgs.length ? imgs : null;
  }

  /** Куда показывает точка на столе: ряд домов или ближайший столбик. */
  private destAt(x: number, y: number): KDest | null {
    if (Math.abs(y - this.topY) < CH * 0.8) {
      const right = persp.x(X0 + 3 * STEP, this.topY) + CW / 2 + 20;
      return x < right ? { type: 'found' } : null;
    }
    if (y < this.tabY - CH) return null;
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < 7; c++) {
      const d = Math.abs(x - persp.x(X0 + c * STEP, y));
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return bd < STEP * 0.75 ? { type: 'tab', col: best } : null;
  }

  private dropStack(id: number, x: number, y: number): boolean {
    const src = this.locate(id);
    const to = this.destAt(x, y);
    if (!src || src === 'stock' || !to || !this.kg.canMove(src, to)) return false;
    this.kg.move(src, to);
    sfx.card(to.type === 'found' ? 3 : 0);
    this.sync();
    this.afterMove();
    return true;
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

  /** Лимит поиска не считается доказательством тупика. */
  private isDead(): boolean {
    return solveKlondikeFrom(this.kg, 3000).result === false;
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
    this.flash.clear();
    this.suggested = undefined;
    const plan = solveKlondikeFrom(this.kg);
    if (plan.result === false) {
      this.onStuck();
      return;
    }
    const move = plan.first;
    if (!move || (move.type === 'draw' ? !this.kg.canDraw : !this.kg.canMove(move.from, move.to))) {
      toast(this, t('game.hintUnknown'));
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
    if (move.type === 'draw') {
      this.flash.show(hintSlot(STOCK_X, this.topY, CW, CH));
      return;
    }
    const [lead, next] = this.kg.cardsAt(move.from);
    const id = cardId(lead);
    const source = hintCard(this.layer.get(id)!, next && this.layer.get(cardId(next)));
    const pile = move.to.type === 'tab' ? this.kg.tableau[move.to.col] : undefined;
    const target = pile?.[pile.length - 1];
    const destination = target
      ? hintCard(this.layer.get(cardId(target))!)
      : hintSlot(X0 + (move.to.type === 'found' ? lead.suit : move.to.col) * STEP,
        move.to.type === 'found' ? this.topY : this.tabY, CW, CH);
    this.suggested = { cardId: id, to: move.to };
    this.flash.show(source, destination);
  }
}
