import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG, OBJETS, PROPS, SUJETS, a, armees, blocEn, contacts, demi, estObjet, solideEn, type Monde, type Objet, type Prop, type Sujet } from '../src/index';
import { monde, placer, tourner, vers } from './outils';

// Chaque combinaison sujet × propriété de docs/REGLES.md a un effet observable.

const CIBLE: Record<Exclude<Sujet, Objet>, number> = { ROUGE: 0, BLEU: 1, VERT: 2, JAUNE: 3, TOUS: 0, LEADER: 0, DERNIER: 0 };
const PAS_NORMAL = (CONFIG.joueur.vitesse * 10) / CONFIG.tickHz;

function mondeJoueur(sujet: Exclude<Sujet, Objet>, prop: Prop) {
  const w = monde([{ x: 0, y: 0, mots: [sujet, 'EST', prop] }]);
  const cible = w.joueurs[CIBLE[sujet]];
  const autre = w.joueurs[(cible.id + 1) % 4];
  if (sujet === 'LEADER') cible.score = 5;
  if (sujet === 'DERNIER') for (const p of w.joueurs) if (p !== cible) p.score = 5;
  w.joueurs.forEach((p, i) => placer(w, i, 1.5 + i, 6.5));
  placer(w, cible.id, 6.5, 3.5);
  placer(w, autre.id, 4.5, 3.5);
  return { w, cible, autre };
}

const armer = (w: Monde) => tourner(w, CONFIG.tickHz + 2);

const SUR_JOUEUR: Record<Prop, (s: Exclude<Sujet, Objet>) => void> = {
  MORT: (s) => {
    const { w, cible, autre } = mondeJoueur(s, 'MORT');
    armer(w);
    assert.equal(cible.mort, true);
    if (s !== 'TOUS') assert.equal(autre.mort, false);
  },
  POINTS: (s) => {
    const { w, cible } = mondeJoueur(s, 'POINTS');
    const avant = cible.score;
    armer(w); tourner(w, 30);
    assert.ok(cible.score > avant + 1.5);
  },
  SOLIDE: (s) => {
    const { w, cible, autre } = mondeJoueur(s, 'SOLIDE');
    armer(w);
    tourner(w, 30, { [autre.id]: vers(1, 0) });
    assert.ok(autre.x < cible.x - 0.6, 'on ne traverse pas un joueur solide');
  },
  RAPIDE: (s) => {
    const { w, cible } = mondeJoueur(s, 'RAPIDE');
    armer(w);
    const x = cible.x;
    tourner(w, 10, { [cible.id]: vers(1, 0) });
    assert.ok(cible.x - x > PAS_NORMAL * 1.2);
  },
  LENT: (s) => {
    const { w, cible } = mondeJoueur(s, 'LENT');
    armer(w);
    const x = cible.x;
    tourner(w, 10, { [cible.id]: vers(1, 0) });
    assert.ok(cible.x - x < PAS_NORMAL * 0.8 && cible.x > x);
  },
  GEANT: (s) => {
    const { w, cible } = mondeJoueur(s, 'GEANT');
    armer(w);
    assert.ok(demi(cible) > CONFIG.joueur.demi * 1.5);
  },
  GLISSANT: (s) => {
    const { w, cible } = mondeJoueur(s, 'GLISSANT');
    armer(w);
    tourner(w, 20, { [cible.id]: vers(1, 0) });
    tourner(w, 5);
    assert.ok(cible.vx > 0.5, 'il glisse encore après avoir lâché');
  },
  AIMANT: (s) => {
    const { w, cible, autre } = mondeJoueur(s, 'AIMANT');
    armer(w);
    const d = Math.hypot(autre.x - cible.x, autre.y - cible.y);
    tourner(w, 20);
    assert.ok(Math.hypot(autre.x - cible.x, autre.y - cible.y) < d - 0.1);
  },
  INVISIBLE: (s) => {
    const { w, cible } = mondeJoueur(s, 'INVISIBLE');
    assert.equal(a(armees(cible), 'invisible'), false, 'pas avant l’armement');
    armer(w);
    assert.equal(a(armees(cible), 'invisible'), true);
  },
};

const LETTRE: Record<Objet, string> = { LAVE: 'L', MUR: 'M', COURONNE: 'K', CAISSE: 'C' };

/** Une rangée entière de l'objet en y = 4, un seul joueur. */
function mondeObjet(o: Objet, prop: Prop | null, x: number, y: number) {
  const carte = Array.from({ length: 7 }, (_, r) => (r === 4 ? LETTRE[o] : '.').repeat(12));
  const w = monde(prop ? [{ x: 0, y: 0, mots: [o, 'EST', prop] }] : [], carte, 1);
  placer(w, 0, x, y);
  return { w, p: w.joueurs[0] };
}

const SUR_OBJET: Record<Prop, (o: Objet) => void> = {
  MORT: (o) => {
    const { w, p } = mondeObjet(o, 'MORT', 6.5, 4.5);
    tourner(w, 2);
    assert.equal(p.mort, true);
  },
  POINTS: (o) => {
    const { w, p } = mondeObjet(o, 'POINTS', 6.5, 4.5);
    tourner(w, 30);
    assert.ok(Math.abs(p.score - CONFIG.points.contact) < 0.01);
  },
  SOLIDE: (o) => {
    const { w, p } = mondeObjet(o, 'SOLIDE', 6.5, 2.5);
    assert.equal(solideEn(w, 6, 4), true);
    tourner(w, 30, { 0: vers(0, 1) });
    if (o === 'CAISSE') assert.ok(!blocEn(w, 6, 4) && p.y > 4, 'une caisse solide se pousse');
    else assert.ok(p.y < 4 - CONFIG.joueur.demi + 0.01, 'on bute dessus');
    const libre = mondeObjet(o, null, 6.5, 2.5);
    tourner(libre.w, 30, { 0: vers(0, 1) });
    assert.ok(libre.p.y > 5, 'sans la règle, on traverse');
  },
  RAPIDE: (o) => {
    const { w, p } = mondeObjet(o, 'RAPIDE', 3.5, 4.5);
    tourner(w, 10, { 0: vers(1, 0) });
    assert.ok(p.x - 3.5 > PAS_NORMAL * 1.2);
  },
  LENT: (o) => {
    const { w, p } = mondeObjet(o, 'LENT', 3.5, 4.5);
    tourner(w, 10, { 0: vers(1, 0) });
    assert.ok(p.x - 3.5 < PAS_NORMAL * 0.8 && p.x > 3.5);
  },
  GEANT: (o) => {
    const pres = 4 - CONFIG.joueur.demi - 0.3; // à 0,3 case du bord de l'objet
    assert.deepEqual(contacts(mondeObjet(o, null, 6.5, pres).w, mondeObjet(o, null, 6.5, pres).p), []);
    const { w, p } = mondeObjet(o, 'GEANT', 6.5, pres);
    assert.deepEqual(contacts(w, p), [o]);
  },
  GLISSANT: (o) => {
    const { w, p } = mondeObjet(o, 'GLISSANT', 2.5, 4.5);
    tourner(w, 20, { 0: vers(1, 0) });
    tourner(w, 5);
    assert.ok(p.vx > 0.5);
  },
  AIMANT: (o) => {
    const { w, p } = mondeObjet(o, 'AIMANT', 6.5, 2);
    tourner(w, 20);
    assert.ok(p.y > 2.1, 'attiré vers l’objet');
  },
  INVISIBLE: (o) => {
    const { w } = mondeObjet(o, 'INVISIBLE', 6.5, 2);
    assert.equal(a(w.tagsObjet[o], 'invisible'), true);
    for (const autre of OBJETS) if (autre !== o) assert.equal(a(w.tagsObjet[autre], 'invisible'), false);
  },
};

for (const sujet of SUJETS)
  for (const prop of PROPS)
    test(`${sujet} EST ${prop}`, () => {
      if (estObjet(sujet)) SUR_OBJET[prop](sujet);
      else SUR_JOUEUR[prop](sujet);
    });
