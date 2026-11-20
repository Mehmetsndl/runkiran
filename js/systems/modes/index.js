// Mod kimliği → mod sınıfı eşlemesi. Yeni mod eklerken buraya da kaydet.
import { WAVES } from '../../data/waves.js';
import { TimedWaveMode } from './TimedWaveMode.js';
import { BlitzMode } from './BlitzMode.js';
import { DefenseMode } from './DefenseMode.js';
import { BossRaidMode } from './BossRaidMode.js';

class SurvivalMode extends TimedWaveMode {
  constructor(game, def) {
    super(game, def, WAVES);
    this.hpScalePerMinute = 0.26;   // Hayatta Kalma daha sert: her dakika +%26 can
  }
}

const MODE_CLASSES = {
  hayatta: SurvivalMode,
  kale: DefenseMode,
  akin: BlitzMode,
  boss: BossRaidMode,
};

export function createMode(game, def) {
  const Cls = MODE_CLASSES[def.id] ?? SurvivalMode;
  return new Cls(game, def);
}
