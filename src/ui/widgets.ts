// Общие элементы интерфейса: текст, плашки, кнопки, прокрутка, окна, звёзды.

import Phaser from 'phaser';
import { C, FONT_BODY, FONT_HEAD, H, W, hex } from '../config';
import { sfx } from '../services/sfx';

type Scene = Phaser.Scene;
type G = Phaser.GameObjects.Graphics;

export interface TxtOpts {
  head?: boolean;
  bold?: boolean;
  italic?: boolean;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  ox?: number;
  oy?: number;
  spacing?: number;
}

export function txt(scene: Scene, x: number, y: number, s: string, size: number, color: number = C.ink, o: TxtOpts = {}): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.head ? FONT_HEAD : FONT_BODY,
    fontSize: size + 'px',
    fontStyle: `${o.italic ? 'italic ' : ''}${o.bold || o.head ? 'bold' : 'normal'}`.trim(),
    color: hex(color),
    align: o.align ?? 'center',
    lineSpacing: o.spacing ?? Math.round(size * 0.28),
    padding: { x: 4, y: 6 },
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: false };
  return scene.add.text(x, y, s, style).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
}

/** Фоновая картинка на весь экран с затемнением. */
export function addBackground(scene: Scene, key: string, dim = 0.25): void {
  const img = scene.add.image(W / 2, H / 2, key);
  img.setScale(Math.max(W / img.width, H / img.height));
  if (dim > 0) scene.add.rectangle(W / 2, H / 2, W, H, 0x0c141a, dim);
}

/** Бумажная плашка с латунной рамкой. */
export function drawPanel(g: G, x: number, y: number, w: number, h: number, r = 30, fill: number = C.paper, border: number = C.brass): void {
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 3, y + 9, w, h, r);
  g.fillStyle(C.brassDark, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(border, 1);
  g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, r - 1);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x + 9, y + 9, w - 18, h - 18, Math.max(4, r - 8));
  g.lineStyle(2, C.brassDark, 0.35);
  g.strokeRoundedRect(x + 20, y + 20, w - 40, h - 40, Math.max(4, r - 16));
}

export function panel(scene: Scene, x: number, y: number, w: number, h: number, r = 30, fill: number = C.paper): G {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, r, fill);
  return g;
}

/** Бордовая лента-заголовок. */
export function ribbon(scene: Scene, cx: number, cy: number, w: number, h: number, label: string, size = 56): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const x = -w / 2;
  const y = -h / 2;
  g.fillStyle(C.wineDark, 1);
  g.fillTriangle(x - 40, y + 14, x + 20, y + 14, x + 20, y + h + 14);
  g.fillTriangle(x - 40, y + h + 14, x + 20, y + h + 14, x - 14, y + h / 2 + 14);
  g.fillTriangle(-x + 40, y + 14, -x - 20, y + 14, -x - 20, y + h + 14);
  g.fillTriangle(-x + 40, y + h + 14, -x - 20, y + h + 14, -x + 14, y + h / 2 + 14);
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(x + 2, y + 8, w, h, 10);
  g.fillStyle(C.brass, 1);
  g.fillRoundedRect(x, y, w, h, 10);
  g.fillStyle(C.wine, 1);
  g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);
  const label_ = txt(scene, 0, -2, label, size, C.paperLight, { head: true });
  return scene.add.container(cx, cy, [g, label_]);
}

export type ButtonStyle = 'primary' | 'paper' | 'dark';

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): Button;
  setLabel(s: string): Button;
}

/** Крупная скруглённая кнопка. (x, y) — центр. */
export function makeButton(scene: Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, style: ButtonStyle = 'paper', size?: number): Button {
  const g = scene.add.graphics();
  const r = Math.min(h / 2, 46);
  const fill = style === 'primary' ? C.wine : style === 'dark' ? C.nightSoft : C.paper;
  const textColor = style === 'paper' ? C.wine : C.paperLight;
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 9, w, h, r);
  g.fillStyle(C.brassDark, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(C.brass, 1);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r - 1);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, Math.max(4, r - 7));
  g.fillStyle(0xffffff, style === 'paper' ? 0.25 : 0.1);
  g.fillRoundedRect(-w / 2 + 14, -h / 2 + 12, w - 28, h * 0.32, Math.max(4, r - 14));
  const text = txt(scene, 0, -3, label, size ?? Math.round(h * 0.42), textColor, { head: true });
  const fit = () => text.setScale(Math.min(1, (w - 60) / Math.max(1, text.width / text.scaleX)));
  fit();
  const c = scene.add.container(x, y, [g, text]) as Button;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  let armed = false;
  let enabled = true;
  c.on('pointerdown', () => {
    if (!enabled) return;
    armed = true;
    c.setScale(0.96);
  });
  c.on('pointerout', () => {
    armed = false;
    c.setScale(1);
  });
  c.on('pointerup', () => {
    c.setScale(1);
    if (!armed || !enabled) return;
    armed = false;
    sfx.click();
    onClick();
  });
  c.setEnabled = (on: boolean) => {
    enabled = on;
    c.setAlpha(on ? 1 : 0.45);
    return c;
  };
  c.setLabel = (s: string) => {
    text.setScale(1).setText(s);
    fit();
    return c;
  };
  return c;
}

/** Круглая кнопка со значком (значок рисует функция draw). */
export function roundButton(scene: Scene, x: number, y: number, radius: number, draw: (g: G) => void, onClick: () => void, fill: number = C.wood): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.4);
  shadow.fillCircle(2, 8, radius);
  const parts: Phaser.GameObjects.GameObject[] = [shadow];
  if (scene.textures.exists('button_round')) {
    // кожаная кнопка с латунным ободком (картинка), значок рисует код
    parts.push(scene.add.image(0, 0, 'button_round').setDisplaySize(radius * 2 + 6, radius * 2 + 6));
  } else {
    shadow.fillStyle(C.brassDark, 1);
    shadow.fillCircle(0, 0, radius);
    shadow.fillStyle(C.brass, 1);
    shadow.fillCircle(0, 0, radius - 2);
    shadow.fillStyle(fill, 1);
    shadow.fillCircle(0, 0, radius - 8);
  }
  draw(g);
  parts.push(g);
  const c = scene.add.container(x, y, parts);
  c.setSize(radius * 2 + 16, radius * 2 + 16);
  c.setInteractive({ useHandCursor: true });
  let armed = false;
  c.on('pointerdown', () => {
    armed = true;
    c.setScale(0.94);
  });
  c.on('pointerout', () => {
    armed = false;
    c.setScale(1);
  });
  c.on('pointerup', () => {
    c.setScale(1);
    if (!armed) return;
    armed = false;
    sfx.click();
    onClick();
  });
  return c;
}

/** Значок «домик» для кнопки «в меню». */
export function drawHome(g: G): void {
  g.fillStyle(C.paperLight, 1);
  g.fillTriangle(-30, -2, 0, -32, 30, -2);
  g.fillRect(-21, -4, 42, 30);
  g.fillStyle(C.wood, 1);
  g.fillRect(-7, 6, 14, 20);
}

/** Значок «стрелка назад». */
export function drawBack(g: G): void {
  g.lineStyle(9, C.paperLight, 1);
  g.beginPath();
  g.moveTo(10, -24);
  g.lineTo(-14, 0);
  g.lineTo(10, 24);
  g.strokePath();
}

export function starPoints(cx: number, cy: number, R: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? R : R * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

export function drawStar(g: G, cx: number, cy: number, R: number, on = true): void {
  g.fillStyle(on ? C.brassDark : 0x000000, on ? 1 : 0.35);
  g.fillPoints(starPoints(cx, cy + 3, R + 4), true);
  g.fillStyle(on ? C.gold : 0x5a5a5a, on ? 1 : 0.6);
  g.fillPoints(starPoints(cx, cy, R), true);
  if (on) {
    g.fillStyle(0xffffff, 0.35);
    g.fillPoints(starPoints(cx - R * 0.08, cy - R * 0.1, R * 0.5), true);
  }
}

/** Ряд звёзд; средняя чуть выше, как на референсе. */
export function starsRow(scene: Scene, cx: number, cy: number, n: number, R = 46, of = 3): Phaser.GameObjects.Container {
  const c = scene.add.container(cx, cy);
  for (let i = 0; i < of; i++) {
    const g = scene.add.graphics();
    const mid = (of - 1) / 2;
    drawStar(g, 0, 0, i === Math.round(mid) ? R * 1.2 : R, i < n);
    g.setPosition((i - mid) * R * 2.7, -(1 - Math.abs(i - mid) / Math.max(1, mid)) * R * 0.5);
    c.add(g);
    if (i < n) {
      g.setScale(0);
      scene.tweens.add({ targets: g, scale: 1, duration: 380, delay: 250 + i * 220, ease: 'Back.easeOut' });
    }
  }
  return c;
}

/** Область с прокруткой: длинный текст и списки. */
export class ScrollArea {
  readonly content: Phaser.GameObjects.Container;
  private scene: Scene;
  private height = 0;
  private scroll = 0;
  private thumb: G;
  private more: G;
  private dragging = false;
  private startY = 0;
  private startScroll = 0;
  /** последний жест был прокруткой, а не нажатием */
  moved = false;
  private dead = false;

  setDepth(d: number): this {
    this.content.setDepth(d);
    this.thumb.setDepth(d);
    this.more.setDepth(d);
    return this;
  }

  destroy(): void {
    this.dead = true;
    this.scene.tweens.killTweensOf(this.more);
    this.content.destroy();
    this.thumb.destroy();
    this.more.destroy();
  }

  constructor(scene: Scene, private x: number, private y: number, private w: number, private h: number, private thumbColor: number = C.brassDark) {
    this.scene = scene;
    this.content = scene.add.container(x, y);
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(x, y, w, h);
    this.content.setMask(maskShape.createGeometryMask());
    this.thumb = scene.add.graphics();
    this.more = scene.add.graphics();
    this.more.fillStyle(thumbColor, 0.9);
    this.more.fillTriangle(-22, -10, 22, -10, 0, 14);
    this.more.setPosition(x + w / 2, y + h + 4);
    scene.tweens.add({ targets: this.more, y: y + h + 16, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dead) return;
      this.moved = false;
      if (!this.contains(p)) return;
      this.dragging = true;
      this.startY = p.y;
      this.startScroll = this.scroll;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dead || !this.dragging || !p.isDown) return;
      const dy = p.y - this.startY;
      if (Math.abs(dy) > 14) this.moved = true;
      if (this.moved) this.setScroll(this.startScroll - dy);
    });
    scene.input.on('pointerup', () => (this.dragging = false));
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.dead && this.contains(p)) this.setScroll(this.scroll + dy);
    });
  }

  contains(p: { x: number; y: number }): boolean {
    return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
  }

  /** Добавляет объект под предыдущими. Объект должен иметь origin (0, 0) или быть контейнером. */
  add<T extends Phaser.GameObjects.GameObject & { y: number }>(obj: T, height: number, gap = 0): T {
    obj.y += this.height;
    this.content.add(obj);
    this.height += height + gap;
    this.update();
    return obj;
  }

  addSpace(px: number): void {
    this.height += px;
    this.update();
  }

  /** Абзацы текста. */
  addParagraphs(paras: string[], size = 46, color: number = C.ink, gap = 30): void {
    for (const p of paras) {
      const text = txt(this.scene, 0, 0, p, size, color, { wrap: this.w - 28, align: 'left', ox: 0, oy: 0, spacing: Math.round(size * 0.34) });
      this.add(text, text.height, gap);
    }
  }

  get contentHeight(): number {
    return this.height;
  }

  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, Math.max(0, this.height - this.h));
    this.update();
  }

  private update(): void {
    this.content.y = this.y - this.scroll;
    const max = this.height - this.h;
    this.thumb.clear();
    this.more.setVisible(max > 4 && this.scroll < max - 4);
    if (max <= 4) return;
    const th = Math.max(60, (this.h * this.h) / this.height);
    const ty = this.y + ((this.h - th) * this.scroll) / max;
    this.thumb.fillStyle(this.thumbColor, 0.25);
    this.thumb.fillRoundedRect(this.x + this.w - 8, this.y, 8, this.h, 4);
    this.thumb.fillStyle(this.thumbColor, 0.85);
    this.thumb.fillRoundedRect(this.x + this.w - 8, ty, 8, th, 4);
  }
}

let openDialogs = 0;
export const dialogsOpen = (): number => openDialogs;
export const dialogOpened = (): void => void openDialogs++;
export const dialogClosed = (): void => void (openDialogs = Math.max(0, openDialogs - 1));

export interface DialogButton {
  label: string;
  style?: ButtonStyle;
  onClick: () => void;
  keepOpen?: boolean;
}

/** Окно поверх экрана. Возвращает функцию, которая его закрывает. */
export function showDialog(scene: Scene, title: string, text: string, buttons: DialogButton[], extra?: (c: Phaser.GameObjects.Container, y: number) => number): () => void {
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a1014, 0.72).setInteractive();
  const c = scene.add.container(0, 0);
  openDialogs++;
  scene.events.once('shutdown', () => (openDialogs = 0));
  const pw = 900;
  const body = text ? txt(scene, W / 2, 0, text, 44, C.ink, { wrap: pw - 140 }) : null;
  let ph = 130 + 90 + (body ? body.height + 40 : 0) + buttons.length * 150 + 30;
  const extraH = extra ? 160 : 0;
  ph += extraH;
  const py = Math.round((H - ph) / 2);
  const g = scene.add.graphics();
  drawPanel(g, (W - pw) / 2, py, pw, ph, 36);
  c.add(g);
  let y = py + 110;
  c.add(txt(scene, W / 2, y, title, 62, C.wine, { head: true, wrap: pw - 120 }));
  y += 80;
  if (extra) y = extra(c, y + 70) + 20;
  if (body) {
    body.setY(y + body.height / 2 + 10);
    c.add(body);
    y += body.height + 50;
  }
  const close = () => {
    dialogClosed();
    shade.destroy();
    c.destroy();
  };
  y += 60;
  for (const b of buttons) {
    c.add(
      makeButton(scene, W / 2, y, pw - 160, 124, b.label, () => {
        if (!b.keepOpen) close();
        b.onClick();
      }, b.style ?? 'paper', 50),
    );
    y += 150;
  }
  shade.setDepth(900);
  c.setDepth(901);
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 180 });
  return close;
}

/** Короткое сообщение внизу экрана. */
export function toast(scene: Scene, message: string): void {
  const t = txt(scene, W / 2, H - 330, message, 44, C.paperLight, { head: true });
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1014, 0.85);
  bg.fillRoundedRect(W / 2 - t.width / 2 - 40, H - 330 - 50, t.width + 80, 100, 50);
  bg.setDepth(950);
  t.setDepth(951);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1500, duration: 400, onComplete: () => (t.destroy(), bg.destroy()) });
}

/** Плавное появление экрана. */
export function fadeIn(scene: Scene): void {
  scene.cameras.main.fadeIn(220, 12, 20, 26);
}
