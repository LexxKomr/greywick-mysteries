import Phaser from 'phaser';
import { C, H, W } from '../config';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { drawSlot } from '../ui/cardLayer';
import { CARD_H, CARD_TEX_SCALE, CARD_W, cardInteractive, cardKey } from '../ui/cards';
import { CardDrag } from '../ui/drag';
import { HintFlash, hintCard, hintSlot } from '../ui/hints';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, levelCtx, lostDialog, persp, watchDead, winLevel } from '../ui/table';
import { dialogsOpen, fadeIn, toast, txt } from '../ui/widgets';
import { GolfGame, GolfMove, GOLF_SEEDS, solveGolf } from '../logic/golf';
import { SpiderGame, SpiderMove, spiderHint } from '../logic/spider';
import { SPIDER_DEALS } from '../logic/spiderDeals';

const FREE_HINTS = 3;
const HELP_Y = () => H - 178;
type CardImage = Phaser.GameObjects.Image;

abstract class AlbionTable extends Phaser.Scene {
  protected ctx!: LevelCtx;
  protected ui!: TableUi;
  protected flash!: HintFlash;
  protected stock!: CardImage;
  protected stockX = 0;
  protected stockY = 0;
  protected artwork!: Phaser.GameObjects.Graphics;
  protected stockCount!: Phaser.GameObjects.Text;
  protected undoButton!: Helper;
  protected hintButton!: Helper;
  protected finished = false;
  protected hints = FREE_HINTS;
  private busy = false;
  private checkDead: (delay?: number) => void = () => {};

  protected abstract get canUndo(): boolean;
  protected abstract get undosLeft(): number;
  protected abstract get won(): boolean;
  protected abstract get stars(): number;
  protected abstract undo(): boolean;
  protected abstract dead(): boolean;
  protected abstract findHint(): (() => void) | undefined;
  protected abstract renderCards(): void;
  protected abstract draw(): void;

  init(data: LevelData): void {
    this.ctx = levelCtx(this.sys.settings.key, data);
    this.finished = false;
    this.busy = false;
    this.hints = FREE_HINTS;
  }

  protected createTable(bg: string, top: number, bottom: number): void {
    fadeIn(this);
    this.flash = new HintFlash(this);
    this.ui = buildTable(this, bg, this.ctx, () => this.inputAllowed() && exitDialog(this, this.ctx), top, bottom);
    this.artwork = this.add.graphics();
    this.undoButton = helperButton(this, W / 2 - 165, HELP_Y(), t('game.undo'), '', 'undo', () => this.tapUndo());
    this.hintButton = helperButton(this, W / 2 + 165, HELP_Y(), t('game.hint'), '', 'hint', () => void this.tapHint());
    this.checkDead = watchDead(this, {
      stop: () => this.finished, wait: () => this.busy, dead: () => this.dead(),
      onDead: () => lostDialog(this, this.ctx, t('game.deadTextNoHelp'), {
        undo: this.canUndo ? () => this.tapUndo() : undefined,
      }),
    });
    this.ui.thoughts(STRIP_H + 96, () => this.inputAllowed());
  }

  protected createStock(x: number, y: number, scale: number): void {
    this.stockX = x;
    this.stockY = y;
    const px = persp.x(x, y);
    drawSlot(this.artwork, x, y, CARD_W * scale, CARD_H * scale);
    this.stock = this.add.image(px, y, 'card_back').setScale(CARD_TEX_SCALE * scale * persp.s(y));
    cardInteractive(this.stock);
    this.stock.on('pointerup', () => this.inputAllowed() && this.draw());
    this.stockCount = txt(this, px - CARD_W * scale * 0.7, y, '', 42, C.paperLight, { head: true }).setStroke('#211a16', 7);
  }

  protected inputAllowed(): boolean {
    return !this.finished && !this.busy && dialogsOpen() === 0;
  }

  protected refresh(): void {
    this.renderCards();
    this.undoButton.setEnabled(this.canUndo);
    this.undoButton.setBadge(String(this.undosLeft));
    this.hintButton.setBadge(this.hints ? String(this.hints) : t('game.ad'));
    this.ui.setStars(this.stars);
  }

  protected moved(): void {
    this.flash.clear();
    this.refresh();
    if (this.won) {
      this.finished = true;
      winLevel(this, this.ctx, this.stars);
    } else this.checkDead();
  }

  private tapUndo(): void {
    if (!this.inputAllowed() || !this.undo()) return;
    sfx.draw();
    this.moved();
  }

  private async tapHint(): Promise<void> {
    if (!this.inputAllowed()) return;
    const show = this.findHint();
    if (!show) return;
    if (this.hints) this.hints--;
    else {
      this.busy = true;
      const ok = await ads.showRewarded();
      this.busy = false;
      if (!ok || !this.sys.isActive()) return;
    }
    this.hintButton.setBadge(this.hints ? String(this.hints) : t('game.ad'));
    show();
  }
}

const GOLF_SCALE = 1.12;
const GOLF_STEP = 132;
const GOLF_ROW = 62;

export class GolfScene extends AlbionTable {
  private gameState!: GolfGame;
  private cards: CardImage[][] = [];
  private waste!: CardImage;
  private solutionCache?: ReturnType<typeof solveGolf>;
  private stockScale = 1.26;
  private top = 0;
  private par = 0;

  constructor() { super('Golf'); }

  create(): void {
    this.solutionCache = undefined;
    const difficulty = this.ctx.caseData?.levels[this.ctx.level - 1]?.difficulty ?? 1;
    this.gameState = new GolfGame(GOLF_SEEDS[difficulty - 1]);
    this.par = [6, 3, 0][difficulty - 1];
    const stockY = HELP_Y() - 250;
    const top = Math.max(STRIP_H + 260, stockY - 570);
    this.createTable('table_kitchen', top - CARD_H / 2, stockY + CARD_H);
    this.top = top + this.ui.dy;
    this.createStock(W / 2 - 145, stockY + this.ui.dy, this.stockScale);
    const wasteX = persp.x(W / 2 + 145, this.stockY);
    this.waste = this.add.image(wasteX, this.stockY, cardKey(this.gameState.top))
      .setScale(CARD_TEX_SCALE * this.stockScale * persp.s(this.stockY));
    const drag = new CardDrag<[number, number]>(this, {
      enabled: () => this.inputAllowed(),
      pick: ([col, row]) => row === this.gameState.columns[col].length - 1 ? [this.cards[col][row]] : null,
      drop: ([col], x, y) => Math.abs(x - wasteX) < 110 && Math.abs(y - this.stockY) < 140 && this.play({ type: 'play', col }),
      tap: ([col, row]) => {
        if (row === this.gameState.columns[col].length - 1 && !this.play({ type: 'play', col })) sfx.no();
      },
    });
    this.cards = this.gameState.columns.map((column, col) => column.map((card, row) => {
      const y = this.top + row * GOLF_ROW;
      const x = persp.x(W / 2 + (col - 3) * GOLF_STEP, y);
      const image = this.add.image(x, y, cardKey(card)).setScale(CARD_TEX_SCALE * GOLF_SCALE * persp.s(y)).setDepth(20 + row);
      cardInteractive(image);
      drag.add(image, [col, row]);
      return image;
    }));
    this.refresh();
  }

  protected get canUndo() { return this.gameState.canUndo; }
  protected get undosLeft() { return this.gameState.undosLeft; }
  protected get won() { return this.gameState.won; }
  protected get stars() { return this.gameState.stock.length >= this.par && this.undosLeft === 3 ? 3 : this.undosLeft > 0 ? 2 : 1; }
  protected undo(): boolean {
    this.solutionCache = undefined;
    return this.gameState.undo();
  }
  protected dead(): boolean { return this.solve().result === false; }
  private solve() { return this.solutionCache ??= solveGolf(this.gameState); }

  protected renderCards(): void {
    this.cards.forEach((column, col) => column.forEach((image, row) => {
      const y = this.top + row * GOLF_ROW;
      image.setPosition(persp.x(W / 2 + (col - 3) * GOLF_STEP, y), y)
        .setDepth(20 + row).setVisible(row < this.gameState.columns[col].length);
    }));
    this.waste?.setTexture(cardKey(this.gameState.top));
    this.stock.setVisible(this.gameState.stock.length > 0);
    this.stockCount.setText(String(this.gameState.stock.length));
  }

  protected findHint(): (() => void) | undefined {
    const move = this.solve().first;
    if (!move) {
      toast(this, t('game.hintUnknown'));
      return;
    }
    return () => {
      if (move.type === 'draw') this.flash.show(hintCard(this.stock));
      else {
        const source = this.cards[move.col][this.gameState.columns[move.col].length - 1];
        this.flash.show(hintCard(source), hintCard(this.waste));
      }
    };
  }

  protected draw(): void { this.play({ type: 'draw' }); }
  private play(move: GolfMove): boolean {
    if (!this.inputAllowed() || !this.gameState.play(move)) return false;
    this.solutionCache = undefined;
    if (move.type === 'draw') sfx.draw();
    else sfx.card(1);
    this.moved();
    return true;
  }
}

const SPIDER_STEP = 103;
const SPIDER_SCALE = 0.88;
const spiderX = (col: number) => W / 2 + (col - 4.5) * SPIDER_STEP;

export class SpiderScene extends AlbionTable {
  private gameState!: SpiderGame;
  private sprites = new Map<number, CardImage>();
  private visible: { x: number; y: number }[][] = [];
  private visited = new Set<string>();
  private solution = new Map<string, SpiderMove>();
  private drag!: CardDrag<number>;
  private selected?: number;
  private completed!: Phaser.GameObjects.Text;
  private par = 0;
  private top = 0;

  constructor() { super('Spider'); }

  create(): void {
    this.sprites = new Map();
    this.visited = new Set();
    this.solution = new Map();
    this.selected = undefined;
    const difficulty = this.ctx.caseData?.levels[this.ctx.level - 1]?.difficulty ?? 1;
    const { seed, path } = SPIDER_DEALS[difficulty - 1];
    this.par = path.length + 10;
    this.gameState = new SpiderGame(seed);
    const witness = new SpiderGame(seed);
    for (const move of path) {
      this.solution.set(witness.key(true), move);
      witness.play(move, false);
    }
    this.visited.add(this.gameState.key());
    const deckY = Math.round(H * 0.44);
    const top = deckY + 200;
    this.createTable('table_library', deckY - CARD_H / 2, HELP_Y() - 140);
    this.top = top + this.ui.dy;
    this.createStock(W - 140, deckY + this.ui.dy, SPIDER_SCALE);
    this.completed = txt(this, W / 2 - 175, this.stockY, '', 43, C.paperLight, { head: true }).setStroke('#211a16', 6);
    this.drag = new CardDrag<number>(this, {
      enabled: () => this.inputAllowed(),
      pick: (id) => {
        const pos = this.position(id);
        if (!pos || !this.gameState.canLift(pos.col, pos.at)) return null;
        this.selected = id;
        return this.gameState.columns[pos.col].slice(pos.at).map(card => this.sprites.get(card.id)!);
      },
      drop: (id, x, y) => {
        const pos = this.position(id);
        if (!pos || y < this.top - 95 || y >= HELP_Y() - 90) return false;
        const to = this.visible.reduce((best, _, col) =>
          Math.abs(persp.x(spiderX(col), y) - x) < Math.abs(persp.x(spiderX(best), y) - x) ? col : best, 0);
        return this.play({ type: 'move', from: pos.col, at: pos.at, to });
      },
      tap: (id) => this.tap(id),
    });
    this.gameState.columns.forEach((_, to) => {
      const x = spiderX(to), y = this.top;
      drawSlot(this.artwork, x, y, CARD_W * SPIDER_SCALE, CARD_H * SPIDER_SCALE);
      this.add.zone(persp.x(x, y), y, CARD_W * SPIDER_SCALE, CARD_H * SPIDER_SCALE)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.inputAllowed() && this.placeSelected(to));
    });
    this.refresh();
  }

  protected get canUndo() { return this.gameState.canUndo; }
  protected get undosLeft() { return this.gameState.undosLeft; }
  protected get won() { return this.gameState.won; }
  protected get stars() { return this.gameState.turns <= this.par && this.gameState.undosLeft === 3 ? 3 : this.gameState.undosLeft > 0 ? 2 : 1; }
  protected undo(): boolean {
    this.selected = undefined;
    return this.gameState.undo();
  }
  protected dead(): boolean { return !this.gameState.won && this.gameState.options().length === 0; }

  private position(id: number): { col: number; at: number } | undefined {
    for (const [col, cards] of this.gameState.columns.entries()) {
      const at = cards.findIndex(card => card.id === id);
      if (at >= 0) return { col, at };
    }
  }

  private tap(id: number): void {
    const pos = this.position(id);
    if (!pos) return;
    if (this.selected !== id && this.placeSelected(pos.col)) return;
    this.selected = this.selected !== id && this.gameState.canLift(pos.col, pos.at) ? id : undefined;
    this.renderCards();
  }

  private placeSelected(to: number): boolean {
    if (this.selected === undefined) return false;
    const from = this.position(this.selected);
    return !!from && this.play({ type: 'move', from: from.col, at: from.at, to });
  }

  protected renderCards(): void {
    const game = this.gameState;
    const onTable = new Set<number>();
    this.visible = game.columns.map((column, col) => {
      const unit = column.slice(0, -1).reduce((sum, card) => sum + (card.up ? 48 : 23), 0);
      const available = Math.max(90, HELP_Y() - this.top - 160);
      const spread = Math.min(1, available / Math.max(1, unit));
      let y = this.top;
      return column.map((card, at) => {
        onTable.add(card.id);
        const x = persp.x(spiderX(col), y);
        let image = this.sprites.get(card.id);
        if (!image) {
          image = this.add.image(x, y, 'card_back');
          cardInteractive(image);
          this.drag.add(image, card.id);
          this.sprites.set(card.id, image);
        }
        this.tweens.killTweensOf(image);
        image.setVisible(true).setTexture(card.up ? cardKey({ rank: card.rank, suit: 0 }) : 'card_back')
          .setPosition(x, y).setDepth(20 + at).setScale(CARD_TEX_SCALE * SPIDER_SCALE * persp.s(y));
        if (card.id === this.selected) image.setTint(0xffcd74);
        else image.clearTint();
        const location = { x, y };
        y += (card.up ? 48 : 23) * spread;
        return location;
      });
    });
    for (const [id, image] of this.sprites) if (!onTable.has(id)) image.setVisible(false);
    this.stock.setVisible(game.stock.length > 0);
    this.stockCount.setText(String(game.stock.length / 10));
    this.completed.setText(t('game.spiderRuns', { n: game.runs }));
  }

  protected findHint(): (() => void) | undefined {
    const key = this.gameState.key(true);
    const planned = this.solution.get(key);
    const move = planned && (planned.type === 'draw' ? this.gameState.canDraw : this.gameState.canMove(planned.from, planned.at, planned.to))
      ? planned : spiderHint(this.gameState, this.visited);
    if (!move) return;
    return () => {
      if (move.type === 'draw') {
        this.flash.show(hintCard(this.stock));
        return;
      }
      const column = this.gameState.columns[move.from];
      const source = this.sprites.get(column[move.at].id)!;
      const next = column[move.at + 1];
      const destination = this.gameState.columns[move.to];
      const target = destination[destination.length - 1];
      this.flash.show(hintCard(source, next && this.sprites.get(next.id)), target
        ? hintCard(this.sprites.get(target.id)!) : hintSlot(spiderX(move.to), this.top, CARD_W * SPIDER_SCALE, CARD_H * SPIDER_SCALE));
    };
  }

  protected draw(): void {
    if (this.play({ type: 'draw' })) return;
    sfx.no();
    if (this.gameState.stock.length) toast(this, t('game.spiderFill'));
  }

  private play(move: SpiderMove): boolean {
    if (!this.inputAllowed() || !this.gameState.play(move)) return false;
    this.selected = undefined;
    this.visited.add(this.gameState.key());
    if (move.type === 'draw') sfx.draw();
    else sfx.card(1);
    this.moved();
    return true;
  }
}
