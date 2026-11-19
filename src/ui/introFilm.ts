import Phaser from 'phaser';
import { t } from '../services/i18n';

const films = import.meta.glob('../../assets/video/*.mp4', {
  eager: true, query: '?url&no-inline', import: 'default',
}) as Record<string, string>;

const panels = import.meta.glob('../../assets/art/comic_*.webp', {
  eager: true, query: '?url&no-inline', import: 'default',
}) as Record<string, string>;

export function introFilmUrl(file: string): string | undefined {
  return films[`../../assets/video/${file}`];
}

function mountIntro(scene: Phaser.Scene, content: HTMLElement, finish: () => void) {
  const wrapper = document.createElement('section');
  wrapper.className = 'intro-film';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = t('intro.skip');
  wrapper.append(content, skip);
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
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    leaving = true;
    observer.disconnect();
    window.removeEventListener('resize', position);
    wrapper.remove();
  });
  return leave;
}

export function playIntroFilm(scene: Phaser.Scene, url: string, finish: () => void, fallback: () => void): void {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const leave = mountIntro(scene, video, finish);
  video.addEventListener('ended', () => leave(finish));
  video.addEventListener('error', () => leave(fallback));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  video.src = url;
  void video.play().catch(() => leave(fallback));
}

export function playIntroComic(scene: Phaser.Scene, story: { image: string; line: string }[], finish: () => void, fallback: () => void): void {
  const strip = document.createElement('div');
  strip.className = 'comic-strip';
  const leave = mountIntro(scene, strip, finish);
  const shots = story.map(({ image, line }) => {
    const picture = new Image();
    picture.alt = '';
    picture.src = panels[`../../assets/art/${image}.webp`];
    const caption = document.createElement('p');
    caption.textContent = line;
    const shot = document.createElement('div');
    shot.className = 'comic-shot';
    shot.dataset.image = image;
    shot.append(picture, caption);
    const duration = 2600 + line.split(/\s+/).length * 235;
    shot.style.setProperty('--duration', duration + 'ms');
    return { picture, shot, duration };
  });
  let running = true;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { running = false; });
  const show = (index: number) => {
    const next = shots[index];
    if (!next) return leave(finish);
    strip.append(next.shot);
    const previous = shots[index - 1]?.shot;
    if (previous) scene.time.delayedCall(520, () => previous.remove());
    scene.time.delayedCall(next.duration, () => show(index + 1));
  };
  void Promise.all(shots.map(({ picture }) => picture.decode()))
    .then(() => { if (running) show(0); }, () => leave(fallback));
}
