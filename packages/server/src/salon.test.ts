import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG, statsVides, validerMessage, type MessageServeur } from '@casse/shared';
import { Salons, attribuerTitres, type Salon } from './salon';

function client(salon: Salon, pseudo: string, jeton?: string) {
  const recus: MessageServeur[] = [];
  const lien = { envoyer: (brut: string) => { recus.push(JSON.parse(brut)); } };
  const membre = salon.entrer(lien, pseudo, jeton);
  const dernier = <T extends MessageServeur['t']>(t: T) => [...recus].reverse().find((m) => m.t === t) as Extract<MessageServeur, { t: T }> | undefined;
  return { membre, recus, dernier };
}
const ok = (c: ReturnType<typeof client>) => { assert.notEqual(typeof c.membre, 'string'); return c.membre as Exclude<typeof c.membre, string>; };

test('validation : tout message inattendu est rejeté', () => {
  for (const m of [null, 42, 'x', {}, { t: 'inconnu' }, { t: 'i', s: 1, mx: 2, my: 0, d: false, a: false }, { t: 'i', s: 1, mx: NaN, my: 0, d: false, a: false },
    { t: 'i', s: -1, mx: 0, my: 0, d: false, a: false }, { t: 'i', s: 1, mx: 0, my: 0, d: 1, a: false }, { t: 'couleur', c: 4 }, { t: 'couleur', c: 1.5 },
    { t: 'rejoindre', code: 'abcd', pseudo: 'x' }, { t: 'rejoindre', code: 'ABCDE', pseudo: 'x' }, { t: 'creer', pseudo: '   ' }, { t: 'creer', pseudo: 7 }, { t: 'emote', n: 9 }, { t: 'bot', n: 5 }])
    assert.equal(validerMessage(m), null, JSON.stringify(m));
  assert.deepEqual(validerMessage({ t: 'creer', pseudo: '  <b>Zoé</b>\u0007 une très longue signature ' }), { t: 'creer', pseudo: 'bZoé/b une t' });
  assert.deepEqual(validerMessage({ t: 'i', s: 3, mx: -1, my: 0.5, d: true, a: false, extra: 'ignoré' }), { t: 'i', s: 3, mx: -1, my: 0.5, d: true, a: false });
});

test('salon : codes, couleurs distinctes, 4 places, hôte', () => {
  const salons = new Salons();
  const s = salons.creer()!;
  assert.match(s.code, /^[A-Z]{4}$/);
  const a = client(s, 'Ana'), b = client(s, 'Bob');
  assert.deepEqual([ok(a).c, ok(b).c], [0, 1]);
  s.recevoir(ok(b), { t: 'couleur', c: 0 });
  assert.equal(ok(b).c, 1, 'couleur déjà prise');
  s.recevoir(ok(b), { t: 'couleur', c: 3 });
  assert.equal(ok(b).c, 3);
  const places = b.dernier('salon')!.etat.places;
  assert.deepEqual(places.map((p) => [p.pseudo, p.hote]), [['Ana', true], ['Bob', false]]);
  client(s, 'Cléo'); client(s, 'Dan');
  assert.equal(client(s, 'Eve').membre, 'Ce salon est complet.');
});

test('salon : seul l’hôte lance, à 2 minimum, quand tout le monde est prêt', () => {
  const s = new Salons().creer()!;
  const a = client(s, 'Ana');
  s.recevoir(ok(a), { t: 'lancer' });
  assert.equal(s.phase, 'salon', 'seul');
  const b = client(s, 'Bob');
  s.recevoir(ok(b), { t: 'lancer' });
  assert.equal(s.phase, 'salon', 'pas l’hôte');
  s.recevoir(ok(a), { t: 'lancer' });
  assert.equal(s.phase, 'salon');
  assert.match(a.dernier('erreur')!.msg, /Bob/);
  s.recevoir(ok(b), { t: 'pret', v: true });
  s.recevoir(ok(a), { t: 'lancer' });
  assert.equal(s.phase, 'match');
  assert.equal(a.dernier('manche')!.numero, 1);
  assert.equal(client(s, 'Tard').membre, 'Partie en cours : revenez à la fin du match.');
});

test('salon : l’hôte qui part passe la main ; un salon vide disparaît', () => {
  const salons = new Salons();
  const s = salons.creer()!;
  const a = client(s, 'Ana'), b = client(s, 'Bob');
  s.sortir(ok(a));
  assert.deepEqual(b.dernier('salon')!.etat.places.map((p) => [p.pseudo, p.hote]), [['Bob', true]]);
  s.sortir(ok(b));
  salons.tick();
  assert.equal(salons.nombre, 0);
});

test('nombre de salons limité', () => {
  const salons = new Salons();
  for (let i = 0; i < CONFIG.salon.max; i++) assert.ok(salons.creer());
  assert.equal(salons.creer(), null);
});

test('reconnexion en cours de match : même place, instantané complet', () => {
  const s = new Salons().creer()!;
  const a = client(s, 'Ana'), b = client(s, 'Bob');
  s.recevoir(ok(b), { t: 'pret', v: true });
  s.recevoir(ok(a), { t: 'lancer' });
  for (let i = 0; i < 10; i++) s.tick();
  const jeton = ok(b).jeton;
  s.sortir(ok(b));
  for (let i = 0; i < 10; i++) s.tick();
  assert.equal(s.phase, 'match', 'la place est gardée');
  const b2 = client(s, 'Bob', jeton);
  assert.equal(ok(b2).c, 1);
  assert.equal(b2.dernier('manche')!.arene, 'marbre');
  s.tick();
  assert.ok(b2.dernier('s')!.m, 'les mots sont renvoyés');
});

test('place expirée : un joueur seul en match renvoie tout le monde au salon', () => {
  const s = new Salons().creer()!;
  const a = client(s, 'Ana'), b = client(s, 'Bob');
  s.recevoir(ok(b), { t: 'pret', v: true });
  s.recevoir(ok(a), { t: 'lancer' });
  s.sortir(ok(b));
  s.tick();
  assert.equal(s.phase, 'match');
  ok(b).parti = 0; // comme si 60 s étaient passées
  s.tick();
  assert.equal(s.phase, 'salon');
  assert.equal(s.membres.length, 1);
});

test('match complet contre 3 bots : manches, fin, titres, tableau des victoires, revanche', () => {
  const s = new Salons().creer()!;
  const a = client(s, 'Ana');
  for (let i = 0; i < 3; i++) s.recevoir(ok(a), { t: 'bot', n: 1 });
  s.recevoir(ok(a), { t: 'lancer' });
  let seq = 0;
  for (let i = 0; i < 40000 && s.phase === 'match'; i++) {
    s.recevoir(ok(a), { t: 'i', s: ++seq, mx: Math.sin(i / 40), my: Math.cos(i / 55), d: i % 70 === 0, a: i % 45 === 0 });
    s.tick();
    if (a.recus.length > 500) { // on ne garde que le dernier instantané
      const der = a.recus.map((m) => m.t).lastIndexOf('s');
      const garde = a.recus.filter((m, k) => m.t !== 's' || k === der);
      a.recus.length = 0; a.recus.push(...garde);
    }
  }
  assert.equal(s.phase, 'fin');
  const fin = a.dernier('fin')!;
  assert.equal(Math.max(...fin.manches), CONFIG.manche.aGagner);
  assert.equal(fin.manches[fin.vainqueur], CONFIG.manche.aGagner);
  assert.ok(fin.titres.length > 0);
  assert.equal(a.dernier('s')!.j[0].seq > 0, true, 'les entrées sont accusées');
  assert.equal(a.dernier('salon')!.etat.places.reduce((n, p) => n + p.victoires, 0), 1);
  s.recevoir(ok(a), { t: 'lancer' });
  assert.equal(s.phase, 'match', 'revanche immédiate');
  assert.deepEqual(s.manches, [0, 0, 0, 0]);
});

test('titres : un titre par statistique non nulle', () => {
  const t = attribuerTitres({ 0: { ...statsVides(), ecrites: 4, morts: 1 }, 2: { ...statsVides(), morts: 6 } });
  assert.deepEqual(t.map((x) => [x.c, x.titre]), [[0, 'Le Législateur'], [2, 'Le Paillasson']]);
});
