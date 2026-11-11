import Phaser from 'phaser';

// Шрифты лежат внутри игры (без загрузки из интернета). Лицензия обоих — OFL.
import '@fontsource/playfair-display/cyrillic-700.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/latin-400.css';
import '@fontsource/pt-serif/cyrillic-700.css';
import '@fontsource/pt-serif/latin-700.css';
import '@fontsource/pt-serif/cyrillic-400-italic.css';
import '@fontsource/pt-serif/latin-400-italic.css';

import { C, H, W, initHeight } from './config';
import { save } from './services/save';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { IntroScene } from './scenes/IntroScene';
import { GameScene } from './scenes/GameScene';
import { PyramidScene } from './scenes/PyramidScene';
import { ClueScene } from './scenes/ClueScene';
import { BoardScene } from './scenes/BoardScene';
import { AccuseScene } from './scenes/AccuseScene';
import { EndingScene } from './scenes/EndingScene';
import { SettingsScene } from './scenes/SettingsScene';

async function loadFonts(): Promise<void> {
  const sample = 'Тайны Грейвика AaZz 0123 №—«»';
  const fonts = ['700 40px "Playfair Display"', '400 40px "PT Serif"', '700 40px "PT Serif"', 'italic 400 40px "PT Serif"'];
  try {
    await Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f, sample))),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch {
    /* без шрифтов игра всё равно запустится на запасном шрифте */
  }
}

async function start(): Promise<void> {
  save.load();
  initHeight();
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: C.night,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    render: { antialias: true, powerPreference: 'low-power' },
    audio: { noAudio: true },
    input: { activePointers: 2 },
    // ?timer в адресе — для проверки в фоновой вкладке, где браузер не рисует кадры
    fps: { forceSetTimeOut: window.location.search.includes('timer') },
    scene: [BootScene, MenuScene, MapScene, IntroScene, GameScene, PyramidScene, ClueScene, BoardScene, AccuseScene, EndingScene, SettingsScene],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
