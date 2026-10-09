export const COULEURS = ['ROUGE', 'BLEU', 'VERT', 'JAUNE'] as const;
export const GROUPES = ['TOUS', 'LEADER', 'DERNIER'] as const;
export const CHOSES = ['COURONNE', 'LAVE', 'CAISSE', 'MUR'] as const;
/** POINTS est gravé dans la Loi d'or : il n'existe jamais en mot libre. */
export const PROPS = ['POINTS', 'MORT', 'LENT', 'RAPIDE', 'GEANT', 'GLISSANT', 'INVERSE', 'INVISIBLE', 'DOUBLE', 'VOLEUR'] as const;

export type Chose = (typeof CHOSES)[number];
export type Sujet = (typeof COULEURS)[number] | (typeof GROUPES)[number] | Chose;
export type Prop = (typeof PROPS)[number];
export type Mot = Sujet | Prop;
export type Famille = 'couleur' | 'groupe' | 'chose' | 'prop';

const FAMILLES: [Famille, readonly string[]][] = [['couleur', COULEURS], ['groupe', GROUPES], ['chose', CHOSES], ['prop', PROPS]];
export const famille = (m: unknown): Famille | undefined => FAMILLES.find(([, mots]) => mots.includes(m as string))?.[0];
export const estMot = (m: unknown): m is Mot => !!famille(m);

// Les identifiants restent en ASCII ; seul l'affichage porte les accents.
const LIBELLES: Partial<Record<Mot, string>> = { GEANT: 'GÉANT', INVERSE: 'INVERSÉ' };
export const libelle = (m: Mot) => LIBELLES[m] ?? m;
export const phrase = (l: { sujet: Sujet; prop: Prop }) => `${libelle(l.sujet)} EST ${libelle(l.prop)}`;
