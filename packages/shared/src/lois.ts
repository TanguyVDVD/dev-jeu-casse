import { CONFIG, ticks } from './config';
import { bouclage, touche, type Joueur, type Monde } from './monde';
import { PROPRIETES } from './proprietes';
import { COULEURS, famille, type Chose, type Mot, type Prop, type Sujet } from './vocab';

/** La phrase d'un châssis : [SUJET] EST [PROPRIÉTÉ]. `w.lois[i]` est celle de `arene.chassis[i]`. */
export interface Loi {
  sujet: Sujet;
  prop: Prop;
  /** dernier joueur à y avoir posé un mot ; -1 : phrase de départ ou mot du ciel */
  auteur: number;
  /** pas restants avant qu'elle agisse (0 = en vigueur) */
  arme: number;
  /** pas de sceau restants sur [sujet, propriété] */
  sceaux: [number, number];
  /** pas écoulés depuis son dernier changement */
  age: number;
  /** joueurs qu'elle touche à ce pas */
  touches: number[];
  /** chose : joueur -> pas d'effet restants après le contact */
  remanence: Record<number, number>;
  victimes: number;
  /** joueurs qu'elle a tenus morts jusqu'au plafond : elle ne peut plus les tuer */
  epargnes: number[];
}

export const loi = (sujet: Sujet, prop: Prop): Loi =>
  ({ sujet, prop, auteur: -1, arme: 0, sceaux: [0, 0], age: 0, touches: [], remanence: {}, victimes: 0, epargnes: [] });

/** Ce mot peut-il remplacer le sujet (0) ou la propriété (1) de ce châssis, maintenant ? */
export function compatible(w: Monde, ch: number, cote: 0 | 1, mot: Mot): boolean {
  const l = w.lois[ch];
  if (l.sceaux[cote] > 0 || (cote ? l.prop : l.sujet) === mot) return false;
  const f = famille(mot);
  // la Loi d'or (châssis 0) : POINTS est gravé, et seule une chose peut rapporter
  return cote ? ch > 0 && f === 'prop' : ch > 0 ? f !== 'prop' : f === 'chose';
}

/** Remplace un mot du châssis : l'ancienne loi cesse, la nouvelle s'arme, le mot posé est scellé. Renvoie le mot éjecté. */
export function ecrire(w: Monde, ch: number, cote: 0 | 1, mot: Mot, par: number): Mot {
  const avant = w.lois[ch];
  const sceaux: [number, number] = [avant.sceaux[0], avant.sceaux[1]];
  sceaux[cote] = Math.round(ticks(CONFIG.loi.sceau) * (bouclage(w) ? CONFIG.loi.sceauBouclage : 1));
  const neuve = { ...loi(cote ? avant.sujet : (mot as Sujet), cote ? (mot as Prop) : avant.prop), auteur: par, arme: ticks(CONFIG.loi.armement), sceaux };
  w.lois[ch] = neuve;
  w.evts.push({ t: 'loi', ch, sujet: neuve.sujet, prop: neuve.prop, par });
  return cote ? avant.prop : avant.sujet;
}

const rang = (w: Monde, extreme: (...n: number[]) => number): Joueur[] => {
  const cible = extreme(...w.joueurs.map((p) => Math.floor(p.score)));
  return w.joueurs.filter((p) => Math.floor(p.score) === cible);
};

/** Les joueurs que le sujet désigne à cet instant. Toute loi finit sur des joueurs. */
export function resoudre(w: Monde, sujet: Sujet): Joueur[] {
  if (sujet === 'TOUS') return [...w.joueurs];
  if (sujet === 'LEADER') return rang(w, Math.max);
  if (sujet === 'DERNIER') return rang(w, Math.min);
  const c = COULEURS.indexOf(sujet as (typeof COULEURS)[number]);
  if (c >= 0) return w.joueurs.filter((p) => p.id === c);
  return w.joueurs.filter((p) => !p.mort && touche(w, p, sujet as Chose));
}

/** Les lois en vigueur qui le désignent à mort par sa couleur ou par un groupe. */
export const condamnent = (w: Monde, p: Joueur): Loi[] =>
  w.lois.filter((l) => l.arme === 0 && l.prop === 'MORT' && famille(l.sujet) !== 'chose' && !l.epargnes.includes(p.id) && resoudre(w, l.sujet).includes(p));

/** Le moteur : pour chaque loi en vigueur, résoudre le sujet en joueurs, puis appliquer la propriété. */
export function appliquerLois(w: Monde): void {
  for (const p of w.joueurs) p.props = [];
  const visees: [Loi, Joueur[]][] = [];
  for (const l of w.lois) {
    l.touches = [];
    if (l.arme > 0) continue;
    const cibles = resoudre(w, l.sujet);
    if (famille(l.sujet) === 'chose' && PROPRIETES[l.prop].remanent !== false) {
      // l'effet transmis par une chose se prolonge un peu après le contact, pour rester visible
      for (const p of cibles) l.remanence[p.id] = ticks(CONFIG.loi.remanence) + 1;
      for (const p of w.joueurs) {
        if (!l.remanence[p.id]) continue;
        if (p.mort || --l.remanence[p.id] <= 0) delete l.remanence[p.id];
        else if (!cibles.includes(p)) cibles.push(p);
      }
    }
    l.touches = cibles.map((p) => p.id);
    for (const p of cibles) if (!p.mort) p.props.push(l.prop);
    visees.push([l, cibles]);
  }
  // les effets, une fois toutes les propriétés connues (DOUBLE vaut pour les points du même pas) ;
  // MORT d'abord : elle l'emporte sur tout ce que les autres lois donneraient
  visees.sort(([l1], [l2]) => Number(l2.prop === 'MORT') - Number(l1.prop === 'MORT'));
  for (const [l, cibles] of visees) for (const p of cibles) if (!p.mort) PROPRIETES[l.prop].surJoueur?.(w, p, l);
}
