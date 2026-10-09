// Fait jouer des manches à 4 bots dans chaque arène, sans réseau, et mesure ce que les lois promettent.
//   npm run mesures                 (200 manches par arène)
//   npm run mesures -- --manches 50
// Sort en code 1 si une cible est manquée. Ces chiffres valent pour des bots :
// ils détectent un système cassé, ils ne prouvent pas que le jeu est drôle.
import { ARENES, CONFIG, creerMonde, famille, memoireBot, pas, penser, resoudre, type Entree, type Prop } from '@casse/shared';

const i = process.argv.indexOf('--manches');
const MANCHES = i > 0 ? Number(process.argv[i + 1]) : 200;
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
const s = (pas: number) => pas / CONFIG.tickHz;
let rate = false;

for (const ar of ARENES) {
  const ecrites: number[] = [], delais: number[] = [], leaders: number[] = [];
  const posees = new Set<Prop>(), duCiel = new Set<Prop>();
  let touche = 0, libre = 0, inertie = 0, mort = 0;
  let points = 0, primes = 0, pasMorts = 0, pasJoues = 0, gagnant = 0; // hors cibles : pour régler
  for (let n = 0; n < MANCHES; n++) {
    const w = creerMonde(ar, [0, 1, 2, 3], n + 1);
    const mems = w.joueurs.map(() => memoireBot());
    const prises = new Map<number, number>(); // joueur -> pas de son dernier ramassage
    let avant = w.lois.map((l) => l.prop), nEcrites = 0, changements = 0, leader = -1;
    while (w.phase !== 'fin') {
      const entrees: Record<number, Entree> = {};
      w.joueurs.forEach((p, k) => { entrees[p.id] = penser(w, p.id, mems[k]); });
      pas(w, entrees);
      for (const e of w.evts) {
        if (e.t === 'prise') prises.set(e.j, w.tick);
        if (e.t !== 'loi') continue;
        if (e.prop !== avant[e.ch]) (e.par >= 0 ? posees : duCiel).add(e.prop);
        if (e.par < 0) continue;
        nEcrites++;
        if (prises.has(e.par)) delais.push(s(w.tick - prises.get(e.par)!));
        prises.delete(e.par);
      }
      avant = w.lois.map((l) => l.prop);
      w.evts = [];
      if (w.phase === 'decompte') continue;
      for (const l of w.lois.slice(1)) { libre++; if (l.touches.length) touche++; }
      for (const l of w.lois) inertie = Math.max(inertie, s(l.age));
      for (const p of w.joueurs) { pasJoues++; if (p.mort) { pasMorts++; mort = Math.max(mort, s(p.tMort)); } }
      const tete = resoudre(w, 'LEADER');
      if (tete.length === 1 && tete[0].id !== leader) { if (leader >= 0) changements++; leader = tete[0].id; }
    }
    ecrites.push(nEcrites); leaders.push(changements);
    for (const p of w.joueurs) { points += p.score; primes += p.stats.victimes * CONFIG.points.victime; }
    gagnant += Math.max(...w.joueurs.map((p) => p.score));
  }
  const existent = [...new Set([...ar.chassis.map((c) => c.prop), ...ar.mots.map((m) => m.mot), ...ar.pioche])].filter((m): m is Prop => famille(m) === 'prop' && m !== 'POINTS');
  const jamais = existent.filter((p) => !posees.has(p));
  const lignes: [string, string, string, boolean][] = [
    ['Lois réécrites par manche (médiane)', String(mediane(ecrites)), '≥ 10', mediane(ecrites) >= 10],
    ['Ramassage → pose (médiane)', `${mediane(delais).toFixed(1)} s`, '≤ 4 s', mediane(delais) <= 4],
    ['Temps où une loi libre touche un joueur', `${Math.round((100 * touche) / libre)} %`, '≥ 50 %', touche / libre >= 0.5],
    ['Changements de leader par manche (médiane)', String(mediane(leaders)), '≥ 2', mediane(leaders) >= 2],
    ['Plus longue loi inchangée', `${inertie.toFixed(1)} s`, '≤ 40 s', inertie <= 40],
    ['Plus longue mort d’affilée', `${mort.toFixed(1)} s`, '≤ 12 s', mort <= 12],
    ['Propriétés jamais posées par un joueur', jamais.length ? `${jamais.join(', ')}${jamais.every((p) => duCiel.has(p)) ? ' (posées par le ciel)' : ''}` : 'aucune', 'aucune', !jamais.length],
  ];
  console.info(`\n${ar.nom} — ${MANCHES} manches à 4 bots`);
  for (const [nom, valeur, cible, ok] of lignes) {
    console.info(`  ${ok ? 'ok  ' : 'RATÉ'}  ${nom.padEnd(44)} ${valeur.padEnd(12)} cible ${cible}`);
    if (!ok) rate = true;
  }
  console.info(`        (pour régler : score du vainqueur ${Math.round(gagnant / MANCHES)}, dont primes de victime ${Math.round((100 * primes) / points)} % des points ; temps passé mort ${Math.round((100 * pasMorts) / pasJoues)} %)`);
}
process.exit(rate ? 1 : 0);
