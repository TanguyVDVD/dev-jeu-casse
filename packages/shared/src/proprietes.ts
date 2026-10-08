import { CONFIG } from './config';
import { marquer, tuer, type Joueur, type Monde, type RegleActive } from './monde';
import type { Objet, Prop } from './vocab';

/**
 * Un composant par propriété. La simulation ne connaît aucun mot : elle lit ces
 * champs sur les étiquettes des entités. Ajouter un mot = une entrée ici + son nom dans vocab.ts.
 */
export interface Composant {
  contraire?: Prop;
  /** multiplicateur de vitesse du joueur étiqueté, ou du joueur au contact de l'objet étiqueté */
  vitesse?: number;
  /** multiplicateur de taille du joueur */
  taille?: number;
  glisse?: true;
  solide?: true;
  attire?: true;
  invisible?: true;
  /** à chaque pas, pour un joueur vivant qui porte l'étiquette armée */
  surJoueur?(w: Monde, p: Joueur, dt: number, regle?: RegleActive): void;
  /** à chaque pas, pour un joueur vivant au contact d'un objet étiqueté */
  auContact?(w: Monde, p: Joueur, objet: Objet, dt: number, regle?: RegleActive): void;
}

export const PROPRIETES: Record<Prop, Composant> = {
  MORT: {
    contraire: 'POINTS',
    surJoueur: (w, p, _dt, regle) => tuer(w, p, regle),
    auContact: (w, p, _o, _dt, regle) => tuer(w, p, regle),
  },
  POINTS: {
    contraire: 'MORT',
    surJoueur: (w, p, dt, regle) => marquer(w, p, CONFIG.points.passif * dt, regle),
    auContact: (w, p, _o, dt, regle) => marquer(w, p, CONFIG.points.contact * dt, regle),
  },
  SOLIDE: { solide: true },
  RAPIDE: { contraire: 'LENT', vitesse: CONFIG.props.rapide },
  LENT: { contraire: 'RAPIDE', vitesse: CONFIG.props.lent },
  GEANT: { taille: CONFIG.props.geant },
  GLISSANT: { glisse: true },
  AIMANT: { attire: true },
  INVISIBLE: { invisible: true },
};

export const a = (tags: readonly Prop[], champ: 'glisse' | 'solide' | 'attire' | 'invisible') =>
  tags.some((t) => PROPRIETES[t][champ]);
export const produit = (tags: readonly Prop[], champ: 'vitesse' | 'taille') =>
  tags.reduce((m, t) => m * (PROPRIETES[t][champ] ?? 1), 1);
