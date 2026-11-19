// Общая «обвязка» игрового стола для всех пасьянсов: фон-место, узкая верхняя
// полоска, кожаные кнопки помощников, окна победы, поражения и выхода.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { toMenuAfterGame } from '../flow';
import { ads } from '../services/ads';
import { dailySeed } from '../logic/generator';
import { CaseData, GameKind, getCase } from '../services/cases';
import { attachThoughts, rulesFor, showIntro, showRules } from './edith';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import tablesData from '../data/tables.json';
import { ButtonGlyph, DialogButton, dialogsOpen, drawStar, roundButton, showDialog, starsRow, txt } from './widgets';

export interface LevelData {
  mode: 'case' | 'daily';
  caseId?: string;
  level?: number;
  dailyDate?: number;
}

export interface LevelCtx {
  sceneKey: string;
  /** какой пасьянс играет этот экран */
  kind: GameKind;
  data: LevelData;
  mode: 'case' | 'daily';
  caseData: CaseData | null;
  level: number;
  total: number;
  /** партия уже была выиграна раньше: играем заново ради звёзд */
  replay: boolean;
}

export function levelCtx(sceneKey: string, data: LevelData): LevelCtx {
  if (data.mode === 'daily' && data.dailyDate === undefined) data = { ...data, dailyDate: dailySeed() };
  const caseData = data.caseId ? getCase(data.caseId) : null;
  const level = data.level ?? 1;
  const total = caseData?.clues.length ?? 12;
  const kinds: Record<string, GameKind> = { Game: 'tripeaks', Pyramid: 'pyramid', Klondike: 'klondike', FreeCell: 'freecell', Golf: 'golf', Spider: 'spider' };
  return {
    sceneKey,
    kind: kinds[sceneKey] ?? 'tripeaks',
    data,
    mode: data.mode ?? 'case',
    caseData,
    level,
    total,
    replay: !!caseData && save.progress(caseData.id, total).stars[level - 1] > 0,
  };
}

export const STRIP_H = 96;

export interface TableUi {
  /** на сколько сдвинуть раскладку по высоте, чтобы она легла по центру столешницы (обычно вверх) */
  dy: number;
  /** сколько звёзд игрок получит, если выиграет сейчас */
  setStars(n: number): void;
  /** включает мысли Эдит: y — где показывать облачко, canShow — можно ли сейчас */
  thoughts(y: number, canShow: () => boolean): void;
}

interface TableZone {
  top: number;
  dim: number;
  edge: number;
}
const TABLES = tablesData as unknown as Record<string, TableZone>;

/**
 * Перспектива стола: дальние карты (выше на экране) чуть мельче и ближе к середине,
 * как на снимке стола под углом. far — верх столешницы, near — нижний край раскладки.
 */
export const persp = {
  far: 0,
  near: 1,
  depth: 0.2,
  s(y: number): number {
    const t = Math.max(0, Math.min(1, (this.near - y) / Math.max(1, this.near - this.far)));
    return 1 - this.depth * t;
  },
  x(x: number, y: number): number {
    return W / 2 + (x - W / 2) * this.s(y);
  },
};

/** Где на экране верх столешницы, если фон не увеличивать (для высоких экранов места больше). */
export function naturalTableTop(bgKey: string): number {
  const zone = TABLES[bgKey] ?? { top: 0.5 };
  return zone.top * Math.max(H, 1920);
}

/** Отступ снизу, который занимают кнопки помощников с подписями. */
export const HELPERS_Y_FROM_BOTTOM = 178;

/**
 * Фон-место: картинка прижата к низу экрана и, если раскладка не помещается на столешницу,
 * чуть увеличивается — потолок уходит за верх экрана, а стол поднимается под карты.
 * needTop — с какой высоты экрана начинаются карты. Возвращает, где на экране верх столешницы.
 */
/** Верх столешницы на экране — не ниже этой доли высоты. */
const TABLE_TOP_MAX = 0.4;

function placeBackground(scene: Phaser.Scene, bgKey: string, needTop: number): number {
  const zone = TABLES[bgKey] ?? { top: 0.5, dim: 0, edge: 0.4 };
  const bg = scene.add.image(W / 2, H, bgKey).setOrigin(0.5, 1);
  const base = Math.max(W / bg.width, H / bg.height);
  const needH = (H - (needTop - 12)) / (1 - zone.top);
  // стол занимает больше экрана: его верх не ниже TABLE_TOP_MAX высоты, карты ближе к середине
  const wantH = (H * (1 - TABLE_TOP_MAX)) / (1 - zone.top);
  const zoom = Math.max(1, needH / (bg.height * base), wantH / (bg.height * base));
  bg.setScale(base * zoom);
  const shownH = bg.height * base * zoom;
  const tableTop = H - (1 - zone.top) * shownH;
  persp.far = tableTop;
  persp.near = H - 300;

  // свет лампы: края стола темнее, середина чуть теплее (под картами, на читаемость не влияет)
  const key = 'table_light_' + scene.scene.key;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, H)!;
  const c = tex.getContext();
  const cy = tableTop + (H - tableTop) * 0.38;
  if (zone.dim > 0) {
    const lin = c.createLinearGradient(0, tableTop - 120, 0, tableTop + 80);
    lin.addColorStop(0, 'rgba(10,16,20,0)');
    lin.addColorStop(1, `rgba(10,16,20,${zone.dim})`);
    c.fillStyle = lin;
    c.fillRect(0, tableTop - 120, W, H - tableTop + 120);
  }
  const rad = c.createRadialGradient(W / 2, cy, 60, W / 2, cy, Math.max(W, H - tableTop) * 0.95);
  rad.addColorStop(0, 'rgba(255,190,110,0.10)');
  rad.addColorStop(0.45, 'rgba(40,24,10,0)');
  rad.addColorStop(1, `rgba(6,4,2,${zone.edge})`);
  c.fillStyle = rad;
  c.fillRect(0, tableTop - 160, W, H - tableTop + 160);
  // мягкий переход от стены к столу, чтобы затемнение не обрывалось линией
  const fade = c.createLinearGradient(0, tableTop - 160, 0, tableTop);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = fade;
  c.fillRect(0, tableTop - 160, W, 160);
  c.globalCompositeOperation = 'source-over';
  tex.refresh();
  scene.add.image(0, 0, key).setOrigin(0, 0);
  return tableTop;
}

/** Фон стола и узкая верхняя полоска: дело, «Улика N из 12», звёзды. needTop — верх раскладки. */
export function buildTable(scene: Phaser.Scene, bgKey: string, ctx: LevelCtx, onHome: () => void, needTop: number, needBottom: number): TableUi {
  const table = ctx.caseData?.tables?.[Math.floor((ctx.level - 1) / 3)] ?? bgKey;
  const tableTop = placeBackground(scene, table, needTop);
  // раскладка посчитана от кнопок снизу; поднимаем её к дальнему краю стола — так удобнее смотреть
  const dy = Math.min(0, tableTop + 40 - needTop);
  // ближние карты (низ раскладки) — в полный размер, дальние мельче
  persp.near = needBottom + dy;

  const g = scene.add.graphics().setDepth(400);
  g.fillStyle(0x0d151b, 0.82);
  g.fillRect(0, 0, W, STRIP_H);
  g.fillStyle(C.brass, 0.9);
  g.fillRect(0, STRIP_H - 3, W, 3);
  roundButton(scene, 56, STRIP_H / 2 - 2, 38, 'home', onHome).setDepth(401);

  const title = ctx.mode === 'case'
    ? `${t('map.caseShort', { n: ctx.caseData!.number })} · ${t('game.clue', { n: ctx.level, total: ctx.total })}`
    : `${t('game.daily')} · ${rulesFor(ctx.kind).name}`;
  const tt = txt(scene, W / 2 - 30, STRIP_H / 2 - 4, title, 42, C.brassLight, { head: true }).setDepth(401);
  tt.setScale(Math.min(1, 560 / tt.width));

  // кнопка «Правила»
  roundButton(scene, W - 226, STRIP_H / 2 - 2, 34, 'rules', () => showRules(scene, ctx.kind)).setDepth(401);

  const stars = scene.add.graphics().setDepth(401);
  const setStars = (n: number) => {
    stars.clear();
    for (let i = 0; i < 3; i++) drawStar(stars, W - 150 + i * 52, STRIP_H / 2 - 3, 20, i < n);
  };
  setStars(3);

  // перед первой партией нового пасьянса Эдит коротко объясняет правила
  if (ctx.kind !== 'tripeaks' && !save.data.seen.includes(ctx.kind)) {
    scene.time.delayedCall(900, () => showIntro(scene, ctx.kind, () => save.markSeen(ctx.kind)));
  }

  return {
    dy,
    setStars,
    thoughts: (y, canShow) => attachThoughts(scene, ctx.caseData, ctx.kind, y, canShow),
  };
}

export interface Helper {
  setEnabled(enabled: boolean): void;
  setBadge(s: string): void;
}

/** Кнопка помощника с подписью и жетоном оставшихся использований. */
export function helperButton(scene: Phaser.Scene, x: number, y: number, label: string, badge: string | null, glyph: ButtonGlyph, onClick: () => void): Helper {
  const button = roundButton(scene, x, y, 80, glyph, onClick);
  const lt = txt(scene, x, y + 108, label, 36, C.paperLight, { head: true });
  lt.setShadow(0, 3, '#000000', 8, false, true);
  const bg = scene.add.graphics();
  const bt = txt(scene, x + 62, y - 66, badge ?? '', 28, C.paperLight, { bold: true }).setDepth(2);
  let enabled = true;
  const paint = () => {
    bg.clear();
    if (!bt.text) return;
    const bw = Math.max(52, bt.width + 24);
    bg.fillStyle(C.brassDark, 1);
    bg.fillRoundedRect(x + 62 - bw / 2 - 2, y - 66 - 26, bw + 4, 52, 26);
    bg.fillStyle(enabled ? C.wine : C.night, 1);
    bg.fillRoundedRect(x + 62 - bw / 2, y - 66 - 24, bw, 48, 24);
  };
  paint();
  return {
    setEnabled(on) {
      if (enabled === on) return;
      enabled = on;
      button.setEnabled(on);
      lt.setAlpha(on ? 1 : 0.66);
      bt.setAlpha(on ? 1 : 0.72);
      paint();
    },
    setBadge(s: string) {
      bt.setText(s);
      paint();
    },
  };
}

interface UndoState {
  readonly hasUndo: boolean;
  readonly undosLeft: number;
}

export function updateUndoButton(button: Helper, game: UndoState): void {
  button.setEnabled(game.hasUndo);
  button.setBadge(game.undosLeft ? String(game.undosLeft) : t('game.ad'));
}

export async function requestUndo<T>(scene: Phaser.Scene, game: UndoState & {
  undo(rewarded?: boolean): T;
}, setBusy: (busy: boolean) => void): Promise<T | undefined> {
  if (!game.hasUndo) return;
  if (game.undosLeft > 0) return game.undo();

  let active = true;
  const stop = () => { active = false; };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  setBusy(true);
  const watched = await ads.showRewarded().catch(() => false);
  scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
  if (!active) return;
  setBusy(false);
  if (watched && scene.sys.isActive()) return game.undo(true);
}

/** Партия выиграна: звёзды, сохранение и переход (улика, доска или меню). */
export function winLevel(scene: Phaser.Scene, ctx: LevelCtx, stars: number): void {
  sfx.win();
  const banner = txt(scene, W / 2, H * 0.3, t('game.won'), 84, C.gold, { head: true }).setDepth(500).setScale(0.4).setAlpha(0);
  banner.setStroke('#3b2a20', 10);
  scene.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
  const withStars = (cont: Phaser.GameObjects.Container, y: number) => {
    cont.add(starsRow(scene, W / 2, y, stars, 44));
    return y + 80;
  };

  if (ctx.mode === 'case') {
    const c = ctx.caseData!;
    const before = save.progress(c.id, ctx.total).stars[ctx.level - 1];
    save.winLevel(c.id, ctx.level, stars, ctx.total);
    if (!ctx.replay) {
      scene.time.delayedCall(1100, () => scene.scene.start('Clue', { caseId: c.id, index: ctx.level - 1, isNew: true, stars }));
      return;
    }
    scene.time.delayedCall(900, () => {
      banner.destroy();
      const text = stars > before ? t('game.replayBetter') : t('game.replaySame');
      showDialog(scene, t('game.won'), text, [{ label: t('game.toBoard'), style: 'primary', onClick: () => void toMenuAfterGame(scene, 'Board', { caseId: c.id, highlight: ctx.level - 1 }) }], withStars);
    });
  } else {
    save.winDaily(ctx.data.dailyDate!, stars, ctx.kind);
    scene.time.delayedCall(900, () => {
      banner.destroy();
      showDialog(scene, t('game.dailyWon'), t('game.dailyWonText'), [{ label: t('game.toMenu'), style: 'primary', onClick: () => void toMenuAfterGame(scene) }], withStars);
    });
  }
}

export function restartLevel(scene: Phaser.Scene, ctx: LevelCtx): void {
  scene.scene.restart(ctx.data);
}

export interface DeadWatch {
  /** партия кончилась — больше не проверять */
  stop: () => boolean;
  /** сейчас нельзя показывать окно (реклама, анимация) — проверить позже */
  wait: () => boolean;
  dead: () => boolean;
  onDead: () => void;
}

/**
 * Следит за тупиком: возвращает функцию «проверь после хода». Если в этот момент открыто
 * другое окно или идёт реклама, проверка повторяется, пока окно не закроется.
 */
export function watchDead(scene: Phaser.Scene, w: DeadWatch): (delay?: number) => void {
  let timer: Phaser.Time.TimerEvent | null = null;
  const tick = () => {
    timer = null;
    if (w.stop()) return;
    if (w.wait() || dialogsOpen() > 0) {
      timer = scene.time.delayedCall(1000, tick);
      return;
    }
    if (w.dead()) w.onDead();
  };
  return (delay = 650) => {
    timer?.remove();
    timer = scene.time.delayedCall(delay, tick);
  };
}

export interface LostOptions {
  /** помощь за рекламу (+5 карт, +1 проход), если она есть в этом пасьянсе */
  extra?: DialogButton;
  /** Возвращает один ход. */
  undo?: () => void;
  undoRewarded?: boolean;
}

/** Окно «Ходов больше нет»: помощь за рекламу (где есть), отмена ходов, начать заново. */
export function lostDialog(scene: Phaser.Scene, ctx: LevelCtx, text: string, opts: LostOptions = {}): void {
  sfx.lose();
  const buttons: DialogButton[] = [];
  if (opts.extra) buttons.push(opts.extra);
  if (opts.undo) buttons.push({ label: t(opts.undoRewarded ? 'game.undoAd' : 'game.undoMove'), style: buttons.length ? 'paper' : 'primary', onClick: opts.undo });
  buttons.push({ label: t('game.restart'), style: buttons.length ? 'paper' : 'primary', onClick: () => restartLevel(scene, ctx) });
  showDialog(scene, t('game.lostTitle'), text, buttons);
}

export function exitDialog(scene: Phaser.Scene, ctx: LevelCtx): void {
  showDialog(scene, t('game.exitTitle'), t('game.exitText'), [
    { label: t('game.exitNo'), style: 'primary', onClick: () => {} },
    { label: t('game.restart'), onClick: () => restartLevel(scene, ctx) },
    { label: t('game.exitYes'), onClick: () => scene.scene.start(ctx.mode === 'case' ? 'Map' : 'Menu') },
  ]);
}
