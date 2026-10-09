// Toutes les valeurs d'équilibrage. Distances en cases, durées en secondes.
export const CONFIG = {
  tickHz: 30,
  manche: { duree: 90, decompte: 7, aide: 20, pause: 6, aGagner: 3, mortSubiteMax: 30, bouclage: 15 },
  joueur: { vitesse: 5.2, demi: 0.32, accel: 70, accelGlisse: 5, invulnerable: 1.5, facteurPorte: 0.9, facteurFantome: 1.2 },
  dash: { vitesse: 15, duree: 0.16, recharge: 1.6, etourdi: 0.5, recul: 12 },
  caisse: { delaiPousse: 0.13 },
  /** ramasser, poser, lancer : portées généreuses, un geste ne rate pas à quelques pixels près */
  geste: { ramasse: 1.3, pose: 1.9, memoire: 0.2, lancer: 5, vitesseLancer: 14, aimant: 0.9, cone: 0.45, ejection: 2, couronne: 0.3 },
  loi: { armement: 1, sceau: 5, sceauBouclage: 0.5, remanence: 0.75 },
  props: { lent: 0.55, rapide: 1.5, rapideRecharge: 2, geant: 2, geantVitesse: 0.85, double: 2, vol: 2, volRecharge: 1 },
  points: { periode: 0.5, victime: 3, bouclage: 2 },
  fantome: { contact: 3, retour: 4, max: 4 },
  chute: { periode: 15, ombre: 2, inertie: 20, ecart: 4, max: 8 },
  contact: 0.08,
  reseau: { interpolationMs: 100, placeGardee: 60, messagesParSeconde: 80, octetsMax: 512 },
  salon: { max: 50, joueurs: 4, pseudoMax: 12, emoteRecharge: 0.8 },
} as const;

export const DT = 1 / CONFIG.tickHz;
export const ticks = (secondes: number) => Math.round(secondes * CONFIG.tickHz);
