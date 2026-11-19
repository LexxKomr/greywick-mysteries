import type Phaser from 'phaser';

const KEY = 'case_medal_halo';

/** Тёплый свет вокруг выбранного медальона, независимо от режима отрисовки. */
export function makeMapHalo(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  if (!scene.textures.exists(KEY)) {
    const texture = scene.textures.createCanvas(KEY, 256, 256)!;
    const context = texture.getContext();
    const glow = context.createRadialGradient(128, 128, 45, 128, 128, 126);
    glow.addColorStop(0, '#f7a33500');
    glow.addColorStop(0.32, '#f7a33550');
    glow.addColorStop(0.40, '#ffe8a1e8');
    glow.addColorStop(0.49, '#ffc76bc0');
    glow.addColorStop(0.67, '#e98c3845');
    glow.addColorStop(1, '#f7a33500');
    context.fillStyle = glow;
    context.fillRect(0, 0, 256, 256);
    texture.refresh();
  }
  const halo = scene.add.image(x, y, KEY).setDisplaySize(228, 228).setVisible(false);
  scene.tweens.add({ targets: halo, alpha: 0.68, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return halo;
}
