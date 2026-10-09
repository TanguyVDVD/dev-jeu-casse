import { CONFIG, DT, ticks } from './config';
import { appliquerLois, compatible, condamnent, ecrire, loi, resoudre, type Loi } from './lois';
import { a, produit } from './proprietes';
import { CHOSES, COULEURS, famille, type Chose, type Mot, type Prop, type Sujet } from './vocab';

export interface Arene {
  id: string;
  nom: string;
  description: string;
  /** '.' sol, L lave, M mur, K couronne, C caisse */
  carte: string[];
  spawns: [number, number][];
  /** Châssis de 5 cases sur 1, (x, y) = case de gauche. Le premier est la Loi d'or : [CHOSE] EST POINTS. */
  chassis: { x: number; y: number; sujet: Sujet; prop: Prop }[];
  /** mots libres au sol au départ (les couleurs sont posées aux pieds des joueurs) */
  mots: { x: number; y: number; mot: Mot }[];
  /** groupes et propriétés qui tombent du ciel, dans l'ordre */
  pioche: Mot[];
}

export interface Entree { seq: number; mx: number; my: number; dash: boolean; action: boolean }
export const ENTREE_VIDE: Entree = { seq: 0, mx: 0, my: 0, dash: false, action: false };

export interface Stats { ecrites: number; victimes: number; morts: number; dashs: number; lances: number; attrapes: number; voles: number }
export const statsVides = (): Stats => ({ ecrites: 0, victimes: 0, morts: 0, dashs: 0, lances: 0, attrapes: 0, voles: 0 });

export interface Joueur {
  id: number; // 0..3 = ROUGE, BLEU, VERT, JAUNE
  x: number; y: number; vx: number; vy: number; fx: number; fy: number;
  mort: boolean; tMort: number; retour: number; invul: number; etourdi: number;
  dashT: number; dashCd: number;
  /** le mot porté au-dessus de la tête */
  porte: Mot | null;
  /** pas pendant lesquels un appui sur l'action reste en mémoire */
  memoire: number;
  pousse: { id: number; dx: number; dy: number; t: number };
  score: number;
  /** propriétés que les lois lui donnent à ce pas */
  props: Prop[];
  /** VOLEUR : victime -> pas à partir duquel on peut la voler de nouveau */
  vols: Record<number, number>;
  seq: number;
  stats: Stats;
}

/** Un mot au sol, ou en vol tant que `reste` > 0. */
export interface MotLibre { id: number; mot: Mot; x: number; y: number; dx: number; dy: number; reste: number; par: number; ne: number }
export interface Caisse { id: number; x: number; y: number }
export interface Couronne { x: number; y: number; porteur: number }
/** Un mot qui va tomber : au sol (ch = -1) ou dans un emplacement. */
export interface Ombre { x: number; y: number; mot: Mot; t: number; ch: number; cote: 0 | 1 }

export type Evt =
  | { t: 'loi'; ch: number; sujet: Sujet; prop: Prop; par: number }
  | { t: 'active'; ch: number }
  | { t: 'prise'; j: number; mot: Mot }
  | { t: 'lance'; j: number; mot: Mot }
  | { t: 'mort'; j: number; par: number; ch: number }
  | { t: 'choc'; a: number; b: number }
  | { t: 'dash'; j: number }
  | { t: 'pousse'; j: number; x: number; y: number }
  | { t: 'couronne'; j: number }
  | { t: 'vol'; a: number; b: number; n: number }
  | { t: 'ombre'; x: number; y: number; mot: Mot }
  | { t: 'chute'; x: number; y: number; mot: Mot }
  | { t: 'efface'; x: number; y: number; mot: Mot }
  | { t: 'respawn'; j: number }
  | { t: 'phase'; phase: Phase };

export type Phase = 'decompte' | 'jeu' | 'mortsubite' | 'fin';

export interface Monde {
  arene: Arene;
  tick: number;
  phase: Phase;
  temps: number; // pas restants dans la phase
  joueurs: Joueur[];
  lois: Loi[];
  mots: MotLibre[];
  caisses: Caisse[];
  couronne: Couronne | null;
  /** change quand un mot ou une caisse apparaît, disparaît ou s'arrête */
  version: number;
  ombres: Ombre[];
  chuteDans: number;
  derniereChute: number;
  /** rang du prochain mot dans la pioche de l'arène */
  pioche: number;
  graine: number;
  prochainId: number;
  vainqueur: number;
  evts: Evt[];
}

const LETTRES: Record<Chose, string> = { COURONNE: 'K', LAVE: 'L', CAISSE: 'C', MUR: 'M' };
const LARGEUR_CHASSIS = 5;
const EPS = 1e-4;

const cases = (ar: Arene, lettre: string) => ar.carte.flatMap((rang, y) => [...rang].flatMap((k, x) => (k === lettre ? [{ x, y }] : [])));

export function validerArene(ar: Arene): void {
  const refus = (quoi: string): never => { throw new Error(`arène ${ar.id} : ${quoi}`); };
  const l = ar.carte[0]?.length ?? 0;
  if (!l || ar.carte.some((r) => r.length !== l || /[^.LMKC]/.test(r))) refus('carte invalide');
  if (ar.spawns.length < CONFIG.salon.joueurs) refus("il faut 4 points d'apparition");
  const [or, ...libres] = ar.chassis;
  if (!or || or.prop !== 'POINTS' || famille(or.sujet) !== 'chose') refus("le premier châssis doit être la Loi d'or : [CHOSE] EST POINTS");
  if (libres.length < 2) refus('il faut au moins deux lois libres');
  for (const c of ar.chassis) if (ar.carte[c.y]?.slice(c.x, c.x + LARGEUR_CHASSIS) !== '.'.repeat(LARGEUR_CHASSIS)) refus(`châssis mal placé en ${c.x},${c.y}`);
  const places = [...libres.flatMap((c) => [c.sujet, c.prop]), ...ar.mots.map((m) => m.mot), or.sujet];
  for (const c of libres) if (famille(c.sujet) === 'prop' || famille(c.prop) !== 'prop') refus(`phrase mal formée ${c.sujet} EST ${c.prop}`);
  for (const m of new Set(places)) {
    const f = famille(m), n = places.filter((k) => k === m).length;
    if (!f || f === 'couleur' || m === 'POINTS') refus(`mot interdit ${m}`);
    // un seul exemplaire de chaque mot, deux pour les noms de choses
    if (n > (f === 'chose' ? 2 : 1)) refus(`trop d'exemplaires de ${m}`);
    if (f === 'chose' && !cases(ar, LETTRES[m as Chose]).length) refus(`${m} n'existe pas dans cette arène`);
  }
  for (const m of ar.pioche) if (m === 'POINTS' || (famille(m) !== 'groupe' && famille(m) !== 'prop')) refus(`la pioche n'accepte que groupes et propriétés, pas ${m}`);
}

export function creerMonde(arene: Arene, ids: number[], graine: number): Monde {
  validerArene(arene);
  const k = cases(arene, 'K')[0];
  const w: Monde = {
    arene, tick: 0, phase: 'decompte', temps: ticks(CONFIG.manche.decompte),
    joueurs: ids.map((id) => ({
      id, x: arene.spawns[id][0] + 0.5, y: arene.spawns[id][1] + 0.5, vx: 0, vy: 0, fx: 0, fy: 1,
      mort: false, tMort: 0, retour: 0, invul: 0, etourdi: 0, dashT: 0, dashCd: 0, porte: null, memoire: 0,
      pousse: { id: -1, dx: 0, dy: 0, t: 0 }, score: 0, props: [], vols: {}, seq: 0, stats: statsVides(),
    })),
    lois: arene.chassis.map((c) => loi(c.sujet, c.prop)), mots: [], caisses: [],
    couronne: k ? { x: k.x + 0.5, y: k.y + 0.5, porteur: -1 } : null, version: 0, ombres: [],
    chuteDans: ticks(CONFIG.chute.periode), derniereChute: 0, pioche: 0, graine: graine | 0, prochainId: 1, vainqueur: -1, evts: [],
  };
  // moins de caisses que de joueurs : ce qui peut rapporter doit être disputé
  const centre = (c: { x: number; y: number }) => Math.hypot(c.x + 0.5 - largeur(w) / 2, c.y + 0.5 - hauteur(w) / 2);
  for (const c of cases(arene, 'C').sort((c1, c2) => centre(c1) - centre(c2)).slice(0, Math.max(1, ids.length - 1))) w.caisses.push({ id: w.prochainId++, ...c });
  for (const m of arene.mots) semer(w, m.mot, m.x + 0.5, m.y + 0.5);
  // la couleur de chacun à ses pieds : qui la tient peut écrire une loi sur lui
  for (const p of w.joueurs) semer(w, COULEURS[p.id], p.x, p.y);
  return w;
}

// --- utilitaires ---------------------------------------------------------

export function alea(w: Monde): number {
  w.graine = (w.graine + 0x6d2b79f5) | 0;
  let t = w.graine;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const largeur = (w: Monde) => w.arene.carte[0].length;
export const hauteur = (w: Monde) => w.arene.carte.length;
const horsGrille = (w: Monde, x: number, y: number) => x < 0 || y < 0 || x >= largeur(w) || y >= hauteur(w);
export const tuileEn = (w: Monde, x: number, y: number): 'LAVE' | 'MUR' | undefined => ({ L: 'LAVE', M: 'MUR' } as const)[w.arene.carte[y]?.[x] as 'L' | 'M'];
export const caisseEn = (w: Monde, x: number, y: number) => w.caisses.find((c) => c.x === x && c.y === y);
/** Les murs et les caisses sont solides par nature, comme les bords. */
export const solideEn = (w: Monde, x: number, y: number): boolean => horsGrille(w, x, y) || tuileEn(w, x, y) === 'MUR' || !!caisseEn(w, x, y);
/** Centre de l'emplacement sujet (0) ou propriété (1) d'un châssis. */
export const emplacement = (ar: Arene, ch: number, cote: 0 | 1) => ({ x: ar.chassis[ch].x + (cote ? 4 : 1), y: ar.chassis[ch].y + 0.5 });
const surChassis = (w: Monde, x: number, y: number) => w.arene.chassis.some((c) => Math.floor(y) === c.y && x >= c.x && x < c.x + LARGEUR_CHASSIS);
export const bouclage = (w: Monde) => w.phase === 'mortsubite' || (w.phase === 'jeu' && w.temps <= ticks(CONFIG.manche.bouclage));

export const demi = (p: Joueur) => CONFIG.joueur.demi * produit(p.props, 'taille');

type Boite = [number, number, number, number];
const boite = (p: Joueur, marge = 0): Boite => {
  const h = demi(p) + marge;
  return [p.x - h, p.y - h, p.x + h, p.y + h];
};
const croise = (b: Boite, c: Boite) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1];
const cellule = (x: number, y: number): Boite => [x, y, x + 1, y + 1];

/** Une chose transmet sa propriété à qui la touche. */
export function touche(w: Monde, p: Joueur, chose: Chose): boolean {
  if (chose === 'COURONNE') return w.couronne?.porteur === p.id;
  if (chose === 'LAVE') return tuileEn(w, Math.floor(p.x), Math.floor(p.y)) === 'LAVE';
  const b = boite(p, CONFIG.contact);
  if (chose === 'CAISSE') return w.caisses.some((c) => croise(b, cellule(c.x, c.y)));
  for (let y = Math.floor(b[1]); y <= Math.floor(b[3]); y++)
    for (let x = Math.floor(b[0]); x <= Math.floor(b[2]); x++) if (tuileEn(w, x, y) === 'MUR' && croise(b, cellule(x, y))) return true;
  return false;
}

/** Un mot au sol reste lisible et laisse lire les lois : jamais à cheval sur un bord, jamais couché sur un châssis. */
const caler = (w: Monde, m: { x: number; y: number }) => {
  m.x = Math.max(0.9, Math.min(largeur(w) - 0.9, m.x));
  m.y = Math.max(0.4, Math.min(hauteur(w) - 0.4, m.y));
  for (const c of w.arene.chassis) {
    if (m.x <= c.x - 0.8 || m.x >= c.x + LARGEUR_CHASSIS + 0.8 || m.y <= c.y - 0.4 || m.y >= c.y + 1.4) continue;
    // il glisse du côté le plus proche, au-dessus ou au-dessous
    m.y = c.y + 1 >= hauteur(w) || (m.y < c.y + 0.5 && c.y >= 1) ? c.y - 0.45 : c.y + 1.45;
  }
};

function semer(w: Monde, mot: Mot, x: number, y: number): void {
  const m = { id: w.prochainId++, mot, x, y, dx: 0, dy: 0, reste: 0, par: -1, ne: w.tick };
  caler(w, m);
  w.mots.push(m);
  w.version++;
}

// --- conséquences (appelées par les composants) ---------------------------

export function marquer(w: Monde, p: Joueur, points: number): void {
  p.score += points * produit(p.props, 'gain');
}

export function tuer(w: Monde, p: Joueur, l?: Loi): void {
  if (p.mort || p.invul > 0 || l?.epargnes.includes(p.id)) return;
  // au contact d'une chose : un délai fixe ; visé par sa couleur ou un groupe : tant que la loi le vise
  const contact = !l || famille(l.sujet) === 'chose';
  Object.assign(p, { mort: true, tMort: 0, retour: ticks(contact ? CONFIG.fantome.contact : CONFIG.fantome.retour), dashT: 0, etourdi: 0, props: [] });
  p.stats.morts++;
  if (w.couronne?.porteur === p.id) { // la couronne retourne sur son socle : elle ne reste pas là où l'on meurt
    const k = cases(w.arene, 'K')[0];
    w.couronne = { x: k.x + 0.5, y: k.y + 0.5, porteur: -1 };
  }
  const auteur = l && w.joueurs.find((j) => j.id === l.auteur);
  if (l) l.victimes++;
  // une loi qui condamne aussi son auteur ne lui rapporte rien : pas de prime pour un massacre où l'on s'inclut
  if (l && auteur && auteur !== p && (contact || !resoudre(w, l.sujet).includes(auteur))) { marquer(w, auteur, CONFIG.points.victime); auteur.stats.victimes++; }
  w.evts.push({ t: 'mort', j: p.id, par: l?.auteur ?? -1, ch: l ? w.lois.indexOf(l) : -1 });
}

/** VOLEUR : prend des points à chaque joueur vivant qu'il touche. */
export function detrousser(w: Monde, p: Joueur): void {
  for (const q of w.joueurs) {
    if (q === p || q.mort || (p.vols[q.id] ?? 0) > w.tick || !croise(boite(p, CONFIG.contact), boite(q))) continue;
    p.vols[q.id] = w.tick + ticks(CONFIG.props.volRecharge);
    const n = Math.min(CONFIG.props.vol, Math.floor(q.score)); // un score ne descend jamais sous zéro
    if (n <= 0) continue;
    q.score -= n;
    marquer(w, p, n);
    p.stats.voles += n;
    w.evts.push({ t: 'vol', a: p.id, b: q.id, n });
  }
}

// --- ramasser, poser, lancer ------------------------------------------------

export type Intention =
  | { t: 'ramasser'; id: number }
  | { t: 'poser'; ch: number; cote: 0 | 1 }
  | { t: 'lancer'; dx: number; dy: number; ch: number; cote: 0 | 1 };

/** Ce que ferait le bouton d'action maintenant. Le client s'en sert pour le montrer avant l'appui. */
export function intention(w: Monde, p: Joueur): Intention | null {
  const g = CONFIG.geste, plus = demi(p) - CONFIG.joueur.demi;
  if (!p.porte) {
    let mieux: MotLibre | undefined, dm = g.ramasse + plus;
    for (const m of w.mots) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < dm) { dm = d; mieux = m; }
    }
    return mieux ? { t: 'ramasser', id: mieux.id } : null;
  }
  let pose: Intention | null = null, dp = g.pose + plus;
  let tir: Intention = { t: 'lancer', dx: p.fx, dy: p.fy, ch: -1, cote: 0 }, angle: number = g.cone;
  for (let ch = 0; ch < w.lois.length; ch++)
    for (const cote of [0, 1] as const) {
      if (!compatible(w, ch, cote, p.porte)) continue;
      const c = emplacement(w.arene, ch, cote), ex = c.x - p.x, ey = c.y - p.y, d = Math.hypot(ex, ey);
      const cos = d > EPS ? (ex * p.fx + ey * p.fy) / d : 1;
      // poser : à portée et devant soi (ou assez près pour que l'orientation ne compte plus)
      if (d < dp && (d < g.aimant || cos > 0)) { dp = d; pose = { t: 'poser', ch, cote }; }
      // lancer : la visée s'aimante vers l'emplacement le mieux aligné
      const ecart = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (d > EPS && d <= g.lancer + g.aimant && ecart < angle) { angle = ecart; tir = { t: 'lancer', dx: ex / d, dy: ey / d, ch, cote }; }
    }
  return pose ?? tir;
}

/** L'ancien mot retombe deux cases plus loin, de préférence dans le prolongement du geste et sur du sol nu. */
function ejecter(w: Monde, mot: Mot, c: { x: number; y: number }, dx: number, dy: number): void {
  const n = Math.hypot(dx, dy);
  [dx, dy] = n > 0.01 ? [dx / n, dy / n] : [0, 1];
  const E = CONFIG.geste.ejection;
  for (const difficile of [false, true])
    for (const [ax, ay] of [[dx, dy], [-dy, dx], [dy, -dx], [-dx, -dy]]) {
      const x = c.x + ax * E, y = c.y + ay * E;
      if (solideEn(w, Math.floor(x), Math.floor(y)) || (!difficile && (surChassis(w, x, y) || tuileEn(w, Math.floor(x), Math.floor(y))))) continue;
      return semer(w, mot, x, y);
    }
  semer(w, mot, c.x, c.y);
}

function poser(w: Monde, ch: number, cote: 0 | 1, mot: Mot, par: number, ox: number, oy: number): void {
  const c = emplacement(w.arene, ch, cote);
  const auteur = w.joueurs.find((j) => j.id === par);
  if (auteur) auteur.stats.ecrites++;
  ejecter(w, ecrire(w, ch, cote, mot, par), c, c.x - ox, c.y - oy);
}

function agir(w: Monde, p: Joueur): boolean {
  const it = intention(w, p);
  if (!it) return false;
  const mot = p.porte;
  if (it.t === 'ramasser') {
    const m = w.mots.find((k) => k.id === it.id)!;
    w.mots = w.mots.filter((k) => k !== m);
    p.porte = m.mot;
    if (m.reste > 0 && m.par !== p.id) p.stats.attrapes++;
    w.evts.push({ t: 'prise', j: p.id, mot: m.mot });
  } else if (mot) {
    p.porte = null;
    if (it.t === 'poser') poser(w, it.ch, it.cote, mot, p.id, p.x, p.y);
    else {
      w.mots.push({ id: w.prochainId++, mot, x: p.x, y: p.y, dx: it.dx, dy: it.dy, reste: CONFIG.geste.lancer, par: p.id, ne: w.tick });
      w.evts.push({ t: 'lance', j: p.id, mot });
    }
  }
  w.version++;
  return true;
}

/** Les mots lancés glissent droit devant : un obstacle ou un joueur les arrête, un emplacement compatible les prend. */
export function glisser(w: Monde): void {
  for (const m of [...w.mots]) {
    if (m.reste <= 0) continue;
    const d = Math.min(m.reste, CONFIG.geste.vitesseLancer * DT);
    const x = m.x + m.dx * d, y = m.y + m.dy * d;
    if (solideEn(w, Math.floor(x), Math.floor(y))) m.reste = 0;
    else { m.x = x; m.y = y; m.reste -= d; }
    for (let ch = 0; ch < w.lois.length && m.reste >= 0; ch++)
      for (const cote of [0, 1] as const) {
        const c = emplacement(w.arene, ch, cote);
        if (m.reste < 0 || !compatible(w, ch, cote, m.mot) || Math.hypot(c.x - m.x, c.y - m.y) > CONFIG.geste.aimant) continue;
        w.mots = w.mots.filter((k) => k !== m);
        const lanceur = w.joueurs.find((j) => j.id === m.par);
        if (lanceur) lanceur.stats.lances++;
        poser(w, ch, cote, m.mot, m.par, m.x - m.dx, m.y - m.dy);
        m.reste = -1;
      }
    if (m.reste > 0 && w.joueurs.some((q) => q.id !== m.par && !q.mort && Math.hypot(q.x - m.x, q.y - m.y) < demi(q) + 0.2)) m.reste = 0;
    if (m.reste === 0) { caler(w, m); m.ne = w.tick; w.version++; }
  }
}

function lacher(w: Monde, p: Joueur): void {
  if (p.porte) semer(w, p.porte, p.x, p.y);
  p.porte = null;
  if (w.couronne?.porteur === p.id) w.couronne.porteur = -1;
}

/** La couronne se porte sur la tête : on la ramasse en marchant dessus. */
function couronner(w: Monde): void {
  const c = w.couronne;
  if (!c) return;
  const porteur = w.joueurs.find((p) => p.id === c.porteur);
  if (porteur) { c.x = porteur.x; c.y = porteur.y; return; }
  const p = w.joueurs.filter((q) => !q.mort && q.etourdi === 0 && Math.hypot(q.x - c.x, q.y - c.y) < demi(q) + CONFIG.geste.couronne)
    .sort((q1, q2) => Math.hypot(q1.x - c.x, q1.y - c.y) - Math.hypot(q2.x - c.x, q2.y - c.y))[0];
  if (p) { c.porteur = p.id; w.evts.push({ t: 'couronne', j: p.id }); }
}

// --- déplacement (partagé avec la prédiction du client) -------------------

const bloque = (w: Monde, p: Joueur, x: number, y: number): boolean => {
  const h = demi(p);
  for (let cy = Math.floor(y - h); cy <= Math.floor(y + h); cy++)
    for (let cx = Math.floor(x - h); cx <= Math.floor(x + h); cx++) if (solideEn(w, cx, cy)) return true;
  return false;
};
const HUIT = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

/** Un changement de taille (ou une caisse poussée sur lui) ne coince jamais un joueur : il est ramené sur le sol libre le plus proche. */
function degager(w: Monde, p: Joueur): void {
  if (!bloque(w, p, p.x, p.y)) return;
  // d'abord sans jamais faire passer son centre à travers un mur ou une caisse ; à défaut, n'importe où plutôt que coincé
  const traverse = (ax: number, ay: number, r: number) => { for (let d = 0; d <= r; d += 0.25) if (solideEn(w, Math.floor(p.x + ax * d), Math.floor(p.y + ay * d))) return true; return false; };
  for (const partout of [false, true])
    for (let r = 0.1; r <= 2.5; r += 0.1)
      for (const [ax, ay] of HUIT)
        if (!bloque(w, p, p.x + ax * r, p.y + ay * r) && (partout || !traverse(ax, ay, r))) { p.x += ax * r; p.y += ay * r; return; }
}

/** Avance sur un axe, s'arrête au ras des obstacles ; renvoie la caisse heurtée de face. */
function avancer(w: Monde, p: Joueur, axe: 'x' | 'y', d: number): Caisse | undefined {
  if (!d) return;
  const avant = boite(p);
  const h = demi(p);
  p[axe] += d;
  let heurte: Caisse | undefined;
  const apres = boite(p);
  for (let y = Math.floor(apres[1]); y <= Math.floor(apres[3]); y++)
    for (let x = Math.floor(apres[0]); x <= Math.floor(apres[2]); x++) {
      const c = cellule(x, y);
      // on laisse sortir d'une case où l'on se trouvait déjà : jamais coincé
      if (!solideEn(w, x, y) || !croise(apres, c) || croise(avant, c)) continue;
      const k = caisseEn(w, x, y);
      const travers = axe === 'x' ? p.y - y : p.x - x;
      if (k && travers >= 0 && travers < 1) heurte = k;
      p[axe] = d > 0 ? Math.min(p[axe], (axe === 'x' ? x : y) - h - EPS) : Math.max(p[axe], (axe === 'x' ? x : y) + 1 + h + EPS);
      p[axe === 'x' ? 'vx' : 'vy'] = 0;
    }
  return heurte;
}

/**
 * Un pas d'un joueur : geste, dash, déplacement. `autorite` = faux côté client : mêmes
 * collisions et mêmes gestes (c'est la prédiction), mais les caisses ne bougent pas.
 */
export function bouger(w: Monde, p: Joueur, entree: Entree, autorite: boolean): void {
  p.seq = entree.seq;
  p.dashCd = Math.max(0, p.dashCd - produit(p.props, 'recharge'));
  const libre = p.etourdi === 0;
  if (p.etourdi > 0) p.etourdi--;
  const sens = a(p.props, 'inverse') ? -1 : 1;
  let mx = libre ? entree.mx * sens : 0, my = libre ? entree.my * sens : 0;
  const n = Math.hypot(mx, my);
  if (n > 1) { mx /= n; my /= n; }
  if (n > 0.2) { p.fx = mx / Math.min(n, 1); p.fy = my / Math.min(n, 1); }

  // mémoire d'entrée : un appui un peu trop tôt est rejoué pendant quelques pas
  if (entree.action) p.memoire = ticks(CONFIG.geste.memoire);
  if (p.memoire > 0) p.memoire = libre && agir(w, p) ? 0 : p.memoire - 1;

  degager(w, p);
  if (entree.dash && libre && p.dashCd === 0) {
    p.dashT = ticks(CONFIG.dash.duree); p.dashCd = ticks(CONFIG.dash.recharge);
    p.vx = p.fx * CONFIG.dash.vitesse; p.vy = p.fy * CONFIG.dash.vitesse;
    if (autorite) w.evts.push({ t: 'dash', j: p.id });
  }
  if (p.dashT > 0) p.dashT--;
  else {
    const v = CONFIG.joueur.vitesse * produit(p.props, 'vitesse') * (p.porte ? CONFIG.joueur.facteurPorte : 1) * (p.mort ? CONFIG.joueur.facteurFantome : 1);
    const ex = mx * v - p.vx, ey = my * v - p.vy;
    const e = Math.hypot(ex, ey);
    const pasMax = (a(p.props, 'glisse') ? CONFIG.joueur.accelGlisse : CONFIG.joueur.accel) * DT;
    const k = e > pasMax ? pasMax / e : 1;
    p.vx += ex * k; p.vy += ey * k;
  }

  const dx = p.vx * DT, dy = p.vy * DT;
  const hx = avancer(w, p, 'x', dx);
  const hy = avancer(w, p, 'y', dy);
  // on ne pousse une caisse que dans l'axe dominant de l'intention : la longer ne la déplace pas
  const cible = hx && Math.abs(mx) >= Math.abs(my) ? { id: hx.id, dx: Math.sign(dx), dy: 0 }
    : hy && Math.abs(my) > Math.abs(mx) ? { id: hy.id, dx: 0, dy: Math.sign(dy) } : null;
  if (!cible) { p.pousse.t = 0; p.pousse.id = -1; return; }
  const meme = p.pousse.id === cible.id && p.pousse.dx === cible.dx && p.pousse.dy === cible.dy;
  p.pousse = { ...cible, t: meme ? p.pousse.t + 1 : 1 };
  if (autorite && p.pousse.t >= (a(p.props, 'bouscule') ? 1 : ticks(CONFIG.caisse.delaiPousse))) {
    const c = w.caisses.find((k) => k.id === cible.id)!;
    if (!solideEn(w, c.x + cible.dx, c.y + cible.dy)) {
      c.x += cible.dx; c.y += cible.dy; w.version++;
      w.evts.push({ t: 'pousse', j: p.id, x: c.x, y: c.y });
    }
    p.pousse.t = 0;
  }
}

/** GÉANT : écarte les joueurs qu'il recouvre, sans les faire entrer dans un mur. */
function bousculer(w: Monde): void {
  for (const g of w.joueurs) {
    if (g.mort || !a(g.props, 'bouscule')) continue;
    for (const q of w.joueurs) {
      if (q === g || q.mort || a(q.props, 'inebranlable') || !croise(boite(g), boite(q))) continue;
      const ex = q.x - g.x, ey = q.y - g.y, axe = Math.abs(ex) >= Math.abs(ey) ? 'x' : 'y';
      const e = axe === 'x' ? ex : ey;
      avancer(w, q, axe, (e < 0 ? -1 : 1) * Math.min(0.4, demi(g) + demi(q) - Math.abs(e)));
    }
  }
}

function chocs(w: Monde): void {
  for (const p of w.joueurs) {
    if (p.dashT <= 0 || p.mort) continue;
    for (const q of w.joueurs) {
      if (q === p || q.mort || q.invul > 0 || q.etourdi > 0 || a(q.props, 'inebranlable') || !croise(boite(p), boite(q))) continue;
      q.etourdi = ticks(CONFIG.dash.etourdi); q.dashT = 0;
      q.vx = p.fx * CONFIG.dash.recul; q.vy = p.fy * CONFIG.dash.recul;
      lacher(w, q);
      p.stats.dashs++;
      w.evts.push({ t: 'choc', a: p.id, b: q.id });
    }
  }
}

// --- mots du ciel -----------------------------------------------------------

const pris = (w: Monde, mot: Mot) => w.lois.some((l) => l.sujet === mot || l.prop === mot) || w.joueurs.some((p) => p.porte === mot);
const attendu = (w: Monde, mot: Mot) => w.ombres.some((o) => o.mot === mot);

/**
 * Choisit le prochain mot du ciel : dans une loi restée inchangée trop longtemps (la plus ancienne
 * d'abord), sinon au sol. Un mot que le ciel reprend quitte le sol dès l'annonce : rien ne peut l'en empêcher.
 */
function planifier(w: Monde, vieilles: number[], auSol: boolean): void {
  const ar = w.arene, t = ticks(CONFIG.chute.ombre);
  const annoncer = (o: Ombre) => { w.ombres.push(o); w.evts.push({ t: 'ombre', x: o.x, y: o.y, mot: o.mot }); };
  const piocher = (bon: (m: Mot) => boolean): Mot | undefined => {
    for (let k = 0; k < ar.pioche.length; k++) {
      const i = (w.pioche + k) % ar.pioche.length;
      if (bon(ar.pioche[i]) && !pris(w, ar.pioche[i]) && !attendu(w, ar.pioche[i])) { w.pioche = i + 1; return ar.pioche[i]; }
    }
  };
  const reprendre = (m: MotLibre | undefined): Mot | undefined => {
    if (!m) return;
    w.mots = w.mots.filter((k) => k !== m);
    w.version++;
    w.evts.push({ t: 'efface', x: m.x, y: m.y, mot: m.mot });
    return m.mot;
  };
  const posee = (mot: Mot) => w.mots.find((m) => m.mot === mot && m.reste <= 0);
  for (const ch of vieilles) {
    const cote = (m: Mot) => (famille(m) === 'prop' ? 1 : 0);
    let mot: Mot | undefined;
    if (ch === 0) {
      // la Loi d'or ne reçoit que des noms de choses : celui qui traîne au sol depuis le plus longtemps, à défaut celui qu'un joueur garde en main
      mot = reprendre(w.mots.filter((m) => m.reste <= 0 && compatible(w, 0, 0, m.mot)).sort((m1, m2) => m1.ne - m2.ne)[0]);
      const porteur = mot ? undefined : w.joueurs.find((p) => p.porte && compatible(w, 0, 0, p.porte));
      if (porteur) { mot = porteur.porte!; porteur.porte = null; w.evts.push({ t: 'efface', x: porteur.x, y: porteur.y, mot }); }
    } else {
      // d'abord un mot qui n'est nulle part, sinon un mot qui traîne au sol
      mot = piocher((m) => compatible(w, ch, cote(m), m) && !w.mots.some((k) => k.mot === m))
        ?? reprendre(posee(piocher((m) => compatible(w, ch, cote(m), m) && !!posee(m)) as Mot));
    }
    if (mot) return annoncer({ ...emplacement(ar, ch, cote(mot)), mot, t, ch, cote: cote(mot) });
  }
  const mot = auSol && piocher((m) => !w.mots.some((k) => k.mot === m));
  for (let essai = 0; mot && essai < 60; essai++) {
    const x = Math.floor(alea(w) * largeur(w)) + 0.5, y = Math.floor(alea(w) * hauteur(w)) + 0.5;
    if (solideEn(w, Math.floor(x), Math.floor(y)) || tuileEn(w, Math.floor(x), Math.floor(y)) || surChassis(w, x, y) || w.ombres.some((o) => o.x === x && o.y === y)) continue;
    return annoncer({ x, y, mot, t, ch: -1, cote: 0 });
  }
}

function chutes(w: Monde): void {
  for (const o of w.ombres) {
    if (--o.t > 0) continue;
    if (o.ch < 0) semer(w, o.mot, o.x, o.y);
    else if (compatible(w, o.ch, o.cote, o.mot)) poser(w, o.ch, o.cote, o.mot, -1, o.x, o.y - 1);
    else ejecter(w, o.mot, o, 0, 1); // la loi a changé entre-temps : le mot tombe à côté
    w.evts.push({ t: 'chute', x: o.x, y: o.y, mot: o.mot });
  }
  w.ombres = w.ombres.filter((o) => o.t > 0);
  // une loi restée inchangée trop longtemps reçoit un mot du ciel, sans attendre la chute périodique
  const vieilles = w.lois.map((_, ch) => ch).filter((ch) => w.lois[ch].age >= ticks(CONFIG.chute.inertie) && !w.ombres.some((o) => o.ch === ch))
    .sort((c1, c2) => w.lois[c2].age - w.lois[c1].age);
  const periodique = --w.chuteDans <= 0;
  if (periodique) w.chuteDans = ticks(CONFIG.chute.periode);
  if (!periodique && (!vieilles.length || w.tick - w.derniereChute < ticks(CONFIG.chute.ecart))) return;
  w.derniereChute = w.tick;
  planifier(w, vieilles, periodique);
}

/** Pas plus de mots libres que le plafond : le groupe ou la propriété qui traîne depuis le plus longtemps disparaît. */
function plafonner(w: Monde): void {
  const compte = () => [...w.mots.map((m) => m.mot), ...w.joueurs.map((p) => p.porte)].filter((m) => m && famille(m) !== 'couleur').length;
  while (compte() > CONFIG.chute.max) {
    const vieux = w.mots.filter((m) => m.reste <= 0 && famille(m.mot) !== 'couleur' && famille(m.mot) !== 'chose').sort((m1, m2) => m1.ne - m2.ne)[0];
    if (!vieux) return;
    w.mots = w.mots.filter((m) => m !== vieux);
    w.version++;
    w.evts.push({ t: 'efface', x: vieux.x, y: vieux.y, mot: vieux.mot });
  }
}

// --- le pas ---------------------------------------------------------------

function fantome(w: Monde, p: Joueur): void {
  p.tMort++;
  const lois = condamnent(w, p);
  if (lois.length && p.tMort < ticks(CONFIG.fantome.max)) { p.retour = ticks(CONFIG.fantome.retour); return; }
  // plafond atteint : la loi qui le tenait mort le lâche, et ne peut plus le tuer tant qu'elle n'est pas réécrite
  for (const l of lois) l.epargnes.push(p.id);
  if (--p.retour > 0) return;
  const mortelles = CHOSES.filter((c) => w.lois.some((l) => l.arme === 0 && l.sujet === c && l.prop === 'MORT'));
  const n = w.arene.spawns.length;
  // son point de départ, sauf s'il touche quelque chose qui tue
  const sur = Array.from({ length: n }, (_, i) => w.arene.spawns[(p.id + i) % n]).find(([sx, sy]) => !mortelles.some((c) => touche(w, { ...p, x: sx + 0.5, y: sy + 0.5 }, c)));
  const [sx, sy] = sur ?? w.arene.spawns[p.id];
  Object.assign(p, { x: sx + 0.5, y: sy + 0.5, vx: 0, vy: 0, mort: false, invul: ticks(CONFIG.joueur.invulnerable) });
  w.evts.push({ t: 'respawn', j: p.id });
}

/** Les premiers au score, ex æquo compris ; un seul = il gagne. */
export const enTete = (w: Monde): Joueur[] => resoudre(w, 'LEADER');

function finir(w: Monde, vainqueur: Joueur): void {
  w.phase = 'fin'; w.vainqueur = vainqueur.id;
  w.evts.push({ t: 'phase', phase: 'fin' });
}

/** Un pas de simulation à durée fixe. Les événements du pas s'accumulent dans `w.evts`. */
export function pas(w: Monde, entrees: Record<number, Entree>): void {
  w.tick++;
  if (w.phase === 'fin') return;
  if (w.phase === 'decompte') {
    if (--w.temps <= 0) { w.phase = 'jeu'; w.temps = ticks(CONFIG.manche.duree); w.evts.push({ t: 'phase', phase: 'jeu' }); }
    return;
  }
  chutes(w);
  for (const p of w.joueurs) bouger(w, p, entrees[p.id] ?? ENTREE_VIDE, true);
  glisser(w);
  bousculer(w);
  couronner(w);
  w.lois.forEach((l, ch) => {
    l.age++;
    l.sceaux = [Math.max(0, l.sceaux[0] - 1), Math.max(0, l.sceaux[1] - 1)];
    if (l.arme > 0 && --l.arme === 0) w.evts.push({ t: 'active', ch });
  });
  appliquerLois(w);
  for (const p of w.joueurs) {
    if (p.invul > 0) p.invul--;
    if (p.mort) fantome(w, p);
  }
  chocs(w);
  plafonner(w);

  const tete = enTete(w);
  if (w.phase === 'mortsubite' && tete.length === 1) return finir(w, tete[0]);
  if (--w.temps > 0) return;
  if (tete.length === 1 || w.phase === 'mortsubite') return finir(w, tete[Math.floor(alea(w) * tete.length)]);
  w.phase = 'mortsubite'; w.temps = ticks(CONFIG.manche.mortSubiteMax);
  w.evts.push({ t: 'phase', phase: 'mortsubite' });
}
