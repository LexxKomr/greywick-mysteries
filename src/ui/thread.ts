import Phaser from 'phaser';

type Point = Phaser.Math.Vector2;
type Graphics = Phaser.GameObjects.Graphics;

const point = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Плавная нить между кнопками. Между рядами она обходит полосу с записями. */
export function drawThread(g: Graphics, start: Point, end: Point, outside?: number): void {
  const bend = (a: Point, c1: Point, c2: Point, b: Point) => {
    const curve = new Phaser.Curves.CubicBezier(a, c1, c2, b);
    return curve.getSpacedPoints(Math.ceil(curve.getLength() / 3));
  };
  let points: Point[];
  if (outside === undefined) {
    const reach = (end.x - start.x) * 0.34;
    points = bend(start, point(start.x + reach, start.y + 15), point(end.x - reach, end.y + 15), end);
  } else {
    const side = Math.sign(start.x - outside);
    const upper = point(outside, start.y + 28);
    const lower = point(outside + side * 2, end.y - 29);
    points = [
      ...bend(start, point(start.x - (start.x - outside) * 0.50, start.y + 8), point(outside, start.y - 12), upper),
      ...bend(upper, point(outside, start.y + 55), point(outside + side * 5, end.y - 57), lower).slice(1),
      ...bend(lower, point(outside + side * 2, end.y + 12), point(end.x - (end.x - outside) * 0.46, end.y + 5), end).slice(1),
    ];
  }

  g.lineStyle(9, 0x341a11, 0.14);
  g.strokePoints(points.map((p) => point(p.x + 1.5, p.y + 3)));
  g.lineStyle(7, 0x351a10, 0.38);
  g.strokePoints(points.map((p) => point(p.x + 1, p.y + 1.8)));
  g.lineStyle(6, 0x84291b, 1);
  g.strokePoints(points);
  g.lineStyle(4, 0xb33423, 1);
  g.strokePoints(points);
  // Рельеф кручёной нити и редкие короткие волокна. Рисунок стабилен от кадра к кадру.
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const next = points[i + 1];
    const direction = next.clone().subtract(points[i - 1]).normalize();
    const nx = -direction.y;
    const ny = direction.x;
    g.lineStyle(0.85, i % 3 === 0 ? 0xf0714b : 0xd64b32, 0.46);
    g.lineBetween(p.x + nx * 1.1, p.y + ny * 1.1, next.x - nx * 1.7, next.y - ny * 1.7);
    if (i % 7 === 0) {
      const side = i % 2 ? 1 : -1;
      g.lineStyle(0.65, 0xc3472c, 0.54);
      g.lineBetween(p.x + nx * side * 2, p.y + ny * side * 2,
        p.x + nx * side * 4 + direction.x * 1.7, p.y + ny * side * 4 + direction.y * 1.7);
    }
  }
}
