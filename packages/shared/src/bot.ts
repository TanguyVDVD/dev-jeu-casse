import { compatible, resoudre } from './lois';
import { caisseEn, emplacement, hauteur, intention, largeur, solideEn, touche, tuileEn, type Entree, type Joueur, type Monde } from './monde';
import { PROPRIETES, a } from './proprietes';
import { CHOSES, famille, type Chose, type Mot, type Prop, type Sujet } from './vocab';

type Pt = { x: number; y: number };
type Place = { ch: number; cote: 0 | 1 };
type Phrase = { sujet: Sujet; prop: Prop };
type Acces = (q: Joueur, chose: Chose) => number;

export interface MemoireBot { seq: number; jusqua: number; route: Pt[]; mot: number; vise: Place | null }
export const memoireBot = (): MemoireBot => ({ seq: 0, jusqua: 0, route: [], mot: -1, vise: null });

const QUATRE = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const HUIT = [...QUATRE, [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;
/** gain minimal (en « intérêt ») pour qu'un bot aille chercher un mot */
const SEUIL = 1;
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/** Où toucher une chose : la couronne, les cases de lave, le sol au pied d'un mur ou d'une caisse. */
function prises(w: Monde, chose: Chose): Pt[] {
  if (chose === 'COURONNE') return w.couronne ? [w.couronne] : [];
  const pts: Pt[] = [];
  for (let y = 0; y < hauteur(w); y++)
    for (let x = 0; x < largeur(w); x++) {
      if (chose === 'LAVE') { if (tuileEn(w, x, y) === 'LAVE') pts.push({ x: x + 0.5, y: y + 0.5 }); continue; }
      if (solideEn(w, x, y)) continue;
      for (const [dx, dy] of QUATRE)
        if (chose === 'MUR' ? tuileEn(w, x + dx, y + dy) === 'MUR' : caisseEn(w, x + dx, y + dy)) pts.push({ x: x + 0.5 + dx * 0.3, y: y + 0.5 + dy * 0.3 });
    }
  return pts;
}

/** Les cases où un vivant ne doit pas mettre les pieds, vu les lois (en vigueur ou qui s'arment). */
function dangers(w: Monde): (x: number, y: number) => boolean {
  const mortelles = CHOSES.filter((c) => w.lois.some((l) => l.sujet === c && l.prop === 'MORT'));
  const pres = (x: number, y: number, bon: (cx: number, cy: number) => unknown) => HUIT.some(([dx, dy]) => bon(x + dx, y + dy));
  return (x, y) => (mortelles.includes('LAVE') && tuileEn(w, x, y) === 'LAVE')
    || (mortelles.includes('MUR') && pres(x, y, (cx, cy) => tuileEn(w, cx, cy) === 'MUR'))
    || (mortelles.includes('CAISSE') && pres(x, y, (cx, cy) => caisseEn(w, cx, cy)));
}

/**
 * Ce que vaut un jeu de lois pour ce joueur. Ce qui lui arrive compte plein ; ce qui arrive
 * aux autres compte à l'envers, et le leader pèse plus lourd : c'est lui qu'on vise.
 */
function interet(w: Monde, moi: Joueur, lois: Phrase[], acces: Acces): number {
  const premiers = resoudre(w, 'LEADER'), tete = premiers.length < w.joueurs.length ? premiers : []; // à égalité générale, personne à viser
  const or = lois[0].sujet as Chose;
  const orMortel = lois.some((l) => l.sujet === or && l.prop === 'MORT');
  let v = 0;
  for (const q of w.joueurs) {
    const k = q === moi ? 1 : tete.includes(q) ? -0.6 : -0.2;
    for (const l of lois.slice(1)) {
      // une chose ne touche que ceux qui s'en approchent : surtout celle qui rapporte
      const poids = famille(l.sujet) === 'chose' ? (touche(w, q, l.sujet as Chose) ? 1 : l.sujet === or ? 0.4 : 0.1) : resoudre(w, l.sujet).includes(q) ? 1 : 0;
      v += k * poids * PROPRIETES[l.prop].attrait;
    }
    if (!orMortel) v += k * 4 * acces(q, or);
  }
  return v;
}

/** Chemin case par case (en largeur) vers le but, ou vers la case atteignable la plus proche du but. */
function route(w: Monde, p: Joueur, but: Pt, danger: (x: number, y: number) => boolean): Pt[] {
  const L = largeur(w), H = hauteur(w);
  // un géant ne passe pas dans un couloir d'une case
  const etroit = (x: number, y: number) => a(p.props, 'bouscule') && ((solideEn(w, x - 1, y) && solideEn(w, x + 1, y)) || (solideEn(w, x, y - 1) && solideEn(w, x, y + 1)));
  const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < L && y < H && !solideEn(w, x, y) && !etroit(x, y) && (p.mort || !danger(x, y));
  const depart = Math.floor(p.y) * L + Math.floor(p.x), arrivee = Math.floor(but.y) * L + Math.floor(but.x);
  const parent = new Int16Array(L * H).fill(-1);
  parent[depart] = depart;
  const file = [depart];
  let proche = depart, dProche = Infinity;
  for (let i = 0; i < file.length && proche !== arrivee; i++) {
    const c = file[i], cx = c % L, cy = (c - cx) / L;
    const d = c === arrivee ? -1 : Math.hypot(cx + 0.5 - but.x, cy + 0.5 - but.y);
    if (d < dProche) { dProche = d; proche = c; }
    for (const [dx, dy] of HUIT) {
      const x = cx + dx, y = cy + dy;
      if (!passable(x, y) || parent[y * L + x] >= 0 || (dx && dy && !(passable(x, cy) && passable(cx, y)))) continue;
      parent[y * L + x] = c;
      file.push(y * L + x);
    }
  }
  const pts: Pt[] = proche === arrivee ? [but] : [];
  for (let c = proche; c !== depart; c = parent[c]) pts.unshift({ x: (c % L) + 0.5, y: Math.floor(c / L) + 0.5 });
  if (proche === arrivee && pts.length > 1) pts.splice(pts.length - 2, 1); // la dernière case s'efface devant le but exact
  return pts;
}

/** Où aller quand il n'y a pas de mot à déplacer : remplir la condition de la Loi d'or. */
function objectif(w: Monde, p: Joueur, danger: (x: number, y: number) => boolean): Pt {
  const or = w.lois[0].sujet as Chose;
  if (!p.mort && !w.lois.some((l) => l.sujet === or && l.prop === 'MORT')) {
    if (or === 'COURONNE' && touche(w, p, or)) { // il porte la couronne : il s'éloigne du plus proche
      const rival = w.joueurs.filter((q) => q !== p && !q.mort).sort((q1, q2) => dist(p, q1) - dist(p, q2))[0];
      if (!rival || dist(p, rival) > 5) return p;
      const d = dist(p, rival) || 1;
      return { x: Math.max(0.5, Math.min(largeur(w) - 0.5, p.x + ((p.x - rival.x) / d) * 3)), y: Math.max(0.5, Math.min(hauteur(w) - 0.5, p.y + ((p.y - rival.y) / d) * 3)) };
    }
    const pt = prises(w, or).filter((k) => !danger(Math.floor(k.x), Math.floor(k.y))).sort((k1, k2) => dist(p, k1) - dist(p, k2))[0];
    if (pt) return pt;
  }
  for (;;) { // rien à gagner : il rôde
    const x = Math.floor(Math.random() * largeur(w)), y = Math.floor(Math.random() * hauteur(w));
    if (!solideEn(w, x, y) && !danger(x, y)) return { x: x + 0.5, y: y + 0.5 };
  }
}

function planifier(w: Monde, p: Joueur, mem: MemoireBot): void {
  const cache = new Map<string, number>();
  const acces: Acces = (q, chose) => {
    const cle = `${q.id}${chose}`;
    if (!cache.has(cle)) cache.set(cle, touche(w, q, chose) ? 1 : 1 / (1 + Math.min(Infinity, ...prises(w, chose).map((k) => dist(q, k))) / 3));
    return cache.get(cle)!;
  };
  const lois: Phrase[] = w.lois.map(({ sujet, prop }) => ({ sujet, prop }));
  const actuel = interet(w, p, lois, acces);
  /** les emplacements où ce mot peut aller, avec ce que j'y gagne */
  const places = (mot: Mot) => lois.flatMap((_, ch) => ([0, 1] as const).filter((cote) => compatible(w, ch, cote, mot)).map((cote) => {
    const essai = lois.map((l, i) => (i !== ch ? l : cote ? { ...l, prop: mot as Prop } : { ...l, sujet: mot as Sujet }));
    return { ch, cote, gain: interet(w, p, essai, acces) - actuel, ...emplacement(w.arene, ch, cote) };
  }));
  const danger = dangers(w);
  let but: Pt | null = null;
  mem.mot = -1; mem.vise = null;
  if (p.porte) {
    const mieux = places(p.porte).sort((s1, s2) => s2.gain - s1.gain)[0];
    if (mieux && mieux.gain > 0) { mem.vise = mieux; but = mieux; }
    else mem.vise = { ch: -1, cote: 0 }; // plus rien d'utile à en faire : il s'en débarrasse
  } else {
    let mieux = SEUIL;
    for (const m of w.mots) {
      if (m.reste > 0) continue;
      for (const s of places(m.mot)) {
        const v = s.gain - 0.12 * (dist(p, m) + dist(m, s)); // un mot loin vaut moins
        if (v > mieux) { mieux = v; mem.mot = m.id; but = m; }
      }
    }
  }
  mem.route = route(w, p, but ?? objectif(w, p, danger), danger);
}

/** Rien de solide entre le joueur et ce point : le lancer passera. */
const degage = (w: Monde, p: Pt, c: Pt): boolean => {
  const n = Math.ceil(dist(p, c) / 0.4);
  for (let i = 1; i < n; i++) if (solideEn(w, Math.floor(p.x + ((c.x - p.x) * i) / n), Math.floor(p.y + ((c.y - p.y) * i) / n))) return false;
  return true;
};

/**
 * Le bot : il remplit la condition de la Loi d'or, réécrit la loi qui le gêne ou celle
 * qui gênerait le leader, et bouscule qui porte la couronne ou un mot.
 */
export function penser(w: Monde, id: number, mem: MemoireBot): Entree {
  const p = w.joueurs.find((j) => j.id === id);
  const entree: Entree = { seq: ++mem.seq, mx: 0, my: 0, dash: false, action: false };
  if (!p || w.phase === 'decompte' || w.phase === 'fin') return entree;
  // le compteur de pas repart de zéro à chaque manche : une échéance trop lointaine est périmée
  if (w.tick >= mem.jusqua || mem.jusqua > w.tick + 60) {
    mem.jusqua = w.tick + 8 + Math.floor(Math.random() * 10);
    planifier(w, p, mem);
  }

  const it = intention(w, p), v = mem.vise;
  const voulu = it?.t === 'ramasser' ? it.id === mem.mot
    : !!it && !!v && it.ch === v.ch && (v.ch < 0 || (it.cote === v.cote && (it.t === 'poser' || degage(w, p, emplacement(w.arene, v.ch, v.cote)))));
  if (voulu && p.memoire === 0) { entree.action = true; mem.jusqua = 0; }

  while (mem.route.length > 1 && dist(p, mem.route[0]) < 0.4) mem.route.shift();
  // au bout du chemin sans avoir atteint l'emplacement (lave, mur) : il se tourne vers lui pour lancer
  const cible = mem.route[0] ?? (v && v.ch >= 0 ? emplacement(w.arene, v.ch, v.cote) : p);
  let dx = cible.x - p.x, dy = cible.y - p.y;
  const d = Math.hypot(dx, dy), allure = mem.route.length ? 1 : 0.21;
  if (d > 0.12) { dx = (dx / d) * allure; dy = (dy / d) * allure; } else dx = dy = 0;
  // filet de sécurité : jamais un pas de plus vers ce qui tue
  const danger = dangers(w);
  if (!p.mort && !danger(Math.floor(p.x), Math.floor(p.y)) && danger(Math.floor(p.x + dx * 0.6), Math.floor(p.y + dy * 0.6))) dx = dy = 0;

  const proie = w.joueurs.find((q) => q !== p && !q.mort && q.invul === 0 && !a(q.props, 'inebranlable') && dist(p, q) < 1.7);
  if (proie && !p.mort && p.dashCd === 0 && (w.couronne?.porteur === proie.id || proie.porte || Math.random() < 0.02)) {
    const n = dist(p, proie) || 1;
    dx = (proie.x - p.x) / n; dy = (proie.y - p.y) / n;
    entree.dash = true;
  }
  const sens = a(p.props, 'inverse') ? -1 : 1; // commandes inversées : il compense, comme un joueur qui a compris
  entree.mx = Math.max(-1, Math.min(1, dx * sens));
  entree.my = Math.max(-1, Math.min(1, dy * sens));
  return entree;
}
