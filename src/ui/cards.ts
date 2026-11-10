// Карты рисуются кодом: кремовая лицевая сторона с крупными индексами,
// бордово-золотая рубашка с маяком.

import Phaser from 'phaser';
import { FONT_HEAD } from '../config';
import { Card } from '../logic/tripeaks';
import { t } from '../services/i18n';

/** Размер карты на столе (в игровых пикселях). Текстуры рисуются в 1,5 раза крупнее для чёткости. */
export const CARD_W = 104;
export const CARD_H = 156;
const S = 1.5;
const TW = CARD_W * S;
const TH = CARD_H * S;
export const CARD_TEX_SCALE = 1 / S;

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

function paintFaceBase(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, TH);
  grad.addColorStop(0, '#fdf6e4');
  grad.addColorStop(1, '#eedfbd');
  roundRect(ctx, 1.5, 1.5, TW - 3, TH - 3, 16);
  ctx.fillStyle = grad;
  ctx.fill();
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
  const make = (key: string, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, TW, TH)!;
    paint(tex.getContext());
    tex.refresh();
  };
  for (let rank = 1; rank <= 13; rank++) {
    for (let suit = 0; suit < 4; suit++) {
      make(`card_${rank}_${suit}`, (ctx) => paintFace(ctx, suit, labels[rank - 1]));
    }
  }
  make('card_back', paintBack);
  make('card_joker', (ctx) => paintJoker(ctx, t('joker')));
}

/** Фон игрового стола: зелёное сукно, освещённое лампой. */
export function createTableTexture(scene: Phaser.Scene): void {
  const w = 540;
  const h = 1170;
  const tex = scene.textures.createCanvas('bg_table', w, h)!;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(w / 2, h * 0.36, 40, w / 2, h * 0.42, h * 0.72);
  grad.addColorStop(0, '#3c7a5f');
  grad.addColorStop(0.45, '#245443');
  grad.addColorStop(1, '#0d2420');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // зерно сукна
  const img = ctx.getImageData(0, 0, w, h);
  let seed = 12345;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 24) / 255 - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}
