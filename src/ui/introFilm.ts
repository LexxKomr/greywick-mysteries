import Phaser from 'phaser';
import { t } from '../services/i18n';

const films = import.meta.glob('../../assets/video/*.mp4', {
  eager: true, query: '?url&no-inline', import: 'default',
}) as Record<string, string>;

export function introFilmUrl(file: string): string | undefined {
  return films[`../../assets/video/${file}`];
}

export function playIntroFilm(scene: Phaser.Scene, url: string, finish: () => void, fallback: () => void): void {
  const wrapper = document.createElement('section');
  wrapper.className = 'intro-film';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = t('intro.skip');
  wrapper.append(video, skip);
  document.body.append(wrapper);

  const canvas = scene.game.canvas;
  const position = () => {
    const bounds = canvas.getBoundingClientRect();
    wrapper.style.left = `${bounds.left}px`;
    wrapper.style.top = `${bounds.top}px`;
    wrapper.style.width = `${bounds.width}px`;
    wrapper.style.height = `${bounds.height}px`;
  };
  const observer = new ResizeObserver(position);
  observer.observe(canvas);
  window.addEventListener('resize', position);
  position();

  let leaving = false;
  const leave = (action: () => void) => {
    if (leaving) return;
    leaving = true;
    action();
  };
  skip.addEventListener('click', () => leave(finish));
  video.addEventListener('ended', () => leave(finish));
  video.addEventListener('error', () => leave(fallback));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    leaving = true;
    observer.disconnect();
    window.removeEventListener('resize', position);
    video.pause();
    video.removeAttribute('src');
    video.load();
    wrapper.remove();
  });
  video.src = url;
  void video.play().catch(() => leave(fallback));
}
