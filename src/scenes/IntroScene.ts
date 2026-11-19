// Вступление к делу.

import Phaser from 'phaser';
import { C, H, W } from '../config';
import { continueCase } from '../flow';
import { AccusationDraft, getCase } from '../services/cases';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { ScrollArea, addBackground, fadeIn, makeButton, panel, roundButton, txt } from '../ui/widgets';
import { introFilmUrl, playIntroComic, playIntroFilm } from '../ui/introFilm';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create(data: { caseId: string; full?: boolean; filmUnavailable?: boolean; board?: { from?: string; accusation?: AccusationDraft } }): void {
    fadeIn(this);
    const c = getCase(data.caseId);
    addBackground(this, 'bg_harbor', 0.45);
    const back = () => {
      if (data.board) this.scene.start('Board', { caseId: c.id, ...data.board });
      else if (data.full && !data.filmUnavailable) this.scene.restart({ caseId: c.id });
      else this.scene.start('Map');
    };
    const start = () => {
      if (data.board) return back();
      save.markIntroSeen(c.id, c.clues.length);
      continueCase(this, c);
    };
    if (c.comic && !data.filmUnavailable) {
      playIntroComic(this, c.comic, start, () => this.scene.restart({ ...data, full: true, filmUnavailable: true }));
      return;
    }
    const film = c.introFilm && !data.filmUnavailable ? introFilmUrl(c.introFilm) : undefined;
    if (film) {
      playIntroFilm(this, film, start, () => this.scene.restart({ ...data, full: true, filmUnavailable: true }));
      return;
    }

    txt(this, W / 2, 72, t('map.case', { n: c.number }), 44, C.brassLight, { head: true });
    const title = txt(this, W / 2, 158, c.title, 76, C.paperLight, { head: true });
    title.setScale(Math.min(1, (W - 220) / title.width));
    title.setShadow(0, 4, '#000000', 10, false, true);

    roundButton(this, 82, 82, 50, 'back', back);
    const short = !data.full && c.opening;
    const top = short ? Math.round(H * 0.26) : 240;
    const bottom = short ? H - 390 : H - 230;
    panel(this, 40, top, W - 80, bottom - top, 36);
    const area = new ScrollArea(this, 90, top + 50, W - 180, bottom - top - 100);
    area.addParagraphs(short || c.intro, short ? 50 : 47);
    area.addSpace(20);

    if (short) {
      makeButton(this, W / 2, H - 270, 690, 100, t('intro.full'), () => this.scene.restart({ ...data, full: true }), 'dark', 39);
    }
    makeButton(this, W / 2, H - 118, 820, 150, t(data.board ? 'intro.toBoard' : 'intro.start'), start, 'primary', 58);
  }
}
