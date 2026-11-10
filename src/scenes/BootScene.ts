import Phaser from 'phaser';
import { C, H, W } from '../config';
import { createCardTextures, createTableTexture } from '../ui/cards';

// Все картинки из assets (сейчас — временные, из папки temp).
const urls = import.meta.glob('../../assets/**/*.{jpg,png,svg}', { eager: true, query: '?url&no-inline', import: 'default' }) as Record<string, string>;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(C.brassDark, 1);
      bar.fillRoundedRect(W / 2 - 304, H / 2 - 14, 608, 28, 14);
      bar.fillStyle(C.brassLight, 1);
      bar.fillRoundedRect(W / 2 - 300, H / 2 - 10, Math.max(20, 600 * p), 20, 10);
    });
    for (const path in urls) {
      const m = /([^/]+)\.(\w+)$/.exec(path)!;
      if (m[2] === 'svg') this.load.svg(m[1], urls[path], { width: 400, height: 400 });
      else this.load.image(m[1], urls[path]);
    }
  }

  create(): void {
    createCardTextures(this);
    createTableTexture(this);
    document.getElementById('loading')?.remove();
    const bg = urls[Object.keys(urls).find((k) => k.includes('bg_fog')) ?? ''];
    if (bg) document.body.style.backgroundImage = `url(${bg})`;
    this.scene.start('Menu');
  }
}
