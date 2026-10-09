import { CONFIG, DT } from './config';
import type { Loi } from './lois';
import { bouclage, detrousser, marquer, tuer, type Joueur, type Monde } from './monde';
import type { Prop } from './vocab';

/**
 * Un composant par propriété. Le moteur ne connaît aucun mot : il lit ces champs
 * sur les propriétés que les lois donnent à un joueur. Ajouter un mot = une entrée ici + son nom dans vocab.ts.
 */
export interface Composant {
  /** ce qu'un bot en pense : positif, il la veut pour lui ; négatif, pour les autres */
  attrait: number;
  vitesse?: number;
  taille?: number;
  /** vitesse de recharge du dash */
  recharge?: number;
  /** multiplicateur de tous les points gagnés */
  gain?: number;
  glisse?: true;
  inverse?: true;
  invisible?: true;
  /** ni étourdi ni repoussé */
  inebranlable?: true;
  /** écarte joueurs et caisses en marchant */
  bouscule?: true;
  /** faux : transmis par une chose, l'effet cesse avec le contact */
  remanent?: false;
  /** à chaque pas, pour un joueur vivant que la loi touche */
  surJoueur?(w: Monde, p: Joueur, loi: Loi): void;
}

export const PROPRIETES: Record<Prop, Composant> = {
  POINTS: { attrait: 0, remanent: false, surJoueur: (w, p) => marquer(w, p, (DT / CONFIG.points.periode) * (bouclage(w) ? CONFIG.points.bouclage : 1)) },
  MORT: { attrait: -10, remanent: false, surJoueur: tuer },
  LENT: { attrait: -3, vitesse: CONFIG.props.lent },
  RAPIDE: { attrait: 3, vitesse: CONFIG.props.rapide, recharge: CONFIG.props.rapideRecharge },
  GEANT: { attrait: 1, taille: CONFIG.props.geant, vitesse: CONFIG.props.geantVitesse, inebranlable: true, bouscule: true },
  GLISSANT: { attrait: -2, glisse: true },
  INVERSE: { attrait: -3, inverse: true },
  INVISIBLE: { attrait: 1.5, invisible: true },
  DOUBLE: { attrait: 5, gain: CONFIG.props.double },
  VOLEUR: { attrait: 2.5, surJoueur: detrousser },
};

type Drapeau = 'glisse' | 'inverse' | 'invisible' | 'inebranlable' | 'bouscule';
export const a = (props: readonly Prop[], champ: Drapeau) => props.some((t) => PROPRIETES[t][champ]);
export const produit = (props: readonly Prop[], champ: 'vitesse' | 'taille' | 'recharge' | 'gain') =>
  props.reduce((m, t) => m * (PROPRIETES[t][champ] ?? 1), 1);
