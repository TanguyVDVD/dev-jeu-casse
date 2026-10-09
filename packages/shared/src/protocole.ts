import { CONFIG } from './config';
import type { Loi } from './lois';
import type { Caisse, Couronne, Evt, Joueur, Monde, MotLibre, Ombre, Phase, Stats } from './monde';

// --- client -> serveur ----------------------------------------------------

export type MessageClient =
  | { t: 'creer'; pseudo: string }
  | { t: 'essai'; pseudo: string }
  | { t: 'rejoindre'; code: string; pseudo: string; jeton?: string }
  | { t: 'couleur'; c: number }
  | { t: 'pret'; v: boolean }
  | { t: 'bot'; n: 1 | -1 }
  | { t: 'lancer' }
  | { t: 'salon' }
  | { t: 'emote'; n: number }
  | { t: 'i'; s: number; mx: number; my: number; d: boolean; a: boolean };

const entier = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const axe = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1;
const bool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Retire les caractères de contrôle et les chevrons, borne la longueur ; chaîne vide si rien d'utilisable. */
export function nettoyerPseudo(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, CONFIG.salon.pseudoMax);
}

/** Valide un message entrant ; tout ce qui n'est pas strictement attendu est rejeté. */
export function validerMessage(m: any): MessageClient | null {
  if (!m || typeof m !== 'object') return null;
  switch (m.t) {
    case 'creer':
    case 'essai': {
      const pseudo = nettoyerPseudo(m.pseudo);
      return pseudo ? { t: m.t, pseudo } : null;
    }
    case 'rejoindre': {
      const pseudo = nettoyerPseudo(m.pseudo);
      if (!pseudo || typeof m.code !== 'string' || !/^[A-Z]{4}$/.test(m.code)) return null;
      const jeton = typeof m.jeton === 'string' && /^[a-f0-9]{32}$/.test(m.jeton) ? m.jeton : undefined;
      return { t: 'rejoindre', code: m.code, pseudo, jeton };
    }
    case 'couleur': return entier(m.c, 0, 3) ? { t: 'couleur', c: m.c } : null;
    case 'pret': return bool(m.v) ? { t: 'pret', v: m.v } : null;
    case 'bot': return m.n === 1 || m.n === -1 ? { t: 'bot', n: m.n } : null;
    case 'lancer': return { t: 'lancer' };
    case 'salon': return { t: 'salon' };
    case 'emote': return entier(m.n, 0, 3) ? { t: 'emote', n: m.n } : null;
    case 'i': return entier(m.s, 0, 2 ** 31) && axe(m.mx) && axe(m.my) && bool(m.d) && bool(m.a)
      ? { t: 'i', s: m.s, mx: m.mx, my: m.my, d: m.d, a: m.a } : null;
    default: return null;
  }
}

// --- serveur -> client ----------------------------------------------------

export interface Place { c: number; pseudo: string; pret: boolean; bot: boolean; connecte: boolean; hote: boolean; victoires: number }
export interface EtatSalon { code: string; phase: 'salon' | 'match' | 'fin'; places: Place[] }
export interface Titre { c: number; titre: string; detail: string }

/** `m` et `x` (mots libres, caisses) ne sont envoyés que lorsqu'ils changent ou qu'un mot vole. */
export interface Instantane {
  t: 's'; k: number; ph: Phase; tp: number;
  j: Joueur[]; l: Loi[]; o: Ombre[]; c: Couronne | null; n: number; m?: MotLibre[]; x?: Caisse[]; e: Evt[];
}

export type MessageServeur =
  | { t: 'bienvenue'; code: string; jeton: string; moi: number }
  | { t: 'salon'; etat: EtatSalon; moi: number }
  | { t: 'manche'; arene: string; numero: number; manches: number[]; ids: number[] }
  | Instantane
  | { t: 'finmanche'; vainqueur: number; manches: number[] }
  | { t: 'fin'; vainqueur: number; manches: number[]; stats: Record<number, Stats>; titres: Titre[] }
  | { t: 'emote'; c: number; n: number }
  | { t: 'erreur'; msg: string };

export function instantane(w: Monde, complet: boolean): Instantane {
  return { t: 's', k: w.tick, ph: w.phase, tp: w.temps, j: w.joueurs, l: w.lois, o: w.ombres, c: w.couronne, n: w.prochainId, m: complet ? w.mots : undefined, x: complet ? w.caisses : undefined, e: w.evts };
}

// 3 décimales suffisent et divisent la taille des instantanés par deux
export const serialiser = (m: MessageServeur) => JSON.stringify(m, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));

/**
 * Réplique locale du monde. Renvoie la fonction qui y recopie un instantané : les mots et les caisses
 * repartent toujours de la dernière version reçue, car la prédiction des gestes les modifie entre-temps.
 */
export function replique(): (w: Monde, s: Instantane) => void {
  let mots: MotLibre[] = [], caisses: Caisse[] = [];
  return (w, s) => {
    if (s.m && s.x) { mots = s.m; caisses = s.x; }
    Object.assign(w, { tick: s.k, phase: s.ph, temps: s.tp, joueurs: s.j, lois: s.l, ombres: s.o, couronne: s.c, prochainId: s.n, evts: [] });
    w.mots = mots.map((m) => ({ ...m }));
    w.caisses = caisses.map((c) => ({ ...c }));
  };
}
