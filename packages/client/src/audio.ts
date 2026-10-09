// Tout le son est synthétisé : bruit filtré et ondes courtes, façon atelier d'imprimerie.
let ctx: AudioContext | undefined;
let sortie: GainNode;
let sortieMusique: GainNode;
/** où va le prochain son : les bruitages par défaut, la musique le temps de sa mesure */
let cible: GainNode;
let bruitTampon: AudioBuffer;

export const PISTES = ['sons', 'musique', 'voix'] as const;
export type Piste = (typeof PISTES)[number];
/** ce que le joueur a coupé, retenu d'une session à l'autre */
const coupe: Record<Piste, boolean> = { sons: false, musique: false, voix: false };
try { Object.assign(coupe, JSON.parse(localStorage.getItem('casse.son') ?? '{}')); } catch { /* préférence illisible : tout est audible */ }

function regler(): void {
  if (ctx) { sortie.gain.value = coupe.sons ? 0 : 0.5; sortieMusique.gain.value = coupe.musique ? 0 : 0.5; }
  if (coupe.voix && 'speechSynthesis' in window) speechSynthesis.cancel();
}
export const estCoupe = (piste: Piste) => coupe[piste];
export function couper(piste: Piste, v: boolean): void {
  coupe[piste] = v;
  try { localStorage.setItem('casse.son', JSON.stringify(coupe)); } catch { /* navigation privée : le réglage vaut pour cette page */ }
  regler();
}

/** À appeler sur un geste de l'utilisateur (les navigateurs bloquent l'audio avant). */
export function reveiller(): void {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
  } catch { return; } // pas d'audio : le jeu reste jouable
  cible = sortie = ctx.createGain();
  sortieMusique = ctx.createGain();
  sortie.connect(ctx.destination);
  sortieMusique.connect(ctx.destination);
  regler();
  bruitTampon = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = bruitTampon.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/** Le Prote lit la loi à voix haute, quand le navigateur a une voix française. */
export function lire(texte: string): void {
  if (coupe.voix || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(texte.toLowerCase());
  u.lang = 'fr-FR'; u.rate = 1.25; u.pitch = 0.6; u.volume = 0.9;
  speechSynthesis.cancel(); // une loi chasse l'autre : il ne prend jamais de retard
  speechSynthesis.speak(u);
}

function enveloppe(vol: number, t: number, duree: number): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  g.connect(cible);
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
  // un caractère qu'on sort de la casse, qu'on cale dans le châssis, qu'on jette
  prise: () => bruit(0.02, 2600, { vol: 0.3, q: 6 }),
  pose: () => { bruit(0.05, 900, { vol: 0.5, q: 3 }); ton(220, 0.08, { type: 'triangle', vol: 0.4 }); },
  lance: () => bruit(0.16, 900, { type: 'highpass', vers: 3200, vol: 0.16 }),
  dash: () => bruit(0.14, 500, { type: 'highpass', vers: 4000, vol: 0.2 }),
  choc: () => { ton(110, 0.16, { vers: 45, vol: 0.6 }); bruit(0.09, 1400, { vol: 0.4 }); },
  // la loi entre en vigueur : coup de presse + cloche de machine à écrire
  loiActive: () => { ton(80, 0.28, { vers: 38, vol: 0.9 }); bruit(0.07, 300, { vol: 0.5 }); ton(1320, 0.7, { vol: 0.16, dans: 0.06 }); ton(1980, 0.5, { vol: 0.08, dans: 0.06 }); },
  // trois tics qui montent : une loi s'arme
  arme: () => [0, 1, 2].forEach((i) => ton(620 + i * 210, 0.09, { type: 'square', vol: 0.2, dans: i * 0.3 })),
  couronne: () => [1320, 1760].forEach((f, i) => ton(f, 0.12, { type: 'triangle', vol: 0.2, dans: i * 0.07 })),
  vol: () => [900, 500].forEach((f, i) => ton(f, 0.07, { type: 'square', vol: 0.16, dans: i * 0.06 })),
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
  cible = sortieMusique;
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
  cible = sortie;
}
