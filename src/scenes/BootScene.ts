import Phaser from 'phaser';
import { createCardTextures } from '../ui/cards';

// Все картинки из assets (сейчас — временные, из папки temp).
const urls = import.meta.glob(
  ['../../assets/**/*.{jpg,png,svg,webp}', '!../../assets/art/comic_*.webp'],
  { eager: true, query: '?url&no-inline', import: 'default' },
) as Record<string, string>;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = document.getElementById('loading');
    this.load.on('progress', (p: number) => {
      bar?.style.setProperty('--loaded', `${p * 100}%`);
    });
    for (const path in urls) {
      const m = /([^/]+)\.(\w+)$/.exec(path)!;
      if (m[2] === 'svg') this.load.svg(m[1], urls[path], { width: 400, height: 400 });
      else this.load.image(m[1], urls[path]);
    }
  }

  create(): void {
    createCardTextures(this);
    document.getElementById('loading')?.remove();
    const bg = urls[Object.keys(urls).find((k) => k.includes('bg_fog')) ?? ''];
    if (bg) document.body.style.backgroundImage = `url(${bg})`;
    this.scene.start('Menu');
  }
}
