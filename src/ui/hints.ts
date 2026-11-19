import Phaser from 'phaser';
import { CARD_H, CARD_TEX_SCALE, CARD_W, KEY } from './cards';
import { persp } from './table';

interface HintArea {
  x: number;
  y: number;
  w: number;
  h: number;
  flat?: boolean;
}

export function hintSlot(x: number, y: number, w: number, h: number, flat = false): HintArea {
  const scale = flat ? 1 : persp.s(y);
  return { x: flat ? x : persp.x(x, y), y, w: w * scale, h: h * scale, flat };
}

export function hintCard(card: Phaser.GameObjects.Image, next?: Phaser.GameObjects.Image): HintArea {
  const size = card.scaleY / CARD_TEX_SCALE;
  const height = CARD_H * size;
  const exposed = next ? Math.max(24, Math.min(height, next.y - card.y)) : height;
  return { x: card.x, y: card.y - (height - exposed) / 2, w: CARD_W * size, h: exposed, flat: !!next };
}

/** Один временный слой на подсказку. Его анимация не трогает сами карты. */
export class HintFlash {
  private layer?: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {}

  clear(): void {
    if (!this.layer) return;
    this.scene.tweens.killTweensOf(this.layer);
    this.layer.destroy();
    this.layer = undefined;
  }

  show(source: HintArea, destination?: HintArea): void {
    this.clear();
    const graphic = this.scene.add.graphics().setName('hint-flash').setDepth(890);
    this.layer = graphic;
    const outline = (area: HintArea, color: number, fill: number) => {
      const { x, y, w, h } = area;
      const hw = w / 2 + 5;
      const hh = h / 2 + 4;
      const top = area.flat ? 1 : KEY;
      const points = [
        new Phaser.Math.Vector2(x - hw * top, y - hh), new Phaser.Math.Vector2(x + hw * top, y - hh),
        new Phaser.Math.Vector2(x + hw, y + hh), new Phaser.Math.Vector2(x - hw, y + hh),
      ];
      graphic.fillStyle(color, fill).fillPoints(points, true);
      graphic.lineStyle(5, color, 1).strokePoints(points, true);
    };
    outline(source, 0xffce67, 0.24);
    if (destination) outline(destination, 0xffedb7, 0.12);
    this.scene.tweens.add({
      targets: graphic, alpha: { from: 1, to: 0.36 }, duration: 320, yoyo: true, repeat: 2,
      onComplete: () => {
        graphic.destroy();
        if (this.layer === graphic) this.layer = undefined;
      },
    });
  }
}
