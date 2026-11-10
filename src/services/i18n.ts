// Тексты интерфейса по языкам. Ключа нет в выбранном языке — берётся русский.

import ru from '../data/i18n/ru.json';
import en from '../data/i18n/en.json';
import { save } from './save';

const tables: Record<string, Record<string, string>> = { ru, en: en as Record<string, string> };

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = tables[save.data.lang]?.[key] ?? tables.ru[key] ?? key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
