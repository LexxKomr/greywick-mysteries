// Игровой стол «Три пика».

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { toMenuAfterGame } from '../flow';
import { dailySeed, dealForDaily, dealForLevel, mulberry32 } from '../logic/generator';
import { Deal, Game, TABLEAU_SIZE, makeBonusCards, rowOf, starsFor } from '../logic/tripeaks';
import { ads } from '../services/ads';
import { CaseData, getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { CARD_H, CARD_TEX_SCALE, CARD_W, cardKey } from '../ui/cards';
import { drawHome, fadeIn, roundButton, showDialog, starsRow, txt } from '../ui/widgets';

interface GameData {
  mode: 'case' | 'daily';
  caseId?: string;
  level?: number;
}

const STEP = 106; // шаг карт по горизонтали
const DY = 90; // шаг рядов по вертикали
const BIG = 1.5; // колода и сброс крупнее карт пиков

export class GameScene extends Phaser.Scene {
  private mode: 'case' | 'daily' = 'case';
  private caseData: CaseData | null = null;
  private level = 1;
  private deal!: Deal;
  private tp!: Game;
  private rng!: () => number;
  private sprites: Phaser.GameObjects.Image[] = [];
  private faceUp: boolean[] = [];
  private home: { x: number; y: number }[] = [];
  private stockBacks: Phaser.GameObjects.Image[] = [];
  private stockCount!: Phaser.GameObjects.Text;
  private stockEmpty!: Phaser.GameObjects.Graphics;
  private wasteSprite!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private undoBadge!: Phaser.GameObjects.Text;
  private undoButton!: Phaser.GameObjects.Container;
  private stockPos = { x: 0, y: 0 };
  private wastePos = { x: 0, y: 0 };
  private finished = false;
  private adBusy = false;
  private flyDepth = 200;

  constructor() {
    super('Game');
  }

  init(data: GameData): void {
    this.mode = data.mode ?? 'case';
    this.caseData = data.caseId ? getCase(data.caseId) : null;
    this.level = data.level ?? 1;
    this.finished = false;
    this.adBusy = false;
    this.sprites = [];
    this.faceUp = [];
    this.home = [];
    this.stockBacks = [];
    this.flyDepth = 200;
  }

  create(): void {
    fadeIn(this);
    const total = this.caseData?.clues.length ?? 12;
    this.deal = this.mode === 'case' ? dealForLevel(this.caseData!.number, this.level, total) : dealForDaily();
    this.tp = new Game(this.deal);
    this.rng = mulberry32(Date.now() & 0xffffff);
    (window as unknown as { __tp: unknown }).__tp = { game: this.tp, deal: this.deal, scene: this };

    const bg = this.add.image(W / 2, H / 2, 'bg_table');
    bg.setDisplaySize(W, H);

    this.buildTopBar(total);

    const peaksTop = Math.round(H * 0.17);
    const deckY = peaksTop + 3 * DY + CARD_H + 250 + Math.round((H - 1920) * 0.3);
    this.stockPos = { x: W / 2 - 150, y: deckY };
    this.wastePos = { x: W / 2 + 150, y: deckY };

    this.buildDeck();
    this.buildTableau(peaksTop);
    this.buildHelpers();

    this.streakText = txt(this, W / 2, peaksTop + 3 * DY + CARD_H + 70, '', 60, C.gold, { head: true }).setAlpha(0).setDepth(150);
    this.refreshHud();
  }

  // ---------- построение экрана ----------

  private buildTopBar(total: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, W, 138);
    g.fillStyle(C.nightSoft, 1);
    g.fillRect(0, 0, W, 130);
    g.fillStyle(C.brass, 1);
    g.fillRect(0, 126, W, 4);
    roundButton(this, 78, 64, 46, drawHome, () => this.askExit());

    if (this.mode === 'case') {
      txt(this, W / 2, 44, t('game.clue', { n: this.level, total }), 46, C.brassLight, { head: true });
      const dots = this.add.graphics();
      const found = save.progress(this.caseData!.id, total).stars;
      const gap = 40;
      for (let i = 0; i < total; i++) {
        const x = W / 2 - ((total - 1) * gap) / 2 + i * gap;
        dots.fillStyle(found[i] > 0 ? C.gold : i === this.level - 1 ? C.paperLight : 0x0d171d, 1);
        dots.fillCircle(x, 96, i === this.level - 1 ? 13 : 11);
        dots.lineStyle(2, C.brassDark, 1);
        dots.strokeCircle(x, 96, i === this.level - 1 ? 13 : 11);
      }
    } else {
      txt(this, W / 2, 64, t('game.daily'), 52, C.brassLight, { head: true });
    }
    txt(this, W - 36, 38, t('game.score'), 32, C.paperDark, { ox: 1 });
    this.scoreText = txt(this, W - 36, 86, '0', 52, C.paperLight, { head: true, ox: 1 });
  }

  private buildDeck(): void {
    const { x, y } = this.stockPos;
    this.stockEmpty = this.add.graphics();
    this.stockEmpty.lineStyle(5, C.brassLight, 0.35);
    this.stockEmpty.strokeRoundedRect(x - (CARD_W * BIG) / 2, y - (CARD_H * BIG) / 2, CARD_W * BIG, CARD_H * BIG, 18);
    for (let i = 0; i < 3; i++) {
      const img = this.add.image(x - 14 + i * 7, y - 6 + i * 3, 'card_back').setScale(CARD_TEX_SCALE * BIG);
      this.stockBacks.push(img);
    }
    const top = this.stockBacks[2];
    top.setInteractive({ useHandCursor: true });
    top.on('pointerdown', () => this.tapStock());
    const zone = this.add.zone(x, y, CARD_W * BIG + 30, CARD_H * BIG + 30).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tapStock());
    zone.setDepth(-1);

    const badge = this.add.graphics();
    badge.fillStyle(C.night, 0.85);
    badge.fillRoundedRect(x - 58, y + (CARD_H * BIG) / 2 + 14, 116, 60, 30);
    badge.lineStyle(3, C.brass, 1);
    badge.strokeRoundedRect(x - 58, y + (CARD_H * BIG) / 2 + 14, 116, 60, 30);
    this.stockCount = txt(this, x, y + (CARD_H * BIG) / 2 + 42, '', 42, C.paperLight, { head: true });

    const w = this.add.graphics();
    w.lineStyle(5, C.brassLight, 0.25);
    w.strokeRoundedRect(this.wastePos.x - (CARD_W * BIG) / 2, y - (CARD_H * BIG) / 2, CARD_W * BIG, CARD_H * BIG, 18);
    this.wasteSprite = this.add.image(this.wastePos.x, this.wastePos.y, cardKey(this.tp.top)).setScale(CARD_TEX_SCALE * BIG).setDepth(100);
  }

  private buildTableau(top: number): void {
    const x0 = (W - 9 * STEP) / 2;
    for (let i = 0; i < TABLEAU_SIZE; i++) {
      const row = rowOf(i);
      let x: number;
      if (row === 3) x = x0 + (i - 18) * STEP;
      else if (row === 2) x = x0 + STEP / 2 + (i - 9) * STEP;
      else if (row === 1) x = x0 + STEP + Math.floor((i - 3) / 2) * 3 * STEP + ((i - 3) % 2) * STEP;
      else x = x0 + 1.5 * STEP + i * 3 * STEP;
      const y = top + row * DY + CARD_H / 2;
      this.home.push({ x, y });
      const open = this.tp.isOpen(i);
      this.faceUp.push(open);
      const s = this.add.image(this.stockPos.x, this.stockPos.y, 'card_back').setScale(CARD_TEX_SCALE).setDepth(i);
      s.setInteractive({ useHandCursor: true });
      s.on('pointerdown', () => this.tapCard(i));
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

  private buildHelpers(): void {
    const y = H - 170;
    const mk = (x: number, label: string, badge: string, draw: (g: Phaser.GameObjects.Graphics) => void, onClick: () => void) => {
      const b = roundButton(this, x, y, 82, draw, onClick);
      txt(this, x, y + 116, label, 36, C.paperLight, { head: true });
      const bg = this.add.graphics();
      const bt = txt(this, x + 62, y - 70, badge, 30, C.paperLight, { bold: true });
      const bw = Math.max(54, bt.width + 26);
      bg.fillStyle(C.brassDark, 1);
      bg.fillRoundedRect(x + 62 - bw / 2 - 2, y - 70 - 27, bw + 4, 54, 27);
      bg.fillStyle(C.wine, 1);
      bg.fillRoundedRect(x + 62 - bw / 2, y - 70 - 25, bw, 50, 25);
      bt.setDepth(2);
      return { b, bt };
    };
    const undo = mk(W / 2 - 290, t('game.undo'), '3', (g) => {
      g.lineStyle(10, C.paperLight, 1);
      g.beginPath();
      g.arc(2, 4, 30, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(110), false);
      g.strokePath();
      g.fillStyle(C.paperLight, 1);
      g.fillTriangle(-44, -18, -14, -28, -34, 8);
    }, () => this.tapUndo());
    this.undoBadge = undo.bt;
    this.undoButton = undo.b;
    mk(W / 2, t('game.joker'), t('game.ad'), (g) => {
      g.fillStyle(C.gold, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 40 : 17;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + 2));
      }
      g.fillPoints(pts, true);
    }, () => this.tapJoker());
    mk(W / 2 + 290, t('game.plus5'), t('game.ad'), (g) => {
      g.fillStyle(C.paperLight, 1);
      g.fillRoundedRect(-30, -34, 44, 60, 7);
      g.fillStyle(C.wood, 1);
      g.fillRoundedRect(-12, -24, 48, 64, 8);
      g.fillStyle(C.paperLight, 1);
      g.fillRoundedRect(-9, -21, 42, 58, 6);
      g.fillStyle(C.wine, 1);
      g.fillRect(8, -6, 8, 30);
      g.fillRect(-3, 5, 30, 8);
    }, () => this.tapPlus5());
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
        this.wasteSprite.setTexture(cardKey(this.tp.top));
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
    const status = this.tp.status;
    if (status === 'won') this.onWin();
    else if (status === 'lost') this.time.delayedCall(650, () => this.tp.status === 'lost' && !this.finished && this.onLost());
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
      s.setPosition(this.home[i].x, this.home[i].y).setScale(CARD_TEX_SCALE).setDepth(i);
      s.setInteractive({ useHandCursor: true });
    }
    this.wasteSprite.setTexture(cardKey(this.tp.top));
    this.refreshHud();
  }

  private refreshHud(): void {
    const n = this.tp.stock.length;
    this.stockCount.setText(String(n));
    this.stockBacks[2].setVisible(n > 0);
    this.stockBacks[1].setVisible(n > 1);
    this.stockBacks[0].setVisible(n > 2);
    this.stockEmpty.setVisible(n === 0);
    this.scoreText.setText(String(this.tp.score));
    this.undoBadge.setText(String(this.tp.undosLeft));
    this.undoButton.setAlpha(this.tp.canUndo ? 1 : 0.5);
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
  }

  // ---------- конец партии ----------

  private onWin(): void {
    if (this.finished) return;
    this.finished = true;
    sfx.win();
    const stars = starsFor(this.tp.stockLeft);
    const banner = txt(this, W / 2, H * 0.3, t('game.won'), 84, C.gold, { head: true }).setDepth(300).setScale(0.4).setAlpha(0);
    banner.setStroke('#3b2a20', 10);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });

    if (this.mode === 'case') {
      const c = this.caseData!;
      save.winLevel(c.id, this.level, stars, c.clues.length);
      this.time.delayedCall(1100, () => this.scene.start('Clue', { caseId: c.id, index: this.level - 1, isNew: true, stars }));
    } else {
      save.winDaily(dailySeed(), stars);
      this.time.delayedCall(900, () => {
        banner.destroy();
        showDialog(this, t('game.dailyWon'), t('game.dailyWonText'), [{ label: t('game.toMenu'), style: 'primary', onClick: () => void toMenuAfterGame(this) }], (cont, y) => {
          cont.add(starsRow(this, W / 2, y, stars, 44));
          return y + 80;
        });
      });
    }
  }

  private onLost(): void {
    sfx.lose();
    showDialog(this, t('game.lostTitle'), t('game.lostText'), [
      {
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
      { label: t('game.restart'), onClick: () => this.scene.restart({ mode: this.mode, caseId: this.caseData?.id, level: this.level }) },
    ]);
  }

  private askExit(): void {
    if (this.finished) return;
    showDialog(this, t('game.exitTitle'), t('game.exitText'), [
      { label: t('game.exitNo'), style: 'primary', onClick: () => {} },
      { label: t('game.restart'), onClick: () => this.scene.restart({ mode: this.mode, caseId: this.caseData?.id, level: this.level }) },
      { label: t('game.exitYes'), onClick: () => this.scene.start('Menu') },
    ]);
  }
}

