import { expect, it } from 'vitest';
import en from '../src/data/i18n/en.json';
import ru from '../src/data/i18n/ru.json';
import rulesEn from '../src/data/i18n/rules.en.json';
import rulesRu from '../src/data/i18n/rules.ru.json';
import case01En from '../src/data/cases/case01.en.json';
import case01Ru from '../src/data/cases/case01.ru.json';
import case02En from '../src/data/cases/case02.en.json';
import case02Ru from '../src/data/cases/case02.ru.json';

it('has an English equivalent for each interface string and ruleset', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  expect(Object.keys(rulesEn).sort()).toEqual(Object.keys(rulesRu).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(en[key].match(/\{\w+\}/g)?.sort()).toEqual(ru[key].match(/\{\w+\}/g)?.sort());
  }
});

it.each([[case01En, case01Ru], [case02En, case02Ru]])('keeps case progress portable between languages', (translated, original) => {
  expect(translated.id).toBe(original.id);
  expect(translated.levels).toEqual(original.levels);
  expect(translated.clues.map(({ image }) => image)).toEqual(original.clues.map(({ image }) => image));
  expect(translated.suspects.map(({ id, portrait }) => [id, portrait]))
    .toEqual(original.suspects.map(({ id, portrait }) => [id, portrait]));
  expect(translated.culprit).toBe(original.culprit);
  expect(translated.links.map(({ clues }) => clues)).toEqual(original.links.map(({ clues }) => clues));
  expect(translated.thoughts.map(({ after }) => after)).toEqual(original.thoughts.map(({ after }) => after));
  expect(translated.comic).toHaveLength(4);
  expect(JSON.stringify(translated)).not.toMatch(/[А-Яа-яЁё]/u);
});
