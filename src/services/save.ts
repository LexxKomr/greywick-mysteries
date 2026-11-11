// Сохранения. Вся игра обращается только к этому модулю: позже хранилище
// браузера (localStorage) заменится облаком Яндекса заменой одного объекта backend.

export interface CaseProgress {
  introSeen: boolean;
  /** звёзды за каждую партию; 0 = партия ещё не выиграна */
  stars: number[];
  /** кого игрок назвал виновным; null = выбор ещё не сделан */
  accused: string | null;
}

export interface SaveData {
  v: 1;
  sound: boolean;
  lang: 'ru' | 'en';
  cases: Record<string, CaseProgress>;
  /** сколько партий выиграно всего (для показа рекламы после каждой второй) */
  wins: number;
  /** пора показать межстраничную рекламу при следующем переходе */
  adDue: boolean;
  daily: { date: number; stars: number } | null;
  /** пасьянсы, с которыми Эдит уже познакомила игрока */
  seen: string[];
}

interface Backend {
  read(): string | null;
  write(value: string): void;
}

const KEY = 'greywick-save-v1';

const localBackend: Backend = {
  read() {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* хранилище недоступно (приватный режим) — играем без сохранения */
    }
  },
};

let backend: Backend = localBackend;

function fresh(): SaveData {
  return { v: 1, sound: true, lang: 'ru', cases: {}, wins: 0, adDue: false, daily: null, seen: [] };
}

class Save {
  data: SaveData = fresh();

  load(): void {
    this.data = fresh();
    const raw = backend.read();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) this.data = { ...fresh(), ...parsed };
    } catch {
      /* испорченное сохранение — начинаем заново */
    }
  }

  persist(): void {
    backend.write(JSON.stringify(this.data));
  }

  setBackend(b: Backend): void {
    backend = b;
  }

  progress(caseId: string, total: number): CaseProgress {
    let p = this.data.cases[caseId];
    if (!p) {
      p = { introSeen: false, stars: [], accused: null };
      this.data.cases[caseId] = p;
    }
    while (p.stars.length < total) p.stars.push(0);
    return p;
  }

  found(caseId: string, total: number): number {
    return this.progress(caseId, total).stars.filter((s) => s > 0).length;
  }

  /** Первая невыигранная партия (1…total) или 0, если все улики найдены. */
  nextLevel(caseId: string, total: number): number {
    const i = this.progress(caseId, total).stars.findIndex((s) => s === 0);
    return i < 0 ? 0 : i + 1;
  }

  totalStars(caseId: string, total: number): number {
    return this.progress(caseId, total).stars.reduce((a, b) => a + b, 0);
  }

  markIntroSeen(caseId: string, total: number): void {
    this.progress(caseId, total).introSeen = true;
    this.persist();
  }

  /** Партия дела выиграна: улика найдена. */
  winLevel(caseId: string, level: number, stars: number, total: number): void {
    const p = this.progress(caseId, total);
    p.stars[level - 1] = Math.max(p.stars[level - 1], stars);
    this.countWin();
    // перед выбором виновного и развязкой рекламы не бывает
    if (this.nextLevel(caseId, total) === 0) this.data.adDue = false;
    this.persist();
  }

  winDaily(date: number, stars: number): void {
    this.data.daily = { date, stars: Math.max(stars, this.data.daily?.date === date ? this.data.daily.stars : 0) };
    this.countWin();
    this.persist();
  }

  private countWin(): void {
    this.data.wins++;
    if (this.data.wins % 2 === 0) this.data.adDue = true;
  }

  accuse(caseId: string, suspectId: string, total: number): void {
    this.progress(caseId, total).accused = suspectId;
    this.data.adDue = false;
    this.persist();
  }

  markSeen(kind: string): void {
    if (!this.data.seen.includes(kind)) this.data.seen.push(kind);
    this.persist();
  }

  reset(): void {
    const { sound, lang } = this.data;
    this.data = { ...fresh(), sound, lang };
    this.persist();
  }
}

export const save = new Save();
