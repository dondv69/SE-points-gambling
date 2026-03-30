import * as Tone from 'tone';

let initialized = false;
let masterVol;
let clickSynth, winSynth, lossSynth, bonusSynth, jackpotSynth;
let lastClickTime = 0;

async function init() {
  if (initialized) return;
  await Tone.start();

  masterVol = new Tone.Volume(-4).toDestination();

  // Reel stop click — sharp, satisfying tick
  clickSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -6,
  }).connect(masterVol);

  // Win arpeggio
  winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 },
  }).connect(masterVol);

  // Loss thud
  lossSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
    volume: -8,
  }).connect(masterVol);

  // Bonus fanfare
  const bonusReverb = new Tone.Reverb(1.2).connect(masterVol);
  bonusSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.2, release: 0.8 },
    volume: -4,
  }).connect(bonusReverb);

  // Jackpot
  const jackpotReverb = new Tone.Reverb(2.5).connect(masterVol);
  jackpotSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 1.5 },
    volume: -6,
  }).connect(jackpotReverb);

  initialized = true;
}

export const audio = {
  async ensure() {
    await init();
  },

  // No more startSpin/stopSpin noise — just silence during spin

  reelStop() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const time = Math.max(now, lastClickTime + 0.06);
      lastClickTime = time;
      // Ascending pitch per reel: C5, E5, G5
      const notes = ['C5', 'E5', 'G5'];
      const noteIdx = Math.min(2, Math.round((time - now) / 0.06));
      clickSynth.triggerAttackRelease(notes[noteIdx] || 'G5', '64n', time, 0.4);
    } catch {}
  },

  win(multiplier = 1) {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const notes = multiplier >= 10
        ? ['E5', 'G5', 'B5', 'E6']
        : ['C5', 'E5', 'G5'];
      notes.forEach((note, i) => {
        winSynth.triggerAttackRelease(note, '8n', now + i * 0.08, 0.4);
      });
    } catch {}
  },

  loss() {
    if (!initialized) return;
    try {
      lossSynth.triggerAttackRelease('E3', '16n', Tone.now(), 0.2);
    } catch {}
  },

  bonus() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((note, i) => {
        bonusSynth.triggerAttackRelease(note, '4n', now + i * 0.1, 0.4);
      });
    } catch {}
  },

  jackpot() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const chords = [
        ['C4', 'E4', 'G4'],
        ['E4', 'G#4', 'B4'],
        ['G4', 'B4', 'D5'],
        ['C5', 'E5', 'G5'],
      ];
      chords.forEach((chord, i) => {
        jackpotSynth.triggerAttackRelease(chord, '2n', now + i * 0.25, 0.5);
      });
    } catch {}
  },
};
