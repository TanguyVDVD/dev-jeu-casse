import { creerMonde, pas, type Arene, type Entree, type Monde } from '../src/index';

export const VIDE = Array.from({ length: 7 }, () => '.'.repeat(12));

/** Petit monde de test, déjà en jeu, sans chute de mots. */
export function monde(blocs: Arene['blocs'] = [], carte: string[] = VIDE, n = 4): Monde {
  const arene: Arene = { id: 'test', nom: '', description: '', carte, blocs, spawns: [[5, 6], [7, 6], [9, 6], [11, 6]], mots: ['EST'] };
  const w = creerMonde(arene, [0, 1, 2, 3].slice(0, n), 1);
  w.phase = 'jeu'; w.temps = 1e9; w.chuteDans = 1e9; w.disette = -1e9;
  return w;
}

export const vers = (mx: number, my: number, plus: Partial<Entree> = {}): Entree => ({ seq: 0, mx, my, dash: false, agrippe: false, ...plus });

export function tourner(w: Monde, n: number, entrees: Record<number, Entree> = {}): void {
  for (let i = 0; i < n; i++) pas(w, entrees);
}

export function placer(w: Monde, id: number, x: number, y: number): void {
  Object.assign(w.joueurs[id], { x, y });
}
