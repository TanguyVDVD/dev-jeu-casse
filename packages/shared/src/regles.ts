import { PROPRIETES } from './proprietes';
import { COULEURS, OBJETS, estProp, estSujet, type Mot, type Objet, type Prop, type Sujet } from './vocab';

export interface Regle {
  id: string; // « LAVE EST MORT »
  sujet: Sujet;
  prop: Prop;
}

/** Lit la grille : toute suite SUJET-EST-PROPRIÉTÉ vers la droite ou vers le bas. */
export function scanner(blocs: readonly { x: number; y: number; mot: Mot | null }[]): Regle[] {
  const grille = new Map<string, Mot>();
  for (const b of blocs) if (b.mot) grille.set(`${b.x},${b.y}`, b.mot);
  const regles = new Map<string, Regle>();
  for (const b of blocs) {
    if (b.mot !== 'EST') continue;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const sujet = grille.get(`${b.x - dx},${b.y - dy}`);
      const prop = grille.get(`${b.x + dx},${b.y + dy}`);
      if (estSujet(sujet) && estProp(prop)) regles.set(`${sujet} EST ${prop}`, { id: `${sujet} EST ${prop}`, sujet, prop });
    }
  }
  return [...regles.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function comparer<R extends Regle>(avant: readonly R[], apres: readonly Regle[]) {
  return {
    ajoutees: apres.filter((r) => !avant.some((a) => a.id === r.id)),
    retirees: avant.filter((a) => !apres.some((r) => r.id === a.id)),
  };
}

/** Deux propriétés contraires sur le même sujet s'annulent. */
export function annuler(props: readonly Prop[]): Prop[] {
  const uniques = [...new Set(props)];
  return uniques.filter((p) => {
    const contraire = PROPRIETES[p].contraire;
    return !contraire || !uniques.includes(contraire);
  });
}

export function etiquettesObjets(regles: readonly Regle[]): Record<Objet, Prop[]> {
  const tags = {} as Record<Objet, Prop[]>;
  for (const o of OBJETS) tags[o] = annuler(regles.filter((r) => r.sujet === o).map((r) => r.prop));
  return tags;
}

type Classe = { id: number; score: number };

/** Le joueur seul à l'extrémité du classement, sinon -1. */
function seul(joueurs: readonly Classe[], signe: 1 | -1): number {
  if (joueurs.length < 2) return -1;
  const tri = [...joueurs].sort((a, b) => signe * (b.score - a.score));
  return tri[0].score === tri[1].score ? -1 : tri[0].id;
}

export function vise(sujet: Sujet, joueurs: readonly Classe[], id: number): boolean {
  if (sujet === 'TOUS') return true;
  if (sujet === 'LEADER') return seul(joueurs, 1) === id;
  if (sujet === 'DERNIER') return seul(joueurs, -1) === id;
  return COULEURS[id] === sujet;
}

export function etiquettesJoueur(regles: readonly Regle[], joueurs: readonly Classe[], id: number): Prop[] {
  return annuler(regles.filter((r) => vise(r.sujet, joueurs, id)).map((r) => r.prop));
}
