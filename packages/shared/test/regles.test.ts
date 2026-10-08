import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annuler, comparer, etiquettesJoueur, etiquettesObjets, scanner, vise, type Mot } from '../src/index';

const b = (x: number, y: number, mot: Mot | null) => ({ x, y, mot });
const ids = (blocs: ReturnType<typeof b>[]) => scanner(blocs).map((r) => r.id);

test('lit une phrase de gauche à droite', () => {
  assert.deepEqual(ids([b(2, 1, 'LAVE'), b(3, 1, 'EST'), b(4, 1, 'MORT')]), ['LAVE EST MORT']);
});

test('lit une phrase de haut en bas', () => {
  assert.deepEqual(ids([b(2, 1, 'ROUGE'), b(2, 2, 'EST'), b(2, 3, 'LENT')]), ['ROUGE EST LENT']);
});

test('ne lit ni à l’envers, ni en diagonale, ni avec un trou', () => {
  assert.deepEqual(ids([b(0, 0, 'MORT'), b(1, 0, 'EST'), b(2, 0, 'LAVE')]), []);
  assert.deepEqual(ids([b(0, 0, 'LAVE'), b(1, 1, 'EST'), b(2, 2, 'MORT')]), []);
  assert.deepEqual(ids([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(3, 0, 'MORT')]), []);
});

test('refuse les phrases mal formées', () => {
  assert.deepEqual(ids([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, 'MUR')]), []); // sujet EST sujet
  assert.deepEqual(ids([b(0, 0, 'MORT'), b(1, 0, 'EST'), b(2, 0, 'LENT')]), []); // propriété EST propriété
  assert.deepEqual(ids([b(0, 0, 'LAVE'), b(1, 0, 'LAVE'), b(2, 0, 'MORT')]), []); // pas de EST
  assert.deepEqual(ids([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, null)]), []); // une caisse n'est pas un mot
});

test('un EST partagé donne deux phrases croisées', () => {
  const croix = [b(1, 0, 'MUR'), b(0, 1, 'LAVE'), b(1, 1, 'EST'), b(2, 1, 'MORT'), b(1, 2, 'SOLIDE')];
  assert.deepEqual(ids(croix), ['LAVE EST MORT', 'MUR EST SOLIDE']);
});

test('un mot partagé par deux phrases alignées', () => {
  // LAVE EST MORT avec, sous MORT… rien ; mais ROUGE EST MORT verticalement sur le même MORT
  const blocs = [b(0, 2, 'LAVE'), b(1, 2, 'EST'), b(2, 2, 'MORT'), b(2, 0, 'ROUGE'), b(2, 1, 'EST')];
  assert.deepEqual(ids(blocs), ['LAVE EST MORT', 'ROUGE EST MORT']);
});

test('deux phrases identiques ne comptent qu’une fois', () => {
  const blocs = [b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, 'MORT'), b(0, 2, 'LAVE'), b(1, 2, 'EST'), b(2, 2, 'MORT')];
  assert.deepEqual(ids(blocs), ['LAVE EST MORT']);
});

test('compare deux états : ajoutées et retirées', () => {
  const avant = scanner([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, 'MORT')]);
  const apres = scanner([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, 'POINTS')]);
  const d = comparer(avant, apres);
  assert.deepEqual(d.ajoutees.map((r) => r.id), ['LAVE EST POINTS']);
  assert.deepEqual(d.retirees.map((r) => r.id), ['LAVE EST MORT']);
  assert.deepEqual(comparer(avant, avant), { ajoutees: [], retirees: [] });
});

test('les contraires s’annulent, le reste se cumule', () => {
  assert.deepEqual(annuler(['RAPIDE', 'LENT']), []);
  assert.deepEqual(annuler(['MORT', 'POINTS', 'GEANT']), ['GEANT']);
  assert.deepEqual(annuler(['MORT', 'MORT', 'LENT']), ['MORT', 'LENT']);
});

test('étiquettes des objets', () => {
  const tags = etiquettesObjets(scanner([b(0, 0, 'LAVE'), b(1, 0, 'EST'), b(2, 0, 'MORT'), b(0, 1, 'EST'), b(0, 2, 'GLISSANT')]));
  assert.deepEqual(tags.LAVE.sort(), ['GLISSANT', 'MORT']);
  assert.deepEqual(tags.MUR, []);
});

test('LEADER et DERNIER ne visent qu’un joueur seul à son rang', () => {
  const egal = [{ id: 0, score: 0 }, { id: 1, score: 0 }];
  assert.equal(vise('LEADER', egal, 0), false);
  assert.equal(vise('DERNIER', egal, 1), false);
  const classe = [{ id: 0, score: 4 }, { id: 1, score: 9 }, { id: 2, score: 4 }];
  assert.equal(vise('LEADER', classe, 1), true);
  assert.equal(vise('LEADER', classe, 0), false);
  assert.equal(vise('DERNIER', classe, 0), false); // deux derniers ex æquo
  assert.equal(vise('LEADER', [{ id: 0, score: 3 }], 0), false); // seul en jeu
});

test('étiquettes d’un joueur : couleur, TOUS, et annulation entre phrases', () => {
  const regles = scanner([b(0, 0, 'ROUGE'), b(1, 0, 'EST'), b(2, 0, 'MORT'), b(0, 2, 'TOUS'), b(1, 2, 'EST'), b(2, 2, 'POINTS')]);
  const j = [{ id: 0, score: 0 }, { id: 1, score: 0 }];
  assert.deepEqual(etiquettesJoueur(regles, j, 0), []); // MORT + POINTS
  assert.deepEqual(etiquettesJoueur(regles, j, 1), ['POINTS']);
});
