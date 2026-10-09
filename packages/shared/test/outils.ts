import { creerMonde, loi, pas, type Arene, type Chose, type Entree, type Monde, type Prop, type Sujet } from '../src/index';

/**
 * Carte de test. Loi d'or en (0,0), lois libres en (0,2) et (8,2) : emplacements sujet/propriété
 * en (1, y+0,5) et (4, y+0,5), puis (9, 2,5) et (12, 2,5). Lave (2,4), mur (5,4), caisse (8,4), couronne (11,4).
 */
export const CARTE = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..L..M..C..K..',
  '..............',
  '..............',
  '..............',
  '..............',
];

interface Options { or?: Chose; lois?: [Sujet, Prop][]; mots?: Arene['mots']; n?: number; carte?: string[]; pioche?: Arene['pioche'] }

/** Petit monde de test, déjà en jeu, sans mot du ciel. */
export function monde({ or = 'COURONNE', lois = [['MUR', 'LENT'], ['CAISSE', 'RAPIDE']], mots = [], n = 4, carte = CARTE, pioche = [] }: Options = {}): Monde {
  const places = [[0, 0], [0, 2], [8, 2]];
  const arene: Arene = {
    id: 'test', nom: '', description: '', carte, spawns: [[1, 7], [4, 7], [7, 7], [10, 7]], mots, pioche,
    chassis: [[or, 'POINTS'] as [Sujet, Prop], ...lois].map(([sujet, prop], i) => ({ x: places[i][0], y: places[i][1], sujet, prop })),
  };
  const w = creerMonde(arene, [0, 1, 2, 3].slice(0, n), 1);
  w.phase = 'jeu'; w.temps = 1e9; w.chuteDans = 1e9;
  for (const l of w.lois) l.age = -1e9;
  return w;
}

/** Met une loi en vigueur d'autorité (les phrases de départ d'une arène n'acceptent pas les couleurs). */
export function decreter(w: Monde, ch: number, sujet: Sujet, prop: Prop, auteur = -1): void {
  w.lois[ch] = { ...loi(sujet, prop), auteur, age: -1e9 };
}

export const vers = (mx: number, my: number, plus: Partial<Entree> = {}): Entree => ({ seq: 0, mx, my, dash: false, action: false, ...plus });
export const ACTION = vers(0, 0, { action: true });
export function tourner(w: Monde, n: number, entrees: Record<number, Entree> = {}): void {
  for (let i = 0; i < n; i++) pas(w, entrees);
}
export function placer(w: Monde, id: number, x: number, y: number): void {
  Object.assign(w.joueurs[id], { x, y });
}
/** Place le joueur là où il touche la chose. */
export function toucher(w: Monde, id: number, chose: Chose): void {
  const ou = { LAVE: [2.5, 4.5], MUR: [5.5, 5.35], CAISSE: [8.5, 5.35], COURONNE: [11.5, 4.5] }[chose];
  placer(w, id, ou[0], ou[1]);
  if (chose === 'COURONNE') tourner(w, 1);
}
