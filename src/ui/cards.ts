// Карты рисуются кодом: кремовая лицевая сторона с крупными индексами,
// бордово-золотая рубашка с маяком.

import Phaser from 'phaser';
import { FONT_HEAD } from '../config';
import { Card } from '../logic/tripeaks';
import { t } from '../services/i18n';

/** Размер карты на столе (в игровых пикселях). Текстуры рисуются в 1,5 раза крупнее для чёткости. */
export const CARD_W = 104;
/** Перспектива стола: карта лежит в плоскости стола, поэтому видна короче по высоте (SQ)
 *  и чуть уже у дальнего края (KEY — ширина верха к ширине низа). */
export const SQ = 0.88;
export const KEY = 0.93;
const FLAT_H = 156;
/** Видимая высота карты на столе (уже с учётом перспективы). */
export const CARD_H = Math.round(FLAT_H * SQ);
const S = 1.5;
const TW = CARD_W * S;
const TH = FLAT_H * S;
export const CARD_TEX_SCALE = 1 / S;
/** Поле вокруг карты в текстуре: там лежит мягкая тень (вниз-вправо). */
const PAD = 24;

/** Нажимается только сама карта, без поля под тень. */
export function cardInteractive(img: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
  return img.setInteractive({ hitArea: new Phaser.Geom.Rectangle(PAD, PAD * SQ, TW, TH * SQ), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
}

/** Угол «как бросили на стол»: ±1,5°, всегда одинаковый для одного числа (без дрожания). */
export function tableAngle(n: number): number {
  const h = Math.imul(n + 0x9e37, 0x85ebca6b) >>> 0;
  return ((h % 1000) / 1000) * 3 - 1.5;
}

const RED = '#a3202a';
const BLACK = '#2a221d';

export function cardKey(c: Card): string {
  return c.rank === 0 ? 'card_joker' : `card_${c.rank}_${c.suit}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Масти рисуются линиями, чтобы на всех телефонах выглядели одинаково. */
export function drawSuit(ctx: CanvasRenderingContext2D, suit: number, cx: number, cy: number, s: number): void {
  ctx.fillStyle = suit === 1 || suit === 2 ? RED : BLACK;
  ctx.beginPath();
  if (suit === 1) {
    ctx.moveTo(cx, cy + 0.46 * s);
    ctx.bezierCurveTo(cx - 0.78 * s, cy - 0.05 * s, cx - 0.42 * s, cy - 0.64 * s, cx, cy - 0.22 * s);
    ctx.bezierCurveTo(cx + 0.42 * s, cy - 0.64 * s, cx + 0.78 * s, cy - 0.05 * s, cx, cy + 0.46 * s);
  } else if (suit === 2) {
    ctx.moveTo(cx, cy - 0.52 * s);
    ctx.lineTo(cx + 0.38 * s, cy);
    ctx.lineTo(cx, cy + 0.52 * s);
    ctx.lineTo(cx - 0.38 * s, cy);
  } else if (suit === 0) {
    ctx.moveTo(cx, cy - 0.5 * s);
    ctx.bezierCurveTo(cx - 0.78 * s, cy + 0.02 * s, cx - 0.42 * s, cy + 0.56 * s, cx, cy + 0.16 * s);
    ctx.bezierCurveTo(cx + 0.42 * s, cy + 0.56 * s, cx + 0.78 * s, cy + 0.02 * s, cx, cy - 0.5 * s);
    ctx.moveTo(cx, cy + 0.08 * s);
    ctx.lineTo(cx + 0.2 * s, cy + 0.52 * s);
    ctx.lineTo(cx - 0.2 * s, cy + 0.52 * s);
  } else {
    ctx.arc(cx, cy - 0.25 * s, 0.22 * s, 0, Math.PI * 2);
    ctx.moveTo(cx - 0.02 * s, cy + 0.1 * s);
    ctx.arc(cx - 0.24 * s, cy + 0.1 * s, 0.22 * s, 0, Math.PI * 2);
    ctx.moveTo(cx + 0.46 * s, cy + 0.1 * s);
    ctx.arc(cx + 0.24 * s, cy + 0.1 * s, 0.22 * s, 0, Math.PI * 2);
    ctx.moveTo(cx + 0.12 * s, cy);
    ctx.arc(cx, cy, 0.12 * s, 0, Math.PI * 2);
    ctx.moveTo(cx, cy + 0.08 * s);
    ctx.lineTo(cx + 0.2 * s, cy + 0.52 * s);
    ctx.lineTo(cx - 0.2 * s, cy + 0.52 * s);
  }
  ctx.closePath();
  ctx.fill();
}

let paperImg: CanvasImageSource | null = null;
let backImg: CanvasImageSource | null = null;

function paintFaceBase(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, 1.5, 1.5, TW - 3, TH - 3, 16);
  if (paperImg) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(paperImg, 0, 0, TW, TH);
    // чуть теплее, как под лампой
    ctx.fillStyle = 'rgba(255,165,80,0.05)';
    ctx.fillRect(0, 0, TW, TH);
    ctx.restore();
    roundRect(ctx, 1.5, 1.5, TW - 3, TH - 3, 16);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, TH);
    grad.addColorStop(0, '#fdf6e4');
    grad.addColorStop(1, '#eedfbd');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a58d63';
  ctx.stroke();
}

function paintFace(ctx: CanvasRenderingContext2D, suit: number, label: string): void {
  paintFaceBase(ctx);
  const color = suit === 1 || suit === 2 ? RED : BLACK;
  // крупный индекс слева вверху
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 100px ${FONT_HEAD}`;
  const maxW = TW * 0.6;
  const w = ctx.measureText(label).width;
  ctx.save();
  ctx.translate(11, 88);
  if (w > maxW) ctx.scale(maxW / w, 1);
  ctx.fillText(label, 0, 0);
  ctx.restore();
  // масть справа вверху и крупная масть внизу
  drawSuit(ctx, suit, TW - 32, 46, 46);
  drawSuit(ctx, suit, TW / 2, TH * 0.69, 104);
}

function paintBack(ctx: CanvasRenderingContext2D): void {
  if (backImg) {
    // кремовый кант со скруглёнными углами, внутри — рисунок рубашки
    roundRect(ctx, 1.5, 1.5, TW - 3, TH - 3, 16);
    ctx.fillStyle = '#efe6d0';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#8f7a55';
    ctx.stroke();
    ctx.save();
    roundRect(ctx, 9, 9, TW - 18, TH - 18, 9);
    ctx.clip();
    ctx.drawImage(backImg, 9, 9, TW - 18, TH - 18);
    ctx.restore();
    return;
  }
  const grad = ctx.createLinearGradient(0, 0, TW, TH);
  grad.addColorStop(0, '#8a2632');
  grad.addColorStop(1, '#5a141e');
  roundRect(ctx, 1.5, 1.5, TW - 3, TH - 3, 16);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3d0d14';
  ctx.stroke();
  // золотые рамки
  ctx.strokeStyle = '#d7b46a';
  ctx.lineWidth = 3;
  roundRect(ctx, 11, 11, TW - 22, TH - 22, 10);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  roundRect(ctx, 18, 18, TW - 36, TH - 36, 7);
  ctx.stroke();
  // ромбики по углам
  ctx.fillStyle = '#d7b46a';
  for (const [x, y] of [
    [32, 32],
    [TW - 32, 32],
    [32, TH - 32],
    [TW - 32, TH - 32],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
  }
  // медальон с маяком
  const cx = TW / 2;
  const cy = TH / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fillStyle = '#4a1019';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d7b46a';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 45, 0, Math.PI * 2);
  ctx.clip();
  // лучи
  ctx.fillStyle = 'rgba(242, 208, 120, 0.35)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx - 60, cy - 44);
  ctx.lineTo(cx - 60, cy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx + 60, cy - 44);
  ctx.lineTo(cx + 60, cy - 14);
  ctx.closePath();
  ctx.fill();
  // башня
  ctx.fillStyle = '#e8cf8f';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 14);
  ctx.lineTo(cx + 8, cy - 14);
  ctx.lineTo(cx + 13, cy + 30);
  ctx.lineTo(cx - 13, cy + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 11, cy - 20, 22, 6);
  ctx.fillRect(cx - 7, cy - 32, 14, 12);
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 32);
  ctx.lineTo(cx, cy - 41);
  ctx.lineTo(cx + 9, cy - 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a141e';
  ctx.fillRect(cx - 4, cy - 29, 8, 7);
  ctx.fillRect(cx - 10, cy, 20, 5);
  ctx.fillRect(cx - 11.5, cy + 14, 23, 5);
  // скала и волна
  ctx.fillStyle = '#d7b46a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 42, 40, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintJoker(ctx: CanvasRenderingContext2D, label: string): void {
  paintFaceBase(ctx);
  ctx.fillStyle = '#b8862b';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 52 : 23;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = TW / 2 + Math.cos(a) * r;
    const y = TH * 0.4 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a1f2b';
  ctx.stroke();
  ctx.fillStyle = '#7a1f2b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${FONT_HEAD}`;
  ctx.fillText(label, TW / 2, TH * 0.82);
}

/** Создаёт текстуры всех карт. Вызывается один раз после загрузки шрифтов. */
export function createCardTextures(scene: Phaser.Scene): void {
  const labels = t('ranks').split(',');
  const src = (key: string) => (scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as CanvasImageSource) : null);
  paperImg = src('card_paper');
  backImg = src('card_back_art');
  const flat = document.createElement('canvas');
  flat.width = TW + 2 * PAD;
  flat.height = TH + 2 * PAD;
  const make = (key: string, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const ctx = flat.getContext('2d')!;
    ctx.clearRect(0, 0, flat.width, flat.height);
    // мягкая тень под картой
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 13;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, PAD + 3, PAD + 3, TW - 6, TH - 6, 16);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(PAD, PAD);
    paint(ctx);
    ctx.restore();
    // кладём карту в плоскость стола: короче по высоте, верх чуть уже низа
    const outW = flat.width;
    const outH = Math.round(flat.height * SQ);
    const tex = scene.textures.createCanvas(key, outW, outH)!;
    const out = tex.getContext();
    out.imageSmoothingQuality = 'high';
    for (let r = 0; r < outH; r++) {
      const k = KEY + (1 - KEY) * (r / (outH - 1));
      const w = outW * k;
      out.drawImage(flat, 0, (r * flat.height) / outH, outW, flat.height / outH, (outW - w) / 2, r, w, 1);
    }
    tex.refresh();
  };
  // большая тень для карты «в руке» (при переносе)
  if (scene.textures.exists('card_lift_shadow')) scene.textures.remove('card_lift_shadow');
  const lift = scene.textures.createCanvas('card_lift_shadow', TW + 4 * PAD, Math.round((TH + 4 * PAD) * SQ))!;
  const lc = lift.getContext();
  lc.shadowColor = 'rgba(0,0,0,0.5)';
  lc.shadowBlur = 30;
  lc.shadowOffsetX = 2000;
  roundRect(lc, 2 * PAD - 2000, 2 * PAD * SQ, TW, TH * SQ, 16);
  lc.fillStyle = '#000';
  lc.fill();
  lift.refresh();
  for (let rank = 1; rank <= 13; rank++) {
    for (let suit = 0; suit < 4; suit++) {
      make(`card_${rank}_${suit}`, (ctx) => paintFace(ctx, suit, labels[rank - 1]));
    }
  }
  // значки мастей для пустых «домов»
  for (let suit = 0; suit < 4; suit++) {
    const key = 'suit_' + suit;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, 120, 120)!;
    drawSuit(tex.getContext(), suit, 60, 60, 96);
    tex.refresh();
  }
  make('card_back', paintBack);
  make('card_joker', (ctx) => paintJoker(ctx, t('joker')));
}
