import theme from '../../assets/audio/greywick-theme.mp3?url&no-inline';
import { save } from './save';

let player: HTMLAudioElement | undefined;
let unlocked = false;

function sync(): void {
  if (!unlocked || !save.data.music || document.hidden) {
    player?.pause();
    return;
  }
  const audio = player ?? new Audio(theme);
  if (!player) {
    player = audio;
    audio.loop = true;
    audio.volume = 0.30;
  }
  if (audio.paused) void audio.play().catch(() => {});
}

export const music = {
  init(): void {
    const unlock = () => {
      unlocked = true;
      sync();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', sync);
  },
  sync,
};
