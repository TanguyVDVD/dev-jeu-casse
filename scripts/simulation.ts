// Quatre clients WebSocket jouent un match complet contre le vrai serveur.
//   npm run simulation                      (lance dist/serveur.cjs sur le port 8099)
//   npm run simulation -- --url wss://xxx.trycloudflare.com/ws --latence 100
// Échoue (code 1) sur : plantage, désynchronisation entre clients, mot perdu ou dupliqué, délai dépassé.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import {
  ARENES, DT, bouger, creerMonde, famille, glisser, memoireBot, penser, replique,
  type Entree, type Joueur, type MessageClient, type MessageServeur, type Monde,
} from '@casse/shared';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > 0 ? process.argv[i + 1] : undefined; };
const LATENCE = Number(arg('latence') ?? 0); // aller-retour simulé, en ms
const PORT = 8099;
const url = arg('url') ?? `ws://127.0.0.1:${PORT}/ws`;
const serveur = arg('url') ? null : spawn(process.execPath, ['dist/serveur.cjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'inherit' });

const echec = (raison: string): never => { console.error(`ÉCHEC : ${raison}`); serveur?.kill(); process.exit(1); };
const delai = setTimeout(() => echec('délai de 20 minutes dépassé'), 20 * 60_000);
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Empreintes de l'état par pas : les quatre clients doivent voir exactement le même monde. */
const empreintes = new Map<number, { hash: string; vus: number }>();
const bilan = { instantanes: 0, manches: 0, lois: 0, morts: 0, erreurPrediction: 0, erreurMax: 0, corrections: 0, gestes: 0, annules: 0 };

class Client {
  ws!: WebSocket;
  moi = -1;
  w?: Monde;
  pred?: Joueur;
  attente: Entree[] = [];
  mem = memoireBot();
  recopier = replique();
  /** gestes prédits en attente d'accusé : numéro d'entrée -> mot que je pensais porter ensuite */
  gestes = new Map<number, string | null>();
  dernierSeq = 0;
  code = '';
  constructor(readonly nom: string) {}

  envoyer(m: MessageClient): void { setTimeout(() => this.ws.readyState === WebSocket.OPEN && this.ws.send(JSON.stringify(m)), LATENCE / 2); }

  async ouvrir(): Promise<void> {
    this.ws = new WebSocket(url);
    this.ws.on('message', (d) => setTimeout(() => this.recevoir(JSON.parse(d.toString())), LATENCE / 2));
    this.ws.on('close', () => { if (!fini) echec(`${this.nom} : connexion fermée en cours de match`); });
    this.ws.on('error', (e) => echec(`${this.nom} : ${e.message}`));
    await new Promise((r) => this.ws.once('open', r));
  }

  recevoir(m: MessageServeur): void {
    if (m.t === 'bienvenue') { this.code = m.code; this.moi = m.moi; }
    else if (m.t === 'salon') this.moi = m.moi;
    else if (m.t === 'erreur') echec(`${this.nom} : erreur serveur « ${m.msg} »`);
    else if (m.t === 'manche') {
      this.w = creerMonde(ARENES.find((a) => a.id === m.arene)!, m.ids, 0);
      this.recopier = replique(); this.gestes.clear();
      this.pred = undefined; this.attente = []; this.dernierSeq = 0; // nouveau monde : les accusés repartent de zéro
      if (this.moi === 0) { bilan.manches++; console.info(`manche ${m.numero} — ${m.arene} — manches ${m.manches.join('/')}`); }
    } else if (m.t === 's' && this.w) {
      this.recopier(this.w, m);
      const w = this.w;
      bilan.instantanes++;
      // 1. aucun mot perdu ni dupliqué : un exemplaire de chaque, deux pour les choses, et toutes les couleurs
      const mots = [...w.lois.flatMap((l) => [l.sujet, l.prop]), ...w.mots.map((k) => k.mot), ...w.joueurs.flatMap((j) => j.porte ?? [])].filter((k) => k !== 'POINTS');
      for (const k of new Set(mots)) if (mots.filter((x) => x === k).length > (famille(k) === 'chose' ? 2 : 1)) echec(`${this.nom} : mot dupliqué ${k} au pas ${m.k}`);
      if (mots.filter((k) => famille(k) === 'couleur').length !== 4) echec(`${this.nom} : couleur perdue au pas ${m.k}`);
      // 2. tous les clients voient le même état au même pas
      const hash = JSON.stringify([m.ph, m.tp, m.j.map((j) => [j.id, j.x, j.y, j.score, j.mort, j.porte]), m.l.map((l) => [l.sujet, l.prop, l.arme, l.auteur]), m.c, w.mots.map((k) => [k.id, k.x, k.y]), w.caisses]);
      const e = empreintes.get(m.k) ?? { hash, vus: 0 };
      if (e.hash !== hash) echec(`${this.nom} : état divergent au pas ${m.k}`);
      if (++e.vus === 4) empreintes.delete(m.k); else empreintes.set(m.k, e);
      // 3. réconciliation, comme le vrai client, et mesure de l'écart de prédiction
      const i = this.w.joueurs.findIndex((j) => j.id === this.moi);
      const srv = this.w.joueurs[i];
      if (srv.seq < this.dernierSeq) echec(`${this.nom} : accusé de réception qui recule`);
      this.dernierSeq = srv.seq;
      const avant = this.pred;
      this.pred = structuredClone(srv);
      this.w.joueurs[i] = this.pred;
      this.attente = this.attente.filter((x) => x.seq > srv.seq);
      // un geste prédit que le serveur a traité : l'a-t-il confirmé, ou faut-il l'annuler ?
      for (const [seq, porte] of this.gestes) {
        if (seq > srv.seq) continue;
        this.gestes.delete(seq);
        bilan.gestes++;
        if (porte !== srv.porte) bilan.annules++;
      }
      const enJeu = m.ph === 'jeu' || m.ph === 'mortsubite';
      if (enJeu) for (const x of this.attente) { bouger(this.w, this.pred, x, false); glisser(this.w); }
      this.w.evts = [];
      if (avant && enJeu) {
        const err = Math.hypot(avant.x - this.pred.x, avant.y - this.pred.y);
        bilan.erreurPrediction += err; bilan.corrections++;
        bilan.erreurMax = Math.max(bilan.erreurMax, err);
      }
      if (this.moi === 0) for (const ev of m.e) { if (ev.t === 'loi') bilan.lois++; if (ev.t === 'mort') bilan.morts++; }
    } else if (m.t === 'fin' && this.moi === 0) terminer(m);
  }

  /** 30 fois par seconde : joue comme un bot, prédit, envoie. */
  jouer(): void {
    const w = this.w;
    if (!w || !this.pred || (w.phase !== 'jeu' && w.phase !== 'mortsubite')) return;
    const e = penser(w, this.moi, this.mem);
    e.mx = Math.round(e.mx * 100) / 100; e.my = Math.round(e.my * 100) / 100;
    const portait = this.pred.porte;
    bouger(w, this.pred, e, false);
    glisser(w);
    w.evts = [];
    if (this.pred.porte !== portait) this.gestes.set(e.seq, this.pred.porte);
    this.attente.push(e);
    this.envoyer({ t: 'i', s: e.seq, mx: e.mx, my: e.my, d: e.dash, a: e.action });
    if (Math.random() < 0.002) this.envoyer({ t: 'emote', n: Math.floor(Math.random() * 4) });
  }
}

let fini = false;
function terminer(m: Extract<MessageServeur, { t: 'fin' }>): void {
  fini = true;
  clearTimeout(delai);
  const moyenne = bilan.erreurPrediction / Math.max(1, bilan.corrections);
  console.info(`\nMATCH TERMINÉ — vainqueur : couleur ${m.vainqueur}, manches ${m.manches.join('/')}`);
  console.info(`${bilan.manches} manches, ${bilan.instantanes} instantanés reçus, ${bilan.lois} lois écrites, ${bilan.morts} morts`);
  console.info(`titres : ${m.titres.map((t) => `${t.titre} (${t.c})`).join(', ')}`);
  console.info(`latence simulée ${LATENCE} ms — écart de prédiction moyen ${moyenne.toFixed(3)} case, max ${bilan.erreurMax.toFixed(2)}`);
  console.info(`gestes prédits (ramasser, poser, lancer) : ${bilan.gestes}, dont ${bilan.annules} annulés par le serveur`);
  console.info('Aucune désynchronisation, aucun plantage.');
  serveur?.kill();
  process.exit(0);
}

async function main(): Promise<void> {
  if (serveur) await attendre(800);
  const clients = ['Ana', 'Bob', 'Cléo', 'Dan'].map((n) => new Client(n));
  await clients[0].ouvrir();
  clients[0].envoyer({ t: 'creer', pseudo: 'Ana' });
  while (!clients[0].code) await attendre(20);
  for (const c of clients.slice(1)) {
    await c.ouvrir();
    c.envoyer({ t: 'rejoindre', code: clients[0].code, pseudo: c.nom });
    while (c.moi < 0) await attendre(20);
    c.envoyer({ t: 'pret', v: true });
  }
  await attendre(200 + LATENCE);
  console.info(`salon ${clients[0].code} : 4 joueurs, lancement (latence simulée ${LATENCE} ms)`);
  clients[0].envoyer({ t: 'lancer' });
  setInterval(() => clients.forEach((c) => c.jouer()), DT * 1000);
}
main().catch((e) => echec(String(e)));
