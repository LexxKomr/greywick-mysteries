import type Phaser from 'phaser';
import { t } from '../services/i18n';
import { save } from '../services/save';
import { showDialog } from './widgets';

export function confirmProgressReset(scene: Phaser.Scene, afterReset: () => void): void {
  showDialog(scene, t('settings.resetTitle'), t('settings.resetText'), [
    { label: t('settings.resetNo'), style: 'primary', onClick: () => {} },
    {
      label: t('settings.resetYes'),
      onClick: () => {
        save.reset();
        afterReset();
      },
    },
  ]);
}
