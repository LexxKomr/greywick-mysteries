// Дела. Каждое дело — отдельный файл src/data/cases/caseNN.<язык>.json.
// Новое дело добавляется новым файлом, код менять не нужно.

import worldRu from '../data/world.ru.json';
import { save } from './save';

export interface Clue {
  title: string;
  image: string;
  text: string[];
}

export interface Suspect {
  id: string;
  name: string;
  short: string;
  role: string;
  portrait: string;
}

export type GameKind = 'tripeaks' | 'pyramid' | 'klondike' | 'freecell';

export interface LevelSpec {
  game: GameKind;
  /** трудность внутри блока: 1…3 */
  difficulty: number;
}

export interface CaseData {
  id: string;
  number: number;
  title: string;
  place: string;
  intro: string[];
  clues: Clue[];
  accuse: string[];
  suspects: Suspect[];
  culprit: string;
  wrong: Record<string, string[]>;
  ending: string[];
  /** вид пасьянса для каждой партии (по номеру улики) */
  levels: LevelSpec[];
}

const files = import.meta.glob('../data/cases/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const byLang: Record<string, Record<string, CaseData>> = {};
for (const path in files) {
  const m = /([^/]+)\.(\w+)\.json$/.exec(path);
  const data = files[path] as Partial<CaseData>;
  if (!m || !data.id || !data.clues) continue; // заготовки с TODO пропускаем
  (byLang[m[2]] ??= {})[data.id] = data as CaseData;
}

export function getCase(id: string): CaseData {
  const c = byLang[save.data.lang]?.[id] ?? byLang.ru[id];
  if (!c) throw new Error('Нет дела ' + id);
  return c;
}

export function caseByNumber(n: number): CaseData | null {
  const found = Object.values(byLang.ru).find((c) => c.number === n);
  return found ? getCase(found.id) : null;
}

export function listCases(): CaseData[] {
  return Object.values(byLang.ru)
    .map((c) => getCase(c.id))
    .sort((a, b) => a.number - b.number);
}

export const world = worldRu;

export type CaseState = 'new' | 'playing' | 'accuse' | 'closed';

export function caseState(c: CaseData): CaseState {
  const total = c.clues.length;
  const p = save.progress(c.id, total);
  if (p.accused) return 'closed';
  const found = save.found(c.id, total);
  if (found >= total) return 'accuse';
  return found > 0 || p.introSeen ? 'playing' : 'new';
}

/** Дело, в которое игрок играет сейчас: первое незакрытое. */
export function currentCase(): CaseData | null {
  return listCases().find((c) => caseState(c) !== 'closed') ?? null;
}
