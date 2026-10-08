// Tout le son est synthétisé : bruit filtré et ondes courtes, façon atelier d'imprimerie.
let ctx: AudioContext | undefined;
let sortie: GainNode;
let bruitTampon: AudioBuffer;
let muet = false;

/** À appeler sur un geste de l'utilisateur (les navigateurs bloquent l'audio avant). */
export function reveiller(): void {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
  } catch { return; } // pas d'audio : le jeu reste jouable
  sortie = ctx.createGain();
  sortie.gain.value = 0.5;
  sortie.connect(ctx.destination);
  bruitTampon = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = bruitTampon.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function basculerSon(): boolean {
  muet = !muet;
  if (ctx) sortie.gain.value = muet ? 0 : 0.5;
  return muet;
}

function enveloppe(vol: number, t: number, duree: number): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  g.connect(sortie);
  return g;
}

function ton(freq: number, duree: number, o: { type?: OscillatorType; vers?: number; vol?: number; dans?: number } = {}): void {
  if (!ctx) return;
  const t = ctx.currentTime + (o.dans ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.vers) osc.frequency.exponentialRampToValueAtTime(o.vers, t + duree);
  osc.connect(enveloppe(o.vol ?? 0.3, t, duree));
  osc.start(t); osc.stop(t + duree + 0.02);
}

function bruit(duree: number, freq: number, o: { type?: BiquadFilterType; vers?: number; vol?: number; dans?: number; q?: number } = {}): void {
  if (!ctx) return;
  const t = ctx.currentTime + (o.dans ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = bruitTampon;
  const filtre = ctx.createBiquadFilter();
  filtre.type = o.type ?? 'bandpass';
  filtre.Q.value = o.q ?? 1;
  filtre.frequency.setValueAtTime(freq, t);
  if (o.vers) filtre.frequency.exponentialRampToValueAtTime(o.vers, t + duree);
  src.connect(filtre).connect(enveloppe(o.vol ?? 0.3, t, duree));
  src.start(t, Math.random() * 0.5, duree + 0.02);
}

let dernierPoint = 0;

export const SONS = {
  pousse: () => { bruit(0.05, 900, { vol: 0.5, q: 3 }); ton(170, 0.06, { type: 'triangle', vol: 0.35 }); },
  agrippe: () => bruit(0.02, 2600, { vol: 0.3, q: 6 }),
  dash: () => bruit(0.14, 500, { type: 'highpass', vers: 4000, vol: 0.2 }),
  choc: () => { ton(110, 0.16, { vers: 45, vol: 0.6 }); bruit(0.09, 1400, { vol: 0.4 }); },
  // coup de presse + cloche de machine à écrire
  regleCreee: () => { ton(80, 0.28, { vers: 38, vol: 0.9 }); bruit(0.07, 300, { vol: 0.5 }); ton(1320, 0.7, { vol: 0.16, dans: 0.06 }); ton(1980, 0.5, { vol: 0.08, dans: 0.06 }); },
  // papier déchiré
  regleCassee: () => { bruit(0.32, 5000, { vers: 500, vol: 0.45, q: 0.7 }); ton(240, 0.22, { type: 'sawtooth', vers: 70, vol: 0.18 }); },
  // trois tics qui montent : une règle s'arme sur un joueur
  arme: (moi: boolean) => [0, 1, 2].forEach((i) => ton(620 + i * 210, 0.09, { type: 'square', vol: moi ? 0.22 : 0.08, dans: i * 0.3 })),
  mort: () => { ton(320, 0.3, { type: 'square', vers: 50, vol: 0.3 }); bruit(0.2, 700, { vers: 150, vol: 0.4 }); },
  respawn: () => ton(300, 0.16, { type: 'triangle', vers: 900, vol: 0.25 }),
  points: () => {
    if (!ctx || ctx.currentTime - dernierPoint < 0.25) return;
    dernierPoint = ctx.currentTime;
    ton(1760, 0.07, { type: 'triangle', vol: 0.12 });
  },
  ombre: () => ton(1400, 1.9, { vers: 260, vol: 0.07, type: 'triangle' }),
  chute: () => { ton(130, 0.2, { vers: 50, vol: 0.7 }); bruit(0.12, 600, { vol: 0.4 }); },
  tic: () => ton(880, 0.06, { type: 'square', vol: 0.18 }),
  go: () => { ton(880, 0.3, { type: 'square', vol: 0.2 }); ton(1320, 0.3, { type: 'square', vol: 0.15 }); },
  bouclage: () => [0, 0.16, 0.32].forEach((d) => ton(1500, 0.12, { type: 'square', vol: 0.2, dans: d })),
  manche: () => [392, 523, 659, 784].forEach((f, i) => ton(f, 0.22, { type: 'triangle', vol: 0.25, dans: i * 0.11 })),
  victoire: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton(f, 0.3, { type: 'triangle', vol: 0.28, dans: i * 0.14 })),
  emote: (n: number) => [[700, 900], [500, 300], [300, 300], [600, 1200]][n].forEach((f, i) => ton(f, 0.09, { type: 'square', vol: 0.14, dans: i * 0.09 })),
};

// --- musique : une rotative, trois paliers d'intensité ----------------------

let niveau = -1; // -1 = arrêtée, 0 normal, 1 balle de match, 2 bouclage
let pasMusique = 0;
let prochainPas = 0;

export function musique(n: number): void {
  if (niveau < 0 && n >= 0 && ctx) { prochainPas = ctx.currentTime + 0.05; pasMusique = 0; }
  niveau = n;
}

const BASSE = [55, 0, 55, 0, 0, 55, 0, 65.4, 55, 0, 55, 0, 0, 49, 0, 49];

/** À appeler à chaque image : programme les notes un peu en avance. */
export function battreMusique(): void {
  if (!ctx || niveau < 0) return;
  const duree = 60 / (niveau === 2 ? 150 : 114) / 4;
  if (prochainPas < ctx.currentTime - 0.5) prochainPas = ctx.currentTime; // onglet resté en arrière-plan
  while (prochainPas < ctx.currentTime + 0.12) {
    const dans = Math.max(0, prochainPas - ctx.currentTime), p = pasMusique % 16;
    if (p % 4 === 0) ton(105, 0.14, { vers: 42, vol: 0.4, dans });
    if (p % 4 === 2) bruit(0.03, 5200, { type: 'highpass', vol: 0.1, dans });
    if (niveau >= 1 && p % 2 === 1) bruit(0.02, 7000, { type: 'highpass', vol: 0.06, dans });
    if (BASSE[p]) ton(BASSE[p] * (niveau >= 1 && p >= 8 ? 2 : 1), duree * 1.6, { type: 'sawtooth', vol: 0.11, dans });
    if (niveau === 2 && p % 4 === 0) ton(1568, 0.1, { type: 'triangle', vol: 0.09, dans });
    prochainPas += duree;
    pasMusique++;
  }
}
