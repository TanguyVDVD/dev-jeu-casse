export const COULEURS = ['ROUGE', 'BLEU', 'VERT', 'JAUNE'] as const;
export const OBJETS = ['LAVE', 'MUR', 'CAISSE', 'COURONNE'] as const;
export const SUJETS = [...COULEURS, 'TOUS', 'LEADER', 'DERNIER', ...OBJETS] as const;
export const PROPS = ['MORT', 'POINTS', 'SOLIDE', 'RAPIDE', 'LENT', 'GEANT', 'GLISSANT', 'AIMANT', 'INVISIBLE'] as const;

export type Objet = (typeof OBJETS)[number];
export type Sujet = (typeof SUJETS)[number];
export type Prop = (typeof PROPS)[number];
export type Mot = Sujet | Prop | 'EST';

export const estSujet = (m: unknown): m is Sujet => SUJETS.includes(m as Sujet);
export const estProp = (m: unknown): m is Prop => PROPS.includes(m as Prop);
export const estObjet = (m: unknown): m is Objet => OBJETS.includes(m as Objet);
export const estMot = (m: unknown): m is Mot => m === 'EST' || estSujet(m) || estProp(m);

// Les identifiants restent en ASCII ; seul l'affichage porte les accents.
const LIBELLES: Partial<Record<Mot, string>> = { GEANT: 'GÉANT' };
export const libelle = (m: Mot) => LIBELLES[m] ?? m;
export const libelleRegle = (id: string) => id.split(' ').map((m) => libelle(m as Mot)).join(' ');
