// Общие размеры, цвета и шрифты.

/** Ширина игрового поля в «игровых» пикселях. Высота подстраивается под экран телефона. */
export const W = 1080;
export let H = 1920;

/** Вертикальный телефон: высота от 9:16 до 9:19,5. На компьютере — 9:16 по центру. */
export function initHeight(): void {
  const ratio = window.innerHeight / Math.max(1, window.innerWidth);
  H = Math.round(Math.min(2340, Math.max(1920, W * ratio)));
}

export const C = {
  paper: 0xf1e4c8,
  paperLight: 0xfaf2dd,
  paperDark: 0xdcc79c,
  ink: 0x3b2a20,
  inkSoft: 0x6b5443,
  wine: 0x7a1f2b,
  wineDark: 0x4f121b,
  wineLight: 0x9c3040,
  brass: 0xc9a25a,
  brassLight: 0xe8cf8f,
  brassDark: 0x8a6a2f,
  teal: 0x2f4f5a,
  night: 0x16242c,
  nightSoft: 0x24394a,
  felt: 0x1f4a3c,
  cork: 0x9a6b42,
  wood: 0x4a2f20,
  gold: 0xf2c14e,
};

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

export const FONT_HEAD = '"Playfair Display", "PT Serif", Georgia, serif';
export const FONT_BODY = '"PT Serif", Georgia, serif';

export const VERSION = '0.2';
