// Игровой стол «Три пика» (библиотека).

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { dealForBlock, dealForDaily, dealForLevel, mulberry32 } from '../logic/generator';
import { Deal, Game, TABLEAU_SIZE, makeBonusCards, rowOf, starsFor } from '../logic/tripeaks';
import { solveTriPeaksFrom } from '../logic/solver';
import { ads } from '../services/ads';
import { t } from '../services/i18n';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_TEX_SCALE, CARD_W, cardInteractive, cardKey, tableAngle } from '../ui/cards';
import { Helper, LevelCtx, LevelData, STRIP_H, TableUi, buildTable, exitDialog, helperButton, icons, levelCtx, lostDialog, persp, watchDead, winLevel } from '../ui/table';
import { fadeIn, txt } from '../ui/widgets';
import { CardDrag } from '../ui/drag';

const STEP = 106; // шаг карт по горизонтали
const DY = 73; // шаг рядов по вертикали (стол в перспективе — ряды ближе)
const BIG = 1.5; // колода и сброс крупнее карт пиков

export class GameScene extends Phaser.Scene {
  private ctx!: LevelCtx;
  private ui!: TableUi;
  private deal!: Deal;
  private tp!: Game;
  private rng!: () => number;
  private sprites: Phaser.GameObjects.Image[] = [];
  private faceUp: boolean[] = [];
  private home: { x: number; y: number }[] = [];
  /** масштаб каждой карты пиков: дальние ряды чуть мельче */
  private hs: number[] = [];
  private stockBacks: Phaser.GameObjects.Image[] = [];
  private stockCount!: Phaser.GameObjects.Text;
  private stockEmpty!: Phaser.GameObjects.Graphics;
  private wasteSprite!: Phaser.GameObjects.Image;
  private streakText!: Phaser.GameObjects.Text;
  private undo!: Helper;
  private stockPos = { x: 0, y: 0 };
  private wastePos = { x: 0, y: 0 };
  private finished = false;
  /** «проверь тупик» после хода: окно «Ходов больше нет» появляется само */
  private checkDead: (delay?: number) => void = () => {};
  private adBusy = false;
  private flyDepth = 200;

  constructor() {
    super('Game');
  }

  init(data: LevelData): void {
    this.ctx = levelCtx('Game', data);
    this.finished = false;
    this.adBusy = false;
    this.sprites = [];
    this.faceUp = [];
    this.home = [];
    this.hs = [];
    this.stockBacks = [];
    this.flyDepth = 200;
  }

  create(): void {
    fadeIn(this);
    const ctx = this.ctx;
    const spec = ctx.caseData?.levels?.[ctx.level - 1];
    if (ctx.mode !== 'case') this.deal = dealForDaily();
    else if (spec?.game === 'tripeaks') this.deal = dealForBlock(ctx.caseData!.number, ctx.level, spec.difficulty);
    else this.deal = dealForLevel(ctx.caseData!.number, ctx.level, ctx.total); // пасьянс этой партии ещё не готов
    this.tp = new Game(this.deal);
    this.rng = mulberry32(Date.now() & 0xffffff);
    (window as unknown as { __tp: unknown }).__tp = { game: this.tp, deal: this.deal, scene: this };

    // карты лежат на столе: раскладка снизу вверх — помощники, колода, пики
    const helpersY = H - 178;
    let deckY = Math.round(helpersY - 100 - (CARD_H * BIG) / 2);
    let peaksTop = Math.round(deckY - (CARD_H * BIG) / 2 - 50 - (3 * DY + CARD_H));
    this.ui = buildTable(this, 'table_library', ctx, () => !this.finished && exitDialog(this, ctx), peaksTop, deckY + (CARD_H * BIG) / 2);
    // по центру столешницы
    deckY += this.ui.dy;
    peaksTop += this.ui.dy;
    this.stockPos = { x: W / 2 - 130, y: deckY };
    this.wastePos = { x: W / 2 + 130, y: deckY };
    this.checkDead = watchDead(this, { stop: () => this.finished, wait: () => this.adBusy, dead: () => this.isDead(), onDead: () => this.onLost() });


    this.buildDeck();
    this.buildTableau(peaksTop);
    this.buildHelpers(helpersY);

    this.streakText = txt(this, W / 2, peaksTop - 70, '', 64, C.gold, { head: true }).setAlpha(0).setDepth(150);
    this.streakText.setStroke('#2a1a10', 8);
    this.refreshHud();
    this.ui.thoughts(STRIP_H + 96, () => !this.finished && !this.adBusy);
  }

  // ---------- построение экрана ----------

  private buildDeck(): void {
    const { x, y } = this.stockPos;
    const cw = CARD_W * BIG;
    const ch = CARD_H * BIG;
    this.stockEmpty = this.add.graphics();
    this.stockEmpty.lineStyle(5, C.brassLight, 0.4);
    this.stockEmpty.strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 18);
    for (let i = 0; i < 3; i++) {
      this.stockBacks.push(this.add.image(x - 14 + i * 7, y - 6 + i * 3, 'card_back').setScale(CARD_TEX_SCALE * BIG).setAngle(tableAngle(90 + i)));
    }
    const zone = this.add.zone(x, y, cw + 40, ch + 40).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tapStock());

    // сколько карт осталось в колоде — слева от неё
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
    this.wasteSprite = this.add.image(this.wastePos.x, this.wastePos.y, cardKey(this.tp.top)).setScale(CARD_TEX_SCALE * BIG).setDepth(100);
  }

  private buildTableau(top: number): void {
    // карту пика можно перетащить на сброс или просто нажать
    const drag = new CardDrag<number>(this, {
      enabled: () => !this.finished && !this.adBusy,
      pick: (i) => (this.tp.tableau[i] && this.tp.isOpen(i) ? [this.sprites[i]] : null),
      drop: (i, x, y) => {
        const near = Math.abs(x - this.wastePos.x) < 150 && Math.abs(y - this.wastePos.y) < 190;
        if (!near || !this.tp.canPlay(i)) return false;
        this.tapCard(i);
        return true;
      },
      tap: (i) => this.tapCard(i),
    });
    const x0 = (W - 9 * STEP) / 2;
    for (let i = 0; i < TABLEAU_SIZE; i++) {
      const row = rowOf(i);
      let x: number;
      if (row === 3) x = x0 + (i - 18) * STEP;
      else if (row === 2) x = x0 + STEP / 2 + (i - 9) * STEP;
      else if (row === 1) x = x0 + STEP + Math.floor((i - 3) / 2) * 3 * STEP + ((i - 3) % 2) * STEP;
      else x = x0 + 1.5 * STEP + i * 3 * STEP;
      const y = top + row * DY + CARD_H / 2;
      this.home.push({ x: persp.x(x, y), y });
      this.hs.push(persp.s(y));
      x = persp.x(x, y);
      const open = this.tp.isOpen(i);
      this.faceUp.push(open);
      const s = this.add.image(this.stockPos.x, this.stockPos.y, 'card_back').setScale(CARD_TEX_SCALE * this.hs[i]).setDepth(i).setAngle(tableAngle(i * 7 + this.ctx.level));
      cardInteractive(s);
      drag.add(s, i);
      this.sprites.push(s);
      // раздача: карты разлетаются из колоды
      this.tweens.add({
        targets: s,
        x,
        y,
        duration: 260,
        delay: 60 + i * 22,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (open) this.flip(s, cardKey(this.tp.tableau[i] ?? this.deal.tableau[i]));
        },
      });
    }
  }

  private buildHelpers(y: number): void {
    this.undo = helperButton(this, W / 2 - 290, y, t('game.undo'), '3', icons.undo, () => this.tapUndo());
    helperButton(this, W / 2, y, t('game.joker'), t('game.ad'), icons.joker, () => void this.tapJoker());
    helperButton(this, W / 2 + 290, y, t('game.plus5'), t('game.ad'), icons.plusCards, () => void this.tapPlus5());
  }

  // ---------- ходы ----------

  private tapCard(i: number): void {
    if (this.finished || this.adBusy || !this.tp.tableau[i]) return;
    const s = this.sprites[i];
    if (this.tp.canPlay(i)) {
      const card = this.tp.tableau[i]!;
      this.tp.play(i);
      sfx.card(this.tp.streak);
      s.disableInteractive();
      if (!this.faceUp[i]) s.setTexture(cardKey(card));
      this.fly(s, false);
      this.showStreak();
      this.afterMove();
    } else if (this.tp.isOpen(i)) {
      sfx.no();
      this.tweens.add({ targets: s, x: this.home[i].x + 8, duration: 45, yoyo: true, repeat: 2, onComplete: () => s.setX(this.home[i].x) });
    }
  }

  private tapStock(): void {
    if (this.finished || this.adBusy) return;
    if (this.tp.stock.length === 0) {
      sfx.no();
      return;
    }
    const card = this.tp.stock[0];
    this.tp.draw();
    sfx.draw();
    const s = this.add.image(this.stockPos.x, this.stockPos.y, 'card_back').setScale(CARD_TEX_SCALE * BIG);
    this.flip(s, cardKey(card), 90);
    this.fly(s, true);
    this.afterMove();
  }

  /** Карта летит в сброс. */
  private fly(s: Phaser.GameObjects.Image, temp: boolean): void {
    s.setDepth(this.flyDepth++);
    this.tweens.add({
      targets: s,
      x: this.wastePos.x,
      y: this.wastePos.y,
      scaleY: CARD_TEX_SCALE * BIG,
      duration: 210,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (!temp) s.scaleX = s.scaleY;
      },
      onComplete: () => {
        // показываем то, что сейчас действительно сверху сброса
        this.setWaste();
        if (temp) s.destroy();
        else s.setVisible(false);
      },
    });
  }

  /** Переворот карты: сжать, сменить картинку, разжать. */
  private flip(s: Phaser.GameObjects.Image, key: string, half = 80): void {
    const sx = Math.abs(s.scaleX) || CARD_TEX_SCALE;
    this.tweens.add({
      targets: s,
      scaleX: 0,
      duration: half,
      onComplete: () => {
        s.setTexture(key);
        this.tweens.add({ targets: s, scaleX: sx, duration: half });
      },
    });
  }

  private afterMove(): void {
    // открываем карты, с которых сняли обе накрывающие
    for (let i = 0; i < TABLEAU_SIZE; i++) {
      if (this.tp.tableau[i] && !this.faceUp[i] && this.tp.isOpen(i)) {
        this.faceUp[i] = true;
        this.time.delayedCall(120, () => {
          if (this.tp.tableau[i] && this.faceUp[i]) this.flip(this.sprites[i], cardKey(this.tp.tableau[i]!));
        });
      }
    }
    this.refreshHud();
    if (this.tp.status === 'won') this.onWin();
    else this.checkDead();
  }

  /** Выиграть уже нельзя: колода пуста и ходов нет, или решатель доказал тупик. */
  private isDead(): boolean {
    return this.tp.status === 'lost' || solveTriPeaksFrom(this.tp, 200_000).result === false;
  }


  /** Приводит весь стол в соответствие с состоянием игры (после отмены и помощников). */
  private syncAll(): void {
    for (let i = 0; i < TABLEAU_SIZE; i++) {
      const s = this.sprites[i];
      this.tweens.killTweensOf(s);
      const card = this.tp.tableau[i];
      s.setVisible(!!card);
      if (!card) continue;
      const open = this.tp.isOpen(i);
      this.faceUp[i] = open;
      s.setTexture(open ? cardKey(card) : 'card_back');
      s.setPosition(this.home[i].x, this.home[i].y).setScale(CARD_TEX_SCALE * this.hs[i]).setDepth(i);
      cardInteractive(s);
    }
    this.setWaste();
    this.refreshHud();
  }

  /** Верхняя карта сброса, чуть наискось — как положили. */
  private setWaste(): void {
    const top = this.tp.top;
    this.wasteSprite.setTexture(cardKey(top)).setAngle(tableAngle(top.rank * 4 + top.suit + this.tp.waste.length));
  }

  private refreshHud(): void {
    const n = this.tp.stock.length;
    this.stockCount.setText(String(n));
    this.stockBacks[2].setVisible(n > 0);
    this.stockBacks[1].setVisible(n > 1);
    this.stockBacks[0].setVisible(n > 2);
    this.stockEmpty.setVisible(n === 0);
    this.undo.setBadge(String(this.tp.undosLeft));
    this.undo.button.setAlpha(this.tp.canUndo ? 1 : 0.55);
    this.ui.setStars(starsFor(this.tp.stockLeft));
  }

  private showStreak(): void {
    const n = this.tp.streak;
    if (n < 2) return;
    this.tweens.killTweensOf(this.streakText);
    this.streakText.setText(t('game.streak', { n })).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.streakText, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.streakText, alpha: 0, delay: 900, duration: 400 });
  }

  // ---------- помощники ----------

  private tapUndo(): void {
    if (this.finished || this.adBusy) return;
    const h = this.tp.undo();
    if (!h) {
      sfx.no();
      return;
    }
    sfx.draw();
    this.syncAll();
    if (h.type === 'play') {
      const s = this.sprites[h.index];
      s.setPosition(this.wastePos.x, this.wastePos.y).setDepth(this.flyDepth++);
      this.tweens.add({ targets: s, x: this.home[h.index].x, y: this.home[h.index].y, duration: 200, ease: 'Cubic.easeOut', onComplete: () => s.setDepth(h.index) });
    }
  }

  private async tapJoker(): Promise<void> {
    if (this.finished || this.adBusy) return;
    this.adBusy = true;
    const ok = await ads.showRewarded();
    this.adBusy = false;
    if (!ok || this.finished) return;
    this.tp.addJoker();
    this.syncAll();
    this.wasteSprite.setScale(CARD_TEX_SCALE * BIG * 1.25);
    this.tweens.add({ targets: this.wasteSprite, scale: CARD_TEX_SCALE * BIG, duration: 300, ease: 'Back.easeOut' });
    sfx.clue();
    this.checkDead();
  }

  private async tapPlus5(): Promise<void> {
    if (this.finished || this.adBusy) return;
    this.adBusy = true;
    const ok = await ads.showRewarded();
    this.adBusy = false;
    if (!ok || this.finished) return;
    this.addFive();
  }

  private addFive(): void {
    this.tp.addCards(makeBonusCards(this.tp, this.rng));
    this.syncAll();
    sfx.clue();
    this.tweens.add({ targets: this.stockBacks, scale: CARD_TEX_SCALE * BIG * 1.15, duration: 140, yoyo: true });
    this.checkDead();
  }

  // ---------- конец партии ----------

  private onWin(): void {
    if (this.finished) return;
    this.finished = true;
    winLevel(this, this.ctx, starsFor(this.tp.stockLeft));
  }

  private onLost(): void {
    const text = this.tp.stock.length === 0 ? t('game.lostText') : t('game.deadText');
    lostDialog(this, this.ctx, text, {
      extra: {
        label: t('game.lostPlus5'),
        style: 'primary',
        onClick: async () => {
          this.adBusy = true;
          const ok = await ads.showRewarded();
          this.adBusy = false;
          if (ok) this.addFive();
          else this.onLost();
        },
      },
      undo: this.tp.canUndo ? () => this.undoToLive() : undefined,
    });
  }

  /** «Отменить ходы»: откатываемся, пока снова можно выиграть (или пока есть отмены). */
  private undoToLive(): void {
    while (this.tp.canUndo) {
      this.tp.undo();
      if (!this.isDead()) break;
    }
    sfx.draw();
    this.syncAll();
    this.checkDead();
  }
}
