import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARENES, CONFIG, COULEURS, creerMonde, famille, intention, memoireBot, pas, penser, ticks, validerArene,
  type Entree, type Monde, type Mot,
} from '../src/index';
import { ACTION, CARTE, decreter, monde, placer, tourner, toucher, vers } from './outils';

const proche = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const auSol = (w: Monde, mot: Mot) => w.mots.find((m) => m.mot === mot);
/** Donne un mot au joueur et l'oriente. */
function armer(w: Monde, id: number, mot: Mot, x: number, y: number, fx: number, fy: number): void {
  Object.assign(w.joueurs[id], { porte: mot, x, y, fx, fy });
}

// --- ramasser ------------------------------------------------------------------

test('début de manche : la couleur de chaque joueur est à ses pieds, et il y a moins de caisses que de joueurs', () => {
  const carte = CARTE.map((r, y) => (y === 5 ? '..C..C..C..C..' : r));
  for (const n of [2, 3, 4]) {
    const w = monde({ n, carte });
    assert.deepEqual(w.mots.map((m) => [m.mot, m.x, m.y]), w.joueurs.map((p) => [COULEURS[p.id], p.x, p.y]));
    assert.equal(w.caisses.length, n - 1);
  }
});

test('mains vides, l’action ramasse le mot le plus proche à portée', () => {
  const w = monde({ mots: [{ x: 6, y: 5, mot: 'MORT' }, { x: 7, y: 5, mot: 'GEANT' }] });
  placer(w, 0, 5.4, 5.5);
  assert.deepEqual(intention(w, w.joueurs[0]), { t: 'ramasser', id: auSol(w, 'MORT')!.id });
  tourner(w, 1, { 0: ACTION });
  assert.equal(w.joueurs[0].porte, 'MORT');
  assert.equal(auSol(w, 'MORT'), undefined);
  assert.ok(w.evts.some((e) => e.t === 'prise' && e.j === 0));
  placer(w, 1, 2, 2);
  assert.equal(intention(w, w.joueurs[1]), null, 'rien à portée : le bouton ne fait rien');
});

test('mémoire d’entrée : un appui un peu trop tôt ramasse quand même', () => {
  const w = monde({ mots: [{ x: 6, y: 5, mot: 'MORT' }] });
  placer(w, 0, 4.9, 5.5); // 1,6 case : hors de portée
  tourner(w, 1, { 0: vers(1, 0, { action: true }) });
  assert.equal(w.joueurs[0].porte, null);
  tourner(w, 4, { 0: vers(1, 0) });
  assert.equal(w.joueurs[0].porte, 'MORT');
});

test('on ne porte qu’un mot, à 90 % de sa vitesse', () => {
  const w = monde({ mots: [{ x: 6, y: 5, mot: 'MORT' }] });
  armer(w, 0, 'GEANT', 5.6, 5.5, 1, 0);
  tourner(w, 12, { 0: vers(0, 1) });
  proche(w.joueurs[0].vy, CONFIG.joueur.vitesse * CONFIG.joueur.facteurPorte);
  assert.ok(auSol(w, 'MORT'), 'le mot au sol n’a pas bougé');
});

// --- poser ---------------------------------------------------------------------

test('mot en main, face à un emplacement compatible à portée : l’action le pose, l’ancien retombe deux cases plus loin', () => {
  const w = monde();
  armer(w, 0, 'MORT', 4, 5, 0, -1); // sous la propriété du châssis 1, à 2,5 cases : trop loin
  assert.equal(intention(w, w.joueurs[0])!.t, 'lancer');
  placer(w, 0, 4, 4);
  assert.deepEqual(intention(w, w.joueurs[0]), { t: 'poser', ch: 1, cote: 1 });
  tourner(w, 1, { 0: ACTION });
  const l = w.lois[1];
  assert.deepEqual([l.sujet, l.prop, l.auteur, l.arme, l.sceaux], ['MUR', 'MORT', 0, ticks(CONFIG.loi.armement) - 1, [0, ticks(CONFIG.loi.sceau) - 1]]);
  assert.equal(w.joueurs[0].porte, null);
  assert.equal(w.joueurs[0].stats.ecrites, 1);
  const ancien = auSol(w, 'LENT')!;
  // droit devant, il retomberait sur la Loi d'or : il part sur le côté, à deux cases
  assert.deepEqual([ancien.x, ancien.y], [4 + CONFIG.geste.ejection, 2.5]);
});

test('un mot ne reste jamais couché sur un châssis ni à cheval sur un bord : il glisse à côté', () => {
  const w = monde({ n: 2 });
  armer(w, 1, 'MORT', 2.5, 2.6, 0, 1); // debout sur le châssis 1, mot en main
  placer(w, 0, 1.6, 2.6);
  tourner(w, 1, { 0: vers(1, 0, { dash: true }) });
  tourner(w, 3, { 0: vers(1, 0) });
  const m = auSol(w, 'MORT')!;
  assert.ok(m.y <= 1.6 || m.y >= 3.4, `lâché sur la loi, il est en y = ${m.y}`);
  armer(w, 1, 'GEANT', 13.2, 8.5, 1, 0);
  w.joueurs[1].etourdi = 0;
  tourner(w, 1, { 1: ACTION });
  tourner(w, 20);
  assert.equal(auSol(w, 'GEANT')!.x, 13.1, 'lancé contre le bord, il reste entier dans l’arène');
});

test('pas de pose dos à l’emplacement, ni d’un mot identique, ni sur un sceau : le bouton lance', () => {
  const w = monde();
  armer(w, 0, 'MORT', 4, 4, 0, 1);
  assert.equal(intention(w, w.joueurs[0])!.t, 'lancer', 'dos tourné');
  armer(w, 0, 'LENT', 4, 4, 0, -1);
  assert.equal(intention(w, w.joueurs[0])!.t, 'lancer', 'LENT est déjà en place');
  armer(w, 0, 'MORT', 4, 4, 0, -1);
  w.lois[1].sceaux = [0, 30];
  assert.equal(intention(w, w.joueurs[0])!.t, 'lancer', 'emplacement scellé');
  placer(w, 0, 4, 2.9);
  w.lois[1].sceaux = [0, 0];
  w.joueurs[0].fy = 1;
  assert.equal(intention(w, w.joueurs[0])!.t, 'poser', 'collé à l’emplacement, l’orientation ne compte plus');
});

test('une couleur se pose en sujet : qui tient ta couleur écrit une loi sur toi', () => {
  const w = monde();
  armer(w, 1, 'ROUGE', 1, 3.6, 0, -1);
  tourner(w, 1, { 1: ACTION });
  assert.deepEqual([w.lois[1].sujet, w.lois[1].auteur], ['ROUGE', 1]);
  tourner(w, ticks(CONFIG.loi.armement));
  assert.ok(w.joueurs[0].props.includes('LENT'));
});

// --- lancer --------------------------------------------------------------------

test('lancé, un mot glisse 5 cases droit devant puis s’arrête', () => {
  const w = monde();
  armer(w, 0, 'MORT', 3, 6.2, 1, 0);
  tourner(w, 1, { 0: ACTION });
  assert.equal(w.joueurs[0].porte, null);
  assert.ok(auSol(w, 'MORT')!.reste > 0, 'en vol');
  tourner(w, 20);
  const m = auSol(w, 'MORT')!;
  proche(m.x, 3 + CONFIG.geste.lancer, 1e-6);
  assert.deepEqual([m.y, m.reste], [6.2, 0]);
});

test('un mot lancé s’arrête contre un obstacle ou un joueur', () => {
  const w = monde();
  armer(w, 0, 'MORT', 3.5, 4.5, 1, 0); // vers le mur (5,4)
  tourner(w, 1, { 0: ACTION });
  tourner(w, 20);
  assert.ok(auSol(w, 'MORT')!.x < 5 && auSol(w, 'MORT')!.x > 4);
  armer(w, 0, 'GEANT', 3, 6.2, 1, 0);
  placer(w, 1, 5.5, 6.2);
  tourner(w, 1, { 0: ACTION });
  tourner(w, 20);
  proche(auSol(w, 'GEANT')!.x, 5.5, 0.6);
});

test('la visée s’aimante : un mot lancé vers un emplacement compatible s’y pose, au nom du lanceur', () => {
  const w = monde();
  armer(w, 0, 'MORT', 11.3, 6.6, 0, -1); // à 4 cases sous la propriété du châssis 2, un peu de travers
  const it = intention(w, w.joueurs[0]);
  assert.ok(it?.t === 'lancer' && it.ch === 2 && it.cote === 1);
  tourner(w, 1, { 0: ACTION });
  tourner(w, 12);
  assert.deepEqual([w.lois[2].prop, w.lois[2].auteur], ['MORT', 0]);
  assert.equal(w.joueurs[0].stats.lances, 1);
  assert.ok(auSol(w, 'RAPIDE'), 'le mot remplacé est éjecté');
});

test('un autre joueur attrape un mot au vol', () => {
  const w = monde();
  armer(w, 0, 'MORT', 3, 6.2, 1, 0);
  placer(w, 1, 6, 5.4);
  tourner(w, 1, { 0: ACTION });
  tourner(w, 5);
  tourner(w, 1, { 1: ACTION });
  assert.equal(w.joueurs[1].porte, 'MORT');
  assert.equal(w.joueurs[1].stats.attrapes, 1);
});

// --- dash, couronne, caisses ---------------------------------------------------

test('le dash étourdit 0,5 s, repousse d’une case, fait lâcher le mot et la couronne', () => {
  const w = monde({ n: 2 });
  toucher(w, 1, 'COURONNE');
  armer(w, 1, 'MORT', 6, 6.5, 0, 1);
  tourner(w, 1);
  assert.equal(w.couronne!.porteur, 1);
  placer(w, 0, 5, 6.5);
  tourner(w, 1, { 0: vers(1, 0, { dash: true }) });
  tourner(w, 3, { 0: vers(1, 0) });
  const q = w.joueurs[1];
  assert.ok(q.etourdi > 0 && q.etourdi <= ticks(CONFIG.dash.etourdi));
  assert.equal(q.porte, null);
  assert.ok(auSol(w, 'MORT'));
  tourner(w, ticks(CONFIG.dash.etourdi), { 0: vers(1, 0) });
  proche(q.x, 7, 0.25);
  assert.equal(w.couronne!.porteur, 0, 'l’attaquant marche dessus et la prend');
  assert.equal(w.joueurs[0].stats.dashs, 1);
});

test('le dash a un temps de recharge', () => {
  const w = monde();
  placer(w, 0, 2, 6);
  tourner(w, 1, { 0: vers(1, 0, { dash: true }) });
  tourner(w, ticks(CONFIG.dash.duree) + 6);
  const x = w.joueurs[0].x;
  tourner(w, 1, { 0: vers(1, 0, { dash: true }) });
  assert.ok(w.joueurs[0].x - x < 0.3, 'pas de second dash immédiat');
});

test('la couronne se porte sur la tête : on la ramasse en marchant dessus, mains libres', () => {
  const w = monde({ mots: [{ x: 11, y: 5, mot: 'MORT' }] });
  toucher(w, 2, 'COURONNE');
  assert.equal(w.couronne!.porteur, 2);
  assert.ok(w.evts.some((e) => e.t === 'couronne' && e.j === 2));
  tourner(w, 1, { 2: ACTION });
  assert.equal(w.joueurs[2].porte, 'MORT', 'elle n’occupe pas les mains');
  tourner(w, 10, { 2: vers(1, 0) });
  proche(w.couronne!.x, w.joueurs[2].x, 1e-9);
});

test('une caisse se pousse en marchant, d’une case, pas dans un mur ni hors de l’arène', () => {
  const w = monde();
  placer(w, 0, 9.5, 4.5); // à droite de la caisse (8,4), le mur est en (5,4)
  tourner(w, 60, { 0: vers(-1, 0) });
  assert.deepEqual([w.caisses[0].x, w.caisses[0].y], [6, 4], 'arrêtée contre le mur');
  assert.ok(w.joueurs[0].x > 7, 'et le joueur derrière elle');
});

// --- mots du ciel --------------------------------------------------------------

test('toutes les 15 s, le mot suivant de la pioche tombe au sol, annoncé 2 s avant par une ombre', () => {
  const w = monde({ pioche: ['LENT', 'MORT', 'TOUS'] });
  w.chuteDans = ticks(CONFIG.chute.periode);
  tourner(w, ticks(CONFIG.chute.periode));
  assert.deepEqual(w.ombres.map((o) => [o.mot, o.ch]), [['MORT', -1]], 'LENT est déjà en jeu : chaque mot n’existe qu’en un exemplaire');
  tourner(w, ticks(CONFIG.chute.ombre) - 1);
  assert.equal(auSol(w, 'MORT'), undefined);
  tourner(w, 1);
  assert.ok(auSol(w, 'MORT'));
  tourner(w, ticks(CONFIG.chute.periode));
  assert.ok(auSol(w, 'TOUS'));
});

test('une loi inchangée depuis 20 s reçoit le mot du ciel dans son emplacement', () => {
  const w = monde({ pioche: ['TOUS', 'MORT'] });
  w.lois[2].age = 0;
  tourner(w, ticks(CONFIG.chute.inertie) + 1);
  assert.deepEqual(w.ombres.map((o) => [o.mot, o.ch, o.cote]), [['TOUS', 2, 0]]);
  tourner(w, ticks(CONFIG.chute.ombre));
  assert.deepEqual([w.lois[2].sujet, w.lois[2].prop, w.lois[2].auteur], ['TOUS', 'RAPIDE', -1]);
  assert.ok(auSol(w, 'CAISSE'), 'le mot remplacé retombe au sol');
});

test('la Loi d’or trop vieille : faute de nom de chose au sol, le ciel reprend celui qu’un joueur garde en main', () => {
  const w = monde({ pioche: ['TOUS'] });
  w.joueurs[2].porte = 'LAVE';
  w.lois[0].age = ticks(CONFIG.chute.inertie);
  w.derniereChute = -1e6;
  tourner(w, 1);
  assert.equal(w.joueurs[2].porte, null);
  tourner(w, ticks(CONFIG.chute.ombre));
  assert.equal(w.lois[0].sujet, 'LAVE');
});

test('le ciel passe à la loi suivante quand la plus ancienne ne peut rien recevoir', () => {
  const w = monde({ pioche: ['TOUS'] });
  w.lois[0].age = ticks(CONFIG.chute.inertie) + 50; // aucun nom de chose disponible pour la Loi d'or
  w.lois[1].age = ticks(CONFIG.chute.inertie);
  w.derniereChute = -1e6;
  tourner(w, 1);
  assert.deepEqual(w.ombres.map((o) => [o.mot, o.ch]), [['TOUS', 1]]);
});

test('la Loi d’or trop vieille reçoit un nom de chose repris au sol', () => {
  const w = monde({ mots: [{ x: 6, y: 6, mot: 'LAVE' }], pioche: ['TOUS'] });
  w.lois[0].age = ticks(CONFIG.chute.inertie);
  w.derniereChute = -1e6;
  tourner(w, ticks(CONFIG.chute.ombre) + 1);
  assert.equal(w.lois[0].sujet, 'LAVE');
  assert.equal(w.mots.filter((m) => m.mot === 'LAVE').length, 0, 'le mot a quitté le sol');
  assert.ok(auSol(w, 'COURONNE'));
});

test('au plus 8 mots libres : le groupe ou la propriété le plus ancien disparaît, jamais une couleur ni une chose', () => {
  const noms: Mot[] = ['LAVE', 'MUR', 'CAISSE', 'COURONNE', 'TOUS', 'LEADER', 'MORT', 'GEANT'];
  const w = monde({ mots: noms.map((mot, i) => ({ x: 1 + i, y: 6, mot })), pioche: ['DERNIER'] });
  auSol(w, 'TOUS')!.ne = 5; // déplacé depuis : LEADER est désormais le plus ancien
  w.chuteDans = 1;
  tourner(w, ticks(CONFIG.chute.ombre) + 1);
  assert.ok(auSol(w, 'DERNIER'));
  assert.equal(auSol(w, 'LEADER'), undefined);
  assert.equal(w.mots.filter((m) => famille(m.mot) !== 'couleur').length, CONFIG.chute.max);
  assert.equal(w.mots.filter((m) => famille(m.mot) === 'couleur').length, 4);
});

// --- manche --------------------------------------------------------------------

function mondeNeuf(): Monde {
  const w = monde();
  w.phase = 'decompte'; w.temps = ticks(CONFIG.manche.decompte);
  return w;
}

test('décompte puis 90 s, le plus de points gagne', () => {
  const w = mondeNeuf();
  tourner(w, ticks(CONFIG.manche.decompte) - 1, { 0: vers(1, 0) });
  assert.equal(w.phase, 'decompte');
  assert.equal(w.joueurs[0].x, 1.5, 'immobile pendant le décompte');
  tourner(w, 1);
  assert.equal(w.phase, 'jeu');
  w.joueurs[2].score = 7;
  tourner(w, ticks(CONFIG.manche.duree));
  assert.equal(w.phase, 'fin');
  assert.equal(w.vainqueur, 2);
});

test('égalité : mort subite, le premier seul en tête gagne ; plafonnée, elle tire au sort', () => {
  const w = mondeNeuf();
  tourner(w, ticks(CONFIG.manche.decompte) + ticks(CONFIG.manche.duree));
  assert.equal(w.phase, 'mortsubite');
  w.joueurs[1].score = 1;
  tourner(w, 1);
  assert.deepEqual([w.phase, w.vainqueur], ['fin', 1]);
  const v = mondeNeuf();
  v.joueurs[0].score = v.joueurs[3].score = 4;
  tourner(v, ticks(CONFIG.manche.decompte) + ticks(CONFIG.manche.duree) + ticks(CONFIG.manche.mortSubiteMax));
  assert.equal(v.phase, 'fin');
  assert.ok([0, 3].includes(v.vainqueur));
});

// --- arènes et bots ------------------------------------------------------------

test('au moins trois arènes valides : Loi d’or, 2 ou 3 lois libres, 5 à 7 mots au sol, pioche de groupes et propriétés', () => {
  assert.ok(ARENES.length >= 3);
  for (const ar of ARENES) {
    validerArene(ar);
    assert.ok(ar.chassis.length === 3 || ar.chassis.length === 4, ar.id);
    assert.ok(ar.mots.length >= 5 && ar.mots.length <= 7, `${ar.id} : ${ar.mots.length} mots au sol`);
    const w = creerMonde(ar, [0, 1, 2, 3], 1);
    assert.ok(w.caisses.length < 4, 'moins de caisses que de joueurs');
    // la Loi d'or doit toujours pouvoir être réécrite : les lois libres ne peuvent pas retenir tous les autres noms de choses
    const choses = [...ar.chassis.map((c) => c.sujet), ...ar.mots.map((m) => m.mot)].filter((m) => famille(m) === 'chose');
    for (const m of new Set(choses)) assert.ok(choses.filter((k) => k !== m).length > ar.chassis.length - 1, `${ar.id} : rien pour remplacer ${m} dans la Loi d'or`);
  }
  const premiere = [...ARENES[0].chassis.map((c) => c.prop), ...ARENES[0].mots.map((m) => m.mot), ...ARENES[0].pioche].filter((m) => famille(m) === 'prop');
  assert.deepEqual([...new Set(premiere)].sort(), ['GEANT', 'LENT', 'MORT', 'POINTS', 'RAPIDE'], 'la première arène se limite aux mots simples');
});

test('une arène mal formée est refusée', () => {
  const base = ARENES[0];
  const refusee = (plus: Partial<typeof base>) => assert.throws(() => validerArene({ ...base, ...plus }));
  refusee({ chassis: [{ ...base.chassis[0], sujet: 'TOUS' }, ...base.chassis.slice(1)] });
  refusee({ chassis: base.chassis.slice(0, 2) });
  refusee({ mots: [...base.mots, { x: 0, y: 0, mot: 'POINTS' }] });
  refusee({ mots: [...base.mots, { x: 0, y: 0, mot: 'ROUGE' }] });
  refusee({ mots: [...base.mots, { x: 0, y: 0, mot: 'LENT' }] });
  refusee({ mots: [...base.mots, { x: 0, y: 0, mot: 'CAISSE' }] });
  refusee({ pioche: ['LAVE'] });
});

function jouer(w: Monde, n: number, graine = 1): void {
  let g = graine;
  const hasard = Math.random;
  Math.random = () => { g = (g * 1103515245 + 12345) & 0x7fffffff; return g / 0x80000000; };
  try {
    const mems = w.joueurs.map(() => memoireBot());
    for (let i = 0; i < n; i++) {
      const entrees: Record<number, Entree> = {};
      w.joueurs.forEach((p, k) => { entrees[p.id] = penser(w, p.id, mems[k]); });
      pas(w, entrees);
    }
  } finally { Math.random = hasard; }
}

test('déterministe : même graine, mêmes entrées, même monde', () => {
  const a = creerMonde(ARENES[0], [0, 1, 2, 3], 42), b = creerMonde(ARENES[0], [0, 1, 2, 3], 42);
  jouer(a, 1500); jouer(b, 1500);
  a.evts = b.evts = [];
  assert.deepEqual(a, b);
});

for (const ar of ARENES)
  test(`${ar.id} : quatre bots jouent une manche entière, marquent et réécrivent des lois`, () => {
    const w = creerMonde(ar, [0, 1, 2, 3], 7);
    let ecrites = 0;
    for (let i = 0; i < 40 && w.phase !== 'fin'; i++) {
      jouer(w, 100, i + 1);
      ecrites += w.evts.filter((e) => e.t === 'loi' && e.par >= 0).length;
      w.evts = [];
      // les mots ne se perdent ni ne se dupliquent : un exemplaire, deux pour les choses
      const tous = [...w.lois.flatMap((l) => [l.sujet, l.prop]), ...w.mots.map((m) => m.mot), ...w.joueurs.flatMap((p) => p.porte ?? [])].filter((m) => m !== 'POINTS');
      for (const m of new Set(tous)) assert.ok(tous.filter((k) => k === m).length <= (famille(m) === 'chose' ? 2 : 1), `${m} en trop`);
      assert.equal(tous.filter((m) => famille(m) === 'couleur').length, 4, 'aucune couleur perdue');
    }
    assert.equal(w.phase, 'fin');
    assert.ok(Math.max(...w.joueurs.map((p) => p.score)) > 0, 'quelqu’un marque');
    assert.ok(ecrites > 0, 'des lois sont réécrites');
  });

test('le bot replanifie à la manche suivante (sa mémoire survit, pas le compteur de pas)', () => {
  const mem = memoireBot();
  mem.jusqua = 5010;
  const suivante = monde();
  penser(suivante, 0, mem);
  assert.ok(mem.jusqua < 100, 'l’échéance périmée est abandonnée');
});

test('le bot sait remplir la condition de la Loi d’or et réécrire la loi qui le tue', () => {
  const w = monde({ n: 2, mots: [{ x: 3, y: 6, mot: 'GEANT' }] });
  jouer(w, 200);
  assert.ok(w.couronne!.porteur >= 0 || w.joueurs.some((p) => p.score > 0), 'quelqu’un est allé chercher la couronne');
  const v = monde({ n: 2, mots: [{ x: 2, y: 5, mot: 'GLISSANT' }] });
  decreter(v, 1, 'ROUGE', 'MORT');
  v.lois[2] = { ...v.lois[2], sceaux: [1e6, 1e6] }; // seule la loi qui le tue est modifiable
  v.couronne = null;
  const mem = memoireBot();
  tourner(v, 2);
  assert.ok(v.joueurs[0].mort);
  for (let i = 0; i < 300 && v.lois[1].sujet === 'ROUGE' && v.lois[1].prop === 'MORT'; i++) pas(v, { 0: penser(v, 0, mem) });
  assert.equal(v.lois[1].auteur, 0, 'le fantôme a réécrit sa condamnation');
  assert.notEqual(`${v.lois[1].sujet} ${v.lois[1].prop}`, 'ROUGE MORT');
});
