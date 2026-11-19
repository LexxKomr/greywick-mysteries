import Phaser from 'phaser';
import { C, H, W } from '../config';
import { t } from '../services/i18n';
import { ScrollArea, makeButton, panel } from './widgets';

interface ComicFrame {
  image: string;
  paragraphs: string[];
}

/** Листаем иллюстрации автоматически. Любой кадр можно дочитать на паузе. */
export function playIntroComic(scene: Phaser.Scene, frames: ComicFrame[], reviewing: boolean, finish: () => void): () => boolean {
  const left = 62;
  const top = 242;
  const width = W - left * 2;
  const artHeight = Math.min(800, Math.round(H * 0.365));
  const captionTop = top + artHeight + 38;
  const captionHeight = H - captionTop - 252;
  const controlsY = H - 100;
  let index = 0;
  let paused = false;
  let timer: Phaser.Time.TimerEvent | undefined;
  let zoom: Phaser.Tweens.Tween | undefined;
  let art: Phaser.GameObjects.Image | undefined;
  let caption: ScrollArea | undefined;

  const maskGraphics = scene.add.graphics();
  maskGraphics.fillStyle(0xffffff).fillRect(left, top, width, artHeight).setVisible(false);
  const mask = maskGraphics.createGeometryMask();
  const border = scene.add.graphics().setDepth(2);
  border.lineStyle(7, C.brass).strokeRect(left, top, width, artHeight);
  panel(scene, 40, captionTop, W - 80, captionHeight, 30);
  const dots = scene.add.graphics();

  const skip = makeButton(scene, 202, controlsY, 318, 114, t(reviewing ? 'intro.toBoard' : 'intro.skip'), finish, 'dark', 40);
  const pause = makeButton(scene, 525, controlsY, 292, 114, t('intro.pause'), () => {
    paused = !paused;
    if (timer) timer.paused = paused;
    if (paused) zoom?.pause();
    else zoom?.resume();
    pause.setLabel(t(paused ? 'intro.resume' : 'intro.pause'));
  }, 'paper', 39);
  const next = makeButton(scene, 858, controlsY, 338, 114, t('intro.nextFrame'), () => render(index + 1), 'primary', 46);
  const done = makeButton(scene, W / 2, controlsY, 698, 126, t(reviewing ? 'intro.toBoard' : 'intro.start'), finish, 'primary', 50);

  const render = (frameIndex: number) => {
    if (frameIndex < 0 || frameIndex >= frames.length) return;
    index = frameIndex;
    const frame = frames[index];
    const last = index === frames.length - 1;
    timer?.remove();
    if (art) {
      scene.tweens.killTweensOf(art);
      art.destroy();
    }
    caption?.destroy();

    const words = frame.paragraphs.join(' ').trim().split(/\s+/).length;
    const duration = Math.max(9000, 3600 + words * 320);
    art = scene.add.image(W / 2, top, frame.image).setOrigin(0.5, 0).setMask(mask).setAlpha(0);
    const scale = Math.max(width / art.width, artHeight / art.height);
    art.setScale(scale);
    scene.tweens.add({ targets: art, alpha: 1, duration: 320 });
    zoom = scene.tweens.add({ targets: art, scale: scale * 1.045, duration, ease: 'Sine.easeOut', paused });
    caption = new ScrollArea(scene, 94, captionTop + 26, W - 188, captionHeight - 52);
    caption.addParagraphs(frame.paragraphs, 37, C.ink, 15);

    dots.clear();
    frames.forEach((_, i) => {
      dots.fillStyle(i === index ? C.brassLight : C.brassDark);
      dots.fillCircle(W / 2 + (i - (frames.length - 1) / 2) * 34, H - 200, i === index ? 10 : 6);
    });
    skip.setVisible(!last);
    next.setVisible(!last);
    pause.setVisible(!last);
    done.setVisible(last);
    if (!last) {
      timer = scene.time.delayedCall(duration, () => render(index + 1));
      timer.paused = paused;
    }
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mask.destroy());
  render(0);
  return () => {
    if (index === 0) return false;
    render(index - 1);
    return true;
  };
}
