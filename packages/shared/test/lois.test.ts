import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHOSES, CONFIG, PROPS, compatible, demi, ecrire, resoudre, ticks, type Chose, type Sujet } from '../src/index';
import { decreter, monde, placer, tourner, toucher, vers } from './outils';

const proche = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const LIBRES = PROPS.filter((p) => p !== 'POINTS');
const SUJETS: Sujet[] = ['ROUGE', 'TOUS', 'LEADER', 'DERNIER', ...CHOSES];

// --- chaque propriété sur chaque famille de sujet --------------------------------

for (const sujet of SUJETS)
  for (const prop of LIBRES)
    test(`${sujet} EST ${prop} finit sur le joueur visé`, () => {
      const w = monde();
      decreter(w, 1, sujet, prop);
      if (CHOSES.includes(sujet as Chose)) toucher(w, 0, sujet as Chose);
      tourner(w, 2);
      const p = w.joueurs[0];
      if (prop === 'MORT') assert.ok(p.mort);
      else assert.ok(p.props.includes(prop));
      // une chose qui tue ne touche plus sa victime : un fantôme ne touche rien
      if (prop !== 'MORT' || !CHOSES.includes(sujet as Chose)) assert.ok(w.lois[1].touches.includes(0), 'la loi déclare qui elle touche');
    });

for (const chose of CHOSES)
  test(`Loi d'or : ${chose} EST POINTS rapporte 1 point toutes les 0,5 s à qui la touche, et à lui seul`, () => {
    const w = monde({ or: chose });
    toucher(w, 0, chose);
    tourner(w, ticks(2));
    proche(w.joueurs[0].score, 4, 0.2);
    assert.equal(w.joueurs[1].score, 0);
  });

test('une chose que personne ne touche ne touche personne', () => {
  const w = monde();
  decreter(w, 1, 'LAVE', 'GEANT');
  tourner(w, 2);
  assert.deepEqual(w.lois[1].touches, []);
  assert.ok(w.joueurs.every((p) => !p.props.includes('GEANT')));
});

// --- les effets ---------------------------------------------------------------------

test('LENT × 0,55 ; RAPIDE × 1,5 et dash rechargé deux fois plus vite', () => {
  const w = monde({ n: 2 });
  decreter(w, 1, 'ROUGE', 'LENT');
  decreter(w, 2, 'BLEU', 'RAPIDE');
  tourner(w, 15, { 0: vers(1, 0), 1: vers(1, 0) });
  proche(w.joueurs[0].vx, CONFIG.joueur.vitesse * 0.55);
  proche(w.joueurs[1].vx, CONFIG.joueur.vitesse * 1.5);
  tourner(w, 1, { 0: vers(1, 0, { dash: true }), 1: vers(1, 0, { dash: true }) });
  tourner(w, 10);
  assert.equal(w.joueurs[0].dashCd, ticks(CONFIG.dash.recharge) - 10);
  assert.equal(w.joueurs[1].dashCd, ticks(CONFIG.dash.recharge) - 20);
});

test('GÉANT : double de taille, 15 % plus lent, ni étourdi ni repoussé, bouscule joueurs et caisses', () => {
  const w = monde({ n: 2 });
  decreter(w, 1, 'ROUGE', 'GEANT');
  placer(w, 0, 3, 6); placer(w, 1, 4.2, 6);
  tourner(w, 1);
  proche(demi(w.joueurs[0]), CONFIG.joueur.demi * 2, 1e-9);
  // le petit dashe dans le géant : rien
  tourner(w, 1, { 1: vers(-1, 0, { dash: true }) });
  tourner(w, 3, { 1: vers(-1, 0) });
  assert.equal(w.joueurs[0].etourdi, 0);
  // le géant marche sur le petit : il l'écarte
  placer(w, 1, 4.2, 6);
  tourner(w, 20, { 0: vers(1, 0) });
  proche(w.joueurs[0].vx, CONFIG.joueur.vitesse * 0.85);
  assert.ok(w.joueurs[1].x - w.joueurs[0].x >= CONFIG.joueur.demi * 3 - 0.45, 'le petit est poussé devant');
  // une caisse part au premier contact, sans délai
  placer(w, 0, 7.3, 4.5); placer(w, 1, 1, 8);
  tourner(w, 3, { 0: vers(1, 0) });
  assert.equal(w.caisses[0].x, 9);
});

test('un changement de taille ne coince jamais un joueur dans un mur', () => {
  const w = monde();
  placer(w, 0, 4.66, 4.5); // au ras du mur (5,4)
  decreter(w, 1, 'ROUGE', 'GEANT');
  tourner(w, 2);
  const p = w.joueurs[0];
  assert.ok(p.x + demi(p) <= 5, `dégagé du mur (x = ${p.x})`);
  tourner(w, 30, { 0: vers(1, 0) });
  assert.ok(p.x + demi(p) <= 5, 'et il ne le traverse pas');
});

test('GLISSANT : inertie de patinoire ; INVERSÉ : commandes retournées', () => {
  const w = monde({ n: 2 });
  decreter(w, 1, 'ROUGE', 'GLISSANT');
  decreter(w, 2, 'BLEU', 'INVERSE');
  tourner(w, 1);
  tourner(w, 6, { 0: vers(1, 0), 1: vers(1, 0) });
  proche(w.joueurs[0].vx, CONFIG.joueur.accelGlisse * 0.2, 0.01);
  proche(w.joueurs[1].vx, -CONFIG.joueur.vitesse);
});

test('DOUBLE : tous les points gagnés sont doublés, prime de victime comprise', () => {
  const w = monde({ n: 2 });
  decreter(w, 1, 'ROUGE', 'DOUBLE');
  toucher(w, 0, 'COURONNE');
  tourner(w, ticks(1));
  proche(w.joueurs[0].score, 4, 0.3);
  const avant = w.joueurs[0].score;
  decreter(w, 2, 'BLEU', 'MORT', 0);
  tourner(w, 1);
  proche(w.joueurs[0].score - avant, CONFIG.points.victime * 2, 0.2);
});

test('VOLEUR : 2 points par contact, une fois par seconde et par victime, jamais sous zéro', () => {
  const w = monde({ n: 2 });
  decreter(w, 1, 'ROUGE', 'VOLEUR');
  w.joueurs[1].score = 3;
  placer(w, 0, 3, 6); placer(w, 1, 3.3, 6);
  tourner(w, 5);
  assert.deepEqual(w.joueurs.map((p) => p.score), [2, 1]);
  tourner(w, ticks(CONFIG.props.volRecharge));
  assert.deepEqual(w.joueurs.map((p) => p.score), [3, 0], 'il ne reste qu’un point à prendre');
  tourner(w, ticks(CONFIG.props.volRecharge) + 2);
  assert.deepEqual(w.joueurs.map((p) => p.score), [3, 0]);
});

test('l’effet transmis par une chose se prolonge 0,75 s après le contact, sauf POINTS et MORT', () => {
  const w = monde({ or: 'MUR' });
  decreter(w, 1, 'MUR', 'GEANT');
  toucher(w, 0, 'MUR');
  tourner(w, 2);
  placer(w, 0, 2, 7);
  const score = w.joueurs[0].score;
  tourner(w, ticks(CONFIG.loi.remanence) - 2);
  assert.ok(w.joueurs[0].props.includes('GEANT'), 'encore géant');
  assert.ok(w.joueurs[0].score - score < 0.1, 'mais les points cessent avec le contact');
  tourner(w, 4);
  assert.deepEqual(w.joueurs[0].props, []);
});

// --- qui subit une loi -----------------------------------------------------------------

test('LEADER et DERNIER : ex æquo compris, donc tout le monde au début', () => {
  const w = monde();
  assert.equal(resoudre(w, 'LEADER').length, 4);
  assert.equal(resoudre(w, 'DERNIER').length, 4);
  w.joueurs[2].score = 5.9; w.joueurs[3].score = 5.2; w.joueurs[1].score = 1;
  assert.deepEqual(resoudre(w, 'LEADER').map((p) => p.id), [2, 3]);
  assert.deepEqual(resoudre(w, 'DERNIER').map((p) => p.id), [0]);
});

test('cumul : un joueur visé par plusieurs lois additionne leurs effets', () => {
  const w = monde();
  decreter(w, 1, 'ROUGE', 'LENT');
  decreter(w, 2, 'TOUS', 'GEANT');
  tourner(w, 15, { 0: vers(1, 0) });
  assert.deepEqual([...w.joueurs[0].props].sort(), ['GEANT', 'LENT']);
  proche(w.joueurs[0].vx, CONFIG.joueur.vitesse * 0.55 * 0.85);
});

test('MORT l’emporte sur tout : une lave qui rapporte et qui tue ne rapporte rien', () => {
  const w = monde({ or: 'LAVE', lois: [['LAVE', 'MORT'], ['CAISSE', 'RAPIDE']] });
  toucher(w, 0, 'LAVE');
  tourner(w, 10);
  assert.ok(w.joueurs[0].mort);
  assert.equal(w.joueurs[0].score, 0);
});

// --- armement, sceau, remplacement -------------------------------------------------------

test('une loi modifiée s’arme 1 s : l’ancienne cesse à la pose, la nouvelle agit ensuite', () => {
  const w = monde();
  decreter(w, 1, 'TOUS', 'LENT');
  tourner(w, 2);
  assert.ok(w.joueurs[0].props.includes('LENT'));
  w.evts = [];
  assert.equal(ecrire(w, 1, 1, 'MORT', 2), 'LENT', 'le mot remplacé est rendu');
  assert.deepEqual(w.evts, [{ t: 'loi', ch: 1, sujet: 'TOUS', prop: 'MORT', par: 2 }]);
  tourner(w, ticks(CONFIG.loi.armement) - 1);
  assert.deepEqual(w.joueurs[0].props, [], 'LENT a cessé tout de suite');
  assert.ok(!w.joueurs[0].mort, 'MORT n’agit pas encore');
  tourner(w, 1);
  assert.ok(w.joueurs.every((p) => p.mort));
  assert.ok(w.evts.some((e) => e.t === 'active' && e.ch === 1));
});

test('sceau : le mot posé est scellé 5 s, l’autre mot du châssis reste remplaçable', () => {
  const w = monde();
  ecrire(w, 1, 1, 'GLISSANT', 0);
  assert.equal(compatible(w, 1, 1, 'INVERSE'), false, 'scellé');
  assert.equal(compatible(w, 1, 0, 'ROUGE'), true, 'on peut retourner la loi contre son auteur');
  tourner(w, ticks(CONFIG.loi.sceau) - 1);
  assert.equal(compatible(w, 1, 1, 'INVERSE'), false);
  tourner(w, 1);
  assert.equal(compatible(w, 1, 1, 'INVERSE'), true);
});

test('dernières secondes : les sceaux durent deux fois moins et la Loi d’or compte double', () => {
  const w = monde();
  w.temps = ticks(CONFIG.manche.bouclage);
  ecrire(w, 1, 1, 'GLISSANT', 0);
  assert.equal(w.lois[1].sceaux[1], ticks(CONFIG.loi.sceau) / 2);
  toucher(w, 0, 'COURONNE');
  tourner(w, ticks(1));
  proche(w.joueurs[0].score, 4, 0.3);
});

test('emplacements : la Loi d’or ne prend que des choses, POINTS est gravé, pas deux fois le même mot', () => {
  const w = monde();
  assert.equal(compatible(w, 0, 0, 'LAVE'), true);
  assert.equal(compatible(w, 0, 0, 'COURONNE'), false, 'identique au mot en place');
  assert.equal(compatible(w, 0, 0, 'ROUGE'), false);
  assert.equal(compatible(w, 0, 0, 'TOUS'), false);
  assert.equal(compatible(w, 0, 1, 'MORT'), false, 'POINTS ne se remplace pas');
  for (const sujet of ['ROUGE', 'LEADER', 'LAVE'] as const) assert.equal(compatible(w, 1, 0, sujet), true);
  assert.equal(compatible(w, 1, 0, 'MORT'), false);
  assert.equal(compatible(w, 1, 1, 'MORT'), true);
  assert.equal(compatible(w, 1, 1, 'TOUS'), false);
  assert.equal(compatible(w, 1, 1, 'LENT'), false, 'identique au mot en place');
});

test('le châssis prend l’auteur du dernier mot posé, qui touche 3 points par autre joueur tué', () => {
  const w = monde();
  w.joueurs[3].score = 1; // JAUNE n'est plus dernier : la loi ne le vise pas
  ecrire(w, 1, 0, 'DERNIER', 1);
  ecrire(w, 1, 1, 'MORT', 3);
  assert.equal(w.lois[1].auteur, 3);
  tourner(w, ticks(CONFIG.loi.armement));
  assert.equal(w.joueurs[3].score, 1 + 3 * CONFIG.points.victime);
  assert.equal(w.joueurs[3].stats.victimes, 3);
  assert.equal(w.lois[1].victimes, 3);
  assert.deepEqual(w.evts.filter((e) => e.t === 'mort').map((e) => e.t === 'mort' && [e.par, e.ch]), [[3, 1], [3, 1], [3, 1]]);
});

test('une loi qui condamne aussi son auteur ne lui rapporte rien', () => {
  const w = monde();
  ecrire(w, 1, 0, 'TOUS', 3);
  ecrire(w, 1, 1, 'MORT', 3);
  tourner(w, ticks(CONFIG.loi.armement));
  assert.ok(w.joueurs.every((p) => p.mort && p.score === 0));
});

test('une phrase de départ n’a pas d’auteur : ses morts ne rapportent à personne', () => {
  const w = monde({ lois: [['LAVE', 'MORT'], ['CAISSE', 'RAPIDE']] });
  toucher(w, 0, 'LAVE');
  tourner(w, 2);
  assert.ok(w.joueurs[0].mort);
  assert.ok(w.joueurs.every((p) => p.score === 0));
});

// --- mort et fantômes ----------------------------------------------------------------------

test('tué au contact d’une chose : fantôme 3 s, puis retour au départ avec 1,5 s d’invulnérabilité', () => {
  const w = monde({ lois: [['LAVE', 'MORT'], ['CAISSE', 'RAPIDE']] });
  toucher(w, 0, 'LAVE');
  tourner(w, 1);
  assert.ok(w.joueurs[0].mort);
  tourner(w, ticks(CONFIG.fantome.contact) - 2);
  assert.ok(w.joueurs[0].mort);
  tourner(w, 1);
  const p = w.joueurs[0];
  assert.deepEqual([p.mort, p.x, p.y, p.invul], [false, 1.5, 7.5, ticks(CONFIG.joueur.invulnerable)]);
  toucher(w, 0, 'LAVE');
  tourner(w, ticks(CONFIG.joueur.invulnerable) - 2);
  assert.ok(!p.mort, 'invulnérable');
  tourner(w, 3);
  assert.ok(p.mort);
});

test('tué par sa couleur ou un groupe : fantôme tant que la loi le vise, retour 4 s après', () => {
  const w = monde();
  decreter(w, 1, 'ROUGE', 'MORT');
  tourner(w, ticks(2));
  assert.ok(w.joueurs[0].mort, 'toujours visé, toujours mort');
  decreter(w, 1, 'ROUGE', 'LENT');
  tourner(w, ticks(CONFIG.fantome.retour) - 1);
  assert.ok(w.joueurs[0].mort);
  tourner(w, 1);
  assert.ok(!w.joueurs[0].mort);
});

test('plafond : une loi ne tient personne mort plus de 4 s (8 s avec le délai de retour), et ne peut plus le tuer ensuite', () => {
  const w = monde();
  decreter(w, 1, 'LEADER', 'MORT');
  tourner(w, ticks(CONFIG.fantome.max) + ticks(CONFIG.fantome.retour) - 2);
  assert.ok(w.joueurs.every((p) => p.mort));
  assert.deepEqual(w.lois[1].touches, [], 'la loi les a lâchés : le retour est en route');
  tourner(w, 1);
  assert.ok(w.joueurs.every((p) => !p.mort));
  tourner(w, ticks(CONFIG.joueur.invulnerable) + 30);
  assert.ok(w.joueurs.every((p) => !p.mort), 'épargnés tant que la loi n’est pas réécrite');
  assert.deepEqual(w.lois[1].touches, [], 'et elle ne prétend plus toucher personne');
  ecrire(w, 1, 0, 'TOUS', -1);
  tourner(w, ticks(CONFIG.loi.armement));
  assert.ok(w.joueurs.every((p) => p.mort), 'une loi réécrite tue de nouveau');
});

test('un fantôme ne marque pas, ne porte pas la couronne, ne s’étourdit pas et va 20 % plus vite', () => {
  const w = monde({ n: 2 });
  toucher(w, 0, 'COURONNE');
  assert.equal(w.couronne!.porteur, 0);
  decreter(w, 1, 'ROUGE', 'MORT');
  tourner(w, ticks(1));
  const score = w.joueurs[0].score;
  assert.deepEqual(w.couronne, { x: 11.5, y: 4.5, porteur: -1 }, 'la couronne retourne sur son socle');
  placer(w, 0, 11.5, 4.5);
  tourner(w, 10);
  assert.equal(w.couronne!.porteur, -1);
  assert.equal(w.joueurs[0].score, score);
  placer(w, 0, 3, 6); placer(w, 1, 2.2, 6);
  tourner(w, 1, { 1: vers(1, 0, { dash: true }) });
  tourner(w, 3, { 1: vers(1, 0) });
  assert.equal(w.joueurs[0].etourdi, 0);
  tourner(w, 8, { 0: vers(0, -1) });
  proche(w.joueurs[0].vy, -CONFIG.joueur.vitesse * CONFIG.joueur.facteurFantome);
});
