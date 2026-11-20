import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseLanguage, detectLanguage, signalPlatformReady } from '../src/services/platformLanguage';
import { save, type SaveData } from '../src/services/save';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('startup language', () => {
  it.each([
    ['en', 'ru-RU', 'en'],
    ['ru', 'en-GB', 'ru'],
    ['tr', 'ru-RU', 'en'],
    [undefined, 'RU-ru', 'ru'],
    [undefined, 'de-DE', 'en'],
    [undefined, undefined, 'ru'],
  ])('prefers platform language %s over browser language %s', (platform, browser, expected) => {
    expect(chooseLanguage(platform, browser)).toBe(expected);
  });

  it('reads the Yandex SDK before startup and notifies it when the menu is ready', async () => {
    vi.stubEnv('MODE', 'yandex');
    const ready = vi.fn();
    const init = vi.fn().mockResolvedValue({ environment: { i18n: { lang: 'en' } }, features: { LoadingAPI: { ready } } });
    vi.stubGlobal('window', { YaGames: { init } });
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    expect(await detectLanguage()).toBe('en');
    expect(init).toHaveBeenCalledOnce();
    expect(ready).not.toHaveBeenCalled();
    signalPlatformReady();
    signalPlatformReady();
    expect(ready).toHaveBeenCalledOnce();
  });

  it('falls back to the browser when SDK initialization fails', async () => {
    vi.stubEnv('MODE', 'yandex');
    vi.stubGlobal('window', { YaGames: { init: () => Promise.reject(new Error('unavailable')) } });
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    expect(await detectLanguage()).toBe('ru');
  });

  it('accepts the GamePush language from the SDK callback when configured', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_GAMEPUSH_PROJECT_ID', 'test-id');
    vi.stubEnv('VITE_GAMEPUSH_PUBLIC_TOKEN', 'test-token');
    const host: { onGPInit?: (sdk: { language: string }) => void } = {};
    vi.stubGlobal('window', host);
    vi.stubGlobal('document', { createElement: () => ({}), head: { append: () => host.onGPInit?.({ language: 'ru' }) } });
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(await detectLanguage()).toBe('ru');
  });
});

describe('saved language', () => {
  const openSave = (data: Partial<SaveData>) => {
    let raw = JSON.stringify({ v: 1, ...data });
    save.setBackend({ read: () => raw, write: (value) => { raw = value; } });
    save.load('en');
  };

  it('updates older default Russian saves while preserving their progress', () => {
    openSave({ lang: 'ru', wins: 5 });
    expect(save.data.lang).toBe('en');
    expect(save.data.wins).toBe(5);
  });

  it('preserves the manual Russian choice through resets', () => {
    openSave({ lang: 'ru', langManual: true });
    expect(save.data.lang).toBe('ru');
    save.reset();
    save.load('en');
    expect(save.data.lang).toBe('ru');
  });

  it('uses current platform language when a saved language was detected automatically', () => {
    openSave({ lang: 'en', langManual: false });
    save.load('ru');
    expect(save.data.lang).toBe('ru');
  });
});
