// Toutes les valeurs d'équilibrage. Distances en cases, durées en secondes.
export const CONFIG = {
  tickHz: 30,
  manche: { duree: 90, decompte: 3, pause: 6, aGagner: 3, mortSubiteMax: 30, bouclage: 10 },
  joueur: { vitesse: 5.2, demi: 0.32, accel: 70, accelGlisse: 5, respawn: 3, invulnerable: 1, facteurAgrippe: 0.75 },
  dash: { vitesse: 15, duree: 0.16, recharge: 1.6, etourdi: 0.5, recul: 9 },
  bloc: { delaiPousse: 0.13, chaineMax: 3, distTire: 1.8, distLache: 2.4, max: 40 },
  regle: { armement: 1 },
  props: { rapide: 1.5, lent: 0.55, geant: 1.6, geantChaine: 2, geantObjet: 0.5, aimantRayon: 4, aimantForce: 2.4 },
  points: { passif: 2, contact: 4, victime: 3 },
  chute: { periode: 20, ombre: 2, disette: 10, pointsMax: 3 },
  contact: 0.06,
  reseau: { interpolationMs: 100, placeGardee: 60, messagesParSeconde: 80, octetsMax: 512 },
  salon: { max: 50, joueurs: 4, pseudoMax: 12, emoteRecharge: 0.8 },
} as const;

export const DT = 1 / CONFIG.tickHz;
export const ticks = (secondes: number) => Math.round(secondes * CONFIG.tickHz);
