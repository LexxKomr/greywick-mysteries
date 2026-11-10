// Реклама и покупки. Игра вызывает рекламу ТОЛЬКО через этот модуль.
// Сейчас это заглушка: плашка на 2 секунды. Позже сюда подключится Яндекс SDK.

import { save } from './save';
import { t } from './i18n';

const STUB_MS = 2000;
let busy = false;

function showStub(text: string): Promise<void> {
  return new Promise((resolve) => {
    const box = document.getElementById('ad');
    if (!box) return resolve();
    document.getElementById('ad-text')!.textContent = text;
    document.getElementById('ad-note')!.textContent = t('ad.note');
    box.style.display = 'flex';
    window.setTimeout(() => {
      box.style.display = 'none';
      resolve();
    }, STUB_MS);
  });
}

export const ads = {
  /** Счётчики показов — чтобы проверять места показа в тестовой версии. */
  shown: { interstitial: 0, rewarded: 0 },

  /** Реклама на весь экран между партиями. */
  async showInterstitial(): Promise<void> {
    if (busy) return;
    busy = true;
    this.shown.interstitial++;
    await showStub(t('ad.interstitial'));
    busy = false;
  },

  /** Реклама за награду. true — игрок досмотрел, награду можно выдавать. */
  async showRewarded(): Promise<boolean> {
    if (busy) return false;
    busy = true;
    this.shown.rewarded++;
    await showStub(t('ad.rewarded'));
    busy = false;
    return true;
  },

  /**
   * Межстраничная реклама «после каждой второй выигранной партии».
   * Вызывается только при переходе к следующей партии или в меню:
   * никогда посреди партии, перед выбором виновного и перед развязкой.
   */
  async interstitialIfDue(): Promise<void> {
    if (!save.data.adDue) return;
    save.data.adDue = false;
    save.persist();
    await this.showInterstitial();
  },
};

/** Покупки: в v0.1 не делаем, место оставлено под Яндекс SDK. */
export const purchases = {
  available: false,
  async buy(_productId: string): Promise<boolean> {
    return false;
  },
};
