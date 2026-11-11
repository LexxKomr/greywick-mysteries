// Слой карт для пасьянсов со столбиками («Косынка», «Свободная ячейка»).
// У каждой из 52 карт своя картинка; экран говорит только, где карта должна лежать,
// а слой сам плавно переносит её и переворачивает.

import Phaser from 'phaser';
import { Card } from '../logic/tripeaks';
import { CARD_TEX_SCALE, KEY, cardInteractive, cardKey } from './cards';
import { persp } from './table';

export interface Placement {
  x: number;
  y: number;
  depth: number;
  up: boolean;
  /** наклон в градусах (карты в столбиках лежат ровно, в домах и сбросе — чуть вразнобой) */
  angle?: number;
}

export const cardId = (c: Card): number => (c.rank - 1) * 4 + c.suit;
export const cardOfId = (id: number): Card => ({ rank: Math.floor(id / 4) + 1, suit: id % 4 });

export class CardLayer {
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private faceUp = new Map<number, boolean>();
  private current = new Map<number, Placement>();
  private texScale: number;

  /** bind — подключает карту к нажатию и перетаскиванию (см. drag.ts) */
  constructor(private scene: Phaser.Scene, scale: number, private origin: { x: number; y: number }, private bind: (img: Phaser.GameObjects.Image, id: number) => void) {
    this.texScale = CARD_TEX_SCALE * scale;
  }

  private sprite(id: number): Phaser.GameObjects.Image {
    let s = this.sprites.get(id);
    if (!s) {
      s = this.scene.add.image(this.origin.x, this.origin.y, 'card_back').setScale(this.texScale);
      cardInteractive(s);
      this.bind(s, id);
      this.sprites.set(id, s);
      this.faceUp.set(id, false);
    }
    return s;
  }

  /** Раскладывает карты по местам. delayStep — задержка между картами (для раздачи). */
  apply(places: Map<number, Placement>, animate = true, delayStep = 0): void {
    let n = 0;
    for (const [id, raw] of places) {
      const s = this.sprite(id);
      // точка на столе -> точка на экране с перспективой
      const sc = this.texScale * persp.s(raw.y);
      const p: Placement = { ...raw, x: persp.x(raw.x, raw.y) };
      const angle = p.angle ?? 0;
      const old = this.current.get(id);
      const moved = !old || old.x !== p.x || old.y !== p.y || (old.angle ?? 0) !== angle;
      const flipped = this.faceUp.get(id) !== p.up;
      this.current.set(id, p);
      if (flipped) this.faceUp.set(id, p.up);
      const key = p.up ? cardKey(cardOfId(id)) : 'card_back';
      if (!animate) {
        s.setTexture(key).setPosition(p.x, p.y).setAngle(angle).setScale(sc).setDepth(p.depth);
        continue;
      }
      if (flipped && !delayStep) {
        // переворот: сжать, сменить картинку, разжать
        this.scene.tweens.add({
          targets: s,
          scaleX: 0,
          duration: 70,
          onComplete: () => {
            s.setTexture(key);
            this.scene.tweens.add({ targets: s, scaleX: sc, duration: 70 });
          },
        });
      } else {
        if (flipped) s.setTexture(key);
        if (s.scaleX !== sc) this.scene.tweens.add({ targets: s, scaleX: sc, duration: 190, delay: n * delayStep });
      }
      if (moved) {
        s.setDepth(1000 + p.depth);
        this.scene.tweens.add({
          targets: s,
          x: p.x,
          y: p.y,
          angle,
          scaleY: sc,
          duration: 190,
          delay: n * delayStep,
          ease: 'Cubic.easeOut',
          onComplete: () => s.setDepth(this.current.get(id)?.depth ?? p.depth),
        });
        n++;
      } else {
        s.setDepth(p.depth);
        if (s.scaleY !== sc) s.setScale(s.scaleX, sc);
      }
    }
  }

  /** Картинка карты (для перетаскивания стопки). */
  get(id: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }

  /** Подсветка карт (подсказка). */
  pulse(ids: number[]): void {
    for (const id of ids) {
      const s = this.sprites.get(id);
      if (!s) continue;
      s.setTint(0xffd36b);
      const base = s.scaleY;
      this.scene.tweens.add({ targets: s, scaleY: base * 1.1, duration: 220, yoyo: true, repeat: 2, onComplete: () => s.clearTint().setScale(base) });
    }
  }

  /** «Нет хода»: карта покачивается. */
  shake(id: number): void {
    const s = this.sprites.get(id);
    const p = this.current.get(id);
    if (!s || !p) return;
    this.scene.tweens.add({ targets: s, x: p.x + 8, duration: 45, yoyo: true, repeat: 2, onComplete: () => s.setX(this.current.get(id)?.x ?? p.x) });
  }
}

/** Пустое место под карту: тонкая рамка и, если нужно, масть. */
export function drawSlot(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 0.4): void {
  // место лежит на столе: трапеция с перспективой, как и карты
  const k = persp.s(y);
  const cx = persp.x(x, y);
  const hw = (w * k) / 2;
  const hh = (h * k) / 2;
  const pts = [
    new Phaser.Math.Vector2(cx - hw * KEY, y - hh),
    new Phaser.Math.Vector2(cx + hw * KEY, y - hh),
    new Phaser.Math.Vector2(cx + hw, y + hh),
    new Phaser.Math.Vector2(cx - hw, y + hh),
  ];
  g.fillStyle(0x000000, 0.22);
  g.fillPoints(pts, true);
  g.lineStyle(4, 0xe8cf8f, alpha);
  g.strokePoints(pts, true);
}
