import { CONFIG, DT, ticks } from './config';
import { PROPRIETES, a, produit } from './proprietes';
import { annuler, comparer, etiquettesJoueur, etiquettesObjets, scanner, vise, type Regle } from './regles';
import { estMot, type Mot, type Objet, type Prop } from './vocab';

export interface Arene {
  id: string;
  nom: string;
  description: string;
  /** '.' sol, L lave, M mur, K couronne, C caisse */
  carte: string[];
  blocs: { x: number; y: number; dir?: 'h' | 'v'; mots: Mot[]; verrou?: boolean }[];
  spawns: [number, number][];
  /** le sac dans lequel piochent les chutes */
  mots: Mot[];
}

export interface Entree { seq: number; mx: number; my: number; dash: boolean; agrippe: boolean }
export const ENTREE_VIDE: Entree = { seq: 0, mx: 0, my: 0, dash: false, agrippe: false };

export interface Stats { creees: number; cassees: number; victimes: number; morts: number; dashs: number; pousses: number; generes: number }

export interface Joueur {
  id: number; // 0..3 = ROUGE, BLEU, VERT, JAUNE
  x: number; y: number; vx: number; vy: number; fx: number; fy: number;
  mort: boolean; tMort: number; invul: number; etourdi: number;
  dashT: number; dashCd: number;
  tient: number; // id du bloc agrippé, -1 sinon
  pousse: { id: number; dx: number; dy: number; t: number };
  score: number;
  /** étiquette -> pas restants avant armement (0 = armée) */
  tags: Partial<Record<Prop, number>>;
  seq: number;
  stats: Stats;
}

export interface Bloc { id: number; x: number; y: number; mot: Mot | null; verrou: boolean; par: number }
export interface Ombre { x: number; y: number; mot: Mot; t: number }
export interface RegleActive extends Regle { auteur: number; victimes: number }

export type Evt =
  | { t: 'regle'; id: string; on: boolean; par: number; auteur: number; victimes: number }
  | { t: 'mort'; j: number; par: number; regle: string }
  | { t: 'arme'; j: number; prop: Prop }
  | { t: 'choc'; a: number; b: number }
  | { t: 'dash'; j: number }
  | { t: 'pousse'; j: number; x: number; y: number }
  | { t: 'ombre'; x: number; y: number; mot: Mot }
  | { t: 'chute'; x: number; y: number; mot: Mot }
  | { t: 'respawn'; j: number }
  | { t: 'phase'; phase: Phase };

export type Phase = 'decompte' | 'jeu' | 'mortsubite' | 'fin';

export interface Monde {
  arene: Arene;
  tick: number;
  phase: Phase;
  temps: number; // pas restants dans la phase
  joueurs: Joueur[];
  blocs: Bloc[];
  versionBlocs: number;
  regles: RegleActive[];
  tagsObjet: Record<Objet, Prop[]>;
  ombres: Ombre[];
  chuteDans: number;
  disette: number;
  graine: number;
  prochainId: number;
  sale: boolean; // un bloc a bougé : relire la grille
  bougeur: number;
  vainqueur: number;
  evts: Evt[];
}

const TUILES: Record<string, Objet> = { L: 'LAVE', M: 'MUR', K: 'COURONNE' };
const EPS = 1e-4;

export function validerArene(ar: Arene): void {
  const l = ar.carte[0]?.length ?? 0;
  if (!l || ar.carte.some((r) => r.length !== l || /[^.LMKC]/.test(r))) throw new Error(`arène ${ar.id} : carte invalide`);
  if (ar.spawns.length < CONFIG.salon.joueurs) throw new Error(`arène ${ar.id} : il faut 4 points d'apparition`);
  for (const m of [...ar.mots, ...ar.blocs.flatMap((b) => b.mots)]) if (!estMot(m)) throw new Error(`arène ${ar.id} : mot inconnu ${m}`);
}

export function creerMonde(arene: Arene, ids: number[], graine: number): Monde {
  validerArene(arene);
  const w: Monde = {
    arene, tick: 0, phase: 'decompte', temps: ticks(CONFIG.manche.decompte),
    joueurs: ids.map((id) => ({
      id, x: arene.spawns[id][0] + 0.5, y: arene.spawns[id][1] + 0.5, vx: 0, vy: 0, fx: 0, fy: 1,
      mort: false, tMort: 0, invul: 0, etourdi: 0, dashT: 0, dashCd: 0, tient: -1,
      pousse: { id: -1, dx: 0, dy: 0, t: 0 }, score: 0, tags: {}, seq: 0,
      stats: { creees: 0, cassees: 0, victimes: 0, morts: 0, dashs: 0, pousses: 0, generes: 0 },
    })),
    blocs: [], versionBlocs: 0, regles: [], tagsObjet: etiquettesObjets([]), ombres: [],
    chuteDans: ticks(CONFIG.chute.periode), disette: 0, graine: graine | 0, prochainId: 1,
    sale: false, bougeur: -1, vainqueur: -1, evts: [],
  };
  const poser = (x: number, y: number, mot: Mot | null, verrou: boolean) => {
    if (blocEn(w, x, y) || horsGrille(w, x, y)) throw new Error(`arène ${arene.id} : bloc mal placé en ${x},${y}`);
    w.blocs.push({ id: w.prochainId++, x, y, mot, verrou, par: -1 });
  };
  arene.carte.forEach((rang, y) => [...rang].forEach((c, x) => c === 'C' && poser(x, y, null, false)));
  for (const b of arene.blocs) b.mots.forEach((m, i) => poser(b.x + (b.dir === 'v' ? 0 : i), b.y + (b.dir === 'v' ? i : 0), m, !!b.verrou));
  relire(w, true);
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
export const blocEn = (w: Monde, x: number, y: number) => w.blocs.find((b) => b.x === x && b.y === y);
export const tuileEn = (w: Monde, x: number, y: number): Objet | undefined => TUILES[w.arene.carte[y]?.[x] ?? '.'];
export const objetEn = (w: Monde, x: number, y: number): Objet | undefined => {
  const b = blocEn(w, x, y);
  return b ? (b.mot === null ? 'CAISSE' : undefined) : tuileEn(w, x, y);
};
const tuileSolide = (w: Monde, x: number, y: number) => {
  const t = tuileEn(w, x, y);
  return !!t && a(w.tagsObjet[t], 'solide');
};
export function solideEn(w: Monde, x: number, y: number): boolean {
  if (horsGrille(w, x, y)) return true;
  const b = blocEn(w, x, y);
  return b ? b.mot !== null || a(w.tagsObjet.CAISSE, 'solide') : tuileSolide(w, x, y);
}

/** Étiquettes armées d'un joueur vivant (un fantôme n'en a aucune). */
export const armees = (p: Joueur): Prop[] => (p.mort ? [] : (Object.keys(p.tags) as Prop[]).filter((t) => p.tags[t] === 0));
export const demi = (p: Joueur) => CONFIG.joueur.demi * produit(armees(p), 'taille');

type Boite = [number, number, number, number];
const boite = (p: Joueur, marge = 0): Boite => {
  const h = demi(p) + marge;
  return [p.x - h, p.y - h, p.x + h, p.y + h];
};
const croise = (b: Boite, c: Boite) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1];
const cellule = (x: number, y: number, marge = 0): Boite => [x - marge, y - marge, x + 1 + marge, y + 1 + marge];

/** Les types d'objets que le joueur touche. */
export function contacts(w: Monde, p: Joueur): Objet[] {
  const vus = new Set<Objet>();
  const large = boite(p, CONFIG.contact + CONFIG.props.geantObjet);
  const juste = boite(p, CONFIG.contact);
  for (let y = Math.floor(large[1]); y <= Math.floor(large[3]); y++)
    for (let x = Math.floor(large[0]); x <= Math.floor(large[2]); x++) {
      const o = objetEn(w, x, y);
      if (!o || vus.has(o)) continue;
      const grossi = w.tagsObjet[o].includes('GEANT') ? CONFIG.props.geantObjet : 0;
      if (croise(juste, cellule(x, y, grossi))) vus.add(o);
    }
  return [...vus];
}

// --- conséquences (appelées par les composants) ---------------------------

export function tuer(w: Monde, p: Joueur, regle?: RegleActive): void {
  if (p.mort || p.invul > 0) return;
  p.mort = true; p.tMort = 0; p.tient = -1; p.dashT = 0; p.etourdi = 0;
  p.stats.morts++;
  let par = -1;
  if (regle) {
    regle.victimes++;
    par = regle.auteur;
    const auteur = w.joueurs.find((j) => j.id === par);
    if (auteur && auteur !== p) { auteur.score += CONFIG.points.victime; auteur.stats.victimes++; }
  }
  w.evts.push({ t: 'mort', j: p.id, par, regle: regle?.id ?? '' });
}

export function marquer(w: Monde, p: Joueur, points: number, regle?: RegleActive): void {
  p.score += points;
  const auteur = regle && w.joueurs.find((j) => j.id === regle.auteur);
  if (auteur) auteur.stats.generes += points;
}

// --- règles ---------------------------------------------------------------

function relire(w: Monde, silencieux = false): void {
  const { ajoutees, retirees } = comparer(w.regles, scanner(w.blocs));
  const bougeur = w.joueurs.find((j) => j.id === w.bougeur);
  for (const r of retirees) {
    if (bougeur) bougeur.stats.cassees++;
    w.evts.push({ t: 'regle', id: r.id, on: false, par: w.bougeur, auteur: r.auteur, victimes: r.victimes });
  }
  w.regles = w.regles.filter((r) => !retirees.includes(r));
  for (const r of ajoutees) {
    w.regles.push({ ...r, auteur: w.bougeur, victimes: 0 });
    if (bougeur) bougeur.stats.creees++;
    if (!silencieux) w.evts.push({ t: 'regle', id: r.id, on: true, par: w.bougeur, auteur: w.bougeur, victimes: 0 });
  }
  w.tagsObjet = etiquettesObjets(w.regles);
  w.sale = false;
  w.bougeur = -1;
}

/** Pose/retire les étiquettes des joueurs ; une étiquette neuve met un délai à s'armer. */
function etiqueter(w: Monde): void {
  for (const p of w.joueurs) {
    const voulues = etiquettesJoueur(w.regles, w.joueurs, p.id);
    for (const t of Object.keys(p.tags) as Prop[]) {
      if (!voulues.includes(t)) delete p.tags[t];
      else if (p.tags[t]! > 0) p.tags[t]!--;
    }
    for (const t of voulues)
      if (!(t in p.tags)) {
        p.tags[t] = ticks(CONFIG.regle.armement);
        w.evts.push({ t: 'arme', j: p.id, prop: t });
      }
  }
}

// --- blocs ----------------------------------------------------------------

function deplacerBlocs(w: Monde, blocs: Bloc[], dx: number, dy: number, par: number): void {
  for (const b of blocs) { b.x += dx; b.y += dy; b.par = par; }
  w.sale = true; w.bougeur = par; w.versionBlocs++;
}

function pousser(w: Monde, p: Joueur, premier: Bloc, dx: number, dy: number): boolean {
  const chaine = [premier];
  let x = premier.x + dx, y = premier.y + dy;
  for (let n = blocEn(w, x, y); n; n = blocEn(w, x, y)) { chaine.push(n); x += dx; y += dy; }
  const max = CONFIG.bloc.chaineMax + (armees(p).includes('GEANT') ? CONFIG.props.geantChaine : 0);
  if (chaine.length > max || chaine.some((b) => b.verrou) || horsGrille(w, x, y) || tuileSolide(w, x, y)) return false;
  deplacerBlocs(w, chaine, dx, dy, p.id);
  p.stats.pousses++;
  w.evts.push({ t: 'pousse', j: p.id, x: premier.x, y: premier.y });
  return true;
}

function tirer(w: Monde, p: Joueur, entree: Entree, autorite: boolean): void {
  const b = w.blocs.find((k) => k.id === p.tient);
  if (!b || !entree.agrippe || p.etourdi > 0 || b.verrou) { p.tient = -1; return; }
  const ex = b.x + 0.5 - p.x, ey = b.y + 0.5 - p.y;
  const horizontal = Math.abs(ex) >= Math.abs(ey);
  const le = horizontal ? ex : ey, travers = horizontal ? ey : ex;
  const dist = Math.abs(le) - (demi(p) - CONFIG.joueur.demi);
  if (dist > CONFIG.bloc.distLache || Math.abs(travers) > 0.8) { p.tient = -1; return; }
  if (!autorite || dist < CONFIG.bloc.distTire) return;
  const dx = horizontal ? -Math.sign(le) : 0, dy = horizontal ? 0 : -Math.sign(le);
  const x = b.x + dx, y = b.y + dy;
  if (horsGrille(w, x, y) || blocEn(w, x, y) || tuileSolide(w, x, y)) return;
  deplacerBlocs(w, [b], dx, dy, p.id);
  w.evts.push({ t: 'pousse', j: p.id, x: b.x, y: b.y });
}

// --- déplacement (partagé avec la prédiction du client) -------------------

/** Avance sur un axe, s'arrête au ras des obstacles ; renvoie le bloc heurté de face. */
function avancer(w: Monde, p: Joueur, axe: 'x' | 'y', d: number): Bloc | undefined {
  if (!d) return;
  const avant = boite(p);
  const h = demi(p);
  p[axe] += d;
  let heurte: Bloc | undefined;
  const arreter = (min: number, max: number) => {
    p[axe] = d > 0 ? Math.min(p[axe], min - h - EPS) : Math.max(p[axe], max + h + EPS);
    p[axe === 'x' ? 'vx' : 'vy'] = 0;
  };
  const apres = boite(p);
  for (let y = Math.floor(apres[1]); y <= Math.floor(apres[3]); y++)
    for (let x = Math.floor(apres[0]); x <= Math.floor(apres[2]); x++) {
      const c = cellule(x, y);
      // on laisse sortir d'une case où l'on se trouvait déjà : jamais coincé
      if (!solideEn(w, x, y) || !croise(apres, c) || croise(avant, c)) continue;
      const b = blocEn(w, x, y);
      const travers = axe === 'x' ? p.y - y : p.x - x;
      if (b && travers >= 0 && travers < 1) heurte = b;
      arreter(axe === 'x' ? x : y, axe === 'x' ? x + 1 : y + 1);
    }
  if (!p.mort)
    for (const q of w.joueurs) {
      if (q === p || q.mort || !(a(armees(q), 'solide') || a(armees(p), 'solide'))) continue;
      const c = boite(q);
      if (croise(boite(p), c) && !croise(avant, c)) arreter(axe === 'x' ? c[0] : c[1], axe === 'x' ? c[2] : c[3]);
    }
  return heurte;
}

/** Traction vers l'aimant le plus proche (joueur ou case). */
function aimant(w: Monde, p: Joueur): [number, number] {
  if (p.mort || a(armees(p), 'solide')) return [0, 0];
  const R = CONFIG.props.aimantRayon;
  let mx = 0, my = 0, md: number = R;
  const voir = (x: number, y: number) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < md) { md = d; mx = x; my = y; }
  };
  for (const q of w.joueurs) if (q !== p && a(armees(q), 'attire')) voir(q.x, q.y);
  for (let y = Math.floor(p.y - R); y <= p.y + R; y++)
    for (let x = Math.floor(p.x - R); x <= p.x + R; x++) {
      const o = objetEn(w, x, y);
      if (o && a(w.tagsObjet[o], 'attire')) voir(x + 0.5, y + 0.5);
    }
  if (md >= R || md < 0.05) return [0, 0];
  const f = (CONFIG.props.aimantForce * (1 - md / R) * DT) / md;
  return [(mx - p.x) * f, (my - p.y) * f];
}

/**
 * Un pas de déplacement d'un joueur. `autorite` = faux côté client : mêmes
 * collisions, mais les blocs ne bougent pas (le serveur seul les déplace).
 */
export function bouger(w: Monde, p: Joueur, entree: Entree, autorite: boolean): void {
  p.seq = entree.seq;
  if (p.dashCd > 0) p.dashCd--;
  const libre = p.etourdi === 0;
  if (p.etourdi > 0) p.etourdi--;
  let mx = libre ? entree.mx : 0, my = libre ? entree.my : 0;
  const n = Math.hypot(mx, my);
  if (n > 1) { mx /= n; my /= n; }
  if (n > 0.2) { p.fx = mx / Math.min(n, 1); p.fy = my / Math.min(n, 1); }

  if (p.tient >= 0) tirer(w, p, entree, autorite);
  else if (entree.agrippe && libre) {
    const hz = Math.abs(p.fx) >= Math.abs(p.fy);
    const portee = demi(p) + 0.3;
    const b = blocEn(w, Math.floor(p.x + (hz ? Math.sign(p.fx) * portee : 0)), Math.floor(p.y + (hz ? 0 : Math.sign(p.fy) * portee)));
    if (b && !b.verrou) p.tient = b.id;
  }

  const propres = armees(p);
  const tous = p.mort ? [] : annuler([...propres, ...contacts(w, p).flatMap((o) => w.tagsObjet[o])]);
  if (entree.dash && libre && p.dashCd === 0) {
    p.dashT = ticks(CONFIG.dash.duree); p.dashCd = ticks(CONFIG.dash.recharge);
    p.vx = p.fx * CONFIG.dash.vitesse; p.vy = p.fy * CONFIG.dash.vitesse;
    if (autorite) w.evts.push({ t: 'dash', j: p.id });
  }
  if (p.dashT > 0) p.dashT--;
  else {
    const v = CONFIG.joueur.vitesse * produit(tous, 'vitesse') * (p.tient >= 0 ? CONFIG.joueur.facteurAgrippe : 1);
    const ex = mx * v - p.vx, ey = my * v - p.vy;
    const e = Math.hypot(ex, ey);
    const pasMax = (a(tous, 'glisse') ? CONFIG.joueur.accelGlisse : CONFIG.joueur.accel) * DT;
    const k = e > pasMax ? pasMax / e : 1;
    p.vx += ex * k; p.vy += ey * k;
  }

  const [ax, ay] = aimant(w, p);
  const dx = p.vx * DT + ax, dy = p.vy * DT + ay;
  const hx = avancer(w, p, 'x', dx);
  const hy = avancer(w, p, 'y', dy);
  // on ne pousse que dans l'axe dominant de l'intention : longer une rangée ne la déplace pas
  const cible = hx && Math.abs(mx) >= Math.abs(my) ? { id: hx.id, dx: Math.sign(dx), dy: 0 }
    : hy && Math.abs(my) > Math.abs(mx) ? { id: hy.id, dx: 0, dy: Math.sign(dy) } : null;
  if (!cible) { p.pousse.t = 0; p.pousse.id = -1; return; }
  const meme = p.pousse.id === cible.id && p.pousse.dx === cible.dx && p.pousse.dy === cible.dy;
  p.pousse = { ...cible, t: meme ? p.pousse.t + 1 : 1 };
  if (autorite && p.pousse.t >= ticks(CONFIG.bloc.delaiPousse)) {
    pousser(w, p, w.blocs.find((b) => b.id === cible.id)!, cible.dx, cible.dy);
    p.pousse.t = 0;
  }
}

// --- chutes ---------------------------------------------------------------

const nbMots = (w: Monde) => w.blocs.filter((b) => b.mot).length;

function planifierChute(w: Monde, mot: Mot): void {
  for (let essai = 0; essai < 60; essai++) {
    const x = Math.floor(alea(w) * largeur(w)), y = Math.floor(alea(w) * hauteur(w));
    if (blocEn(w, x, y) || tuileEn(w, x, y) || w.ombres.some((o) => o.x === x && o.y === y)) continue;
    w.ombres.push({ x, y, mot, t: ticks(CONFIG.chute.ombre) });
    w.evts.push({ t: 'ombre', x, y, mot });
    return;
  }
}

function chutes(w: Monde): void {
  for (const o of w.ombres) {
    if (--o.t > 0) continue;
    if (blocEn(w, o.x, o.y)) continue; // un bloc a été poussé sous l'ombre : le mot est perdu
    w.blocs.push({ id: w.prochainId++, x: o.x, y: o.y, mot: o.mot, verrou: false, par: -1 });
    w.versionBlocs++; w.sale = true;
    w.evts.push({ t: 'chute', x: o.x, y: o.y, mot: o.mot });
  }
  w.ombres = w.ombres.filter((o) => o.t > 0);
  if (--w.chuteDans <= 0) {
    w.chuteDans = ticks(CONFIG.chute.periode);
    if (nbMots(w) < CONFIG.bloc.max && w.arene.mots.length) planifierChute(w, w.arene.mots[Math.floor(alea(w) * w.arene.mots.length)]);
  }
  const attendu = w.regles.some((r) => r.prop === 'POINTS') || w.ombres.some((o) => o.mot === 'POINTS');
  w.disette = attendu ? 0 : w.disette + 1;
  if (w.disette >= ticks(CONFIG.chute.disette)) { w.disette = 0; planifierChute(w, 'POINTS'); }
}

// --- le pas ---------------------------------------------------------------

function reapparaitre(w: Monde, p: Joueur): void {
  if (++p.tMort < ticks(CONFIG.joueur.respawn) || 'MORT' in p.tags) return;
  const mortels = (Object.keys(w.tagsObjet) as Objet[]).filter((o) => w.tagsObjet[o].includes('MORT'));
  const n = w.arene.spawns.length;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = w.arene.spawns[(p.id + i) % n];
    const essai = { ...p, x: sx + 0.5, y: sy + 0.5, mort: false };
    if (contacts(w, essai).some((o) => mortels.includes(o))) continue;
    Object.assign(p, { x: essai.x, y: essai.y, vx: 0, vy: 0, mort: false, invul: ticks(CONFIG.joueur.invulnerable) });
    w.evts.push({ t: 'respawn', j: p.id });
    return;
  }
}

function chocs(w: Monde): void {
  for (const p of w.joueurs) {
    if (p.dashT <= 0 || p.mort) continue;
    for (const q of w.joueurs) {
      if (q === p || q.mort || q.invul > 0 || q.etourdi > 0 || a(armees(q), 'solide') || !croise(boite(p), boite(q))) continue;
      q.etourdi = ticks(CONFIG.dash.etourdi); q.tient = -1; q.dashT = 0;
      q.vx = p.fx * CONFIG.dash.recul; q.vy = p.fy * CONFIG.dash.recul;
      p.stats.dashs++;
      w.evts.push({ t: 'choc', a: p.id, b: q.id });
    }
  }
}

/** Les joueurs seuls en tête ; un seul = il gagne. */
export function enTete(w: Monde): Joueur[] {
  const max = Math.max(...w.joueurs.map((p) => Math.floor(p.score)));
  return w.joueurs.filter((p) => Math.floor(p.score) === max);
}

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
  if (w.sale) relire(w);
  etiqueter(w);
  for (const p of w.joueurs) {
    if (p.invul > 0) p.invul--;
    if (p.mort) { reapparaitre(w, p); continue; }
    for (const t of armees(p))
      PROPRIETES[t].surJoueur?.(w, p, DT, w.regles.find((r) => r.prop === t && vise(r.sujet, w.joueurs, p.id)));
    for (const o of contacts(w, p))
      for (const t of w.tagsObjet[o]) PROPRIETES[t].auContact?.(w, p, o, DT, w.regles.find((r) => r.sujet === o && r.prop === t));
  }
  chocs(w);

  const tete = enTete(w);
  if (w.phase === 'mortsubite' && tete.length === 1) return finir(w, tete[0]);
  if (--w.temps > 0) return;
  if (tete.length === 1 || w.phase === 'mortsubite') return finir(w, tete[Math.floor(alea(w) * tete.length)]);
  w.phase = 'mortsubite'; w.temps = ticks(CONFIG.manche.mortSubiteMax);
  w.evts.push({ t: 'phase', phase: 'mortsubite' });
}
