export type Language = 'ru' | 'en';

interface YandexSdk {
  environment: { i18n: { lang: string } };
  features?: { LoadingAPI?: { ready(): void } };
}

type PlatformWindow = Window & {
  YaGames?: { init(): Promise<YandexSdk> };
  onGPInit?: (sdk: { language: string }) => void;
};

let yandex: YandexSdk | undefined;

export function chooseLanguage(platform: string | undefined, browser: string | undefined): Language {
  const code = (platform || browser || 'ru').trim().split(/[-_]/)[0].toLowerCase();
  return code === 'ru' ? 'ru' : 'en';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Platform SDK unavailable'));
    document.head.append(script);
  });
}

async function getPlatformLanguage(host: PlatformWindow): Promise<string | undefined> {
  if (import.meta.env.MODE === 'yandex') {
    if (!host.YaGames) await loadScript('/sdk.js');
    yandex = await host.YaGames?.init();
    return yandex?.environment.i18n.lang;
  }

  const projectId = import.meta.env.VITE_GAMEPUSH_PROJECT_ID;
  const publicToken = import.meta.env.VITE_GAMEPUSH_PUBLIC_TOKEN;
  if (!projectId || !publicToken) return;
  return new Promise((resolve, reject) => {
    host.onGPInit = (sdk) => resolve(sdk.language);
    const url = new URL('https://s3.gamepush.com/files/gs/sdk/game-score.js');
    url.search = new URLSearchParams({ projectId, publicToken, callback: 'onGPInit' }).toString();
    void loadScript(url.href).catch(reject);
  });
}

export async function detectLanguage(): Promise<Language> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const detected = await Promise.race([
      getPlatformLanguage(window),
      new Promise<undefined>((resolve) => { timer = setTimeout(resolve, 5000); }),
    ]);
    return chooseLanguage(detected, navigator.language);
  } catch {
    return chooseLanguage(undefined, navigator.language);
  } finally {
    clearTimeout(timer);
  }
}

export function signalPlatformReady(): void {
  yandex?.features?.LoadingAPI?.ready();
  yandex = undefined;
}
