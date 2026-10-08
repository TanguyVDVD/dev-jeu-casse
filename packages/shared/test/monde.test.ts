import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENES, CONFIG, creerMonde, memoireBot, pas, penser, solideEn, ticks, type Entree, type Monde } from '../src/index';
import { monde, placer, tourner, vers } from './outils';

const S = CONFIG.tickHz;
const mot = (x: number, y: number, m: any, verrou = false) => ({ x, y, mots: [m], verrou });
const en = (w: Monde, m: string) => w.blocs.find((b) => b.mot === m)!;
const evts = (w: Monde, t: string) => w.evts.filter((e) => e.t === t) as any[];

// --- blocs ----------------------------------------------------------------

test('marcher dans un bloc le pousse d’une case à la fois', () => {
  const w = monde([mot(5, 3, 'LAVE')]);
  placer(w, 0, 3.5, 3.5);
  tourner(w, 12, { 0: vers(1, 0) });
  assert.equal(en(w, 'LAVE').x, 6);
  tourner(w, 40, { 0: vers(1, 0) });
  assert.ok(en(w, 'LAVE').x > 7);
});

test('poussée en chaîne : 3 blocs oui, 4 non', () => {
  const trois = monde([mot(5, 3, 'LAVE'), mot(6, 3, 'MUR'), mot(7, 3, 'CAISSE')]);
  placer(trois, 0, 3.5, 3.5);
  tourner(trois, 12, { 0: vers(1, 0) });
  assert.deepEqual([en(trois, 'LAVE').x, en(trois, 'MUR').x, en(trois, 'CAISSE').x], [6, 7, 8]);

  const quatre = monde([mot(5, 3, 'LAVE'), mot(6, 3, 'MUR'), mot(7, 3, 'CAISSE'), mot(8, 3, 'TOUS')]);
  placer(quatre, 0, 3.5, 3.5);
  tourner(quatre, 40, { 0: vers(1, 0) });
  assert.equal(en(quatre, 'LAVE').x, 5);
});

test('un bloc verrouillé ne bouge pas et bloque la chaîne', () => {
  const w = monde([mot(5, 3, 'LAVE'), mot(6, 3, 'MUR', true)]);
  placer(w, 0, 3.5, 3.5);
  tourner(w, 40, { 0: vers(1, 0) });
  assert.deepEqual([en(w, 'LAVE').x, en(w, 'MUR').x], [5, 6]);
});

test('on ne pousse pas un bloc hors de l’arène ni dans un mur solide', () => {
  const carte = ['............', '............', '............', '.......M....', '............', '............', '............'];
  const w = monde([mot(6, 3, 'LAVE'), { x: 0, y: 0, mots: ['MUR', 'EST', 'SOLIDE'] }, mot(11, 5, 'TOUS')], carte);
  placer(w, 0, 4.5, 3.5);
  placer(w, 1, 9.5, 5.5);
  tourner(w, 40, { 0: vers(1, 0), 1: vers(1, 0) });
  assert.equal(en(w, 'LAVE').x, 6);
  assert.equal(en(w, 'TOUS').x, 11);
});

test('longer une rangée de blocs ne la pousse pas', () => {
  const w = monde([mot(3, 4, 'LAVE'), mot(4, 4, 'MUR'), mot(5, 4, 'TOUS')]);
  placer(w, 0, 3.5, 3.5);
  tourner(w, 20, { 0: vers(1, 0.6) });
  assert.deepEqual(w.blocs.map((b) => b.y), [4, 4, 4]);
  placer(w, 0, 4.5, 3.5);
  tourner(w, 20, { 0: vers(0.6, 1) });
  assert.equal(en(w, 'MUR').y, 5, 'mais appuyer franchement dessus, si');
});

test('agripper permet de décoller un bloc du bord', () => {
  const w = monde([mot(0, 3, 'LAVE')]);
  placer(w, 0, 1.4, 3.5);
  tourner(w, 2, { 0: vers(-1, 0, { agrippe: true }) });
  assert.equal(w.joueurs[0].tient, en(w, 'LAVE').id);
  tourner(w, 40, { 0: vers(1, 0, { agrippe: true }) });
  assert.ok(en(w, 'LAVE').x >= 2);
  tourner(w, 2, { 0: vers(1, 0) });
  assert.equal(w.joueurs[0].tient, -1, 'relâcher la touche lâche le bloc');
});

test('on n’agrippe pas un bloc verrouillé', () => {
  const w = monde([mot(0, 3, 'LAVE', true)]);
  placer(w, 0, 1.4, 3.5);
  tourner(w, 3, { 0: vers(-1, 0, { agrippe: true }) });
  assert.equal(w.joueurs[0].tient, -1);
});

// --- dash -----------------------------------------------------------------

test('le dash étourdit 0,5 s et fait lâcher prise', () => {
  const w = monde([mot(5, 3, 'LAVE')]);
  placer(w, 1, 4.6, 3.5);
  placer(w, 0, 3.4, 3.5);
  w.joueurs[1].fx = 1; w.joueurs[1].fy = 0;
  tourner(w, 1, { 1: vers(0, 0, { agrippe: true }) });
  assert.equal(w.joueurs[1].tient, en(w, 'LAVE').id);
  w.joueurs[0].fx = 1; w.joueurs[0].fy = 0;
  pas(w, { 0: vers(1, 0, { dash: true }), 1: vers(0, 0, { agrippe: true }) });
  tourner(w, 2, { 1: vers(0, 0, { agrippe: true }) });
  assert.equal(w.joueurs[1].tient, -1);
  assert.ok(w.joueurs[1].etourdi > 0);
  assert.equal(evts(w, 'choc').length, 1);
  tourner(w, ticks(CONFIG.dash.etourdi));
  assert.equal(w.joueurs[1].etourdi, 0);
});

test('le dash a un temps de recharge', () => {
  const w = monde();
  placer(w, 0, 2.5, 3.5);
  tourner(w, 20, { 0: vers(1, 0, { dash: true }) });
  assert.equal(evts(w, 'dash').length, 1);
  tourner(w, ticks(CONFIG.dash.recharge), { 0: vers(-1, 0, { dash: true }) });
  assert.equal(evts(w, 'dash').length, 2);
});

// --- règles visant un joueur ----------------------------------------------

const ROUGE_MORT = { x: 4, y: 2, mots: ['ROUGE', 'EST', 'MORT'] as any };

test('une règle visant un joueur met 1 s à s’armer, avec avertissement', () => {
  const w = monde([ROUGE_MORT]);
  tourner(w, 1);
  assert.deepEqual(evts(w, 'arme'), [{ t: 'arme', j: 0, prop: 'MORT' }]);
  tourner(w, S - 2);
  assert.equal(w.joueurs[0].mort, false);
  tourner(w, 3);
  assert.equal(w.joueurs[0].mort, true);
});

test('un mort reste fantôme tant que la règle le vise', () => {
  const w = monde([ROUGE_MORT]);
  tourner(w, S * 8);
  assert.equal(w.joueurs[0].mort, true);
  assert.equal(w.joueurs[0].stats.morts, 1);
});

test('le fantôme casse la règle qui le tue, revient après 3 s, invulnérable 1 s', () => {
  const w = monde([ROUGE_MORT, { x: 0, y: 6, mots: ['LAVE', 'EST', 'MORT'] }], ['............', '............', '............', '............', '............', '............', '.....L......']);
  placer(w, 0, 6.5, 4.5);
  tourner(w, S + 2);
  assert.equal(w.joueurs[0].mort, true);
  tourner(w, 20, { 0: vers(0, -1) }); // pousse MORT hors de la phrase
  assert.equal(w.regles.some((r) => r.id === 'ROUGE EST MORT'), false);
  assert.equal(w.joueurs[0].stats.cassees, 1);
  tourner(w, 20);
  assert.equal(w.joueurs[0].mort, true, 'pas avant 3 s');
  tourner(w, ticks(CONFIG.joueur.respawn));
  const p = w.joueurs[0];
  assert.equal(p.mort, false);
  assert.notDeepEqual([p.x, p.y], [5.5, 6.5], 'son point d’apparition est dans la lave mortelle : il prend le suivant');
  assert.equal(evts(w, 'respawn').length, 1);
});

test('l’invulnérabilité protège de la mort pendant 1 s', () => {
  const carte = Array.from({ length: 7 }, (_, y) => (y === 4 ? 'L'.repeat(12) : '.'.repeat(12)));
  const w = monde([{ x: 0, y: 0, mots: ['LAVE', 'EST', 'MORT'] }], carte, 1);
  placer(w, 0, 6.5, 4.5);
  w.joueurs[0].invul = ticks(CONFIG.joueur.invulnerable);
  tourner(w, ticks(CONFIG.joueur.invulnerable) - 1);
  assert.equal(w.joueurs[0].mort, false);
  tourner(w, 3);
  assert.equal(w.joueurs[0].mort, true);
});

test('un fantôme ne marque pas', () => {
  const w = monde([ROUGE_MORT, { x: 0, y: 0, mots: ['TOUS', 'EST', 'GEANT'] }]);
  tourner(w, S * 3);
  assert.equal(w.joueurs[0].mort, true);
  assert.equal(w.joueurs[0].score, 0);
});

test('contraires : ROUGE EST MORT + ROUGE EST POINTS ne font rien', () => {
  const w = monde([ROUGE_MORT, { x: 4, y: 4, mots: ['ROUGE', 'EST', 'POINTS'] }]);
  tourner(w, S * 3);
  assert.equal(w.joueurs[0].mort, false);
  assert.equal(w.joueurs[0].score, 0);
});

test('LEADER change de tête : la règle se réarme sur le nouveau leader', () => {
  const w = monde([{ x: 4, y: 2, mots: ['LEADER', 'EST', 'LENT'] }]);
  tourner(w, S + 2);
  assert.deepEqual(w.joueurs.map((p) => Object.keys(p.tags).length), [0, 0, 0, 0], 'personne à 0 partout');
  w.joueurs[0].score = 5;
  tourner(w, S + 2);
  assert.equal(w.joueurs[0].tags.LENT, 0);
  w.joueurs[1].score = 9;
  tourner(w, 2);
  assert.equal(w.joueurs[0].tags.LENT, undefined);
  assert.ok(w.joueurs[1].tags.LENT! > 0, 'en cours d’armement');
});

// --- auteur ---------------------------------------------------------------

test('qui complète la phrase en est l’auteur et touche les victimes', () => {
  const w = monde([{ x: 4, y: 2, mots: ['ROUGE', 'EST'] }, mot(6, 4, 'MORT')]);
  placer(w, 1, 6.5, 6.5);
  for (let i = 0; i < 80 && !w.regles.length; i++) pas(w, { 1: vers(0, -1) });
  assert.deepEqual(w.regles.map((r) => [r.id, r.auteur]), [['ROUGE EST MORT', 1]]);
  assert.equal(w.joueurs[1].stats.creees, 1);
  tourner(w, S + 2);
  assert.equal(w.joueurs[0].mort, true);
  assert.equal(w.joueurs[1].score, CONFIG.points.victime);
  assert.equal(w.joueurs[1].stats.victimes, 1);
  assert.equal(w.regles[0].victimes, 1);
  assert.deepEqual(evts(w, 'mort'), [{ t: 'mort', j: 0, par: 1, regle: 'ROUGE EST MORT' }]);
});

test('on ne gagne rien à se tuer soi-même', () => {
  const w = monde([{ x: 4, y: 2, mots: ['ROUGE', 'EST'] }, mot(6, 4, 'MORT')]);
  placer(w, 0, 6.5, 6.5);
  for (let i = 0; i < 80 && !w.regles.length; i++) pas(w, { 0: vers(0, -1) });
  tourner(w, S + 2);
  assert.equal(w.joueurs[0].mort, true);
  assert.equal(w.joueurs[0].score, 0);
});

// --- chutes ---------------------------------------------------------------

test('un mot tombe toutes les 20 s, annoncé 2 s avant par une ombre', () => {
  const w = monde();
  w.chuteDans = ticks(CONFIG.chute.periode);
  tourner(w, ticks(CONFIG.chute.periode) - 1);
  assert.equal(w.ombres.length, 0);
  tourner(w, 1);
  assert.equal(w.ombres.length, 1);
  tourner(w, ticks(CONFIG.chute.ombre) - 1);
  assert.equal(w.blocs.length, 0);
  tourner(w, 1);
  assert.deepEqual(w.blocs.map((b) => b.mot), ['EST']);
  assert.equal(w.ombres.length, 0);
});

test('10 s sans règle POINTS : un bloc POINTS tombe', () => {
  const w = monde();
  w.disette = 0;
  tourner(w, ticks(CONFIG.chute.disette) + ticks(CONFIG.chute.ombre));
  assert.deepEqual(w.blocs.map((b) => b.mot), ['POINTS']);
});

test('pas de disette tant qu’une règle POINTS existe', () => {
  const w = monde([{ x: 0, y: 0, mots: ['LAVE', 'EST', 'POINTS'] }]);
  w.disette = 0;
  tourner(w, ticks(CONFIG.chute.disette) * 2);
  assert.equal(w.blocs.length, 3);
});

// --- manche ---------------------------------------------------------------

test('décompte puis 90 s, le plus de points gagne', () => {
  const w = creerMonde(ARENES[0], [0, 1], 7);
  assert.equal(w.phase, 'decompte');
  const x = w.joueurs[0].x;
  tourner(w, ticks(CONFIG.manche.decompte) - 1, { 0: vers(1, 0) });
  assert.equal(w.joueurs[0].x, x, 'immobile pendant le décompte');
  tourner(w, 1);
  assert.equal(w.phase, 'jeu');
  assert.equal(w.temps, ticks(CONFIG.manche.duree));
  w.joueurs[1].score = 4;
  w.temps = 3;
  tourner(w, 3);
  assert.equal(w.phase, 'fin');
  assert.equal(w.vainqueur, 1);
});

test('égalité : mort subite, le premier seul en tête gagne', () => {
  const w = monde();
  w.temps = 2;
  tourner(w, 2);
  assert.equal(w.phase, 'mortsubite');
  tourner(w, 10);
  assert.equal(w.phase, 'mortsubite');
  w.joueurs[2].score = 1;
  tourner(w, 1);
  assert.equal(w.phase, 'fin');
  assert.equal(w.vainqueur, 2);
});

test('mort subite plafonnée : tirage au sort entre ex æquo', () => {
  const w = monde();
  w.joueurs[0].score = w.joueurs[3].score = 2;
  w.temps = 1;
  tourner(w, 1 + ticks(CONFIG.manche.mortSubiteMax));
  assert.equal(w.phase, 'fin');
  assert.ok([0, 3].includes(w.vainqueur));
});

// --- arènes, déterminisme, robustesse -------------------------------------

for (const arene of ARENES)
  test(`arène ${arene.id} : valide, jouable, et 4 bots finissent la manche sans incohérence`, () => {
    const w = creerMonde(arene, [0, 1, 2, 3], 42);
    assert.ok(w.regles.some((r) => r.prop === 'POINTS'), 'il y a de quoi marquer dès le départ');
    for (const [x, y] of arene.spawns) assert.equal(solideEn(w, x, y), false);
    const mems = [0, 1, 2, 3].map(memoireBot);
    const max = ticks(CONFIG.manche.decompte + CONFIG.manche.duree + CONFIG.manche.mortSubiteMax) + 5;
    for (let i = 0; i < max && w.phase !== 'fin'; i++) {
      pas(w, Object.fromEntries(mems.map((m, id) => [id, penser(w, id, m)])));
      const cases = new Set(w.blocs.map((b) => `${b.x},${b.y}`));
      assert.equal(cases.size, w.blocs.length, 'deux blocs sur la même case');
      for (const p of w.joueurs) assert.ok(p.x > 0 && p.x < 18 && p.y > 0 && p.y < 11 && Number.isFinite(p.score), 'joueur hors arène');
      w.evts.length = 0;
    }
    assert.equal(w.phase, 'fin');
    assert.ok(w.vainqueur >= 0);
  });

test('déterministe : même graine, mêmes entrées, même monde', () => {
  const jouer = () => {
    const w = creerMonde(ARENES[0], [0, 1, 2, 3], 99);
    let g = 12345;
    const h = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 1500; i++) {
      const e: Record<number, Entree> = {};
      for (let id = 0; id < 4; id++) e[id] = { seq: i, mx: Math.round(h() * 2 - 1), my: Math.round(h() * 2 - 1), dash: h() < 0.05, agrippe: h() < 0.3 };
      pas(w, e);
    }
    return JSON.stringify(w);
  };
  assert.equal(jouer(), jouer());
});
