// Эдит на игровом столе: окно «Правила», знакомство с новым пасьянсом,
// облачко с её мыслями при простое.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import rulesRu from '../data/i18n/rules.ru.json';
import { CaseData, GameKind } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { sfx } from '../services/sfx';
import { CARD_TEX_SCALE } from './cards';
import { ScrollArea, dialogClosed, dialogOpened, dialogsOpen, drawPanel, makeButton, roundButton, txt } from './widgets';

interface RulesText {
  name: string;
  intro: string;
  rules: string[];
  hints: string[];
}

const RULES: Record<string, Record<string, RulesText>> = { ru: rulesRu };

export function rulesFor(kind: GameKind): RulesText {
  return RULES[save.data.lang]?.[kind] ?? RULES.ru[kind];
}

/** Окно с правилами текущего пасьянса: текст листается, закрывается крестиком или нажатием мимо. */
export function showRules(scene: Phaser.Scene, kind: GameKind): void {
  const r = rulesFor(kind);
  dialogOpened();
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a1014, 0.75).setInteractive().setDepth(900);
  const px = 40;
  const py = Math.round(H * 0.08);
  const pw = W - 80;
  const ph = Math.round(H * 0.84);
  const g = scene.add.graphics().setDepth(901);
  drawPanel(g, px, py, pw, ph, 36);
  const swallow = scene.add.zone(W / 2, py + ph / 2, pw, ph).setInteractive().setDepth(901);
  const title = txt(scene, W / 2 - 40, py + 92, t('rules.title', { name: r.name }), 60, C.wine, { head: true }).setDepth(902);
  title.setScale(Math.min(1, (pw - 240) / title.width));
  const line = scene.add.graphics().setDepth(902);
  line.lineStyle(3, C.brassDark, 0.7);
  line.lineBetween(px + 70, py + 150, px + pw - 70, py + 150);
  const area = new ScrollArea(scene, px + 60, py + 180, pw - 120, ph - 250).setDepth(902);
  area.addParagraphs(r.rules, 44);
  area.addSpace(20);
  const close = () => {
    dialogClosed();
    for (const o of [shade, g, swallow, title, line, x]) o.destroy();
    area.destroy();
  };
  const x = roundButton(scene, px + pw - 78, py + 82, 44, (ig) => {
    ig.lineStyle(9, C.paperLight, 1);
    ig.lineBetween(-15, -15, 15, 15);
    ig.lineBetween(15, -15, -15, 15);
  }, close).setDepth(903);
  shade.on('pointerup', () => {
    sfx.click();
    close();
  });
}

/** Простая анимация хода для знакомства с пасьянсом. */
function demo(scene: Phaser.Scene, kind: GameKind, cx: number, cy: number, depth: number): Phaser.GameObjects.GameObject[] {
  const s = CARD_TEX_SCALE * 1.25;
  const card = (key: string, x: number, y: number) => scene.add.image(cx + x, cy + y, key).setScale(s).setDepth(depth);
  const objs: Phaser.GameObjects.GameObject[] = [];
  if (kind === 'tripeaks') {
    const base = card('card_7_0', 90, 0);
    const mover = card('card_6_1', -150, 0).setDepth(depth + 1);
    scene.tweens.add({ targets: mover, x: cx + 90, duration: 700, delay: 500, hold: 900, repeat: -1, repeatDelay: 600, ease: 'Cubic.easeInOut' });
    objs.push(base, mover);
  } else if (kind === 'pyramid') {
    const a = card('card_8_3', -80, -20);
    const b = card('card_5_1', 80, -20);
    const sum = txt(scene, cx, cy + 125, '8 + 5 = 13', 48, C.wine, { head: true }).setDepth(depth);
    scene.tweens.add({ targets: [a, b], alpha: 0, y: cy - 70, duration: 600, delay: 1100, hold: 500, repeat: -1, repeatDelay: 900 });
    objs.push(a, b, sum);
  } else if (kind === 'klondike') {
    const base = card('card_10_0', 90, -30);
    const mover = card('card_9_2', -150, 20).setDepth(depth + 1);
    scene.tweens.add({ targets: mover, x: cx + 90, y: cy + 30, duration: 700, delay: 500, hold: 900, repeat: -1, repeatDelay: 600, ease: 'Cubic.easeInOut' });
    objs.push(base, mover);
  } else {
    const slot = scene.add.graphics().setDepth(depth);
    slot.lineStyle(5, C.brassDark, 0.8);
    slot.strokeRoundedRect(cx + 90 - 66, cy - 60 - 98, 132, 196, 14);
    const mover = card('card_12_1', -130, 50).setDepth(depth + 1);
    scene.tweens.add({ targets: mover, x: cx + 90, y: cy - 60, duration: 700, delay: 500, hold: 900, repeat: -1, repeatDelay: 600, ease: 'Cubic.easeInOut' });
    objs.push(slot, mover);
  }
  return objs;
}

/** Знакомство: портрет Эдит, её слова о пасьянсе и короткая анимация хода. */
export function showIntro(scene: Phaser.Scene, kind: GameKind, onClose: () => void): void {
  const r = rulesFor(kind);
  dialogOpened();
  const objs: Phaser.GameObjects.GameObject[] = [];
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a1014, 0.78).setInteractive().setDepth(900);
  const pw = 940;
  const words = txt(scene, W / 2, 0, r.intro, 44, C.ink, { wrap: pw - 130 }).setDepth(902);
  const ph = 250 + words.height + 360 + 190;
  const py = Math.round((H - ph) / 2) + 60;
  const g = scene.add.graphics().setDepth(901);
  drawPanel(g, (W - pw) / 2, py, pw, ph, 36);
  // портрет в латунном кольце, наполовину над окном
  const ring = scene.add.graphics().setDepth(902);
  ring.fillStyle(C.brassDark, 1);
  ring.fillCircle(W / 2, py, 124);
  ring.fillStyle(C.brass, 1);
  ring.fillCircle(W / 2, py, 119);
  const face = scene.add.image(W / 2, py, 'edith').setDisplaySize(224, 224).setDepth(903);
  const name = txt(scene, W / 2, py + 168, r.name, 60, C.wine, { head: true }).setDepth(902);
  words.setY(py + 230 + words.height / 2);
  const demoY = py + 250 + words.height + 170;
  objs.push(...demo(scene, kind, W / 2, demoY, 902));
  const close = () => {
    dialogClosed();
    for (const o of [shade, g, ring, face, name, words, button, ...objs]) {
      scene.tweens.killTweensOf(o);
      o.destroy();
    }
    onClose();
  };
  const button = makeButton(scene, W / 2, py + ph - 110, pw - 200, 130, t('rules.start'), close, 'primary', 52).setDepth(903);
}

// ---------- мысли Эдит ----------

const shownThoughts: Record<string, Set<string>> = {};
const hintIndex: Record<string, number> = {};
let lastBubbleAt = 0;

const IDLE_THOUGHT_MS = 9000;
const IDLE_HINT_MS = 18000;
const BETWEEN_MS = 35000;
const SHOW_MS = 5500;

function pickThought(c: CaseData): string | null {
  const blocks = c.thoughts ?? [];
  const found = save.found(c.id, c.clues.length);
  const open = blocks.filter((b) => b.after <= found);
  if (!open.length) return null;
  const shown = (shownThoughts[c.id] ??= new Set());
  const all = open.flatMap((b) => b.lines);
  if (all.every((l) => shown.has(l))) shown.clear(); // все показаны — начинаем круг заново
  // сначала самый свежий блок, потом вперемешку из старых
  const fresh = open.reduce((a, b) => (b.after > a.after ? b : a)).lines.filter((l) => !shown.has(l));
  const pool = fresh.length ? fresh : all.filter((l) => !shown.has(l));
  const line = pool[Math.floor(Math.random() * pool.length)];
  shown.add(line);
  return line;
}

/**
 * Следит за простоем и показывает облачко: мысль о найденных уликах (простой 9 секунд,
 * не чаще раза в 35 секунд) или подсказку по игре (простой 18 секунд).
 * y — центр облачка по вертикали; canShow — можно ли показывать сейчас.
 */
export function attachThoughts(scene: Phaser.Scene, c: CaseData | null, kind: GameKind, y: number, canShow: () => boolean): void {
  let lastActivity = scene.time.now;
  let thoughtGiven = false;
  let hintGiven = false;
  let bubble: Phaser.GameObjects.Container | null = null;
  let hideEvent: Phaser.Time.TimerEvent | null = null;
  let shownAt = 0;

  const hide = () => {
    hideEvent?.remove();
    hideEvent = null;
    if (!bubble) return;
    // пока облачко было на экране, таймер простоя стоял
    const now = scene.time.now;
    lastActivity += Math.max(0, now - Math.max(shownAt, lastActivity));
    const b = bubble;
    bubble = null;
    scene.tweens.add({ targets: b, alpha: 0, duration: 200, onComplete: () => b.destroy() });
  };

  const show = (line: string) => {
    const text = txt(scene, 0, 0, line, 34, C.ink, { wrap: W - 260, align: 'left', ox: 0, spacing: 6 });
    const bw = Math.max(260, text.width + 60);
    const bh = Math.max(96, text.height + 36);
    const bx = 164;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(bx + 3, -bh / 2 + 7, bw, bh, 26);
    g.fillStyle(C.brassDark, 1);
    g.fillRoundedRect(bx, -bh / 2, bw, bh, 26);
    g.fillStyle(C.paperLight, 1);
    g.fillRoundedRect(bx + 4, -bh / 2 + 4, bw - 8, bh - 8, 22);
    g.fillTriangle(bx + 6, -14, bx + 6, 14, bx - 18, 0);
    g.fillStyle(C.brassDark, 1);
    g.fillCircle(86, 0, 66);
    g.fillStyle(C.brass, 1);
    g.fillCircle(86, 0, 62);
    text.setPosition(bx + 30, 0);
    const face = scene.add.image(86, 0, 'edith').setDisplaySize(116, 116);
    // облачко закрывается раньше времени только нажатием на него самого
    const hit = scene.add.zone(20, -Math.max(bh, 132) / 2, bx + bw - 20, Math.max(bh, 132)).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => hide());
    bubble = scene.add.container(0, y, [g, face, text, hit]).setDepth(450).setAlpha(0);
    shownAt = scene.time.now;
    scene.tweens.add({ targets: bubble, alpha: 1, duration: 250 });
    hideEvent = scene.time.delayedCall(SHOW_MS + (line.length > 80 ? 2000 : 0), hide);
    lastBubbleAt = Date.now();
  };

  scene.input.on('pointerdown', () => {
    lastActivity = scene.time.now;
    thoughtGiven = false;
    hintGiven = false;
  });

  scene.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (bubble || dialogsOpen() > 0 || !canShow()) return;
      const idle = scene.time.now - lastActivity;
      if (idle >= IDLE_HINT_MS && !hintGiven) {
        hintGiven = true;
        const hints = rulesFor(kind).hints;
        const i = hintIndex[kind] ?? 0;
        hintIndex[kind] = (i + 1) % hints.length;
        show(hints[i]);
      } else if (idle >= IDLE_THOUGHT_MS && !thoughtGiven && c && Date.now() - lastBubbleAt >= BETWEEN_MS) {
        thoughtGiven = true;
        const line = pickThought(c);
        if (line) show(line);
      }
    },
  });
}
