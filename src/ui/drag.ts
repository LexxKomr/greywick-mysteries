// Перетаскивание карт пальцем или мышью — общее для всех пасьянсов.
// Карта (или стопка) приподнимается: чуть крупнее, под ней большая тень.
// Отпустили на правильном месте — ход делает сцена; на неправильном — карты плавно
// возвращаются. Нажатие без сдвига остаётся вторым способом (срабатывает при отпускании).

import Phaser from 'phaser';
import { sfx } from '../services/sfx';

type Img = Phaser.GameObjects.Image;

export interface DragSpec<K> {
  /** можно ли сейчас трогать карты (не идёт реклама, анимация, партия не кончилась) */
  enabled(): boolean;
  /** что поднимается вместе с этой картой (она первая); null — эту карту не тащат */
  pick(key: K): Img[] | null;
  /** карту отпустили, её центр в точке x, y: true — ход сделан, false — вернуть на место */
  drop(key: K, x: number, y: number): boolean;
  tap(key: K): void;
}

interface Start {
  x: number;
  y: number;
  depth: number;
  angle: number;
  sx: number;
  sy: number;
}

const LIFT = 1.07;

export class CardDrag<K> {
  private moved = false;
  private downKey: K | null = null;
  private key: K | null = null;
  private group: Img[] = [];
  private starts: Start[] = [];
  private shadows: Img[] = [];

  constructor(private scene: Phaser.Scene, private spec: DragSpec<K>) {
    scene.input.dragDistanceThreshold = 12;
    scene.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Img) => this.start(obj));
    // сдвиг считаем от точки нажатия, чтобы карта шла ровно за пальцем
    scene.input.on('drag', (p: Phaser.Input.Pointer, obj: Img) => this.move(obj, p.x - p.downX, p.y - p.downY));
    scene.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Img) => this.end(obj));
  }

  /** Подключает карту: её можно тащить и нажимать. */
  add(img: Img, key: K): void {
    img.setData('dragKey', key);
    this.scene.input.setDraggable(img);
    img.on('pointerdown', () => {
      this.moved = false;
      this.downKey = key;
    });
    img.on('pointerup', () => {
      if (this.moved || this.downKey !== key) return;
      this.downKey = null;
      if (this.spec.enabled()) this.spec.tap(key);
    });
  }

  get dragging(): boolean {
    return this.key !== null;
  }

  private start(obj: Img): void {
    this.moved = true;
    const key = obj.getData('dragKey') as K;
    if (!this.spec.enabled()) return;
    const group = this.spec.pick(key);
    if (!group || !group.length) return;
    this.key = key;
    this.group = group;
    this.starts = group.map((s) => ({ x: s.x, y: s.y, depth: s.depth, angle: s.angle, sx: s.scaleX, sy: s.scaleY }));
    group.forEach((s, i) => {
      this.scene.tweens.killTweensOf(s);
      const st = this.starts[i];
      // приподнимаем: крупнее, ровнее, большая тень снизу
      const sh = this.scene.add.image(s.x + 12, s.y + 20, 'card_lift_shadow').setScale(st.sx * LIFT, st.sy * LIFT).setAngle(st.angle).setAlpha(0.75).setDepth(4990 + i);
      this.shadows.push(sh);
      s.setDepth(5000 + i);
      this.scene.tweens.add({ targets: s, scaleX: st.sx * LIFT, scaleY: st.sy * LIFT, duration: 90 });
    });
    sfx.click();
  }

  private move(obj: Img, dx: number, dy: number): void {
    if (this.key === null || obj !== this.group[0]) return;
    this.group.forEach((s, i) => s.setPosition(this.starts[i].x + dx, this.starts[i].y + dy));
    this.shadows.forEach((sh, i) => sh.setPosition(this.starts[i].x + dx + 12, this.starts[i].y + dy + 20));
  }

  private end(obj: Img): void {
    if (this.key === null || obj !== this.group[0]) return;
    const key = this.key;
    const group = this.group;
    const starts = this.starts;
    this.key = null;
    this.group = [];
    this.starts = [];
    for (const sh of this.shadows) sh.destroy();
    this.shadows = [];
    group.forEach((s, i) => {
      this.scene.tweens.killTweensOf(s);
      s.setScale(starts[i].sx, starts[i].sy);
    });
    if (this.spec.drop(key, group[0].x, group[0].y)) return;
    // не туда — плавно назад
    sfx.no();
    group.forEach((s, i) => {
      const st = starts[i];
      this.scene.tweens.add({ targets: s, x: st.x, y: st.y, duration: 200, ease: 'Cubic.easeOut', onComplete: () => s.setDepth(st.depth) });
    });
  }
}
